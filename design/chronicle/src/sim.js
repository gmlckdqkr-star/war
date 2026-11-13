// ============================================================================
// sim: deterministic, fixed step (1/30 s), seeded RNG. It knows nothing about drawing.
// It only appends to `fx` (render-only events) which it never reads back.
// ============================================================================
const ST = { ACTIVE: 0, CLIMB: 1, FALL: 2, DEAD: 3 };
const STATS = {
  d_spear: { hp: 100, atk: 9, armor: 0.22, reach: 8.5, cd: 1.1, speed: 22, r: 3.2 },
  d_sword: { hp: 125, atk: 11, armor: 0.36, reach: 4.5, cd: 1.0, speed: 21, r: 3.4 },
  d_archer: { hp: 75, atk: 9, armor: 0.1, reach: 3.5, cd: 1.8, speed: 22, r: 3, range: 235 },
  h_levy: { hp: 70, atk: 7, armor: 0.12, reach: 6, cd: 1.2, speed: 19, r: 3.2 },
  h_maa: { hp: 115, atk: 11, armor: 0.36, reach: 4.5, cd: 1.0, speed: 18, r: 3.5 },
  h_bow: { hp: 65, atk: 8, armor: 0.1, reach: 3, cd: 3.4, speed: 19, r: 3, range: 340 },
  h_ladder: { hp: 75, atk: 7, armor: 0.12, reach: 3, cd: 1.2, speed: 17, r: 3.3 },
  o_grunt: { hp: 125, atk: 12, armor: 0.25, reach: 4.5, cd: 1.0, speed: 21, r: 3.9 },
  o_goblin: { hp: 40, atk: 5, armor: 0, reach: 3.5, cd: 0.9, speed: 29, r: 2.6 },
  o_berserk: { hp: 150, atk: 16, armor: 0.1, reach: 4.5, cd: 0.8, speed: 26, r: 4 },
};
const NORTH_WALK = [66 + 4, 168 - 4], SOUTH_WALK = [252 + 4, 352 - 4];

