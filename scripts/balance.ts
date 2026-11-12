/**
 * Automated playtest: a bot plays the whole campaign the way a casual player would
 * (auto squads + auto commander, spends gold on refills/upgrades/squads/supplies, replays when stuck).
 * Usage: npx tsx scripts/balance.ts [seed=1] [difficulty=normal] [maxBattles=40] [auto|manual] [endlessRuns=0]
 *   auto   = auto squads + auto commander (abilities and the war council between waves)
 *   manual = auto squads only: no commander abilities, no council picks
 *   endlessRuns > 0: after a finished campaign the final army plays that many endless sieges (auto commander)
 * Prints one JSON line per battle and a summary. Deterministic for a given seed.
 */
import { SQUAD_TYPES, type SquadTypeId } from '../src/sim/defs';
import { RNG } from '../src/sim/rng';
import { STAGES, endlessStage, type StageDef, type Supplies } from '../src/sim/stages';
import { BATTLE_HARD_CAP, World } from '../src/sim/world';
import { newSave, type SaveData } from '../src/meta/save';
import {
  SQUAD_PRICE,
  SUPPLY_PRICE,
  UPGRADES,
  applyBattle,
  baseSupplies,
  battleConfig,
  buySquad,
  buyUpgrade,
  defaultLineup,
  foodNeeded,
  lineupSoldiers,
  readyCount,
  refillSquad,
  squadCap,
  treatSquad,
  unlockedTypes,
  upgradeCost,
} from '../src/meta/progression';

declare const process: { argv: string[] };
const seed = Number(process.argv[2] ?? 1);
const difficulty = (process.argv[3] ?? 'normal') as 'easy' | 'normal' | 'hard';
const maxBattles = Number(process.argv[4] ?? 40);
const autoCmd = (process.argv[5] ?? 'auto') === 'auto';
const endlessRuns = Number(process.argv[6] ?? 0);

const rng = new RNG(seed * 99991);
const save: SaveData = newSave(0);
save.settings.difficulty = difficulty;
save.settings.autoCommand = autoCmd;

/** gold kept back for supplies and refills when buying research */
const RESERVE = 120;
let goldOnResearch = 0;
let goldOnSupplies = 0;
let goldOnRoster = 0;

function shop(s: SaveData, st: StageDef) {
  const g0 = s.gold;
  // 1) refill & treat squads that will fight
  for (const r of s.roster) {
    refillSquad(s, r);
    if (readyCount(r) < SQUAD_TYPES[r.type].size * 0.7) treatSquad(s, r);
  }
  // 2) make sure we have enough squads for the cap, preferring a balanced army
  const cap = squadCap(s, st);
  const want: SquadTypeId[] = ['archer', 'spear', 'engineer', 'xbow', 'surgeon', 'ballista', 'sword', 'knight', 'archer', 'xbow', 'spear'];
  for (const t of want) {
    if (s.roster.length >= cap) break;
    const have = s.roster.filter((r) => r.type === t).length;
    const need = want.filter((x) => x === t).length;
    if (have < need && unlockedTypes(s).includes(t)) buySquad(s, t);
  }
  // a field surgeon once they can be hired (free unlocks otherwise fill the barracks before the bot buys one)
  if (unlockedTypes(s).includes('surgeon') && !s.roster.some((r) => r.type === 'surgeon') && s.gold >= SQUAD_PRICE.surgeon + RESERVE) buySquad(s, 'surgeon');
  goldOnRoster += g0 - s.gold;
  // 3) upgrades, cheapest first among a priority set, keep a reserve for refills
  for (let k = 0; k < 20; k++) {
    const opts = UPGRADES.filter((u) => (s.upgrades[u.id] ?? 0) < u.max)
      .map((u) => ({ u, c: upgradeCost(u, s.upgrades[u.id] ?? 0) }))
      .sort((a, b) => a.c - b.c);
    if (!opts.length || s.gold - opts[0].c < RESERVE) break;
    if (buyUpgrade(s, opts[0].u.id) === null) goldOnResearch += opts[0].c;
  }
}

/**
 * Supply packs a sensible player buys: enough food for the forecast shown on the pre-battle screen,
 * and, when retrying a stage, an extra pack of arrows and of medicine.
 */
function buySupplies(s: SaveData, st: StageDef, lineup: string[], attempt: number): Partial<Supplies> {
  const extra: Partial<Supplies> = {};
  const buy = (k: keyof Supplies, packs: number) => {
    const pr = SUPPLY_PRICE[k];
    for (let i = 0; i < packs && s.gold >= pr.pack; i++) {
      s.gold -= pr.pack;
      goldOnSupplies += pr.pack;
      extra[k] = (extra[k] ?? 0) + pr.per;
    }
  };
  const base = baseSupplies(s, st);
  const short = foodNeeded(st, lineupSoldiers(s, lineup)) - base.food;
  if (short > 0) buy('food', Math.min(3, Math.ceil(short / SUPPLY_PRICE.food.per)));
  if (attempt >= 2) {
    buy('arrows', 1);
    buy('meds', 1);
  }
  return extra;
}

