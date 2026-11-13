import { describe, expect, it } from 'vitest';
import { GH, GW, TILE_INFO, Tile } from '../src/sim/defs';
import { Grid, SPAWN_GAP, cx, cy, idx, tileAt } from '../src/sim/grid';
import { findThreats } from '../src/sim/council';
import { RNG } from '../src/sim/rng';
import { ENDLESS_CASTLES, ENDLESS_RESUPPLY, STAGES, dailyChallenge, endlessStage, planWaves, swarmWave, type Edge, type StageDef } from '../src/sim/stages';
import { COUNCIL_IDS, COUNCIL_NAMES, GATE_BOOST, REPAIR_FRAC, councilDesc } from '../src/sim/warcouncil';
import { josa } from '../src/sim/josa';
import { ACT, BAND_STALL_T, BATTLE_HARD_CAP, CAP_HOLD_N, KEEP_PRESS_MAX, KEEP_PRESS_T, SAPPER_COVER, SAPPER_DIG_T, SAPPER_STONES, POT_FIRE_STONE, BREATH_HALF, BREATH_LEN, DRAGON_FLEE_HP, DRAGON_MAX_STAY, DRAGON_PAIN_DMG, DRAGON_PAIN_MAX, GARRISON_GRACE, GATE_SAFE_R, ST, TOWER_EMPTY_T, TREB_SPLASH_DMG, World, isEngine, type Unit } from '../src/sim/world';
import { newSave, newSquad } from '../src/meta/save';
import { LEVY_BELOW, LEVY_MAX_SQUADS, UPGRADES, applyBattle, baseSupplies, battleConfig, defaultLineup, foodNeeded, lineupSoldiers, upgradeCost } from '../src/meta/progression';

function armyFor(stageIdx: number) {
  const s = newSave(0);
  for (let i = 1; i < stageIdx; i++) s.stars['s' + i] = 2;
  s.roster.push(newSquad(s, 'engineer'), newSquad(s, 'xbow'), newSquad(s, 'surgeon'), newSquad(s, 'ballista'), newSquad(s, 'knight'), newSquad(s, 'spear'));
  s.upgrades = { masonry: 2, fletching: 2, smithing: 2, drill: 2, logistics: 2, medicine: 2, barracks: 2 };
  return s;
}

function runBattle(stageId: string, seed: number, maxT = BATTLE_HARD_CAP + 60) {
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
    const edges = new Set([...st.waves.flatMap((w) => w.groups.map((x) => x.edge)), ...(st.lanes ?? []).map((l) => l.edge)]);
    for (const e of edges) {
      let reachable = false;
      for (let k = 0; k < (e === 'W' || e === 'E' ? GH : GW); k++) {
        const i = e === 'W' ? k * GW : e === 'E' ? k * GW + GW - 1 : e === 'N' ? k : (GH - 1) * GW + k;
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
    // brittle walls (a daily modifier) on top of masonry research: rebuilt walls must match them
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 1234, { mods: ['brittle'] }));
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
    // the rebuilt wall is as strong as the castle's own this battle (masonry research and modifiers)
    for (let i = 0; i < 30 * 90 && g.tiles[gap] !== Tile.WALL; i++) w.step();
    expect(g.tiles[gap]).toBe(Tile.WALL);
    expect(w.structHpMul).toBeCloseTo((1 + 0.12 * 2) * 0.65, 5);
    expect(g.maxHp[gap]).toBeCloseTo(TILE_INFO[Tile.WALL].maxHp * w.structHpMul, 2);
  });
});

