import { describe, expect, it } from 'vitest';
import { STAGES, dailyChallenge, endlessStage, type StageDef } from '../src/sim/stages';
import { World, type BattleConfig } from '../src/sim/world';
import { memoryKV, newSave, newSquad, type SaveData } from '../src/meta/save';
import { battleConfig, defaultLineup } from '../src/meta/progression';
import {
  BattleRecorder,
  RESUME_KEY,
  clearRecord,
  loadRecord,
  replay,
  resolveStage,
  saveRecord,
  stageRefFor,
  stageSig,
  storableCfg,
  type BattleRecord,
  type RecordBase,
  type StageRef,
} from '../src/ui/resume';
import { Charges } from '../src/ui/orders';
import { settleBattle } from '../src/ui/prebattle';
import { RESUME_VER } from '../src/ui/version';

/** Everything that matters about a battle state, down to the RNG. */
function fingerprint(w: World) {
  let h = 0;
  for (const u of w.units) h = (h * 31 + Math.round(u.x * 100) * 7 + Math.round(u.y * 100) * 13 + Math.round(u.hp * 100) + u.state * 17 + (u.fleeing ? 5 : 0)) | 0;
  let gh = 0;
  for (let i = 0; i < w.grid.n; i++) gh = (gh * 31 + w.grid.tiles[i] * 7 + Math.round(w.grid.hp[i] * 10)) | 0;
  return {
    t: Math.round(w.t * 1000),
    state: w.state,
    wave: w.waveIdx,
    units: w.units.length,
    h,
    gh,
    rng: (w.rng as any).s,
    keep: Math.round(w.keepHp * 100),
    sup: { ...w.supplies },
    squads: w.squads.map((q) => ({ st: q.stance, auto: q.auto, focus: q.focus?.id ?? -1, dest: q.destTile, home: q.homeTile, mor: Math.round(q.morale * 100), alive: q.alive })),
    stats: { ...w.stats },
    abil: Object.values(w.abilities).map((a) => Math.round(a.cd * 1000)),
  };
}

function saveWithArmy(): SaveData {
  const s = newSave(1);
  for (const t of ['xbow', 'engineer', 'surgeon', 'knight'] as const) s.roster.push(newSquad(s, t));
  return s;
}

function base(st: StageDef, cfg: BattleConfig, ref: StageRef, w: World, extra = {}): RecordBase {
  return { ver: RESUME_VER, id: 'b-test', mode: ref.kind, ref, cfg: storableCfg(cfg), lineup: cfg.squads.map((q) => q.rosterId), extra, sig: stageSig(w), name: st.name };
}

/** Same round trip as the app: JSON into the KV store and back through the validating loader. */
function roundTrip(rec: BattleRecord): BattleRecord {
  const kv = memoryKV();
  expect(saveRecord(kv, rec)).toBe(true);
  const back = loadRecord(kv, RESUME_VER);
  expect(back).not.toBeNull();
  return back!;
}

/** What the app does on "이어하기": rebuild the stage from the reference, then replay. */
async function rebuild(rec: BattleRecord): Promise<World> {
  const stage = resolveStage(rec.ref)!;
  expect(stage).toBeTruthy();
  const w = new World({ ...JSON.parse(JSON.stringify(rec.cfg)), stage });
  expect(stageSig(w)).toBe(rec.sig);
  await replay(w, rec);
  return w;
}

/**
 * A scripted player: orders at fixed steps (decided from the world state, so equal worlds get equal
 * orders), melee charges through the same Charges bookkeeping the battle screen uses, checked every step.
 */