class Sim {
  constructor(seed, n) {
    this.rng = RNG(seed);
    this.t = 0; this.steps = 0;
    this.units = []; this.proj = []; this.fx = []; this.fires = [];
    this.nextId = 1;
    this.gate = { hp: 150, max: 1100, broken: false };
    this.keep = 94;
    this.ladders = [];
    this.squads = [];
    this.kills = { ours: 0, theirs: 0 };
    this.stats = { fell: 0, ladderBurnt: 0, gateBrokenT: -1, oilT: -1, ramBurnT: -1, firstArcherDeath: -1 };
    this.wave = 3; this.waves = 5;
    this.abil = { oil: { cd: 0, max: 38 } };
    this.scale = n / 100;
    this.grid = new Map();
    this.setup();
  }
  cnt(k) { return Math.max(1, Math.round(k * this.scale)); }
  add(kind, x, y, role, extra = {}) {
    const S = STATS[kind];
    const u = { id: this.nextId++, k: KIDX[kind], kind, side: KINDS[KIDX[kind]].side, x, y, px: x, py: y, z: 0, pz: 0, hp: S.hp, maxHp: S.hp, st: ST.ACTIVE, cd: this.rng.range(0, S.cd), tgt: null, retT: this.rng.range(0, 0.5), fx: KINDS[KIDX[kind]].side ? 1 : -1, role, S, squad: null, slotX: x, slotY: y, ladder: -1, climbT: 0, onWall: false, hitT: 0, v: this.rng.int(0, 1), pose: this.rng.int(0, 2), fallT: 0, bowT: 0, ...extra };
    this.units.push(u);
    return u;
  }
  setup() {
    const r = this.rng;
    // --- our squads
    const sq = (name, emblem, kind, n, slotFn, type) => { const s = { name, emblem, kind, n, units: [], morale: 82, type, sel: false, lost: 0 }; this.squads.push(s); for (let i = 0; i < n; i++) { const [x, y] = slotFn(i); const u = this.add(kind, x + r.range(-0.6, 0.6), y + r.range(-0.6, 0.6), type === 'wall' ? 'wallArcher' : 'line', { slotX: x, slotY: y }); u.squad = s; s.units.push(u); if (type === 'wall') { u.z = WH; u.pz = WH; u.onWall = true; } } return s; };
    const nSp = this.cnt(12), nSw = this.cnt(12), nAr = this.cnt(8);
    const files = 4;
    const sp = sq('회색매 창병대', 'hawk', 'd_spear', nSp, (i) => [WX + WW + 12 + Math.floor(i / files) * 8.5, GYC - 12.75 + (i % files) * 8.5 + (Math.floor(i / files) % 2) * 1.5], 'line');
    sp.sel = true; sp.engage = 64; sp.threshold = true;
    const sw = sq('브란의 방패검병대', 'chevron', 'd_sword', nSw, (i) => [588 + Math.floor(i / files) * 8.2, 236 + (i % files) * 8.2], 'line');
    sw.engage = 96;
    const walkSlots = (a, b, n) => (i) => [WX + 9, a + ((b - a) * (i + 0.5)) / n];
    sq('갈대피리 궁수대', 'reed', 'd_archer', nAr, walkSlots(NORTH_WALK[0], NORTH_WALK[1], nAr), 'wall');
    sq('물레 궁수대', 'wheel', 'd_archer', nAr, walkSlots(SOUTH_WALK[0], SOUTH_WALK[1], nAr), 'wall');

    // --- ladders (already raised) — north and south
    this.ladders.push({ y: 116, up: 1, alive: true, burning: false, q: [], climbers: 0, raiseT: 1, id: 0 });
    this.ladders.push({ y: 304, up: 1, alive: true, burning: false, q: [], climbers: 0, raiseT: 1, id: 1 });

    // --- Concord: ladder parties + longbows
    const party = (L, nLevy, nMaa) => {
      for (let i = 0; i < nLevy; i++) { const u = this.add('h_levy', WX - 22 - r.range(0, 60), L.y + r.range(-18, 18), 'ladder', { ladder: L.id }); }
      for (let i = 0; i < nMaa; i++) { const u = this.add('h_maa', WX - 40 - r.range(0, 60), L.y + r.range(-16, 16), 'ladder', { ladder: L.id }); }
    };
    party(this.ladders[0], this.cnt(6), this.cnt(3));
    party(this.ladders[1], this.cnt(6), this.cnt(3));
    // first climber already half-way up the north ladder
    const first = this.units.find((u) => u.role === 'ladder' && u.ladder === 0);
    if (first) { first.st = ST.CLIMB; first.climbT = 0.55; first.x = WX - 12; first.y = 116; this.ladders[0].climbers = 1; }
    const nBow = this.cnt(10);
    for (let i = 0; i < nBow; i++) {
      const y = 112 + (i * 196) / Math.max(1, nBow - 1) + r.range(-5, 5);
      const u = this.add('h_bow', 262 + r.range(-6, 6) + (i % 2) * 7, y, 'bow');
      u.slotX = u.x; u.slotY = u.y; u.cd = 0.4 + (i % 4) * 0.12 + r.range(0, 0.2);
    }
    // --- Ashtusk: the ram, its crew, and the warband waiting at the gate
    this.ram = { x: WX - 26, y: GYC, px: WX - 26, py: GYC, hp: 750, max: 750, swingT: 0.0, phase: 0, burning: false, wreck: false, back: false, crew: [] };
    for (let i = 0; i < this.cnt(4); i++) { const u = this.add('o_grunt', this.ram.x - 20 - (i % 2) * 5, GYC - 8 + Math.floor(i / 2) * 16 + r.range(-1, 1), 'crew'); u.crewI = i; this.ram.crew.push(u); }
    const nG = this.cnt(8), nGob = this.cnt(10), nB = this.cnt(2);
    for (let i = 0; i < nG; i++) this.add('o_grunt', WX - 70 - r.range(0, 70), GYC + r.range(-46, 46), 'gate');
    for (let i = 0; i < nGob; i++) this.add('o_goblin', WX - 48 - r.range(0, 80), GYC + r.range(-58, 58), 'gate');
    for (let i = 0; i < nB; i++) this.add('o_berserk', WX - 90 - r.range(0, 40), GYC + r.range(-30, 30), 'gate');
    this.enemyCap = Math.round(this.units.filter((u) => u.side === 1).length * 1.05);
    this.reinf = [
      { t: 6.0, list: [['o_goblin', 6], ['o_grunt', 2]], role: 'gate', y: GYC },
      { t: 12.0, list: [['o_berserk', 3], ['o_grunt', 3]], role: 'gate', y: GYC + 30 },
      { t: 16.5, list: [['h_ladder', 2], ['h_levy', 4], ['h_maa', 2]], role: 'carrier', y: 296 },
      { t: 22.0, list: [['o_goblin', 7]], role: 'gate', y: GYC - 30 },
      { t: 27.0, list: [['h_levy', 5], ['o_grunt', 3]], role: 'gate', y: GYC + 10 },
    ];
  }