describe('siege engines', () => {
  /** a stage with only the given band attacking (the scripted waves are cleared) */
  function lone(stageId: string, band: string, seed = 7, alongside: string[] = []) {
    const st = STAGES.find((x) => x.id === stageId)!;
    const s = armyFor(st.index);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, seed));
    w.start();
    w.pending = [];
    for (const o of alongside) w.spawnBand({ band: o, edge: 'W', span: [16, 18], delay: 0 }, 0);
    w.spawnBand({ band, edge: 'W', span: [16, 18], delay: 0 }, 0);
    const b = w.bands[w.bands.length - 1];
    return { w, b, core: b.core };
  }

  it('a climber whose ladder is pushed away falls to the wall foot outside, never into the wall', () => {
    const { w } = lone('s3', 'h_escalade', 7);
    const g = w.grid;
    let climber: Unit | undefined;
    for (let i = 0; i < 30 * 120 && !climber; i++) {
      for (const e of w.enemies) e.hp = e.maxHp; // whatever the castle's strength, let them reach the wall
      w.step();
      climber = w.enemies.find((e) => e.state === ST.CLIMB);
    }
    expect(climber).toBeDefined();
    const c = climber!;
    // let him get well up the ladder (over the wall tile), then the ladder goes
    for (let i = 0; i < 20 && c.state === ST.CLIMB; i++) w.step();
    expect(c.state).toBe(ST.CLIMB);
    // he is over the wall tile itself by now
    c.x = (c.actTile % GW + 0.5) * 16;
    c.y = (Math.floor(c.actTile / GW) + 0.5) * 16;
    const lad = w.ladderAt(c.actTile)!;
    expect(lad).toBeTruthy();
    w.removeLadder(lad, true);
    w.step();
    expect(c.state).not.toBe(ST.CLIMB);
    expect(c.elev).toBe(false);
    const i = tileAt(c.x, c.y);
    expect(g.isStruct(i)).toBe(false);
    expect(g.inside[i]).toBe(0);
  });

  it('escorts screen the ram at its pace and the ram hits the gate even after the escort breaks', () => {
    const { w, b, core } = lone('s4', 'w_ram');
    const ram = core[0];
    expect(isEngine(ram)).toBe(true);
    const g = w.grid;
    const kd = (u: Unit) => Math.hypot(u.x - g.keepX, u.y - g.keepY);
    let ahead = 0;
    let samples = 0;
    for (let i = 0; i < 30 * 40; i++) {
      w.step();
      if (!b.convoy) break;
      for (const u of b.units) {
        if (u === ram || u.state !== ST.ACTIVE) continue;
        samples++;
        if (kd(u) < kd(ram) - 3 * 16) ahead++;
      }
    }
    expect(samples).toBeGreaterThan(100);
    expect(ahead / samples).toBeLessThan(0.05);
    // the escort scatters: the ram keeps rolling
    for (const u of b.units) if (u !== ram && u.state === ST.ACTIVE) w.killEnemy(u, null);
    w.breakBand(b);
    expect(ram.fleeing).toBe(false);
    const gates = g.structTiles.filter((i) => g.tiles[i] === Tile.GATE);
    const hp0 = gates.reduce((a, i) => a + g.hp[i], 0);
    for (let i = 0; i < 30 * 120 && ram.state === ST.ACTIVE && !ram.fleeing; i++) w.step();
    const hp1 = gates.reduce((a, i) => a + g.hp[i], 0);
    expect(hp1).toBeLessThan(hp0 - 200);
  });

  it('a trebuchet whose escort is gone still sets up and fires', () => {
    const { w, b, core } = lone('s8', 'h_treb');
    const treb = core[0];
    for (const u of b.units) if (u !== treb) w.killEnemy(u, null);
    w.breakBand(b);
    let stones = 0;
    for (let i = 0; i < 30 * 90; i++) {
      w.step();
      for (const p of w.projectiles) if (p.kind === 'stone' && p.src === treb && p.t === 1 / 30) stones++;
    }
    expect(treb.fleeing).toBe(false);
    expect(stones).toBeGreaterThan(2);
  });

  it('a stone bruises the men beside its impact but cannot cut down a whole squad', () => {
    const { w, core } = lone('s8', 'h_treb');
    const treb = core[0];
    w.step(); // spatial hashes are built in the step
    const sq = w.squads.find((q) => q.units.filter((u) => u.state === ST.ACTIVE && u.elev).length >= 6)!;
    const men = sq.units.filter((u) => u.state === ST.ACTIVE);
    const x = men.reduce((a, u) => a + u.x, 0) / men.length;
    const y = men.reduce((a, u) => a + u.y, 0) / men.length;
    const hp0 = men.map((u) => u.hp);
    w.land({ x, y, sx: x, sy: y, tx: x, ty: y, t: 0, dur: 1, target: null, side: 1, dmg: TREB_SPLASH_DMG * treb.atkMul, ap: 0.5, kind: 'stone', structTile: -1, area: true, src: treb, keep: false });
    const hurt = men.filter((u, k) => u.hp < hp0[k]).length;
    expect(hurt).toBeGreaterThan(0);
    expect(hurt).toBeLessThan(men.length / 2);
    expect(men.every((u) => u.state === ST.ACTIVE)).toBe(true);
  });

  it('a siege tower docks against the wall', () => {
    const { w, core } = lone('s8', 'h_tower');
    const tower = core[0];
    for (let i = 0; i < 30 * 120 && tower.act !== ACT.DOCKED && tower.state === ST.ACTIVE; i++) w.step();
    expect(tower.act).toBe(ACT.DOCKED);
    expect(w.ladders.some((l) => l.tower === tower)).toBe(true);
  });

  it('a digging sapper works under a mantlet: missiles do less damage, a ground blow full', () => {
    const { w, core } = lone('s4', 'w_sappers', 3);
    const sap = core[0];
    const bow = w.defs.find((u) => u.def.id === 'd_xbow')!;
    w.step();
    sap.act = ACT.DIG;
    sap.screened = false;
    let h = sap.hp;
    w.damage(sap, 20, 0, bow, true);
    const shot = h - sap.hp;
    h = sap.hp;
    w.damage(sap, 20, 0, bow, false);
    const blow = h - sap.hp;
    expect(shot).toBeCloseTo(blow * SAPPER_COVER, 5);
    expect(SAPPER_COVER).toBeLessThan(1);
    expect(SAPPER_DIG_T).toBeGreaterThanOrEqual(8);
  });

  it('stones from the wall walk hit a digging miner hard; the same blow on a man below who is not digging is weak', () => {
    const { w, core } = lone('s4', 'w_sappers', 3);
    const sap = core[0];
    w.step();
    const spear = w.defs.find((u) => u.def.id === 'd_spear')!;
    spear.elev = true;
    sap.elev = false;
    const blow = (dig: boolean) => {
      sap.act = dig ? ACT.DIG : ACT.NONE;
      sap.hp = sap.maxHp;
      spear.cd = 0;
      w.meleeHit(spear, sap, 1);
      return sap.maxHp - sap.hp;
    };
    const stones = blow(true);
    const plain = blow(false);
    expect(plain).toBeGreaterThan(0);
    expect(stones / plain).toBeCloseTo(SAPPER_STONES / 0.6, 5);
    expect(SAPPER_STONES).toBeGreaterThan(1);
  });

  it('a miner at work is every archer\'s first mark, and the squads send men to the wall walk above him', () => {
    const { w, core } = lone('s4', 'w_sappers', 3);
    const g = w.grid;
    w.step();
    const [a, b] = core;
    for (const e of w.enemies) if (e !== a && e !== b) e.state = ST.FLED;
    const wall = idx(30, 14);
    expect(g.tiles[wall]).toBe(Tile.WALL);
    // two miners at the wall foot, mirrored about an archer's line of sight: one digs, one does not
    const bow = w.defs.find((u) => u.def.id === 'd_archer' || u.def.id === 'd_xbow')!;
    a.x = a.px = cx(wall) - 16;
    a.y = a.py = cy(wall);
    b.x = b.px = cx(wall) - 16;
    b.y = b.py = cy(wall) + 2 * 16;
    bow.x = bow.px = cx(wall) + 3 * 16;
    bow.y = bow.py = cy(wall) + 16;
    for (const u of [a, b]) {
      u.screened = false;
      u.elev = false;
    }
    w.handleObstacle(a, wall);
    expect(a.act).toBe(ACT.DIG);
    w.activeEnemies.length = 0;
    w.activeEnemies.push(a, b);
    w.eHash.build(w.activeEnemies);
    expect(w.pickRangedTarget(bow, bow.squad!)).toBe(a);
    // the council marks the mine as a threat at the wall walk right above it
    const th = findThreats(w);
    expect(th.length).toBeGreaterThan(0);
    expect(Math.hypot(th[0].x - cx(wall), th[0].y - cy(wall))).toBeLessThan(16);
    // and an auto melee squad is sent there
    for (let i = 0; i < 30; i++) {
      a.hp = a.maxHp;
      w.step();
    }
    const sent = w.squads.filter((q) => q.auto && q.alive > 0 && ['spear', 'sword', 'knight', 'militia'].includes(q.type.id) && q.destTile >= 0);
    expect(sent.some((q) => Math.hypot(cx(q.destTile) - cx(wall), cy(q.destTile) - cy(wall)) < 2 * 16)).toBe(true);
  });

  it('a docked tower nobody climbs any more stops holding its band in the fight', () => {
    const { w, b, core } = lone('s6', 'h_tower');
    const tower = core[0];
    for (let i = 0; i < 30 * 150 && tower.act !== ACT.DOCKED && tower.state === ST.ACTIVE; i++) w.step();
    expect(tower.act).toBe(ACT.DOCKED);
    w.waveIdx = w.totalWaves() - 1; // the last wave: only this tower is left
    for (const u of b.units) if (u !== tower && u.state !== ST.DEAD) w.killEnemy(u, null);
    // only archers are left on the walls: they find the tower too stout to shoot at
    for (const u of w.defs) if (u.def.id !== 'd_archer' && u.state !== ST.DEAD) w.killDef(u);
    tower.hp = tower.maxHp * 0.9;
    b.contactT = w.t; // the last of its men went up the tower just now
    const t0 = w.t;
    let leftAfter = -1;
    for (let i = 0; i < 30 * (BAND_STALL_T + 20) && w.state === 'battle'; i++) {
      // nobody hurts it (a stray arrow at most)
      tower.hp = Math.max(tower.hp, tower.maxHp * 0.9);
      tower.crew = 100;
      w.step();
      if (leftAfter < 0 && tower.fleeing) leftAfter = w.t - t0;
    }
    expect(tower.fleeing || tower.state !== ST.ACTIVE).toBe(true);
    // an empty tower is pulled back soon, not after a full stall
    expect(leftAfter).toBeGreaterThan(0);
    expect(leftAfter).toBeLessThan(TOWER_EMPTY_T + 5);
    expect(w.state).toBe('won');
    expect(w.t - t0).toBeLessThan(BAND_STALL_T + 20);
  });

  it('a fleeing ram inside the courtyard leaves the way it came in instead of pressing on the far wall', () => {
    const { w, core } = lone('s4', 'w_ram');
    const ram = core[0];
    const g = w.grid;
    // put it in the inner courtyard of the pass fort, behind the broken inner gate
    const gate = idx(42, 17);
    w.destroyStruct(gate, 'broken');
    w.destroyStruct(idx(30, 17), 'broken');
    w.step();
    ram.x = 46.5 * 16;
    ram.y = 17.5 * 16;
    w.engineRetreat(ram);
    let maxX = ram.x;
    for (let i = 0; i < 30 * 150 && ram.state === ST.ACTIVE; i++) {
      ram.hp = ram.maxHp; // let it go: we only follow its way out
      w.step();
      maxX = Math.max(maxX, ram.x);
    }
    expect(ram.state).toBe(ST.FLED);
    // out by the west, through both broken gates, not out the back of the pass fort
    expect(ram.x).toBeLessThan(3 * 16);
    expect(maxX).toBeLessThan(48 * 16);
    expect(g.inside[idx(0, Math.floor(ram.y / 16))]).toBe(0);
  });

  it('screened sappers reach the wall and dig, but are exposed while digging', () => {
    const { w, core } = lone('s4', 'w_sappers', 3, ['w_wall']);
    let dug = false;
    let screenedOnTheWay = false;
    for (let i = 0; i < 30 * 120 && !dug; i++) {
      w.step();
      if (core.some((u) => u.screened)) screenedOnTheWay = true;
      dug = core.some((u) => u.act === ACT.DIG);
    }
    expect(screenedOnTheWay).toBe(true);
    expect(dug).toBe(true);
    for (let i = 0; i < 15; i++) w.step();
    for (const u of core) if (u.act === ACT.DIG) expect(u.screened).toBe(false);
  });

  it('a mine stays dug when its miner falls: the next sapper at that wall carries on', () => {
    const { w, core } = lone('s4', 'w_sappers', 3);
    const g = w.grid;
    w.step();
    const wall = idx(30, 14);
    expect(g.tiles[wall]).toBe(Tile.WALL);
    const [a, b] = core;
    w.handleObstacle(a, wall);
    expect(a.act).toBe(ACT.DIG);
    const half = SAPPER_DIG_T / 2;
    for (let i = 0; i < Math.round(30 * half); i++) {
      a.hp = a.maxHp;
      w.step();
    }
    w.killEnemy(a, null);
    expect(w.mineProg[wall]).toBeCloseTo(half, 0);
    expect(g.tiles[wall]).toBe(Tile.WALL);
    // the second miner needs only what is left of the gallery
    w.handleObstacle(b, wall);
    expect(b.act).toBe(ACT.DIG);
    expect(b.timer).toBeCloseTo(SAPPER_DIG_T - half, 0);
    let took = 0;
    for (let i = 0; i < 30 * SAPPER_DIG_T && g.tiles[wall] === Tile.WALL; i++) {
      b.hp = b.maxHp;
      w.step();
      took += 1 / 30;
    }
    expect(g.tiles[wall]).toBe(Tile.RUBBLE);
    expect(took).toBeLessThan(SAPPER_DIG_T - half + 0.5);
    expect(w.mineProg[wall]).toBe(0);
  });

  it('two miners at one wall tile dig one tunnel: no faster than one miner', () => {
    const { w, core } = lone('s4', 'w_sappers', 3);
    const g = w.grid;
    w.step();
    const wall = idx(30, 14);
    const [a, b] = core;
    w.handleObstacle(a, wall);
    w.handleObstacle(b, wall);
    expect(a.act).toBe(ACT.DIG);
    expect(b.act).toBe(ACT.DIG);
    let took = 0;
    for (let i = 0; i < 30 * (SAPPER_DIG_T + 2) && g.tiles[wall] === Tile.WALL; i++) {
      a.hp = a.maxHp;
      b.hp = b.maxHp;
      w.step();
      took += 1 / 30;
    }
    expect(g.tiles[wall]).toBe(Tile.RUBBLE);
    expect(took).toBeGreaterThan(SAPPER_DIG_T - 0.5);
  });

  it('a gallery left half dug when the assault ends is filled in before the next wave', () => {
    const { w, core } = lone('s4', 'w_sappers', 3);
    w.step();
    const wall = idx(30, 14);
    const [a] = core;
    w.handleObstacle(a, wall);
    for (let i = 0; i < 30 * 5; i++) {
      a.hp = a.maxHp;
      w.step();
    }
    expect(w.mineProg[wall]).toBeGreaterThan(4);
    for (const e of w.enemies) if (e.state === ST.ACTIVE) w.killEnemy(e, null);
    for (let i = 0; i < 30 * 120 && w.waveIdx === 0; i++) w.step();
    expect(w.waveIdx).toBe(1);
    expect(w.mineProg[wall]).toBe(0);
    expect(w.events.some((e) => e.type === 'minefilled')).toBe(true);
  });

  it('crossbowmen who have shot their quivers empty go home instead of hacking at the gate', () => {
    const { w, b } = lone('s4', 'w_bolts', 1);
    const g = w.grid;
    w.step();
    const wall = idx(30, 14);
    const men = b.units.filter((u) => u.state === ST.ACTIVE);
    expect(men.length).toBeGreaterThan(3);
    // one bolt left among them: the band is still in the fight, and an empty-handed man hits the wall
    for (const u of men) u.ammo = 0;
    men[0].ammo = 1;
    const hp0 = g.hp[wall];
    men[1].cd = 0;
    w.handleObstacle(men[1], wall);
    expect(b.broken).toBe(false);
    expect(g.hp[wall]).toBeLessThan(hp0);
    // the last bolt gone: hacking at stone is no siege for them, the band goes home
    men[0].ammo = 0;
    men[1].cd = 0;
    w.handleObstacle(men[1], wall);
    expect(b.broken).toBe(true);
    expect(men.every((u) => u.fleeing || u.state !== ST.ACTIVE)).toBe(true);
    expect(w.events.some((e) => e.type === 'withdraw')).toBe(true);
  });
});