function act(w: World, ch: Charges, k: number) {
  const g = w.grid;
  if (k === 0) {
    const t = g.nearestTile(Math.floor(g.keepY / 16) * 60 + Math.floor((g.keepX - 40) / 16), (j) => g.deployable(j), 10);
    w.placeSquad(w.squads[0], t);
  }
  if (k === 10) w.start();
  if (k === 200) w.commandStance(w.squads[1], 'hold');
  if (k === 400) w.commandMove(w.squads[0], g.keepX - 48, g.keepY);
  if (k > 300 && k % 240 === 0) {
    // charge the nearest enemy with a melee squad (the battle screen's tap-on-enemy order)
    const sq = w.squads.find((q) => !q.type.ranged && q.alive > 0 && q.type.id !== 'surgeon' && q.type.id !== 'engineer');
    let best = null as (typeof w.activeEnemies)[number] | null;
    let bd = Infinity;
    if (sq) for (const e of w.activeEnemies) if (!e.fleeing && Math.hypot(e.x - sq.cx, e.y - sq.cy) < bd) ((bd = Math.hypot(e.x - sq.cx, e.y - sq.cy)), (best = e));
    if (sq && best) ch.start(w, sq, best);
  }
  if (k === 900 && w.state !== 'deploy') w.useAbility('rally', g.keepX, g.keepY);
  if (k === 1300) w.preset('holdAll');
  if (k === 1700) w.preset('allAuto');
  if (k === 2000) w.commandRetreat(w.squads[2]);
  if (k === 2300) w.commandAuto(w.squads[2], true);
  if (w.state === 'intermission' && k % 100 === 50) w.skipIntermission();
  const ranged = w.squads.find((q) => q.type.ranged && q.alive > 0);
  if (k % 500 === 250 && ranged && w.activeEnemies[0]) w.commandFocus(ranged, w.activeEnemies[0]);
  ch.check(w);
}

function run(w: World, ch: Charges, from: number, to: number) {
  for (let k = from; k < to; k++) {
    act(w, ch, k);
    w.step();
  }
}

function setup(stageIdx = 2, seed = 4242, extra = {}) {
  const s = saveWithArmy();
  const st = STAGES[stageIdx];
  const cfg = battleConfig(s, st, defaultLineup(s, st), extra, seed);
  return { s, st, cfg, ref: stageRefFor('campaign', st, seed)! };
}

function stageData(st: StageDef) {
  const d: Record<string, unknown> = { ...st };
  delete d.build;
  return JSON.parse(JSON.stringify(d));
}

/** Build two worlds from the original stage and from the reference; they must be the same battle. */
function expectSameBattle(orig: StageDef, ref: StageRef, cfgOf: (st: StageDef) => BattleConfig) {
  const again = resolveStage(JSON.parse(JSON.stringify(ref)))!;
  expect(again).toBeTruthy();
  expect(stageData(again)).toEqual(stageData(orig));
  const a = new World(cfgOf(orig));
  const b = new World(cfgOf(again));
  expect(stageSig(b)).toBe(stageSig(a));
  for (const w of [a, b]) {
    w.start();
    for (let i = 0; i < 30 * 40; i++) w.step();
  }
  expect(fingerprint(b)).toEqual(fingerprint(a));
}