  enemiesOf(u) { return u.side === 0 ? 1 : 0; }
  dmgUnit(u, raw, src, kind) {
    if (u.st === ST.DEAD) return;
    const d = raw * (1 - u.S.armor) * this.rng.range(0.82, 1.18);
    u.hp -= d; u.hitT = 0.14;
    if (src) { const dx = u.x - src.x, dy = u.y - src.y, l = Math.hypot(dx, dy) || 1; u.x += (dx / l) * 1.2; u.y += (dy / l) * 1.2; }
    const lethal = u.hp <= 0;
    this.fx.push({ k: 'hit', x: u.x, y: u.y, z: u.z, dx: src ? Math.sign(u.x - src.x) || 1 : 1, lethal, kind, side: u.side });
    if (lethal) this.kill(u, src);
  }
  kill(u, src) {
    if (u.st === ST.CLIMB && this.ladders[u.ladder]) this.ladders[u.ladder].climbers = Math.max(0, this.ladders[u.ladder].climbers - 1);
    if (u.st === ST.CLIMB || (u.onWall && u.side === 1 && this.rng() < 0.5)) {
      u.st = ST.FALL; u.fallT = 0; u.fallZ = u.z; u.onWall = false; u.x = Math.min(u.x, WX - 4); return;
    }
    u.st = ST.DEAD; u.hp = 0;
    if (u.side === 0) { this.kills.theirs++; if (u.squad) u.squad.lost++; if (u.kind === 'd_archer' && this.stats.firstArcherDeath < 0) { this.stats.firstArcherDeath = this.t; this.fx.push({ k: 'bark', key: 'archer_down', who: u.squad && u.squad.name }); } }
    else this.kills.ours++;
    this.fx.push({ k: 'die', x: u.x, y: u.y, z: u.z, kind: u.k, v: u.v, dir: u.fx, pose: u.pose, onWall: u.onWall, id: u.id, side: u.side });
  }

  step() {
    const dt = DT; this.t += dt; this.steps++;
    const r = this.rng;
    // scripted commander actions (the "player" in this demo): oil on the south ladder, fire arrows on the ram
    if (this.stats.oilT < 0 && this.t >= 8.0) this.useOil(this.ladders[1]);
    if (this.stats.ramBurnT < 0 && this.t >= 11.0 && this.ram && !this.ram.wreck) { this.ram.burning = true; this.stats.ramBurnT = this.t; this.fx.push({ k: 'ignite', x: this.ram.x, y: this.ram.y, big: true }); this.fx.push({ k: 'bark', key: 'ram_burn' }); }
    for (const a of Object.values(this.abil)) if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
    // reinforcements
    while (this.reinf.length && this.reinf[0].t <= this.t) {
      const R = this.reinf.shift();
      const alive = this.units.filter((u) => u.side === 1 && u.st !== ST.DEAD).length;
      let room = Math.max(0, this.enemyCap + 6 - alive);
      for (const [kind, n0] of R.list) {
        const n = Math.min(room, this.cnt(n0)); room -= n;
        for (let i = 0; i < n; i++) {
          const u = this.add(kind, -8 - r.range(0, 30), R.y + r.range(-34, 34), R.role === 'carrier' && kind !== 'h_ladder' ? 'ladder' : R.role);
          if (R.role === 'carrier') { u.ladder = 2; if (kind === 'h_ladder') u.role = 'carrier'; }
        }
      }
    }
    this.updateRam(dt);
    this.updateLadders(dt);
    // spatial hash
    this.grid.clear();
    for (const u of this.units) { if (u.st === ST.DEAD) continue; const key = ((u.x / 12) | 0) * 1000 + ((u.y / 12) | 0); let a = this.grid.get(key); if (!a) this.grid.set(key, (a = [])); a.push(u); }
    for (const u of this.units) {
      if (u.st === ST.DEAD) continue;
      u.px = u.x; u.py = u.y; u.pz = u.z;
      if (u.cd > 0) u.cd -= dt;
      if (u.hitT > 0) u.hitT -= dt;
      if (u.st === ST.FALL) { u.fallT += dt; u.z = Math.max(0, u.fallZ * (1 - (u.fallT / 0.45) ** 2)); u.x -= 8 * dt; if (u.z <= 0) { u.st = ST.ACTIVE; u.z = 0; this.stats.fell++; u.st = ST.DEAD; u.hp = 0; this.kills.ours++; this.fx.push({ k: 'die', x: u.x, y: u.y, z: 0, kind: u.k, v: u.v, dir: u.fx, pose: u.pose, fall: true, id: u.id, side: 1 }); this.fx.push({ k: 'thud', x: u.x, y: u.y }); } continue; }
      if (u.st === ST.CLIMB) { this.climb(u, dt); continue; }
      this.think(u, dt);
    }
    this.separate();
    for (const u of this.units) if (u.st === ST.ACTIVE) this.constrain(u);
    this.updateProj(dt);
    this.updateFires(dt);
    this.updateMorale(dt);
    if (this.steps % 90 === 0) this.units = this.units.filter((u) => u.st !== ST.DEAD);
  }