describe('wall tops', () => {
  /** one spearman on the s3 west wall walk, one orc right beside the wall (inside or outside), nobody else */
  function hurt(side: 'inside' | 'outside') {
    const st = STAGES.find((x) => x.id === 's3')!;
    const s = armyFor(3);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 8));
    const sq = w.squads.find((q) => q.type.id === 'spear')!;
    w.placeSquad(sq, idx(38, 14));
    sq.auto = false;
    sq.stance = 'hold';
    w.start();
    w.pending = [];
    w.spawnBand({ band: 'o_warband', edge: 'W', span: [16, 18], delay: 0 }, 0);
    const grunt = w.enemies.find((e) => e.def.id === 'o_grunt')!;
    for (const e of w.enemies) if (e !== grunt) e.state = ST.FLED;
    const top = sq.units.find((u) => u.elev)!;
    for (const u of w.defs) if (u !== top) u.state = ST.EVAC;
    grunt.x = grunt.px = side === 'inside' ? 39 * 16 + 4 : 38 * 16 - 4;
    grunt.y = grunt.py = top.y;
    expect(w.grid.inside[idx(Math.floor(grunt.x / 16), Math.floor(grunt.y / 16))]).toBe(side === 'inside' ? 1 : 0);
    const hp0 = top.hp;
    for (let i = 0; i < 30 * 4; i++) {
      top.cd = 99; // the spearman holds his blows so the orc lives
      w.step();
    }
    expect(grunt.state).toBe(ST.ACTIVE);
    expect(top.elev).toBe(true);
    return hp0 - top.hp;
  }

  it('an enemy inside the walls strikes a defender on the wall top beside it; one outside cannot', () => {
    expect(hurt('inside')).toBeGreaterThan(10);
    expect(hurt('outside')).toBe(0);
  });
});