function play(st: StageDef, battleSeed: number, attempt: number | 'farm') {
  shop(save, st);
  const lineup = defaultLineup(save, st);
  const extra = buySupplies(save, st, lineup, attempt === 'farm' ? 1 : attempt);
  const cfg = battleConfig(save, st, lineup, extra, battleSeed);
  const w = new World(cfg);
  w.start();
  const t0 = Date.now();
  const evc: Record<string, number> = {};
  const council: string[] = [];
  const edges: string[] = [];
  let lastWave = -1;
  while ((w.state === 'battle' || w.state === 'intermission') && w.t < BATTLE_HARD_CAP + 60) {
    w.step();
    if (w.waveIdx !== lastWave && w.state === 'battle') {
      lastWave = w.waveIdx;
      edges.push(w.nextWaveEdges().join(''));
    }
    for (const e of w.events.splice(0)) {
      evc[e.type] = (evc[e.type] ?? 0) + 1;
      if (e.type === 'council') council.push(w.councilPick ?? '?');
    }
  }
  if (!w.result) w.surrender();
  const res = w.result!;
  const rw = applyBattle(save, st, res, 'campaign', new Date(2027, 0, 1 + save.stats.battles));
  const up = Object.values(save.upgrades).reduce((a, b) => a + b, 0);
  console.log(
    JSON.stringify({
      stage: st.id,
      try: attempt,
      won: res.won,
      stars: res.stars,
      waves: `${res.wavesCleared}/${res.totalWaves}`,
      keep: +res.keepPct.toFixed(2),
      dead: res.dead,
      wounded: res.wounded,
      deployed: res.deployed,
      kills: res.kills,
      t: Math.round(res.time),
      gold: save.gold,
      earned: rw.gold,
      upLv: up,
      squads: lineup.length,
      food: Math.round(w.supplies.food),
      arrows: Math.round(w.supplies.arrows),
      meds: Math.round(w.supplies.meds),
      mats: Math.round(w.supplies.mats),
      // used = what came in (start + recovered + council) minus what is left
      use: {
        a: Math.round(w.arrowsIn - w.supplies.arrows),
        f: Math.round(w.startSupplies.food + (w.councilLog.filter((c) => c === 'forage').length ? w.councilAmt.forage ?? 0 : 0) - w.supplies.food),
        m: Math.round(w.startSupplies.meds - w.supplies.meds),
        t: Math.round(w.startSupplies.mats - w.supplies.mats),
      },
      start: w.startSupplies,
      extra,
      starve: evc.starving ?? 0,
      noArrows: evc.noarrows ?? 0,
      noMeds: evc.nomeds ?? 0,
      council,
      edges,
      ms: Date.now() - t0,
    }),
  );
  return res.won;
}

let battles = 0;
const attempts: Record<string, number> = {};
for (const st of STAGES) {
  let won = false;
  while (!won && battles < maxBattles) {
    attempts[st.id] = (attempts[st.id] ?? 0) + 1;
    won = play(st, rng.int(1, 1e9), attempts[st.id]);
    battles++;
    if (!won && attempts[st.id] % 2 === 0 && st.index > 1) {
      // farm the previous stage once (as a stuck player would)
      play(STAGES[st.index - 2], rng.int(1, 1e9), 'farm');
      battles++;
    }
  }
  if (!won) break;
}
const done = STAGES.every((st) => (save.stars[st.id] ?? 0) > 0);
// endless: the campaign's final army (refilled, with its research) holds as many waves as it can
const endless: number[] = [];
if (done)
  for (let k = 0; k < endlessRuns; k++) {
    const st = endlessStage(seed * 31 + k);
    shop(save, st);
    const lineup = defaultLineup(save, st);
    const s2: SaveData = structuredClone(save);
    s2.settings.autoCommand = true;
    const w = new World(battleConfig(s2, st, lineup, {}, rng.int(1, 1e9)));
    w.start();
    while ((w.state === 'battle' || w.state === 'intermission') && w.t < 20000) {
      w.step();
      w.events.length = 0;
    }
    const waves = w.result ? w.result.wavesCleared : w.waveCleared;
    endless.push(waves);
    console.log(JSON.stringify({ stage: 'endless', castle: st.subtitle.split(' · ')[0], waves, t: Math.round(w.t), food: Math.round(w.supplies.food), arrows: Math.round(w.supplies.arrows), mats: Math.round(w.supplies.mats) }));
  }
console.log(
  'SUMMARY',
  JSON.stringify({
    seed,
    difficulty,
    autoCmd,
    done,
    battles,
    attempts,
    gold: save.gold,
    goldOnResearch,
    goldOnSupplies,
    goldOnRoster,
    upgrades: save.upgrades,
    roster: save.roster.map((r) => `${r.type}:${r.soldiers.length}`).join(','),
    endless,
  }),
);
