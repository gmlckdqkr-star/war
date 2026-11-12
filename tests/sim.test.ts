import { describe, expect, it } from 'vitest';
import { GH, GW, Tile } from '../src/sim/defs';
import { Grid, idx } from '../src/sim/grid';
import { RNG } from '../src/sim/rng';
import { STAGES, dailyChallenge, endlessStage } from '../src/sim/stages';
import { josa } from '../src/sim/josa';
import { ST, World } from '../src/sim/world';
import { newSave, newSquad } from '../src/meta/save';
import { battleConfig, defaultLineup } from '../src/meta/progression';

function armyFor(stageIdx: number) {
  const s = newSave(0);
  for (let i = 1; i < stageIdx; i++) s.stars['s' + i] = 2;
  s.roster.push(newSquad(s, 'engineer'), newSquad(s, 'xbow'), newSquad(s, 'surgeon'), newSquad(s, 'ballista'), newSquad(s, 'knight'), newSquad(s, 'spear'));
  s.upgrades = { masonry: 2, fletching: 2, smithing: 2, drill: 2, logistics: 2, medicine: 2, barracks: 2 };
  return s;
}

function runBattle(stageId: string, seed: number, maxT = 900) {
  const st = STAGES.find((x) => x.id === stageId)!;
  const s = armyFor(st.index);
  s.settings.autoCommand = true;
  const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, seed));
  w.start();
  while ((w.state === 'battle' || w.state === 'intermission') && w.t < maxT) w.step();
  if (!w.result) w.surrender();
  return w;
}

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = new RNG(42);
    const b = new RNG(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
    expect(new RNG(1).next()).not.toBe(new RNG(2).next());
  });
});

describe('stages', () => {
  it.each(STAGES.map((s) => [s.id, s]))('%s builds a valid, defendable castle', (_id, st) => {
    const g = new Grid();
    st.build(g, new RNG(123));
    g.finalize(1);
    expect(g.keepTiles.length).toBe(9);
    const inside = g.inside.reduce((a, b) => a + b, 0);
    expect(inside).toBeGreaterThan(40);
    // every spawn edge used by the stage reaches the keep through the breach field
    const f = (() => {
      const fld = { dist: new Float64Array(GW * GH), next: new Int32Array(GW * GH) };
      g.enemyField('breach', fld);
      return fld;
    })();
    const edges = new Set(st.waves.flatMap((w) => w.groups.map((x) => x.edge)));
    for (const e of edges) {
      let reachable = false;
      for (let k = 0; k < (e === 'W' ? GH : GW); k++) {
        const i = e === 'W' ? k * GW : e === 'N' ? k : (GH - 1) * GW + k;
        if (isFinite(f.dist[i])) reachable = true;
      }
      expect(reachable, `edge ${e}`).toBe(true);
    }
    // at least one gate or wall to defend
    expect(g.structTiles.some((i) => g.tiles[i] === Tile.GATE || g.tiles[i] === Tile.WALL)).toBe(true);
    // waves reference existing bands
    expect(st.waves.length).toBeGreaterThan(0);
  });
});

describe('wall line', () => {
  it('s9 field rubble is outside ground; only collapsed walls of the castle are boundary and rebuildable', () => {
    const st = STAGES.find((x) => x.id === 's9')!;
    const s = armyFor(9);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 1234));
    const g = w.grid;
    let fieldRubble = 0;
    for (let i = 0; i < g.n; i++) {
      if (i % GW >= 32) continue; // west wall column of s9
      if (g.tiles[i] === Tile.RUBBLE) fieldRubble++;
      expect(g.deployable(i), `tile ${i % GW},${Math.floor(i / GW)}`).toBe(false);
      expect(g.isBoundary(i)).toBe(false);
    }
    expect(fieldRubble).toBeGreaterThan(0);
    w.start();
    const gap = idx(32, 14);
    expect(g.tiles[gap]).toBe(Tile.WALL);
    w.destroyStruct(gap, 'broken');
    expect(g.tiles[gap]).toBe(Tile.RUBBLE);
    expect(g.isBoundary(gap)).toBe(true);
    expect(g.deployable(gap)).toBe(true);
    const eng = w.squads.find((q) => q.type.id === 'engineer')!;
    let picked = false;
    for (let i = 0; i < 30 * 10 && !picked; i++) {
      w.step();
      if (eng.taskTile === gap && eng.taskKind === 3) picked = true;
      // engineers never target field rubble
      if (eng.taskTile >= 0) expect(g.wallLine[eng.taskTile]).toBe(1);
    }
    expect(picked).toBe(true);
  });
});