describe('gates', () => {
  it('a gate is barred to defenders while an enemy is within reach of it, and opens again once it is clear', () => {
    const st = STAGES.find((x) => x.id === 's3')!;
    const s = armyFor(3);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 11));
    const gate = idx(38, 17);
    expect(w.grid.tiles[gate]).toBe(Tile.GATE);
    const sq = w.squads.find((q) => q.type.id === 'spear')!;
    sq.auto = false;
    w.start();
    w.pending = [];
    w.spawnBand({ band: 'o_warband', edge: 'W', span: [16, 18], delay: 0 }, 0);
    const grunt = w.enemies.find((e) => e.def.id === 'o_grunt')!;
    for (const e of w.enemies) if (e !== grunt) e.state = ST.FLED;
    const pin = (x: number) => {
      grunt.x = grunt.px = x * 16;
      grunt.y = grunt.py = 17.5 * 16;
      grunt.cd = 99;
      grunt.hp = grunt.maxHp; // the archers on the wall may shoot at it, it stays
    };
    pin(38 - (GATE_SAFE_R - 1)); // two tiles outside the gate
    for (let i = 0; i < 15; i++) {
      pin(38 - (GATE_SAFE_R - 1));
      w.step();
    }
    expect(w.gateOpen(gate)).toBe(false);
    expect(w.gatesShut).toBe(1);
    expect(w.grid.defCanMove(idx(39, 17), gate)).toBe(false);
    // ordered out through it: the spearmen wait inside
    w.commandMove(sq, 33 * 16 + 8, 17 * 16 + 8);
    for (let i = 0; i < 30 * 6; i++) {
      pin(38 - (GATE_SAFE_R - 1));
      w.step();
      for (const u of sq.units) if (u.state === ST.ACTIVE) expect(u.x / 16).toBeGreaterThan(38);
    }
    const waiting = sq.units.filter((u) => u.state === ST.ACTIVE && Math.hypot(u.x - 38.5 * 16, u.y - 17.5 * 16) < 4 * 16).length;
    expect(waiting).toBeGreaterThan(sq.units.length / 2);
    // the orc walks off: the gate opens and they get out
    for (let i = 0; i < 30 * 8; i++) {
      pin(20);
      w.step();
    }
    expect(w.gateOpen(gate)).toBe(true);
    expect(w.gatesShut).toBe(0);
    expect(sq.units.filter((u) => u.state === ST.ACTIVE && u.x / 16 < 38).length).toBeGreaterThan(sq.units.length / 2);
  });
});

describe('stalemates', () => {
  function lastWaveWith(band: string) {
    const st = STAGES.find((x) => x.id === 's5')!;
    const s = armyFor(5);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 21));
    w.start();
    w.waveIdx = st.waves.length - 1; // pretend this is the final wave
    w.pending = [];
    w.spawnBand({ band, edge: 'W', span: [16, 18], delay: 0 }, 0);
    return { w, b: w.bands[w.bands.length - 1] };
  }

  it('a band without progress first assaults, then withdraws — and a withdrawal ends the last wave as won', () => {
    const { w, b } = lastWaveWith('h_levies');
    w.step();
    b.contactT = w.t - BAND_STALL_T - 1;
    w.step();
    expect(b.assault).toBe(true);
    expect(b.units.some((u) => u.fleeing)).toBe(false);
    b.contactT = w.t - BAND_STALL_T - 1;
    w.step();
    expect(b.units.every((u) => u.state !== ST.ACTIVE || u.fleeing)).toBe(true);
    for (let i = 0; i < 5 && w.state === 'battle'; i++) w.step();
    expect(w.state).toBe('won');
  });

  it('enemy archers carry a finite quiver and come forward once it is empty', () => {
    const { w, b } = lastWaveWith('h_archers');
    const bows = b.units.filter((u) => u.def.role === 'ranged');
    expect(bows[0].ammo).toBeGreaterThan(0);
    for (const u of bows) u.ammo = 0;
    const g = w.grid;
    const d0 = bows.reduce((a, u) => a + Math.hypot(u.x - g.keepX, u.y - g.keepY), 0);
    for (let i = 0; i < 30 * 20; i++) w.step();
    const live = bows.filter((u) => u.state === ST.ACTIVE);
    expect(live.length).toBeGreaterThan(0);
    const d1 = live.reduce((a, u) => a + Math.hypot(u.x - g.keepX, u.y - g.keepY), 0);
    expect(d1 / live.length).toBeLessThan(d0 / bows.length - 5 * 16);
    expect(w.projectiles.some((p) => p.side === 1 && p.kind === 'arrow')).toBe(false);
  });

  it('no battle runs past the hard cap', () => {
    const { w } = lastWaveWith('e_skirmish');
    w.t = BATTLE_HARD_CAP - 2;
    for (let i = 0; i < 30 * 3 && w.state === 'battle'; i++) w.step();
    expect(w.state).toBe('won');
    expect(w.result!.won).toBe(true);
    expect(w.t).toBeLessThanOrEqual(BATTLE_HARD_CAP + 1 / 30 + 1e-9);
  });

  it('a garrison with nobody left standing loses the castle after a short grace', () => {
    const st = STAGES.find((x) => x.id === 's3')!;
    const s = armyFor(st.index);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 5));
    w.start();
    for (let i = 0; i < 30 * 5; i++) w.step();
    for (const u of w.defs) if (u.state !== ST.DEAD) w.killDef(u);
    for (let i = 0; i < 30 * (GARRISON_GRACE - 1); i++) w.step();
    expect(w.state).toBe('battle');
    for (let i = 0; i < 30 * 2 && w.state === 'battle'; i++) w.step();
    expect(w.state).toBe('lost');
    expect(w.events.some((e) => e.type === 'wiped' && e.level === 'danger')).toBe(true);
  });

  it('at the hard cap, attackers holding the courtyard take the castle', () => {
    const { w, b } = lastWaveWith('h_levies');
    const g = w.grid;
    const yard: number[] = [];
    for (let i = 0; i < g.n; i++) if (g.inside[i] && !g.keepAdj[i]) yard.push(i);
    b.units.slice(0, CAP_HOLD_N + 1).forEach((u, k) => {
      u.x = ((yard[k * 7] % GW) + 0.5) * 16;
      u.y = (Math.floor(yard[k * 7] / GW) + 0.5) * 16;
    });
    w.t = BATTLE_HARD_CAP - 1 / 30;
    w.step();
    expect(w.state).toBe('lost');
    expect(w.result!.won).toBe(false);
    expect(w.events.some((e) => e.type === 'siegeend' && e.level === 'danger')).toBe(true);
  });

  it('an assault on the keep grows stronger the longer it lasts, and is announced without spam', () => {
    const { w, b } = lastWaveWith('h_levies');
    // the band stays put at the map edge; its first man stands for 'someone hammering at the keep door'
    const pin = b.units.map((u) => [u.x, u.y]);
    const hammer = b.units[0];
    w.keepMax = w.keepHp = 1e6; // never falls here
    const lossOver = (secs: number, hitting = true) => {
      const k0 = w.keepHp;
      for (let i = 0; i < 30 * secs; i++) {
        b.units.forEach((u, k) => {
          u.x = pin[k][0];
          u.y = pin[k][1];
        });
        if (hitting && i % 30 === 0) {
          hammer.cd = 0;
          w.attackKeep(hammer);
        }
        w.step();
      }
      return k0 - w.keepHp;
    };
    const first = lossOver(15);
    lossOver(KEEP_PRESS_T * 2);
    const later = lossOver(15);
    expect(first).toBeGreaterThan(0);
    expect(later / first).toBeGreaterThan(2);
    expect(w.keepPressMul()).toBeLessThanOrEqual(1 + KEEP_PRESS_MAX);
    // one alert opens the assault; no fresh alert every few seconds while it goes on
    expect(w.events.filter((e) => e.type === 'keep').length).toBe(1);
    // driven off, the pressure ebbs; a new assault after a lull is announced again
    lossOver(60, false);
    expect(w.keepPressMul()).toBeLessThan(1 + KEEP_PRESS_MAX);
    lossOver(3);
    expect(w.events.filter((e) => e.type === 'keep').length).toBe(2);
  });
});