describe('stage references rebuild the identical stage', () => {
  const s = saveWithArmy();
  it('campaign: every stage', () => {
    for (const st of STAGES) {
      const ref = stageRefFor('campaign', st, 99)!;
      expect(ref).toEqual({ kind: 'campaign', id: st.id });
      expect(resolveStage(ref)).toBe(st);
    }
    // two quick battles to show the map and waves really come out the same
    for (const st of [STAGES[0], STAGES[6]]) expectSameBattle(st, stageRefFor('campaign', st, 5)!, (x) => battleConfig(s, x, defaultLineup(s, x), {}, 5));
    // a stage object that is not one of the campaign stages can't be referenced by id
    expect(stageRefFor('campaign', { ...STAGES[0] }, 1)).toBeNull();
  });
  it('daily: date key + progress', () => {
    for (const [key, maxIdx] of [
      ['2026-11-12', 2],
      ['2027-02-28', 5],
      ['2030-01-01', 10],
    ] as const) {
      const d = dailyChallenge(key, maxIdx);
      const ref = stageRefFor('daily', d.stage, d.seed, { key, maxIdx })!;
      expect(ref).toEqual({ kind: 'daily', key, maxIdx });
      expectSameBattle(d.stage, ref, (x) => battleConfig(s, x, defaultLineup(s, x), {}, d.seed, { mods: [d.mod.id] }));
    }
    // without the inputs a daily stage can't be rebuilt: no reference rather than a wrong one
    expect(stageRefFor('daily', dailyChallenge('2026-11-12', 3).stage, 1)).toBeNull();
  });
  it('endless: seed', () => {
    for (const seed of [1, 123456789, 987654321]) {
      const st = endlessStage(seed);
      const ref = stageRefFor('endless', st, seed)!;
      expect(ref).toEqual({ kind: 'endless', seed });
      expectSameBattle(st, ref, (x) => ({ ...battleConfig(s, x, defaultLineup(s, x), {}, seed), autoCommand: true }));
    }
  });
  it('a different stage gives a different signature', () => {
    const a = new World(battleConfig(s, STAGES[1], defaultLineup(s, STAGES[1]), {}, 3));
    const b = new World(battleConfig(s, endlessStage(3), defaultLineup(s, STAGES[1]), {}, 3));
    expect(stageSig(a)).not.toBe(stageSig(b));
    expect(resolveStage({ kind: 'campaign', id: 'nope' })).toBeNull();
  });
});