  nearestEnemy(u, maxD, pred) {
    let best = null, bd = maxD * maxD;
    const cx = (u.x / 12) | 0, cy = (u.y / 12) | 0, R = Math.ceil(maxD / 12);
    for (let i = cx - R; i <= cx + R; i++) for (let j = cy - R; j <= cy + R; j++) {
      const a = this.grid.get(i * 1000 + j); if (!a) continue;
      for (const o of a) {
        if (o.side === u.side || o.st !== ST.ACTIVE) continue;
        if (pred && !pred(o)) continue;
        const dx = o.x - u.x, dy = o.y - u.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
    }
    return best;
  }
  moveTo(u, tx, ty, speedMul = 1, stopD = 0.5) {
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (d < stopD) return true;
    const sp = u.S.speed * speedMul * DT;
    const k = Math.min(1, sp / d);
    u.x += dx * k; u.y += dy * k;
    if (Math.abs(dx) > 0.3) u.fx = Math.sign(dx);
    return false;
  }
  melee(u, t) {
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    const reach = u.S.r + t.S.r + u.S.reach;
    u.fx = Math.sign(t.x - u.x) || u.fx;
    if (d > reach) { this.moveTo(u, t.x, t.y, 1, reach * 0.9); return; }
    if (u.cd <= 0) { u.cd = u.S.cd * this.rng.range(0.9, 1.15); this.dmgUnit(t, u.S.atk, u, 'melee'); }
  }
  think(u, dt) {
    const r = this.rng;
    u.retT -= dt;
    switch (u.role) {
      case 'line': {
        const sq = u.squad, eng = sq.engage;
        if (u.retT <= 0 || (u.tgt && u.tgt.st !== ST.ACTIVE)) {
          u.retT = 0.35 + r() * 0.2;
          u.tgt = this.nearestEnemy(u, eng + 20, (o) => o.z === 0 && o.x > (sq.threshold ? WX + 4 : WX + WW + 1) && Math.hypot(o.x - u.slotX, o.y - u.slotY) < eng);
        }
        if (u.tgt && u.tgt.st === ST.ACTIVE) this.melee(u, u.tgt);
        else { this.moveTo(u, u.slotX, u.slotY, 0.7, 0.6); u.fx = -1; }
        break;
      }
      case 'wallArcher': {
        if (u.retT <= 0 || (u.tgt && u.tgt.st !== ST.ACTIVE && u.tgt.st !== ST.CLIMB)) {
          u.retT = 0.5 + r() * 0.3;
          const wallFoe = this.nearestEnemy(u, 26, (o) => o.onWall);
          if (wallFoe) u.tgt = wallFoe, u.mode = 'melee';
          else {
            u.mode = 'shoot';
            let best = null, bs = 1e9;
            for (const o of this.units) {
              if (o.side !== 1 || (o.st !== ST.ACTIVE && o.st !== ST.CLIMB) || o.onWall) continue;
              if (o.x > WX + WW + 4 && o.x > WX + 60) continue;
              const d = Math.hypot(o.x - u.x, o.y - u.y); if (d > u.S.range) continue;
              let s = d;
              if (o.st === ST.CLIMB) s *= 0.25; else if (o.role === 'ladder' || o.role === 'carrier') s *= 0.6;
              if (o.role === 'bow') s *= 0.9;
              s += r() * 30;
              if (s < bs) { bs = s; best = o; }
            }
            u.tgt = best;
          }
        }
        if (u.mode === 'melee' && u.tgt && u.tgt.st === ST.ACTIVE && u.tgt.onWall) { this.walkMelee(u, u.tgt); break; }
        // return to slot along the walkway
        this.moveTo(u, u.slotX, u.slotY, 0.6, 0.6);
        u.fx = -1;
        if (u.tgt && (u.tgt.st === ST.ACTIVE || u.tgt.st === ST.CLIMB) && u.cd <= 0 && Math.abs(u.y - u.slotY) < 3) {
          u.cd = r.range(1.6, 2.3);
          const t = u.tgt, lead = t.st === ST.CLIMB ? 0 : 0.35;
          const tx = t.x + (t.x - t.px) * 30 * lead + r.range(-3, 3), ty = t.y + (t.y - t.py) * 30 * lead + r.range(-3, 3);
          this.shoot(u, tx, ty, t.z, t, r() < 0.12 ? 'fire' : 'arrow', 0.7);
        }
        break;
      }
      case 'bow': {
        this.moveTo(u, u.slotX, u.slotY, 0.5, 1); u.fx = 1;
        if (u.cd <= 0) {
          // volley at the wall archers
          const targets = this.units.filter((o) => o.side === 0 && o.onWall && o.st === ST.ACTIVE);
          u.cd = STATS.h_bow.cd * r.range(0.95, 1.08);
          if (targets.length) { const t = targets[r.int(0, targets.length - 1)]; this.shoot(u, t.x + r.range(-7, 7), t.y + r.range(-9, 9), WH, t, 'arrow', 0.45); }
          else this.shoot(u, WX + 9 + r.range(-4, 4), r.range(80, 340), WH, null, 'arrow', 0);
        }
        break;
      }
      case 'crew': {
        const ram = this.ram;
        if (!ram || ram.wreck) { u.role = 'gate'; break; }
        const i = u.crewI || 0;
        const tx = ram.x - 22 - (i % 2) * 5, ty = ram.y - 7 + Math.floor(i / 2) * 14;
        this.moveTo(u, tx, ty, 1, 0.4); u.fx = 1;
        if (ram.burning && r() < 0.004) u.role = 'gate';
        break;
      }
      case 'gate': {
        if (!this.gate.broken) {
          // mill about in front of the gate, out of the passage, jeering
          if (u.retT <= 0) { u.retT = 1 + r() * 2; u.wx = WX - 40 - r() * 70; u.wy = GYC + r.range(-60, 60); }
          if (u.wx !== undefined) this.moveTo(u, u.wx, u.wy, 0.35, 2);
          u.fx = 1;
          break;
        }
        if (u.x > WX + WW + 3) { u.role = 'inside'; break; }
        // funnel through the broken gate
        const inLane = Math.abs(u.y - GYC) < 11;
        // the breach is a charge: they run for the gap
        if (u.x < WX - 18 || !inLane) this.moveTo(u, WX - 14, GYC + Math.max(-9, Math.min(9, (u.y - GYC) * 0.4)), 1.35, 1);
        else this.moveTo(u, WX + WW + 10, GYC + (u.y - GYC) * 0.6, 1.15, 0.5);
        const foe = this.nearestEnemy(u, 12, (o) => o.z === 0);
        if (foe) this.melee(u, foe);
        break;
      }
      case 'inside': {
        if (u.retT <= 0 || (u.tgt && u.tgt.st !== ST.ACTIVE)) { u.retT = 0.4 + r() * 0.3; u.tgt = this.nearestEnemy(u, 150, (o) => o.z === 0); }
        if (u.tgt) this.melee(u, u.tgt); else this.moveTo(u, 880, u.y, 1, 2);
        break;
      }
      case 'ladder': {
        const L = this.ladders[u.ladder];
        if (!L || !L.alive || L.raiseT < 1) {
          // wait near the ladder's spot (or retreat from fire)
          const ly = L ? L.y : 300;
          if (L && L.burning) { this.moveTo(u, WX - 70, ly + (u.id % 5 - 2) * 8, 1.1, 2); u.fx = 1; }
          else this.moveTo(u, WX - 34 - (u.id % 4) * 6, ly + ((u.id % 7) - 3) * 4, 0.8, 2);
          if (!L || (!L.alive && !L.burning && u.ladder !== 2)) { if (this.t > 14) u.role = 'gate'; }
          break;
        }
        const bx = WX - 13, by = L.y;
        const d = Math.hypot(u.x - bx, u.y - by);
        if (d < 5 && L.climbers < 2 && (L.lastStart === undefined || this.t - L.lastStart > 0.9)) {
          u.st = ST.CLIMB; u.climbT = 0; L.climbers++; L.lastStart = this.t; u.x = bx; u.y = by; u.fx = 1;
        } else {
          // queue: stand in a loose line behind the ladder foot
          const qx = bx - 6 - Math.min(40, d * 0.0) , qy = by + ((u.id % 5) - 2) * 3.5;
          if (d > 8) this.moveTo(u, bx - 4, by + ((u.id % 3) - 1) * 2, 1, 1);
          else { this.moveTo(u, bx, by, 0.6, 0.5); }
          const foe = this.nearestEnemy(u, 10, (o) => o.z === 0); if (foe) this.melee(u, foe);
        }
        break;
      }
      case 'carrier': {
        const L = this.ladders[2];
        const ty = 290;
        if (!L) {
          const arrived = this.moveTo(u, WX - 16, ty + (u.id % 2) * 6, 1, 3);
          if (arrived) {
            this.ladders[2] = { y: ty, up: 1, alive: true, burning: false, q: [], climbers: 0, raiseT: 0, id: 2 };
            this.fx.push({ k: 'bark', key: 'ladder_up' });
          }
        } else {
          u.role = 'ladder'; u.ladder = 2; u.k = KIDX.h_levy; u.kind = 'h_levy';
        }
        break;
      }
      case 'wallEnemy': {
        if (u.retT <= 0 || (u.tgt && u.tgt.st !== ST.ACTIVE)) { u.retT = 0.4; u.tgt = this.nearestEnemy(u, 140, (o) => o.onWall); }
        if (u.tgt) this.walkMelee(u, u.tgt);
        break;
      }
    }
  }
  walkMelee(u, t) {
    const dy = t.y - u.y, reach = u.S.r + t.S.r + u.S.reach;
    u.fx = t.x === u.x ? u.fx : (Math.abs(dy) < 2 ? Math.sign(t.x - u.x) || u.fx : (u.side === 0 ? -1 : 1));
    if (Math.abs(dy) > reach) { u.y += Math.sign(dy) * Math.min(Math.abs(dy) - reach * 0.9, u.S.speed * DT * 0.8); }
    else if (u.cd <= 0) { u.cd = u.S.cd * this.rng.range(0.9, 1.15); this.dmgUnit(t, u.S.atk, u, 'melee'); }
  }
  climb(u, dt) {
    const L = this.ladders[u.ladder];
    if (!L || !L.alive) { u.st = ST.FALL; u.fallT = 0; u.fallZ = u.z; this.stats.fell++; return; }
    u.px = u.x; u.py = u.y; u.pz = u.z;
    if (u.cd > 0) u.cd -= dt;
    if (u.hitT > 0) u.hitT -= dt;
    u.climbT += dt / 2.0;
    u.z = Math.min(WH, u.climbT * WH);
    u.x = WX - 13 + 13 * u.climbT; u.y = L.y;
    if (u.climbT >= 1) {
      u.st = ST.ACTIVE; u.onWall = true; u.z = WH; u.x = WX + 9; u.role = 'wallEnemy'; L.climbers = Math.max(0, L.climbers - 1);
      if (!this.stats.topT) { this.stats.topT = this.t; this.fx.push({ k: 'bark', key: 'on_wall' }); }
    }
  }
  separate() {
    for (const u of this.units) {
      if (u.st !== ST.ACTIVE) continue;
      const cx = (u.x / 12) | 0, cy = (u.y / 12) | 0;
      let ox = 0, oy = 0;
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cy - 1; j <= cy + 1; j++) {
        const a = this.grid.get(i * 1000 + j); if (!a) continue;
        for (const o of a) {
          if (o === u || o.st !== ST.ACTIVE || o.onWall !== u.onWall) continue;
          const dx = u.x - o.x, dy = u.y - o.y, d2 = dx * dx + dy * dy, R = (u.S.r + o.S.r) * 1.05;
          if (d2 < R * R && d2 > 1e-6) { const d = Math.sqrt(d2), p = ((R - d) / d) * 0.5; ox += dx * p; oy += dy * p; }
          else if (d2 <= 1e-6) { ox += (u.id % 3) - 1; oy += (u.id % 2) - 0.5; }
        }
      }
      if (this.ram && !u.onWall) { const dx = u.x - this.ram.x, dy = u.y - this.ram.y; if (Math.abs(dx) < 24 + u.S.r && Math.abs(dy) < 9 + u.S.r && u.role !== 'crew') { oy += Math.sign(dy || 1) * 0.8; } }
      u.x += Math.max(-1.2, Math.min(1.2, ox)); u.y += Math.max(-1.2, Math.min(1.2, oy));
    }
  }
  constrain(u) {
    if (u.onWall) {
      u.x = WX + 9 + Math.max(-2.5, Math.min(2.5, u.x - (WX + 9)));
      const seg = u.y < 210 ? NORTH_WALK : SOUTH_WALK;
      u.y = Math.max(seg[0], Math.min(seg[1], u.y));
      return;
    }
    u.y = Math.max(6, Math.min(WORLD.h - 6, u.y));
    const r = u.S.r;
    // wall band + towers are solid unless passing a broken gate
    const inGate = this.gate.broken && u.y > GY0 + r * 0.6 && u.y < GY1 - r * 0.6;
    if (!inGate) {
      for (const T of TOWERS) if (u.x > T.x0 - r && u.x < T.x1 + r && u.y > T.y0 - r && u.y < T.y1 + r) {
        const pushL = u.x - (T.x0 - r), pushR = T.x1 + r - u.x, pushU = u.y - (T.y0 - r), pushD = T.y1 + r - u.y;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) u.x = T.x0 - r; else if (m === pushR) u.x = T.x1 + r; else if (m === pushU) u.y = T.y0 - r; else u.y = T.y1 + r;
      }
      if (u.x > WX - r && u.x < WX + WW + r) { if (u.px <= WX + WW / 2) u.x = WX - r; else u.x = WX + WW + r; }
    } else {
      if (u.x > WX - r && u.x < WX + WW + r) u.y = Math.max(GY0 + r, Math.min(GY1 - r, u.y));
    }
    u.x = Math.max(-40, Math.min(WORLD.w - 4, u.x));
  }
  shoot(u, tx, ty, tz, target, kind, hit) {
    const sz = u.z + 9, d = Math.hypot(tx - u.x, ty - u.y);
    const dur = 0.35 + d / 250;
    this.proj.push({ x0: u.x, y0: u.y, z0: sz, x1: tx, y1: ty, z1: tz + 4, t: 0, dur, h: Math.min(60, d * 0.2) + 6, target, side: u.side, dmg: u.S.atk, kind, hit });
  }
  updateProj(dt) {
    const r = this.rng;
    for (let i = this.proj.length - 1; i >= 0; i--) {
      const p = this.proj[i];
      p.t += dt;
      if (p.t < p.dur) continue;
      this.proj.splice(i, 1);
      const t = p.target;
      let hit = false;
      if (t && (t.st === ST.ACTIVE || t.st === ST.CLIMB)) {
        const d = Math.hypot(t.x - p.x1, t.y - p.y1);
        if (d < t.S.r + 5 && r() < p.hit + 0.15) { hit = true; this.dmgUnit(t, p.dmg * (p.kind === 'fire' ? 1.3 : 1), null, 'arrow'); }
      }
      if (!hit) {
        const onWall = p.z1 > 10 && p.x1 > WX - 2 && p.x1 < WX + WW + 2;
        this.fx.push({ k: 'land', x: p.x1, y: p.y1, z: onWall ? WH : 0, kind: p.kind, wall: onWall, a: Math.atan2(p.y1 - p.y0, p.x1 - p.x0) });
      }
    }
  }
  updateRam(dt) {
    const ram = this.ram; if (!ram) return;
    ram.px = ram.x; ram.py = ram.y;
    if (ram.wreck) return;
    if (ram.burning) { ram.hp -= 32 * dt; if (ram.hp <= 0) { ram.wreck = true; this.fx.push({ k: 'boom', x: ram.x, y: ram.y }); this.fx.push({ k: 'bark', key: 'ram_dead' }); for (const c of ram.crew) if (c.st === ST.ACTIVE) c.role = 'gate'; } }
    if (!this.gate.broken) {
      ram.swingT += dt;
      if (ram.nextHit === undefined) ram.nextHit = 0.9;
      ram.phase = 1 - Math.max(0, ram.nextHit - ram.swingT) / 2.4;
      if (ram.swingT >= ram.nextHit) {
        ram.nextHit += 2.4;
        this.gate.hp -= 85; this.fx.push({ k: 'ramhit', x: WX - 2, y: GYC });
        if (this.gate.hp <= 0) { this.gate.broken = true; this.gate.hp = 0; this.stats.gateBrokenT = this.t; this.fx.push({ k: 'gatebreak', x: WX + 4, y: GYC }); this.fx.push({ k: 'bark', key: 'gate_break' }); }
      }
    } else {
      ram.phase = 0.3;
      // crew drag the ram back to clear the passage for the warband
      if (ram.x > WX - 64) { ram.x -= 7 * dt; ram.y += (GYC + 34 - ram.y) * 0.4 * dt; }
    }
  }
  updateLadders(dt) {
    for (const L of this.ladders) {
      if (!L) continue;
      if (L.raiseT < 1) L.raiseT = Math.min(1, L.raiseT + dt / 0.9);
      if (L.burning) { L.burnT -= dt; if (L.burnT <= 0) { L.burning = false; } }
    }
  }
  useOil(L) {
    this.stats.oilT = this.t; this.abil.oil.cd = this.abil.oil.max;
    this.fx.push({ k: 'oil', x: WX - 4, y: L.y });
    this.fx.push({ k: 'bark', key: 'oil' });
    L.alive = false; L.burning = true; L.burnT = 5;
    this.stats.ladderBurnt++;
    this.fires.push({ x: WX - 14, y: L.y, r: 20, life: 9, t: 0, id: 1 });
    let fell = 0;
    for (const u of this.units) {
      if (u.side !== 1 || u.st === ST.DEAD) continue;
      const d = Math.hypot(u.x - (WX - 12), u.y - L.y);
      if (u.st === ST.CLIMB && u.ladder === L.id) { u.st = ST.FALL; u.fallT = 0; u.fallZ = u.z; fell++; continue; }
      if (d < 22 && u.z === 0) { this.dmgUnit(u, 70, null, 'fire'); u.burnT = 2; }
    }
    this.stats.oilFell = fell;
  }
  updateFires(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i]; f.t += dt;
      if (f.t > f.life) { this.fires.splice(i, 1); continue; }
      if (this.steps % 15 === 0) for (const u of this.units) {
        if (u.st !== ST.ACTIVE || u.z > 0) continue;
        if (Math.hypot(u.x - f.x, u.y - f.y) < f.r * (1 - f.t / f.life * 0.5)) this.dmgUnit(u, 9, null, 'fire');
      }
    }
  }
  updateMorale(dt) {
    if (this.steps % 15) return;
    for (const s of this.squads) {
      const alive = s.units.filter((u) => u.st === ST.ACTIVE).length;
      let near = 0;
      for (const e of this.units) if (e.side === 1 && e.st === ST.ACTIVE && s.units[0] && Math.hypot(e.x - s.units[0].slotX, e.y - s.units[0].slotY) < 60) near++;
      const target = Math.max(5, 88 - (s.lost / s.n) * 70 - Math.max(0, near - alive) * 4);
      s.morale += (target - s.morale) * 0.15;
      s.alive = alive;
    }
  }
}