describe('dragon', () => {
  /** s9 with the dragon band spawned straight away (other bands skipped) */
  function dragonWorld() {
    const st = STAGES.find((x) => x.id === 's9')!;
    const s = armyFor(9);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 99));
    w.start();
    w.pending = [];
    w.spawnBand({ band: 'c_dragon', edge: 'W', span: [16, 18], delay: 0 }, 0);
    const d = w.enemies.find((e) => e.def.role === 'dragon')!;
    return { w, d };
  }
  const flee = (w: World, d: Unit, maxS: number) => {
    for (let i = 0; i < 30 * maxS && !d.fleeing && d.state === ST.ACTIVE; i++) w.step();
  };

  it('ignores the collapse of its retinue: unhurt, it stays and keeps burning', () => {
    const { w, d } = dragonWorld();
    for (let i = 0; i < 30 * 20; i++) w.step();
    const band = d.band!;
    for (const u of band.units) if (u !== d && u.state === ST.ACTIVE) w.killEnemy(u, null);
    w.breakBand(band);
    // keep it unhurt: only wounds or ballista bolts may send it away
    let breath = 0;
    for (let i = 0; i < 30 * 60 && w.state === 'battle'; i++) {
      d.hp = d.maxHp;
      d.pain = 0;
      w.step();
      if (d.fState === 1) breath += 1 / 30;
    }
    expect(d.fleeing).toBe(false);
    expect(d.state).toBe(ST.ACTIVE);
    expect(breath).toBeGreaterThan(10);
  });

  it('a storm of arrows harries it off long before it is badly hurt; stray shots never do', () => {
    const { w, d } = dragonWorld();
    const bow = w.defs.find((u) => u.def.id === 'd_archer' || u.def.id === 'd_xbow')!;
    // only the test's own shots reach it: the garrison's missile troops stand down
    for (const u of w.defs) if (u.def.range > 0 && u !== bow) u.state = ST.DEAD;
    bow.x = bow.y = -999;
    for (let i = 0; i < 30 * 15; i++) w.step();
    // stray shots: 1% of its HP every 3 s wears off faster than it builds
    for (let k = 0; k < 20 && !d.fleeing; k++) {
      w.damage(d, d.maxHp * 0.01, 1, bow, true);
      for (let i = 0; i < 90; i++) w.step();
    }
    expect(d.fleeing).toBe(false);
    expect(d.pain).toBeLessThan(1);
    // a storm: the same arrows all at once
    const hp0 = d.hp;
    for (let k = 0; k < 60 && d.pain < DRAGON_PAIN_MAX + 0.5; k++) w.damage(d, d.maxHp * 0.01, 1, bow, true);
    const lost = (hp0 - d.hp) / d.maxHp;
    expect(lost).toBeGreaterThanOrEqual(DRAGON_PAIN_MAX * DRAGON_PAIN_DMG - 0.001);
    expect(lost).toBeLessThan((DRAGON_PAIN_MAX + 1) * DRAGON_PAIN_DMG);
    flee(w, d, 1);
    expect(d.fleeing).toBe(true);
    expect(d.hp / d.maxHp).toBeGreaterThan(DRAGON_FLEE_HP);
    expect(w.stats.dragons).toBe(1);
  });

  it('is driven off by sustained ballista hits and counts once in stats.dragons', () => {
    const { w, d } = dragonWorld();
    const bal = w.defs.find((u) => u.def.id === 'd_ballista')!;
    for (let i = 0; i < 30 * 15; i++) w.step();
    for (let k = 0; k < DRAGON_PAIN_MAX + 1; k++) w.damage(d, 1, 0, bal, true);
    expect(d.hp / d.maxHp).toBeGreaterThan(0.9);
    flee(w, d, 1);
    expect(d.fleeing).toBe(true);
    expect(w.stats.dragons).toBe(1);
    // finishing it off on the way out does not count it twice
    w.damage(d, d.hp * 10, 1, bal, true);
    expect(d.state).toBe(ST.DEAD);
    expect(w.stats.dragons).toBe(1);
    expect(w.computeResult(true).dragons).toBe(1);
  });

  it('withdraws when badly wounded and never stays longer than the cap', () => {
    const a = dragonWorld();
    for (let i = 0; i < 30 * 15; i++) a.w.step();
    a.d.hp = a.d.maxHp * 0.3;
    flee(a.w, a.d, 1);
    expect(a.d.fleeing).toBe(true);
    expect(a.w.stats.dragons).toBe(1);
    const b = dragonWorld();
    b.d.hp = b.d.maxHp * 0.9; // barely scratched
    b.d.band!.units = [b.d]; // retinue irrelevant
    flee(b.w, b.d, DRAGON_MAX_STAY + 5);
    expect(b.d.fleeing).toBe(true);
    expect(b.w.t - b.d.bornT).toBeLessThan(DRAGON_MAX_STAY + 2);
  });
});

describe('fire and breath', () => {
  /** one holding spearman on the s3 west wall walk (x 38), nobody else on the field */
  function onWall() {
    const st = STAGES.find((x) => x.id === 's3')!;
    const s = armyFor(3);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 8));
    const sq = w.squads.find((q) => q.type.id === 'spear')!;
    w.placeSquad(sq, idx(38, 14));
    sq.auto = false;
    sq.stance = 'hold';
    w.start();
    w.pending = [];
    for (const e of w.enemies) e.state = ST.FLED;
    const top = sq.units.find((u) => u.elev)!;
    for (const u of w.defs) if (u !== top) u.state = ST.EVAC;
    return { w, top, sq };
  }
  const slotDist = (u: Unit) => Math.hypot(u.x - u.slotX, u.y - u.slotY);

  it('a soldier steps off a burning tile within a second, stays within the hold leash, and returns once it is out', () => {
    const { w, top } = onWall();
    const slot = tileAt(top.slotX, top.slotY);
    expect(tileAt(top.x, top.y)).toBe(slot);
    w.fire[slot] = 3;
    let off = -1;
    for (let i = 0; i < 30 && off < 0; i++) {
      w.step();
      if (w.fire[tileAt(top.x, top.y)] <= 0) off = i;
    }
    expect(off).toBeGreaterThanOrEqual(0);
    expect(top.elev, 'he keeps to the wall walk when a wall tile beside him is safe').toBe(true);
    expect(slotDist(top)).toBeLessThanOrEqual(w.leash(top.squad!));
    // he does not walk back into the fire while it burns
    while (w.fire[slot] > 0) {
      w.step();
      expect(tileAt(top.x, top.y)).not.toBe(slot);
    }
    for (let i = 0; i < 30 * 3; i++) w.step();
    expect(tileAt(top.x, top.y)).toBe(slot);
    expect(slotDist(top)).toBeLessThan(4);
    expect(top.hp, 'barely singed').toBeGreaterThan(top.maxHp * 0.9);
  });

  it('with the whole wall walk around him alight he steps down into the courtyard, and climbs back after', () => {
    const { w, top } = onWall();
    const slot = tileAt(top.slotX, top.slotY);
    for (const j of [slot - GW, slot, slot + GW]) w.fire[j] = 3;
    for (let i = 0; i < 30 && w.fire[tileAt(top.x, top.y)] > 0; i++) w.step();
    const at = tileAt(top.x, top.y);
    expect(w.fire[at]).toBe(0);
    expect(top.elev).toBe(false);
    expect(w.grid.inside[at]).toBe(1);
    for (let i = 0; i < 30 * 7; i++) w.step();
    expect(tileAt(top.x, top.y)).toBe(slot);
    expect(top.elev).toBe(true);
  });

  it('a fire pot that bursts on wall stone burns out quickly; on the ground it burns on', () => {
    const { w, top } = onWall();
    w.step();
    const enemy = w.enemies[0];
    const slot = tileAt(top.x, top.y);
    const ground = slot + 2; // two tiles east: the courtyard
    expect(w.grid.isElev(slot)).toBe(true);
    expect(w.grid.isElev(ground)).toBe(false);
    for (const [i, hit] of [
      [slot, true],
      [ground, false],
    ] as const) {
      w.fire[i] = 0;
      w.land({ x: 0, y: 0, sx: 0, sy: 0, tx: cx(i), ty: cy(i), t: 1, dur: 1, target: hit ? top : null, side: 1, dmg: 1, ap: 0, kind: 'fire', structTile: -1, area: false, src: enemy, keep: false });
    }
    expect(w.fire[slot]).toBeCloseTo(POT_FIRE_STONE, 5);
    expect(w.fire[ground]).toBeCloseTo(2.5, 5);
    expect(POT_FIRE_STONE).toBeLessThan(2);
  });

  it('soldiers in a breathing dragon\'s cone get out of it, and suffer far less than men who stay', () => {
    const st = STAGES.find((x) => x.id === 's9')!;
    const run = (frozen: boolean) => {
      const s = armyFor(9);
      const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 99));
      const sq = w.squads.find((q) => q.type.id === 'spear')!;
      w.start();
      w.pending = [];
      w.spawnBand({ band: 'c_dragon', edge: 'W', span: [16, 18], delay: 0 }, 0);
      const d = w.enemies.find((e) => e.def.role === 'dragon')!;
      for (const e of w.enemies) if (e !== d) e.state = ST.FLED;
      const men = sq.units.filter((u) => u.state === ST.ACTIVE && !u.elev);
      expect(men.length).toBeGreaterThan(3);
      for (const u of w.defs) if (!men.includes(u)) u.state = ST.EVAC;
      sq.auto = false;
      sq.stance = 'hold';
      // the dragon starts a breath at the squad from 3 tiles away
      let mx = 0;
      let my = 0;
      for (const u of men) {
        mx += u.x / men.length;
        my += u.y / men.length;
      }
      d.x = d.px = mx - 3 * 16;
      d.y = d.py = my;
      d.fx = 1;
      d.fy = 0;
      d.fState = 1;
      d.fT = 2.6;
      d.timer = 0.2;
      const hp0 = men.reduce((a, u) => a + u.hp, 0);
      for (let i = 0; i < Math.round(30 * 2.6); i++) {
        if (frozen) for (const u of men) u.cd = u.retarget = 99;
        if (frozen) for (const u of men) [u.slotX, u.slotY] = [u.x, u.y];
        const pos = frozen ? men.map((u) => [u.x, u.y]) : [];
        w.step();
        if (frozen) men.forEach((u, k) => ([u.x, u.y] = pos[k]));
      }
      const inCone = men.filter((u) => {
        if (u.state !== ST.ACTIVE) return true;
        const r = Math.hypot(u.x - d.x, u.y - d.y);
        return r < BREATH_LEN && Math.abs(Math.atan2(u.y - d.y, u.x - d.x)) < BREATH_HALF;
      }).length;
      return { lost: hp0 - men.reduce((a, u) => a + Math.max(0, u.hp), 0), inCone, n: men.length };
    };
    const dodge = run(false);
    const stay = run(true);
    expect(stay.inCone).toBeGreaterThan(0);
    expect(dodge.inCone).toBe(0);
    expect(dodge.lost).toBeLessThan(stay.lost * 0.6);
  });
});