describe('battle simulation', () => {
  it('is deterministic for the same seed', () => {
    const a = runBattle('s1', 77, 200);
    const b = runBattle('s1', 77, 200);
    expect(a.t).toBe(b.t);
    expect(a.stats.kills).toBe(b.stats.kills);
    expect(a.result!.dead).toBe(b.result!.dead);
  });

  it('does not depend on other worlds stepped in between (no shared module state)', () => {
    const st = STAGES.find((x) => x.id === 's5')!;
    const fingerprint = (w: World) => {
      let h = 0;
      for (const u of w.units) h = (Math.imul(h, 31) + Math.round(u.x * 100) + Math.round(u.y * 7) + Math.round(u.hp * 10) + u.state) | 0;
      return { t: w.t, kills: w.stats.kills, dead: w.stats.dead, keep: w.keepHp, wave: w.waveIdx, arrows: w.supplies.arrows, h, squads: w.squads.map((q) => q.destTile) };
    };
    const make = (seed: number, stage = st) => {
      const s = armyFor(stage.index);
      s.settings.autoCommand = true;
      const w = new World(battleConfig(s, stage, defaultLineup(s, stage), {}, seed));
      w.start();
      return w;
    };
    const steps = 30 * 150;
    // reference run, alone
    const a = make(424242);
    for (let i = 0; i < steps; i++) a.step();
    // a different battle advanced an odd number of ticks first, then interleaved tick by tick
    const other = make(5, STAGES[0]);
    for (let i = 0; i < 15; i++) other.step();
    const b = make(424242);
    for (let i = 0; i < steps; i++) {
      b.step();
      if (i % 3 === 0) other.step();
    }
    expect(fingerprint(b)).toEqual(fingerprint(a));
  });

  it.each(STAGES.map((s) => [s.id]))('%s runs to completion with sane state', (id) => {
    const w = runBattle(id, 1000 + Number(id.slice(1)));
    expect(['won', 'lost']).toContain(w.state);
    for (const u of w.units) {
      expect(Number.isFinite(u.x) && Number.isFinite(u.y)).toBe(true);
      expect(Number.isFinite(u.hp)).toBe(true);
    }
    for (const sq of w.squads) {
      expect(sq.morale).toBeGreaterThanOrEqual(0);
      expect(sq.morale).toBeLessThanOrEqual(100);
    }
    const r = w.result!;
    expect(r.kills).toBeGreaterThan(0);
    // every deployed soldier is accounted for exactly once
    for (const o of r.squads) {
      const ids = [...o.dead, ...o.wounded, ...o.survivors];
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(w.supplies.arrows).toBeGreaterThanOrEqual(0);
    expect(w.supplies.food).toBeGreaterThanOrEqual(0);
  });

  it('downed defenders are either dead, evacuated, carried or still down — never lost', () => {
    const w = runBattle('s5', 9);
    for (const u of w.defs) expect([ST.ACTIVE, ST.DOWN, ST.DEAD, ST.CARRIED, ST.EVAC, ST.FLED]).toContain(u.state);
  });

  it('retreat keeps the wounded wounded (no free healing)', () => {
    const st = STAGES[2];
    const s = armyFor(3);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 5));
    w.start();
    while (w.t < 160 && w.state !== 'lost' && w.state !== 'won') w.step();
    w.surrender();
    const r = w.result!;
    const downedOrEvac = w.defs.filter((u) => u.squad && !u.squad.reserve && (u.state === ST.DOWN || u.state === ST.CARRIED || u.state === ST.EVAC)).length;
    expect(r.wounded).toBeGreaterThanOrEqual(downedOrEvac);
    expect(r.won).toBe(false);
  });

  it('daily and endless stages are playable', () => {
    const d = dailyChallenge('2027-01-01', 5);
    expect(d.stage.waves.length).toBeGreaterThan(0);
    const e = endlessStage(3);
    expect(e.waves.length).toBe(60);
    const s = armyFor(6);
    const w = new World(battleConfig(s, e, defaultLineup(s, e), {}, 3));
    w.start();
    for (let i = 0; i < 30 * 120; i++) w.step();
    expect(w.waveIdx).toBeGreaterThanOrEqual(1);
  });

  it("daily '정예군' raises enemy HP and attack by the advertised 30%", () => {
    let key = '';
    for (let d = 1; d <= 28 && !key; d++) if (dailyChallenge(`2027-01-${String(d).padStart(2, '0')}`, 10).mod.id === 'elite') key = `2027-01-${String(d).padStart(2, '0')}`;
    const dc = dailyChallenge(key, 10);
    expect(dc.mod.desc).toContain('+30%');
    const base = STAGES.find((x) => dc.stage.name.endsWith(x.name))!;
    const s = armyFor(base.index);
    const wd = new World(battleConfig(s, dc.stage, defaultLineup(s, dc.stage), {}, 1, { mods: [dc.mod.id] }));
    const wb = new World(battleConfig(s, base, defaultLineup(s, base), {}, 1));
    expect(wd.hpScale / wb.hpScale).toBeCloseTo(1.3, 5);
    expect(wd.atkScale / wb.atkScale).toBeCloseTo(1.3, 5);
  });

  it('battle messages pick Korean particles instead of "이(가)"', () => {
    const st = STAGES[0];
    const s = armyFor(1);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 3));
    w.start();
    const texts: string[] = [];
    while ((w.state === 'battle' || w.state === 'intermission') && w.t < 400) {
      w.step();
      for (const e of w.events.splice(0)) texts.push(e.text);
    }
    const broken = texts.filter((t) => t.includes('무너져 달아납니다'));
    expect(broken.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).not.toMatch(/\((이|가|을|를|은|는|와|과|으)\)/);
    expect(broken).toContain(`${josa('징집병 무리', '이/가')} 무너져 달아납니다!`);
  });

  it('abilities respect cooldowns and supplies', () => {
    const st = STAGES[8];
    const s = armyFor(9);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 11));
    w.start();
    for (let i = 0; i < 30 * 20; i++) w.step();
    const g = w.grid;
    expect(w.useAbility('rally', g.keepX, g.keepY)).toBeNull();
    expect(w.useAbility('rally', g.keepX, g.keepY)).not.toBeNull();
    expect(w.abilities.rally.cd).toBeGreaterThan(0);
    expect(w.useAbility('reserve', 0, 0)).toBeNull();
    expect(w.useAbility('reserve', 0, 0)).not.toBeNull();
  });
});
