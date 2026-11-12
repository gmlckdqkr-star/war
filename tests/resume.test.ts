import { describe, expect, it } from 'vitest';
import { STAGES } from '../src/sim/stages';
import { World } from '../src/sim/world';
import { newSave } from '../src/meta/save';
import { battleConfig, defaultLineup } from '../src/meta/progression';
import { BattleRecorder, loadRecord, replay, saveRecord } from '../src/ui/resume';
import { memoryKV } from '../src/meta/save';

function fingerprint(w: World) {
  let h = 0;
  for (const u of w.units) h = (h * 31 + Math.round(u.x * 10) * 7 + Math.round(u.y * 10) * 13 + Math.round(u.hp) + u.state) | 0;
  return { t: Math.round(w.t * 1000), state: w.state, wave: w.waveIdx, units: w.units.length, h, kills: w.stats?.kills };
}

function setup(stageIdx: number, seed: number) {
  const s = newSave(1);
  const st = STAGES[stageIdx];
  const cfg = battleConfig(s, st, defaultLineup(s, st), {}, seed);
  return { st, cfg };
}

describe('battle resume (record + deterministic replay)', () => {
  it('replaying recorded commands reproduces the exact battle state', async () => {
    const { st, cfg } = setup(2, 4242);
    const live = new World(cfg);
    const rec = new BattleRecorder(live, { ver: 'test', mode: 'campaign', ref: { kind: 'campaign', id: st.id }, cfg: { ...cfg, stage: undefined } as any, lineup: [], extra: {} });
    // a few idle deploy frames, a placement, then the battle with orders sprinkled in
    for (let i = 0; i < 20; i++) live.step();
    const sq0 = live.squads[0];
    live.start();
    for (let i = 0; i < 30 * 20; i++) live.step();
    live.commandStance(live.squads[1], 'hold');
    live.commandMove(sq0, live.grid.keepX * 16, live.grid.keepY * 16);
    for (let i = 0; i < 30 * 15; i++) live.step();
    const foe = live.enemies.find((e) => e.state === 0);
    if (foe) live.commandFocus(live.squads[0], foe);
    live.useAbility('rally', 0, 0);
    live.preset('allAuto');
    for (let i = 0; i < 30 * 25; i++) live.step();
    const want = fingerprint(live);

    const kv = memoryKV();
    expect(saveRecord(kv, rec.record())).toBe(true);
    const back = loadRecord(kv, 'test')!;
    expect(back).not.toBeNull();
    expect(back.steps).toBe(20 + 30 * 60);
    expect(back.cmds.map((c) => c.m)).toEqual(['start', 'commandStance', 'commandMove', ...(foe ? ['commandFocus'] : []), 'useAbility', 'preset']);

    const again = new World({ ...setup(2, 4242).cfg });
    let last = 0;
    await replay(again, back, (f) => (last = f));
    expect(last).toBe(1);
    expect(fingerprint(again)).toEqual(want);
  });

  it('rejects records from another app version or garbage', () => {
    const kv = memoryKV();
    kv.set('ashen.battle', '{not json');
    expect(loadRecord(kv, 'x')).toBeNull();
    const { st, cfg } = setup(0, 1);
    const rec = new BattleRecorder(new World(cfg), { ver: 'old', mode: 'campaign', ref: { kind: 'campaign', id: st.id }, cfg: cfg as any, lineup: [] });
    saveRecord(kv, rec.record());
    expect(loadRecord(kv, 'new')).toBeNull();
  });
});