describe('keep defence', () => {
  it('shooters leave a quiet wall to bring enemies at the keep within range', () => {
    const st = STAGES.find((x) => x.id === 's8')!;
    const s = armyFor(8);
    s.settings.autoCommand = true;
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 31));
    w.start();
    w.pending = [];
    w.spawnBand({ band: 'h_company', edge: 'W', span: [16, 18], delay: 0 }, 0);
    const g = w.grid;
    const ring: number[] = [];
    for (let i = 0; i < g.n; i++) if (g.keepAdj[i] && g.inside[i]) ring.push(i);
    w.enemies.forEach((e, k) => {
      const t = ring[(k * 7) % ring.length];
      e.x = e.px = ((t % GW) + 0.5) * 16;
      e.y = e.py = (Math.floor(t / GW) + 0.5) * 16;
    });
    // only the shooters act
    for (const q of w.squads) if (!q.type.ranged) for (const u of q.units) if (u.state === ST.ACTIVE) u.state = ST.EVAC;
    const shooters = w.squads.filter((q) => q.auto && q.type.ranged && q.type.id !== 'ballista');
    expect(shooters.length).toBeGreaterThan(0);
    // the s8 walls are far from the keep: nobody can reach it from his post
    const reach = (q: (typeof shooters)[number]) =>
      q.units.some((u) => u.state === ST.ACTIVE && w.activeEnemies.some((e) => !e.fleeing && Math.hypot(e.x - u.x, e.y - u.y) <= u.def.range * (u.elev ? 1.25 : 1) * 16));
    expect(shooters.filter(reach).length).toBe(0);
    let hits = 0;
    const dmg = w.damage.bind(w);
    w.damage = (t, d, ap, src, ranged) => {
      if (src && src.side === 0 && ranged) hits++;
      return dmg(t, d, ap, src, ranged);
    };
    for (let i = 0; i < 30 * 20; i++) w.step();
    expect(shooters.filter(reach).length).toBe(shooters.length);
    expect(hits).toBeGreaterThan(50);
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
    expect(w.t).toBeLessThanOrEqual(BATTLE_HARD_CAP + 1e-6); // ended by itself, never by the test's surrender
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

// ---------------------------------------------------------------- balance & depth

/** a world of `stageId` brought to its first intermission (wave 1 swept away) */
function atCouncil(stageId: string, seed: number, auto: boolean) {
  const st = STAGES.find((x) => x.id === stageId)!;
  const s = armyFor(st.index);
  s.settings.autoCommand = auto;
  const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, seed));
  w.start();
  w.pending = [];
  for (const e of w.enemies) e.state = ST.DEAD;
  w.step();
  expect(w.state).toBe('intermission');
  return w;
}