describe('battle resume (record + deterministic replay)', () => {
  it('replaying recorded commands reproduces the exact battle state, UI charges and stances included', async () => {
    const { st, cfg, ref } = setup();
    const live = new World(cfg);
    const rec = new BattleRecorder(live, base(st, cfg, ref, live));
    const ch = new Charges();
    run(live, ch, 0, 30 * 90);
    const want = fingerprint(live);
    const back = roundTrip(rec.record({ charges: ch.save(), t: live.t }));
    expect(back.steps).toBe(30 * 90);
    const ms = back.cmds.map((c) => c.m);
    expect(ms.slice(0, 2)).toEqual(['placeSquad', 'start']);
    for (const m of ['commandStance', 'commandMove', 'commandFocus', 'useAbility', 'preset', 'commandRetreat', 'commandAuto']) expect(ms).toContain(m);
    // charges went through World commands: aggressive on the charge, back to the old stance after it
    const stances = back.cmds.filter((c) => c.m === 'commandStance').map((c) => c.a[1]);
    expect(stances).toContain('aggressive');
    expect(stances.filter((x) => x !== 'aggressive').length).toBeGreaterThan(1);

    let last = 0;
    const again = new World({ ...JSON.parse(JSON.stringify(back.cfg)), stage: resolveStage(back.ref)! });
    const stats = await replay(again, back, (f) => (last = f));
    expect(last).toBe(1);
    expect(stats.steps).toBe(30 * 90);
    expect(fingerprint(again)).toEqual(want);
  });

  it('a resumed recorder keeps recording: resuming twice ends exactly where an uninterrupted battle does', async () => {
    const { st, cfg, ref } = setup(3, 777);
    const N1 = 30 * 35;
    const N2 = 30 * 70;
    const N3 = 30 * 100;
    // uninterrupted
    const u = new World(battleConfig(saveWithArmy(), st, defaultLineup(saveWithArmy(), st), {}, 777));
    const recU = new BattleRecorder(u, base(st, cfg, ref, u));
    const chU = new Charges();
    run(u, chU, 0, N3);
    // killed at N1 and at N2
    const a = new World(cfg);
    const recA = new BattleRecorder(a, base(st, cfg, ref, a));
    const chA = new Charges();
    run(a, chA, 0, N1);
    let saved = roundTrip(recA.record({ charges: chA.save() }));
    let world = a;
    for (const [from, to] of [
      [N1, N2],
      [N2, N3],
    ]) {
      world = await rebuild(saved);
      const ch = new Charges();
      ch.load(world, saved.charges);
      const r = new BattleRecorder(world, saved, { steps: saved.steps, cmds: saved.cmds });
      run(world, ch, from, to);
      saved = roundTrip(r.record({ charges: ch.save() }));
    }
    expect(saved.steps).toBe(N3);
    expect(fingerprint(world)).toEqual(fingerprint(u));
    expect(JSON.parse(JSON.stringify(saved.cmds))).toEqual(JSON.parse(JSON.stringify(recU.record().cmds)));
    // and the record itself replays to the same end state once more
    expect(fingerprint(await rebuild(saved))).toEqual(fingerprint(u));
  });

  it('"포기" settles exactly like the in-battle retreat at the same point (one supply charge, same casualties)', async () => {
    const extra = { arrows: 400, food: 40 };
    const { st, cfg, ref } = setup(2, 31337, extra);
    const live = new World(cfg);
    const rec = new BattleRecorder(live, { ...base(st, cfg, ref, live, extra), id: 'battle-77' });
    const ch = new Charges();
    run(live, ch, 0, 30 * 80);
    const saved = roundTrip(rec.record({ charges: ch.save() }));
    const now = new Date(2026, 10, 12, 12);
    const supplyCost = 210;
    // in-battle: menu → 후퇴 → result screen
    live.surrender();
    const s1 = saveWithArmy();
    s1.gold = 1000;
    const rw1 = settleBattle(s1, { stage: st, mode: 'campaign', supplyCost, battleId: 'battle-77' }, live.result!, now);
    // after a kill: 포기 → rebuild → retreat
    const w = await rebuild(saved);
    w.surrender();
    const s2 = saveWithArmy();
    s2.gold = 1000;
    const rw2 = settleBattle(s2, { stage: w.stage, mode: saved.mode, supplyCost, battleId: saved.id }, w.result!, now);
    expect(w.result).toEqual(live.result);
    expect(s2).toEqual(s1);
    expect(rw2).toEqual(rw1);
    expect(s1.battleDone).toBe('battle-77');
    expect(s1.gold).toBe(1000 + rw1.gold - supplyCost);
    expect(rw1.lines.filter((l) => l.startsWith('보급품 비용')).length).toBe(1);
  });

  it('rejects records from another build, expired, or garbage; clearRecord removes them', () => {
    const kv = memoryKV();
    kv.set(RESUME_KEY, '{not json');
    expect(loadRecord(kv, RESUME_VER)).toBeNull();
    kv.set(RESUME_KEY, '"just a string"');
    expect(loadRecord(kv, RESUME_VER)).toBeNull();
    const { st, cfg, ref } = setup(0, 1);
    const w = new World(cfg);
    const rec = new BattleRecorder(w, base(st, cfg, ref, w));
    w.start();
    for (let i = 0; i < 40; i++) w.step();
    w.commandStance(w.squads[0], 'hold');
    const good = rec.record();
    saveRecord(kv, good);
    expect(loadRecord(kv, RESUME_VER)).not.toBeNull();
    expect(loadRecord(kv, RESUME_VER + 'x')).toBeNull();
    // a week old
    expect(loadRecord(kv, RESUME_VER, good.savedAt + 7 * 86400000 + 1)).toBeNull();
    expect(loadRecord(kv, RESUME_VER, good.savedAt + 6 * 86400000)).not.toBeNull();
    const bad = (patch: Record<string, unknown>) => {
      saveRecord(kv, { ...good, ...patch } as BattleRecord);
      return loadRecord(kv, RESUME_VER);
    };
    expect(bad({ ver: undefined })).toBeNull();
    expect(bad({ id: 5 })).toBeNull();
    expect(bad({ mode: 'arena' })).toBeNull();
    expect(bad({ ref: { kind: 'daily', key: '2026-01-01' } })).toBeNull();
    expect(bad({ ref: { kind: 'moon' } })).toBeNull();
    expect(bad({ sig: null })).toBeNull();
    expect(bad({ cfg: { squads: 'x', seed: 1 } })).toBeNull();
    expect(bad({ steps: -1 })).toBeNull();
    expect(bad({ steps: 1.5 })).toBeNull();
    expect(bad({ cmds: [{ k: 0, m: 'eval', a: [] }] })).toBeNull();
    expect(bad({ cmds: [{ k: 999, m: 'start', a: [] }] })).toBeNull();
    expect(bad({ cmds: [{ k: 5, m: 'start', a: [] }, { k: 2, m: 'start', a: [] }] })).toBeNull();
    expect(bad({ cmds: [{ k: 0, m: 'start' }] })).toBeNull();
    expect(bad({ lineup: [1] })).toBeNull();
    expect(bad({ savedAt: 'yesterday' })).toBeNull();
    expect(bad({ charges: [{ sq: 0, t: 1, prev: 'dance' }] })).toBeNull();
    expect(bad({ charges: [{ sq: 0, t: 1, prev: 'hold' }] })).not.toBeNull();
    clearRecord(kv);
    expect(kv.get(RESUME_KEY)).toBeNull();
    expect(loadRecord(kv, RESUME_VER)).toBeNull();
    // storage that throws: saving reports failure, never throws
    const full = { ...memoryKV(), set: () => { throw new Error('QuotaExceededError'); } };
    expect(saveRecord(full, good)).toBe(false);
  });

  it('a 15-minute battle with an order every 2 s stays a small record', () => {
    const s = saveWithArmy();
    s.upgrades = { masonry: 3, drill: 3, forge: 3, command: 2, logistics: 3, medicine: 2 };
    const st = endlessStage(4242);
    const cfg = { ...battleConfig(s, st, defaultLineup(s, st), {}, 4242), autoCommand: true };
    const w = new World(cfg);
    const rec = new BattleRecorder(w, base(st, cfg, { kind: 'endless', seed: 4242 }, w));
    const ch = new Charges();
    w.start();
    let orders = 0;
    for (let k = 0; k < 30 * 900; k++) {
      if (k % 60 === 30) {
        orders++;
        const alive = w.squads.filter((q) => q.alive > 0);
        const sq = alive[orders % Math.max(1, alive.length)];
        const g = w.grid;
        if (sq) {
          const kind = orders % 6;
          if (kind === 0) w.commandMove(sq, g.keepX - 32 - (orders % 5) * 16, g.keepY + ((orders % 7) - 3) * 16);
          else if (kind === 1) w.commandStance(sq, (['hold', 'defend', 'aggressive'] as const)[orders % 3]);
          else if (kind === 2) w.commandAuto(sq, true);
          else if (kind === 3 && w.activeEnemies[0]) ch.start(w, sq, w.activeEnemies[0]);
          else if (kind === 4) w.useAbility((['rally', 'volley', 'oil'] as const)[orders % 3], g.keepX - 80, g.keepY);
          else w.preset((['allAuto', 'manWalls', 'holdAll', 'fallback'] as const)[orders % 4]);
        }
      }
      ch.check(w);
      w.step();
    }
    const json = JSON.stringify(rec.record({ charges: ch.save() }));
    console.log(`[resume] 15-min record: ${rec.cmds.length} commands (${orders} orders), ${json.length} bytes, battle ${w.state} at t=${Math.round(w.t)}s`);
    expect(rec.steps).toBe(30 * 900);
    expect(json.length).toBeLessThan(120000);
  });
});

