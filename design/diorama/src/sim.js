// ============================================================================
// sim: deterministic fixed-step battle (1/30 s, seeded RNG). It never reads
// anything the renderer owns; the renderer only drains sim.fx.
// Scenario: 쌍둥이탑 성, second wave. The south gate was smashed in the first
// wave and is held behind a cart barricade. Aurel Concord ladders + a siege
// tower on the curtain, Ashtusk orcs and goblins on the gate.
// ============================================================================
const DT = 1 / 30;
function Sim(seed, n) {
  const S = this;
  S.rng = RNG(seed);
  S.t = -0.0; S.step = 0; S.units = []; S.proj = []; S.fx = []; S.nextId = 1; S.events = [];
  S.bar = { hp: 240, max: 240, broken: false };
  S.keep = 100;
  S.oilT = 8.6; S.oilDone = false; S.burn = []; // burning oil patches
  const m = n / 100;
  S.m = m;
  const R = S.rng;
  const add = (k, x, y, z, role, extra) => {
    const kd = KINDS[k];
    const u = { id: S.nextId++, k, kd, side: kd.side, x, y, z: z || 0, px: x, py: y, hp: kd.hp, cd: R() * kd.cd, st: 'idle', role, tgt: null, fx: 0, fy: kd.side ? -1 : 1, hitT: 0, gx: x, gy: y, lad: null, climbT: 0, sq: -1, ...extra };
    S.units.push(u); return u;
  };
  S.add = add;
  // ---- defenders ----
  const nArch = Math.round(18 * m), nSw = Math.round(10 * m), nSp = Math.round(12 * m);
  const posts = [];
  const lc = Math.ceil(nArch * 0.34), rc = Math.ceil(nArch * 0.34), tw = Math.max(2, nArch - lc - rc);
  for (let i = 0; i < lc; i++) posts.push([112 + (i + 0.5) * (214 / lc), WALK_Y + (i % 2) * 2, WZ, 2]);
  for (let i = 0; i < rc; i++) posts.push([556 + (i + 0.5) * (226 / rc), WALK_Y + (i % 2) * 2, WZ, 3]);
  for (let i = 0; i < tw; i++) { const T = i % 2 ? TWR : TWL; const j = Math.floor(i / 2), per = Math.ceil(tw / 2); posts.push([T.x0 + 9 + ((j % 4) + 0.5) * ((T.x1 - T.x0 - 18) / Math.min(4, per)), TW_F - 7 - Math.floor(j / 4) * 9, TZ, i % 2 ? 3 : 2]); }
  for (const p of posts) add('d_archer', p[0] + (R() - 0.5) * 3, p[1], p[2], 'wall', { sq: p[3], post: [p[0], p[1]] });
  const ranks = (count, y0, dy, k, role, sq) => {
    const perRow = Math.min(count, k === 'd_sword' ? 10 : 12); let i = 0;
    for (let r = 0; i < count; r++) for (let c = 0; c < perRow && i < count; c++, i++) {
      const x = 397 + (c + 0.5) * (86 / perRow) + (r % 2) * 3;
      const y = y0 - r * dy;
      add(k, x, y, 0, role, { sq, slot: [x, y], rank: r });
    }
  };
  ranks(nSw, BAR_Y - 8, 7, 'd_sword', 'front', 0);
  ranks(nSp, BAR_Y - 19, 6, 'd_spear', 'back', 1);
  // ---- ladders & siege tower ----
  S.ladders = [
    { x: 214, foot: WY1 + 13, up: false, t: 0, need: 1, cool: 0, fallen: 0, climbers: 0 },
    { x: 596, foot: WY1 + 13, up: false, t: 0, need: 1, cool: 0, fallen: 0, climbers: 0 },
    { x: 300, foot: WY1 + 13, up: false, t: 0, need: 1, cool: 0, fallen: 0, climbers: 0 },
  ];
  S.tower = { x: 664, y: 382, hp: 950, docked: false, dockT: 0, bridge: 0, boarded: 0, vy: 9.2, burn: 0 };
  // ---- the opening forces (already in the field at t=0) ----
  S.cap = n;
  const grp = (k, cnt, x0, x1, y0, y1, role, extra) => { for (let i = 0; i < Math.round(cnt * m); i++) { if (S.t > 0 && S.units.length >= S.cap) break; add(k, R.range(x0, x1), R.range(y0, y1), 0, role, extra ? (typeof extra === 'function' ? extra(i) : extra) : {}); } };
  grp('o_grunt', 8, 380, 500, 300, 360, 'gate');
  grp('o_goblin', 10, 360, 520, 290, 380, 'gate');
  grp('h_ladder', 2, 200, 230, 286, 300, 'carry', { lad: 0 });
  grp('h_levy', 5, 186, 246, 300, 340, 'climb', { lad: 0 });
  grp('h_bow', 8, 120, 340, 400, 430, 'bow');
  grp('h_levy', 5, 640, 690, 404, 416, 'push');
  grp('h_maa', 6, 630, 700, 414, 440, 'board');
  S.sched = [
    { t: 2.5, f: () => { grp('h_ladder', 2, 584, 612, WH + 4, WH + 14, 'carry', { lad: 1 }); grp('h_levy', 4, 570, 630, WH + 6, WH + 30, 'climb', { lad: 1 }); grp('h_maa', 2, 570, 630, WH + 20, WH + 40, 'climb', { lad: 1 }); } },
    { t: 4.5, f: () => grp('o_jav', 5, 400, 500, WH + 4, WH + 30, 'jav') },
    { t: 6.5, f: () => { grp('h_ladder', 2, 288, 314, WH, WH + 10, 'carry', { lad: 2 }); grp('h_levy', 5, 270, 330, WH + 6, WH + 36, 'climb', { lad: 2 }); } },
    { t: 7.5, f: () => { add('o_boss', 448, 452, 0, 'boss'); S.events.push({ t: S.t, k: 'boss' }); grp('o_grunt', 6, 410, 490, WH + 10, WH + 40, 'gate'); grp('o_goblin', 8, 380, 520, WH + 10, WH + 50, 'gate'); } },
    { t: 11.5, f: () => { grp('o_goblin', 10, 360, 540, WH + 4, WH + 40, 'gate'); grp('o_grunt', 4, 400, 480, WH + 10, WH + 40, 'gate'); } },
    { t: 14.5, f: () => { grp('h_maa', 6, 190, 320, WH + 4, WH + 30, 'climb', (i) => ({ lad: i % 2 ? 2 : 0 })); grp('h_bow', 4, 140, 300, WH + 4, WH + 20, 'bow'); } },
    { t: 18.0, f: () => { grp('o_grunt', 6, 400, 500, WH + 4, WH + 30, 'gate'); grp('o_goblin', 8, 360, 540, WH + 4, WH + 40, 'gate'); } },
  ];
  // perf mode: keep the field full so the requested unit count is actually on screen
  if (n > 100) {
    const extra = Math.round(n * 0.6) - S.units.filter((u) => u.side === 1).length;
    for (let i = 0; i < extra; i++) { const k = R.pick(['o_grunt', 'o_goblin', 'h_levy', 'h_maa', 'o_goblin']); add(k, R.range(240, 640), R.range(300, 500), 0, k.startsWith('h') ? 'climb' : 'gate', k.startsWith('h') ? { lad: R.int(0, 2) } : {}); }
  }
}
Sim.prototype.alive = function (u) { return u.st !== 'dead'; };
Sim.prototype.ev = function (k, extra) { this.events.push({ t: this.t, k, ...(extra || {}) }); };
Sim.prototype.kill = function (u, cause) {
  if (u.st === 'dead') return;
  u.st = 'dead'; u.hp = 0;
  this.fx.push({ k: 'die', id: u.id, x: u.x, y: u.y, z: u.z, kind: u.k, fx: u.fx, fy: u.fy, onLad: u.role === 'climbing' ? 1 : 0, cause: cause || 0 });
  if (u.k === 'o_boss') this.ev('bossdown');
};
Sim.prototype.hurt = function (u, dmg, src) {
  if (u.st === 'dead') return;
  u.hp -= dmg; u.hitT = 0.14;
  if (this.rng() < 0.3) this.fx.push({ k: 'blood', x: u.x, y: u.y, z: u.z, s: u.side });
  if (u.hp <= 0) this.kill(u, src === 'oil' ? 1 : 0);
};
Sim.prototype.launch = function (src, tx, ty, tz, tgt, kind, hit, dmg) {
  const d = Math.hypot(tx - src.x, ty - src.y);
  const T = (kind === 'jav' ? 0.55 : 0.42) + d / (kind === 'jav' ? 240 : 400);
  this.proj.push({ x0: src.x, y0: src.y, z0: src.z + 9, x1: tx, y1: ty, z1: tz, t: 0, T, kind, hit, dmg, tgt, arc: Math.min(70, 14 + d * 0.22), side: src.side });
  this.fx.push({ k: 'shot', x: src.x, y: src.y, z: src.z, c: kind });
};
Sim.prototype.stepOnce = function () {
  const S = this, R = S.rng, U = S.units;
  S.t += DT; S.step++;
  while (S.sched.length && S.sched[0].t <= S.t) S.sched.shift().f();
  // spatial buckets
  const grid = new Map();
  const key = (x, y, l) => ((Math.floor(x / 24) & 1023) | ((Math.floor(y / 24) & 1023) << 10) | (l << 20));
  for (const u of U) { if (u.st === 'dead') continue; u.px = u.x; u.py = u.y; const l = u.z > 0 ? 1 : 0; const kk = key(u.x, u.y, l); let b = grid.get(kk); if (!b) grid.set(kk, (b = [])); b.push(u); }
  const near = (x, y, l, r, fn) => { const x0 = Math.floor((x - r) / 24), x1 = Math.floor((x + r) / 24), y0 = Math.floor((y - r) / 24), y1 = Math.floor((y + r) / 24); for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const b = grid.get((gx & 1023) | ((gy & 1023) << 10) | (l << 20)); if (b) for (const v of b) fn(v); } };
  const nearestFoe = (u, r, l, filt) => { let best = null, bd = r * r; near(u.x, u.y, l, r, (v) => { if (v.side === u.side || v.side === 2 || v.st === 'dead' || (filt && !filt(v))) return; const d = (v.x - u.x) ** 2 + (v.y - u.y) ** 2; if (d < bd) { bd = d; best = v; } }); return best; };
  // ---- siege tower ----
  const T = S.tower;
  if (!T.docked && T.hp > 0) {
    const pushers = U.filter((u) => u.role === 'push' && u.st !== 'dead').length;
    const v = T.vy * (pushers > 0 ? Math.min(1, 0.45 + pushers * 0.14) : 0);
    T.y -= v * DT;
    if (T.y <= WY1 + 19) { T.y = WY1 + 19; T.docked = true; T.dockT = S.t; S.ev('dock'); S.fx.push({ k: 'thud', x: T.x, y: WY1 + 2, z: WZ, big: 1 }); }
  }
  if (T.docked) T.bridge = clamp((S.t - T.dockT - 0.6) / 0.9, 0, 1);
  if (T.docked && T.bridge >= 1 && !T.bridgeEv) { T.bridgeEv = 1; S.ev('bridge'); S.fx.push({ k: 'thud', x: T.x, y: WY1 - 2, z: WZ, big: 0 }); }
  // ---- barricade & oil ----
  if (!S.oilDone && S.t >= S.oilT) {
    S.oilDone = true; S.ev('oil');
    S.fx.push({ k: 'oil', x: GATE_X, y: BAR_Y + 16 });
    for (const u of U) if (u.side === 1 && u.st !== 'dead' && Math.abs(u.x - GATE_X) < 50 && u.y > BAR_Y && u.y < BAR_Y + 46) S.hurt(u, 45 + R() * 40, 'oil');
    for (let k = 0; k < 7; k++) S.burn.push({ x: GATE_X - 42 + k * 14 + R.range(-3, 3), y: BAR_Y + 10 + R.range(0, 22), t: 6.5 + R() * 2.5 });
  }
  for (const b of S.burn) { b.t -= DT; if (b.t > 0 && S.step % 6 === 0) near(b.x, b.y, 0, 12, (u) => { if (u.side === 1 && u.st !== 'dead' && Math.hypot(u.x - b.x, u.y - b.y) < 9) S.hurt(u, 5, 'oil'); }); }
  S.burn = S.burn.filter((b) => b.t > 0);
  if (!S.bar.broken && S.bar.hp <= 0) { S.bar.broken = true; S.ev('breach'); S.fx.push({ k: 'break', x: GATE_X, y: BAR_Y }); }
  // ---- ladders ----
  for (let li = 0; li < S.ladders.length; li++) {
    const L = S.ladders[li];
    if (L.cool > 0) { L.cool -= DT; continue; }
    if (!L.up) {
      const carriers = U.filter((u) => u.role === 'carry' && u.lad === li && u.st !== 'dead');
      if (carriers.length && carriers.every((c) => c.y <= L.foot + 6)) { L.t += DT; if (L.t > 1.1) { L.up = true; L.t = 0; S.ev('ladder', { li }); S.fx.push({ k: 'ladder', li, x: L.x }); for (const c of carriers) c.role = 'climb'; } }
    } else {
      // defenders at the top may shove the ladder off if nobody holds the top
      const top = U.some((u) => u.side === 1 && u.st !== 'dead' && u.z > 0 && Math.abs(u.x - L.x) < 14);
      const def = U.find((u) => u.side === 0 && u.st !== 'dead' && u.z === WZ && Math.abs(u.x - L.x) < 16);
      if (!top && def && R() < 0.0065) {
        L.up = false; L.cool = 6; L.fallen++; S.ev('shove', { li, by: def.sq });
        S.fx.push({ k: 'ladderfall', li, x: L.x });
        for (const u of U) if (u.role === 'climbing' && u.lad === li && u.st !== 'dead') { S.kill(u, 2); }
        for (const u of U) if (u.side === 1 && u.lad === li && u.st !== 'dead' && u.role === 'climb') { if (R() < 0.5) u.role = 'carry'; }
      }
    }
  }
  // ---- units ----
  let frontAlive = 0; const ladBusy = [false, false, false];
  for (const v of U) { if (v.st === 'dead') continue; if (v.side === 0 && v.role === 'front' && v.rank === 0) frontAlive++; if (v.role === 'climbing' && v.climbT < 1.3) ladBusy[v.lad] = true; }
  for (const u of U) {
    if (u.st === 'dead') continue;
    if (u.hitT > 0) u.hitT -= DT;
    u.cd -= DT;
    const kd = u.kd;
    let mvx = 0, mvy = 0, spd = kd.spd;
    let melee = null;
    const l = u.z > 0 ? 1 : 0;
    const role = u.role;
    if (u.side === 0) {
      if (role === 'wall') {
        const foeWall = nearestFoe(u, 22, 1);
        if (foeWall) melee = foeWall;
        else if (u.cd <= 0) {
          // pick: climbers first, then the gate crowd, then anything in range
          let best = null, bs = 1e9;
          for (const v of U) {
            if (v.side !== 1 || v.st === 'dead') continue;
            const d = Math.hypot(v.x - u.x, v.y - u.y); if (d > kd.range) continue;
            const s = d - (v.role === 'climbing' ? 140 : 0) - (Math.abs(v.x - GATE_X) < 60 && v.y < BAR_Y + 40 ? 60 : 0) - (v.k === 'o_boss' ? 40 : 0) + R() * 40;
            if (s < bs) { bs = s; best = v; }
          }
          if (best) {
            const hit = R() < (best.role === 'climbing' ? 0.55 : 0.4);
            const tx = hit ? best.x : best.x + R.range(-14, 14), ty = hit ? best.y : best.y + R.range(-10, 12);
            S.launch(u, tx, ty, hit ? best.z + 6 : 0, hit ? best : null, 'arrow', hit, kd.atk * (0.8 + R() * 0.4));
            u.cd = kd.cd * (0.8 + R() * 0.45); u.fx = best.x - u.x; u.fy = best.y - u.y;
          }
          if (!best && T.hp > 0 && Math.hypot(T.x - u.x, T.y - u.y) < kd.range) { S.launch(u, T.x + R.range(-12, 12), T.y + R.range(-6, 6), R.range(10, 50), null, 'arrow', false, 0); u.cd = kd.cd; }
        }
        if (!foeWall) { mvx = u.post[0] - u.x; mvy = u.post[1] - u.y; spd = 12; }
      } else {
        // gate ranks: hold the slot; step up when the rank in front thins out
        const reach = kd.reach;
        const foe = nearestFoe(u, reach + 12, 0);
        if (foe && Math.hypot(foe.x - u.x, foe.y - u.y) <= reach + (S.bar.broken ? 0 : 6)) melee = foe;
        let sx = u.slot[0], sy = u.slot[1];
        if (role === 'back' || u.rank > 0) {
          const want = Math.round(10 * S.m);
          if (frontAlive < want && !u.promoted && R() < 0.01) { u.promoted = 1; u.role = 'front'; u.rank = 0; u.slot = [u.slot[0], BAR_Y - 8]; }
        }
        if (S.bar.broken) sy += 4;
        mvx = sx - u.x; mvy = sy - u.y; spd = 18;
      }
    } else {
      // ---- attackers ----
      if (role === 'gate' || role === 'boss') {
        const foe = nearestFoe(u, 40, 0);
        if (foe && (role !== 'boss' || S.bar.broken) && Math.hypot(foe.x - u.x, foe.y - u.y) <= kd.reach + (S.bar.broken ? 0 : 8)) melee = foe;
        let gx = clamp(u.x, 396, 484), gy = BAR_Y + 9;
        if (S.bar.broken && foe) { gx = foe.x; gy = foe.y + 6; }
        else if (S.bar.broken) gy = BAR_Y - 10;
        if (u.y > BAR_Y + 120) { gx = lerp(u.x, gx, 0.6); }
        mvx = gx - u.x; mvy = gy - u.y;
        if (!melee && !S.bar.broken && u.y < BAR_Y + (role === 'boss' ? 19 : 15) && Math.abs(u.x - GATE_X) < 58 && u.cd <= 0) { S.bar.hp -= kd.atk * (u.k === 'o_boss' ? 4 : 0.35) * (0.7 + R() * 0.6); u.cd = kd.cd; u.fx = 0; u.fy = -1; u.swing = S.t; if (R() < 0.35) S.fx.push({ k: 'chip', x: u.x, y: BAR_Y + 2 }); }
      } else if (role === 'jav') {
        const foe = nearestFoe(u, kd.range, 0);
        if (u.y > BAR_Y + 78) { mvx = 0; mvy = -1; }
        else if (foe && u.cd <= 0) {
          const hit = R() < 0.4;
          S.launch(u, hit ? foe.x : foe.x + R.range(-10, 10), hit ? foe.y : foe.y + R.range(-8, 8), hit ? 6 : 0, hit ? foe : null, 'jav', hit, kd.atk);
          u.cd = kd.cd * (0.9 + R() * 0.3); u.fx = foe.x - u.x; u.fy = foe.y - u.y;
        }
      } else if (role === 'bow') {
        if (u.y > 384) { mvx = (u.x - 240) * -0.02; mvy = -1; }
        else if (u.cd <= 0) {
          const arch = U.filter((v) => v.side === 0 && v.st !== 'dead' && v.role === 'wall' && Math.abs(v.x - u.x) < 240);
          const tg = arch.length ? arch[Math.floor(R() * arch.length)] : null;
          if (tg) {
            const hit = R() < 0.18;
            if (hit) S.launch(u, tg.x, tg.y, tg.z + 6, tg, 'arrow', true, kd.atk);
            else if (R() < 0.6) S.launch(u, tg.x + R.range(-16, 16), WY1 + 0.5, R.range(8, WZ - 2), null, 'arrow_wall', false, 0);
            else S.launch(u, tg.x + R.range(-20, 20), WY0 - R.range(22, 70), 0, null, 'arrow', false, 0);
            u.fx = tg.x - u.x; u.fy = -1;
          }
          u.cd = kd.cd * (0.85 + R() * 0.4);
        }
      } else if (role === 'carry') {
        const L = S.ladders[u.lad];
        mvx = L.x + (u.id % 2 ? -5 : 5) - u.x; mvy = L.foot + 2 - u.y; spd = kd.spd * 0.85;
      } else if (role === 'climb') {
        const L = S.ladders[u.lad];
        const foe = nearestFoe(u, 16, 0);
        if (foe) melee = foe;
        if (L.up && !foe) {
          mvx = L.x - u.x; mvy = L.foot + 3 - u.y;
          if (Math.hypot(mvx, mvy) < 5 && !ladBusy[u.lad]) { u.role = 'climbing'; u.climbT = 0; u.x = L.x; }
        } else if (!foe) { mvx = L.x + ((u.id * 7) % 26) - 13 - u.x; mvy = L.foot + 26 + ((u.id * 13) % 20) - u.y; spd = kd.spd * 0.9; }
      } else if (role === 'climbing') {
        const L = S.ladders[u.lad];
        if (!L.up) { S.kill(u, 2); continue; }
        u.climbT += DT;
        const k = clamp(u.climbT / 2.3, 0, 1);
        u.y = lerp(L.foot + 3, WY1 - 1, k); u.z = lerp(0, WZ, k); u.x = L.x; u.fx = 0; u.fy = -1;
        if (k >= 1) { u.role = 'walltop'; u.y = WALK_Y; u.z = WZ; S.ev('topped', { li: u.lad }); }
        continue;
      } else if (role === 'push') {
        mvx = T.x + ((u.id * 5) % 30) - 15 - u.x; mvy = T.y + 24 - u.y; spd = kd.spd;
        if (T.docked) { u.role = 'climb'; u.lad = 1; }
      } else if (role === 'board') {
        if (T.docked && T.bridge >= 1 && S.t > (u.boardAt || (u.boardAt = S.t + 0.4 + T.boarded++ * 1.1))) {
          u.role = 'intower'; u.climbT = 0; u.x = T.x + ((u.id % 3) - 1) * 8; u.y = T.y + 6;
        } else { mvx = T.x + ((u.id * 7) % 34) - 17 - u.x; mvy = T.y + 34 + ((u.id * 3) % 14) - u.y; spd = kd.spd; }
      } else if (role === 'intower') {
        u.climbT += DT; const k = clamp(u.climbT / 2.6, 0, 1);
        u.z = k * (WZ + 2); u.fy = -1; u.fx = 0;
        if (k >= 1) { u.role = 'walltop'; u.x = T.x + R.range(-10, 10); u.y = WALK_Y; u.z = WZ; S.ev('board'); }
        continue;
      } else if (role === 'walltop') {
        const foe = nearestFoe(u, 120, 1);
        if (foe) { mvx = foe.x - u.x; mvy = foe.y - u.y; if (Math.hypot(mvx, mvy) <= kd.reach) melee = foe; }
        spd = kd.spd * 0.8;
      }
    }
    // ---- melee resolution ----
    if (melee) {
      u.fx = melee.x - u.x; u.fy = melee.y - u.y;
      if (u.cd <= 0) {
        u.cd = kd.cd * (0.85 + R() * 0.35); u.swing = S.t;
        if (R() < 0.62) S.hurt(melee, kd.atk * (0.75 + R() * 0.5) * (u.kd.side === 0 && u.z > 0 && u.kd.wc === 'bow' ? 0.6 : 1), 'melee');
        if (R() < 0.25) S.fx.push({ k: 'clash', x: (u.x + melee.x) / 2, y: (u.y + melee.y) / 2, z: u.z });
      }
      const d = Math.hypot(mvx, mvy); if (d > 6 && u.side === 1) { mvx *= 0.15; mvy *= 0.15; } else { mvx *= 0.1; mvy *= 0.1; }
    }
    // ---- move ----
    const d = Math.hypot(mvx, mvy);
    if (d > 0.6) {
      const s = Math.min(d, spd * DT);
      u.x += (mvx / d) * s; u.y += (mvy / d) * s;
      if (!melee) { u.fx = mvx; u.fy = mvy; }
    }
  }
  // ---- separation & static collision ----
  for (const u of U) {
    if (u.st === 'dead' || u.role === 'climbing' || u.role === 'intower') continue;
    const l = u.z > 0 ? 1 : 0, ru = u.kd.body.startsWith('orc') ? 4.6 : u.kd.body === 'goblin' ? 3.3 : 3.9;
    near(u.x, u.y, l, 10, (v) => {
      if (v === u || v.st === 'dead' || v.role === 'climbing' || v.role === 'intower') return;
      const dx = u.x - v.x, dy = u.y - v.y, dd = dx * dx + dy * dy, rr = ru + 3.4;
      if (dd < rr * rr && dd > 1e-4) { const d = Math.sqrt(dd), p = (rr - d) * 0.25; u.x += (dx / d) * p; u.y += (dy / d) * p * 0.8; }
    });
    if (u.z === 0) {
      // the wall and towers are solid; the barricade holds until it breaks
      const inYard = u.x > 392 && u.x < 488;
      if (u.y < WY1 + 5 && !(inYard && u.y > GH_F + 3)) u.y = WY1 + 5;
      if (inYard && u.y < GH_F + 4) u.y = GH_F + 4;
      if (u.y < TW_F + 2) { if (u.x > TWL.x0 - 3 && u.x < TWL.x1 + 2) u.x = u.x < (TWL.x0 + TWL.x1) / 2 ? TWL.x0 - 3 : TWL.x1 + 2; if (u.x > TWR.x0 - 2 && u.x < TWR.x1 + 3) u.x = u.x < (TWR.x0 + TWR.x1) / 2 ? TWR.x0 - 2 : TWR.x1 + 3; }
      if (!S.bar.broken && Math.abs(u.x - GATE_X) < 56) { if (u.side === 1 && u.y < BAR_Y + 6) u.y = BAR_Y + 6; if (u.side === 0 && u.y > BAR_Y - 5) u.y = BAR_Y - 5; }
      if (!T.docked || true) { const tx0 = T.x - 22, tx1 = T.x + 22, ty0 = T.y - 17, ty1 = T.y + 17; if (u.x > tx0 && u.x < tx1 && u.y > ty0 && u.y < ty1 && u.role !== 'board') { if (u.y > T.y) u.y = ty1; else u.y = ty0; } }
      u.x = clamp(u.x, 4, WW - 4); if (u.y > WH + 60) u.y = WH + 60;
    } else {
      u.y = clamp(u.y, WY0 + 6, WY1 - 4);
      if (u.z === WZ && u.x > TWL.x0 - 2 && u.x < TWR.x1 + 2) u.x = u.x < GATE_X ? TWL.x0 - 2 : TWR.x1 + 2;
    }
  }
  // ---- projectiles ----
  for (const p of S.proj) {
    p.t += DT;
    if (p.t >= p.T) {
      p.done = true;
      if (p.hit && p.tgt && p.tgt.st !== 'dead') S.hurt(p.tgt, p.dmg, 'arrow');
      else S.fx.push({ k: 'land', x: p.x1, y: p.y1, z: p.z1, c: p.kind, a: Math.atan2(p.y1 - p.y0, p.x1 - p.x0) });
    }
  }
  S.proj = S.proj.filter((p) => !p.done);
  S.units = S.units.filter((u) => u.st !== 'dead'); // the renderer already has the 'die' fx
  // keep integrity (for the HUD); the keep is far away in this stretch
  S.keep = 100;
};