describe('war council', () => {
  it('offers three named options each intermission, the same for the same seed and wave', () => {
    const a = atCouncil('s6', 11, false);
    const b = atCouncil('s6', 11, false);
    const oa = a.councilOptions();
    expect(oa.length).toBe(3);
    expect(new Set(oa.map((o) => o.id)).size).toBe(3);
    expect(oa).toEqual(b.councilOptions());
    // names <= 6 characters, descriptions <= 30, for every option of the pool
    for (const id of COUNCIL_IDS) {
      expect([...COUNCIL_NAMES[id]].length, id).toBeLessThanOrEqual(6);
      const d = councilDesc(a, id);
      expect(d.length, id).toBeGreaterThan(0);
      expect([...d].length, d).toBeLessThanOrEqual(30);
    }
    // different seeds draw different offers, and the whole pool shows up
    const seen = new Set<string>();
    const sets = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const w = atCouncil('s6', seed, false);
      const ids = w.councilOptions().map((o) => o.id);
      ids.forEach((i) => seen.add(i));
      sets.add(ids.join(','));
    }
    expect(sets.size).toBeGreaterThan(5);
    expect([...seen].sort()).toEqual([...COUNCIL_IDS].sort());
    // not outside an intermission
    const w = atCouncil('s6', 11, false);
    w.skipIntermission();
    expect(w.state).toBe('battle');
    expect(w.councilOptions()).toEqual([]);
    expect(w.chooseCouncil(oa[0].id)).toBe(false);
  });

  it('allows one pick per intermission, which takes effect at once and is announced', () => {
    const w = atCouncil('s6', 11, false);
    w.councilOffer = ['resupply', 'repair', 'rest'];
    w.events.length = 0;
    const arrows = w.supplies.arrows;
    expect(w.chooseCouncil('scout')).toBe(false); // not on offer
    expect(w.chooseCouncil('resupply')).toBe(true);
    expect(w.supplies.arrows).toBe(arrows + w.councilAmt.resupply);
    expect(w.councilOptions(), 'none left after a pick').toEqual([]);
    expect(w.councilPick).toBe('resupply');
    expect(w.chooseCouncil('repair')).toBe(false);
    expect(w.events.filter((e) => e.type === 'council').length).toBe(1);

    // repair: damaged walls and gates get REPAIR_FRAC of their strength back
    const r = atCouncil('s6', 11, false);
    const g = r.grid;
    const wall = g.structTiles.find((i) => g.tiles[i] === Tile.WALL)!;
    const gate = g.structTiles.find((i) => g.tiles[i] === Tile.GATE)!;
    g.hp[wall] = g.maxHp[wall] * 0.1;
    g.hp[gate] = g.maxHp[gate] * 0.5;
    r.councilOffer = ['repair', 'rest', 'scout'];
    expect(r.chooseCouncil('repair')).toBe(true);
    expect(g.hp[wall] / g.maxHp[wall]).toBeCloseTo(0.1 + REPAIR_FRAC, 5);
    expect(g.hp[gate] / g.maxHp[gate]).toBeCloseTo(Math.min(1, 0.5 + REPAIR_FRAC), 5);

    // gate: a broken gate stands again, an intact one is stronger than before
    const q = atCouncil('s6', 11, false);
    const gq = q.grid;
    const gates = gq.structTiles.filter((i) => gq.tiles[i] === Tile.GATE);
    const full = gq.maxHp[gates[1]];
    q.destroyStruct(gates[0], 'broken');
    expect(gq.tiles[gates[0]]).toBe(Tile.GATE_BROKEN);
    q.councilOffer = ['gate', 'rest', 'scout'];
    expect(q.chooseCouncil('gate')).toBe(true);
    expect(gq.tiles[gates[0]]).toBe(Tile.GATE);
    expect(gq.maxHp[gates[1]]).toBeCloseTo(full * GATE_BOOST, 3);
    expect(gq.maxHp[gates[0]]).toBeCloseTo(q.gateBaseHp() * GATE_BOOST, 3);
    expect(gq.hp[gates[1]]).toBeCloseTo(gq.maxHp[gates[1]], 3);

    // scout: a report of the next wave, by side
    const sc = atCouncil('s6', 11, false);
    sc.councilOffer = ['scout', 'rest', 'repair'];
    sc.events.length = 0;
    expect(sc.chooseCouncil('scout')).toBe(true);
    const rep = sc.events.find((e) => e.type === 'scout')!;
    expect(rep.text).toContain('정찰 보고');
    for (const e of sc.nextWaveEdges()) expect(rep.text).toContain({ W: '서쪽', N: '북쪽', S: '남쪽', E: '동쪽' }[e]!);
  });

  it('an untaken council is decided by the council itself when the next wave starts, auto-commander or not', () => {
    const a = atCouncil('s6', 11, true);
    const n = atCouncil('s6', 11, false);
    for (const w of [a, n]) {
      w.events.length = 0;
      w.skipIntermission();
      expect(w.state).toBe('battle');
      expect(w.councilLog.length).toBe(1);
      const ev = w.events.find((e) => e.type === 'council')!;
      expect(ev.text).toContain('작전 회의가');
      expect(ev.text).toContain(COUNCIL_NAMES[w.councilLog[0]]);
    }
    // letting the offer lapse never costs the pick: the same option with or without the auto-commander
    expect(n.councilLog).toEqual(a.councilLog);
    // a pick the player made stands, and nothing more is added when the wave starts
    const p = atCouncil('s6', 11, false);
    const other = p.councilOffer.find((id) => id !== a.councilLog[0])!;
    expect(p.chooseCouncil(other)).toBe(true);
    p.skipIntermission();
    expect(p.councilLog).toEqual([other]);
    // the pick answers the castle's need: with the stores empty of food, it forages
    const f = atCouncil('s6', 12, false);
    f.councilOffer = ['scout', 'forage', 'rest'];
    f.supplies.food = 0;
    f.skipIntermission();
    expect(f.councilLog).toEqual(['forage']);
    expect(f.starving).toBe(false);
  });
});

/** where a band of `lane` would appear on a castle built from `seed` */
function laneCheck(st: StageDef, seed: number) {
  const g = new Grid();
  st.build(g, new RNG(seed));
  g.finalize(1);
  const fld = () => ({ dist: new Float64Array(GW * GH), next: new Int32Array(GW * GH) });
  const breach = fld();
  const esc = fld();
  g.enemyField('breach', breach);
  g.enemyField('escalade', esc);
  const lanes: { edge: Edge; span: [number, number] }[] = [...(st.lanes ?? []), ...st.waves.flatMap((w) => w.groups)];
  for (const l of lanes)
    for (const along of [l.span[0], (l.span[0] + l.span[1]) / 2, l.span[1]]) {
      const t = g.spawnTile(l.edge, along);
      const where = `${st.id} ${l.edge} ${along}`;
      expect(t, where).toBeGreaterThanOrEqual(0);
      const x = t % GW;
      const y = Math.floor(t / GW);
      const off = l.edge === 'W' ? x : l.edge === 'E' ? GW - 1 - x : l.edge === 'N' ? y : GH - 1 - y;
      expect(off, `${where}: spawns ${off} tiles in from its edge`).toBeLessThanOrEqual(6);
      expect(g.wallDist[t], `${where}: spawns ${g.wallDist[t].toFixed(1)} tiles from the walls`).toBeGreaterThanOrEqual(SPAWN_GAP);
      expect(isFinite(breach.dist[t]) && isFinite(esc.dist[t]), `${where} reaches the keep`).toBe(true);
    }
}

describe('approaches', () => {
  it.each(STAGES.map((s) => [s.id, s]))('%s: every lane spawns outside, near its edge, clear of the walls, and reaches the keep', (_id, st) => {
    for (const seed of [1, 2, 3, 123]) laneCheck(st, seed);
  });

  it('the endless siege rotates through castles whose lanes all reach the keep', () => {
    const ids = new Set<string>();
    for (let seed = 0; seed < ENDLESS_CASTLES.length * 3; seed++) {
      const st = endlessStage(seed);
      ids.add(st.name + '|' + st.subtitle);
      if (seed < ENDLESS_CASTLES.length) laneCheck({ ...st, waves: st.waves.slice(0, 12) }, seed);
    }
    expect(ids.size).toBe(ENDLESS_CASTLES.length);
  });

  it('the plan is fixed per seed, keeps every band, and spreads the attack over several sides', () => {
    const count = (ws: { groups: { n?: number }[] }[]) => ws.map((w) => w.groups.reduce((a, g) => a + (g.n ?? 1), 0));
    let west = 0;
    let all = 0;
    for (const st of STAGES.filter((s) => s.index >= 5)) {
      expect(planWaves(st, 5)).toEqual(planWaves(st, 5));
      const differs = [6, 7, 8, 9].some((s) => JSON.stringify(planWaves(st, s)) !== JSON.stringify(planWaves(st, 5)));
      expect(differs, st.id).toBe(true);
      for (let seed = 1; seed <= 20; seed++) {
        const p = planWaves(st, seed);
        expect(count(p)).toEqual(count(st.waves));
        for (const w of p)
          for (const g of w.groups) {
            all += g.n ?? 1;
            if (g.edge === 'W') west += g.n ?? 1;
          }
      }
    }
    // before: about 3 in 4 bands came from the west
    expect(west / all).toBeLessThan(0.6);
    // the first wave of the first castle always comes the scripted way
    for (let seed = 1; seed <= 20; seed++) expect(planWaves(STAGES[0], seed)[0]).toEqual(STAGES[0].waves[0]);
  });

  it('nextWaveEdges announces exactly the sides each wave then comes from', () => {
    const st = STAGES.find((x) => x.id === 's8')!;
    const s = armyFor(8);
    s.settings.autoCommand = true;
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 5));
    const announced: string[][] = [];
    announced[0] = w.nextWaveEdges();
    w.start();
    let wasInter = false;
    while ((w.state === 'battle' || w.state === 'intermission') && w.t < BATTLE_HARD_CAP) {
      w.step();
      if (w.state === 'intermission' && !wasInter) announced[w.waveIdx + 1] = w.nextWaveEdges();
      wasInter = w.state === 'intermission';
      if (w.state === 'battle' && !announced[w.waveIdx]) announced[w.waveIdx] = w.nextWaveEdges();
    }
    const sideOf = (u: Unit): Edge => (u.spawnX < 0 ? 'W' : u.spawnX > 960 ? 'E' : u.spawnY < 0 ? 'N' : 'S');
    const came: Set<string>[] = [];
    for (const b of w.bands) (came[b.wave] ??= new Set()).add(sideOf(b.units[0]));
    expect(came.length).toBeGreaterThan(2);
    const sides = new Set<string>();
    came.forEach((c, i) => {
      expect([...c].sort(), `wave ${i + 1}`).toEqual([...announced[i]].sort());
      c.forEach((e) => sides.add(e));
    });
    expect(sides.size).toBeGreaterThan(1);
  });
});