describe('replay guards', () => {
  it('an order naming a unit that is already gone from the world means the same thing live and in the replay', async () => {
    const { st, cfg, ref } = setup(2, 99);
    const w = new World(cfg);
    const rec = new BattleRecorder(w, base(st, cfg, ref, w));
    w.start();
    // hold on to an enemy until it has fallen and been swept out of world.units
    let held = null as (typeof w.activeEnemies)[number] | null;
    for (let i = 0; i < 30 * 400 && w.state !== 'won' && w.state !== 'lost'; i++) {
      w.step();
      if (!held) held = w.activeEnemies[0] ?? null;
      if (held && !w.units.includes(held)) break;
    }
    expect(held && !w.units.includes(held)).toBe(true);
    const sq = w.squads.find((q) => q.type.ranged && q.alive > 0)!;
    w.commandFocus(sq, held!);
    // live: the stale unit is not handed to the simulation (the replay could not find it either)
    expect(sq.focus).toBeNull();
    for (let i = 0; i < 300; i++) w.step();
    const again = await rebuild(roundTrip(rec.record()));
    expect(fingerprint(again)).toEqual(fingerprint(w));
  });

  it('a finished battle leaves the shared stage definitions untouched (a later battle on them rebuilds the same)', () => {
    const s = saveWithArmy();
    for (const idx of [0, 4, 8]) {
      const st = STAGES[idx];
      const before = JSON.stringify(stageData(st));
      const w = new World({ ...battleConfig(s, st, defaultLineup(s, st), {}, 11), autoCommand: true });
      w.start();
      for (let i = 0; i < 30 * 900 && w.state !== 'won' && w.state !== 'lost'; i++) w.step();
      expect(JSON.stringify(stageData(st))).toBe(before);
    }
  });
});

