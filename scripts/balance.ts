/**
 * Automated playtest: a bot plays the whole campaign the way a casual player would
 * (auto squads + auto commander, spends gold on refills/upgrades/squads, replays when stuck).
 * Usage: npx tsx scripts/balance.ts [seed=1] [difficulty=normal] [maxBattles=40]
 * Prints one JSON line per battle and a summary. Deterministic for a given seed.
 */
import { SQUAD_TYPES, type SquadTypeId } from '../src/sim/defs';
import { RNG } from '../src/sim/rng';
import { STAGES, type StageDef } from '../src/sim/stages';
import { BATTLE_HARD_CAP, World } from '../src/sim/world';
import { newSave, type SaveData } from '../src/meta/save';
import {
  UPGRADES,
  applyBattle,
  battleConfig,
  buySquad,
  buyUpgrade,
  defaultLineup,
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

const rng = new RNG(seed * 99991);
const save: SaveData = newSave(0);
save.settings.difficulty = difficulty;
save.settings.autoCommand = autoCmd;

function shop(s: SaveData, st: StageDef) {
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
  // 3) upgrades, cheapest first among a priority set, keep a reserve for refills
  for (let k = 0; k < 20; k++) {
    const opts = UPGRADES.filter((u) => (s.upgrades[u.id] ?? 0) < u.max)
      .map((u) => ({ u, c: upgradeCost(u, s.upgrades[u.id] ?? 0) }))
      .sort((a, b) => a.c - b.c);
    if (!opts.length || s.gold - opts[0].c < 120) break;
    buyUpgrade(s, opts[0].u.id);
  }
}

function play(st: StageDef, battleSeed: number) {
  shop(save, st);
  const lineup = defaultLineup(save, st);
  const cfg = battleConfig(save, st, lineup, {}, battleSeed);
  const w = new World(cfg);
  w.start();
  const t0 = Date.now();
  while ((w.state === 'battle' || w.state === 'intermission') && w.t < BATTLE_HARD_CAP + 60) w.step();
  if (!w.result) w.surrender();
  const res = w.result!;
  const rw = applyBattle(save, st, res, 'campaign', new Date(2027, 0, 1 + save.stats.battles));
  const up = Object.values(save.upgrades).reduce((a, b) => a + b, 0);
  console.log(
    JSON.stringify({
      stage: st.id,
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
    won = play(st, rng.int(1, 1e9));
    battles++;
    if (!won && attempts[st.id] % 2 === 0 && st.index > 1) {
      // farm the previous stage once (as a stuck player would)
      play(STAGES[st.index - 2], rng.int(1, 1e9));
      battles++;
    }
  }
  if (!won) break;
}
console.log('SUMMARY', JSON.stringify({ seed, difficulty, autoCmd, battles, attempts, gold: save.gold, upgrades: save.upgrades, roster: save.roster.map((r) => `${r.type}:${r.soldiers.length}`).join(',') }));