describe('levy', () => {
  it('a wiped-out army still fields the castle militia, which costs nothing and is not kept', () => {
    const st = STAGES.find((x) => x.id === 's4')!;
    const s = newSave(0);
    const full = battleConfig(s, st, defaultLineup(s, st), {}, 5);
    expect(full.squads.some((q) => q.type === 'militia')).toBe(false);
    for (const r of s.roster) r.soldiers = [];
    const ids = defaultLineup(s, st);
    expect(lineupSoldiers(s, ids)).toBe(0);
    const cfg = battleConfig(s, st, ids, {}, 5);
    expect(cfg.squads.length).toBe(LEVY_MAX_SQUADS);
    expect(cfg.squads.every((q) => q.type === 'militia')).toBe(true);
    expect(cfg.squads.reduce((n, q) => n + q.soldiers.length, 0)).toBeGreaterThanOrEqual(LEVY_BELOW);
    const w = new World(cfg);
    w.start();
    while ((w.state === 'battle' || w.state === 'intermission') && w.t < 120) w.step();
    if (!w.result) w.surrender();
    const roster = JSON.stringify(s.roster);
    applyBattle(s, st, w.result!, 'campaign', new Date(2027, 0, 1));
    expect(JSON.stringify(s.roster)).toBe(roster);
    expect(s.gold).toBeGreaterThan(0);
  });
});

describe('supplies', () => {
  it('foodNeeded is the ration the sim hands out: half a ration per soldier per wave', () => {
    const st = STAGES.find((x) => x.id === 's5')!;
    const s = armyFor(5);
    const ids = defaultLineup(s, st);
    const w = new World(battleConfig(s, st, ids, {}, 3));
    const n = lineupSoldiers(s, ids);
    const f0 = w.supplies.food;
    w.start();
    expect(f0 - w.supplies.food).toBe(Math.ceil(n / 2));
    expect(foodNeeded(st, n)).toBe(st.waves.length * Math.ceil(n / 2));
  });

  it('the first two castles feed their army; later castles need packs or the council', () => {
    const s = newSave(0);
    for (const id of ['s1', 's2']) {
      const st = STAGES.find((x) => x.id === id)!;
      if (id === 's2') s.roster.push(newSquad(s, 'archer')); // free squad for the first win
      const n = lineupSoldiers(s, defaultLineup(s, st));
      expect(baseSupplies(s, st).food, id).toBeGreaterThanOrEqual(foodNeeded(st, n));
    }
    for (const st of STAGES.filter((x) => x.index >= 3)) {
      const a = armyFor(st.index);
      const n = lineupSoldiers(a, defaultLineup(a, st));
      expect(baseSupplies(a, st).food, st.id).toBeLessThan(foodNeeded(st, n));
    }
  });

  it('research tops out expensive: the last levels cost far more than the first', () => {
    let total = 0;
    for (const u of UPGRADES) for (let lv = 0; lv < u.max; lv++) total += upgradeCost(u, lv);
    expect(total).toBeGreaterThan(20000);
    const masonry = UPGRADES.find((u) => u.id === 'masonry')!;
    expect(upgradeCost(masonry, 4) / upgradeCost(masonry, 3)).toBeGreaterThan(2.5);
  });
});

describe('daily and endless', () => {
  it("'대군' brings 1.5x the bands of every wave, as it says", () => {
    for (const st of STAGES)
      for (const w of st.waves) {
        const n = w.groups.reduce((a, g) => a + (g.n ?? 1), 0);
        const m = swarmWave(w).groups.reduce((a, g) => a + (g.n ?? 1), 0);
        expect(m, st.id).toBe(Math.round(n * 1.5));
      }
  });

  it('endless waves grow in number and strength', () => {
    const st = endlessStage(7);
    // bands per wave, not counting the dragon of every tenth wave
    const bands = st.waves.map((w) => w.groups.filter((g) => g.band !== 'c_dragon').length);
    for (let i = 1; i < st.waves.length; i++) {
      expect(st.waves[i].mul!).toBeGreaterThan(st.waves[i - 1].mul!);
      expect(bands[i]).toBeGreaterThanOrEqual(bands[i - 1]);
    }
    expect(bands[24]).toBeGreaterThanOrEqual(bands[0] * 3);
    // a later wave's soldiers are tougher than the same soldiers in the first wave
    const s = armyFor(8);
    const w = new World(battleConfig(s, st, defaultLineup(s, st), {}, 7));
    w.start();
    const g = { band: 'h_levies', edge: 'W' as Edge, span: [16, 18] as [number, number], delay: 0 };
    w.waveIdx = 0;
    w.spawnBand(g, 0);
    const first = w.enemies[w.enemies.length - 1];
    w.waveIdx = 20;
    w.spawnBand(g, 0);
    const late = w.enemies[w.enemies.length - 1];
    expect(late.def).toBe(first.def);
    expect(late.maxHp / first.maxHp).toBeCloseTo(st.waves[20].mul! / st.waves[0].mul!, 5);
    expect(late.atkMul / first.atkMul).toBeCloseTo(st.waves[20].mul! / st.waves[0].mul!, 5);
  });

  it('a supply train reaches the endless castle before every later wave, and the food forecast counts it', () => {
    const st = endlessStage(3);
    const s = armyFor(8);
    s.settings.autoCommand = false;
    const ids = defaultLineup(s, st);
    const w = new World(battleConfig(s, st, ids, {}, 11));
    w.start();
    expect(w.events.some((e) => e.type === 'resupply')).toBe(false);
    let food = w.supplies.food;
    let mats = w.supplies.mats;
    while (w.waveIdx === 0 && w.t < 400) {
      food = w.supplies.food;
      mats = w.supplies.mats;
      w.events.length = 0;
      // no council offer in between: a lapsed offer is decided by the council, and forage would add food too
      if (w.state === 'intermission') w.councilOffer = [];
      w.step();
    }
    expect(w.waveIdx).toBe(1);
    expect(w.events.some((e) => e.type === 'resupply')).toBe(true);
    const mouths = Math.ceil(w.defs.filter((u) => u.state === ST.ACTIVE).length / 2);
    // the train fills the stores up to what they held at the start, no further
    const cap = (k: 'food' | 'mats', before: number) => Math.floor(Math.min(ENDLESS_RESUPPLY[k]!, w.startSupplies[k] - before));
    expect(cap('food', food)).toBeGreaterThan(0);
    expect(w.supplies.food).toBe(food + cap('food', food) - mouths);
    expect(w.supplies.mats).toBeGreaterThanOrEqual(mats + Math.max(0, cap('mats', mats)) - 1);
    for (const k of ['food', 'arrows', 'mats', 'meds'] as const) expect(w.supplies[k]).toBeLessThanOrEqual(w.startSupplies[k]);
    // a full army eats more than a train carries: the granary runs down over the waves
    const n = lineupSoldiers(s, ids);
    const r = Math.ceil(n / 2);
    expect(r).toBeGreaterThan(ENDLESS_RESUPPLY.food!);
    // the forecast: one ration in store, then what the train does not cover, over the first 10 waves
    expect(foodNeeded(st, n)).toBe(r + 9 * Math.max(0, r - ENDLESS_RESUPPLY.food!));
    expect(foodNeeded(st, 2 * ENDLESS_RESUPPLY.food!)).toBe(ENDLESS_RESUPPLY.food!);
    // campaign castles get no train
    expect(STAGES.every((x) => !x.resupply)).toBe(true);
  });
});