describe('charges (tap an enemy with a melee squad)', () => {
  it('go through recorded World commands and survive a save/load, ending once the target is gone', () => {
    const { st, cfg, ref } = setup(1, 2024);
    const w = new World(cfg);
    const rec = new BattleRecorder(w, base(st, cfg, ref, w));
    w.start();
    let e = null as (typeof w.activeEnemies)[number] | null;
    for (let i = 0; i < 30 * 120 && !e; i++) {
      w.step();
      e = w.activeEnemies.find((u) => !u.fleeing) ?? null;
    }
    expect(e).toBeTruthy();
    const sq = w.squads.find((q) => q.type.id === 'spear')!;
    const before = sq.stance;
    expect(before).not.toBe('aggressive');
    const ch = new Charges();
    ch.start(w, sq, e!);
    expect(sq.stance).toBe('aggressive');
    expect(rec.cmds.slice(-3).map((c) => c.m)).toEqual(['commandMove', 'commandFocus', 'commandStance']);
    // saved while the target lives, loaded into a world where it is gone: the charge ends at the next check
    const saved = ch.save();
    expect(saved).toEqual([{ sq: sq.id, t: e!.id, prev: before }]);
    const other = new Charges();
    other.load(w, [{ ...saved[0], t: -12345 }]);
    expect(other.has(sq)).toBe(true);
    expect(other.check(w)).toEqual([sq]);
    expect(sq.stance).toBe(before);
    expect(rec.cmds[rec.cmds.length - 1]).toMatchObject({ m: 'commandStance', a: [{ $sq: sq.id }, before] });
    // a live target that is no longer the squad's focus ends the charge too
    ch.start(w, sq, e!);
    w.commandFocus(sq, null as any);
    expect(ch.check(w)).toEqual([sq]);
    expect(sq.stance).toBe(before);
  });
});

describe('build id', () => {
  it('records carry the app version and a fingerprint of the simulation sources', () => {
    expect(RESUME_VER).toMatch(/^\d+\.\d+\.\d+\+[0-9a-f]{12}$/);
  });
});

describe('only World commands change the battle from the UI', () => {
  it('no direct writes to squad or unit state in src/ui and src/render', () => {
    const sources = import.meta.glob(['../src/ui/*.ts', '../src/render/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(8);
    const hits: string[] = [];
    // assignments to fields the simulation reads (stance, auto, focus, morale, positions, hp, ...)
    const re = /\b(sq|squad|s|q|u|unit|e|t|target|c\.target)\.(stance|auto|focus|morale|routing|destTile|homeTile|slots|hp|x|y|px|py|fx|fy|state|fleeing|ammo|lastOrderT)\s*(=(?!=)|\+=|-=|\+\+|--)/;
    for (const [f, src] of Object.entries(sources)) {
      src
        .split('\n')
        .forEach((line, i) => {
          if (re.test(line) && !/^\s*(\/\/|\*)/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
