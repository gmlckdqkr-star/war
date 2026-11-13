// ============================================================================
// draw: per-tick render update + the frame itself
// ============================================================================
Battle.prototype.tick = function () {
  const S = this.sim;
  S.stepOnce();
  this.t = S.t;
  this.consumeFx();
  this.updateRender(DT);
  this.stampDecals(P_LOW ? 8 : 24);
};
Battle.prototype.updateRender = function (dt) {
  const t = this.t, S = this.sim, M = (this.mood = moodAt(t));
  this.updateLife(dt, t);
  // animation state derived from sim fields only (x/px, cd, swing, hitT, role)
  for (const u of S.units) {
    if (u.st === 'dead') continue;
    let a = this.ra.get(u.id);
    if (!a) { a = { walk: RR() * 4, lastCd: u.cd, atkT: -9, idle: RR() * 10, face: faceOf(u.fx, u.fy), mv: 0 }; this.ra.set(u.id, a); }
    const d = Math.hypot(u.x - u.px, u.y - u.py);
    a.mv = lerp(a.mv, d / dt, 0.3);
    a.walk += d / (u.kd.body === 'goblin' ? 3.6 : 5.2);
    if (u.cd > a.lastCd + 0.15) a.atkT = t;
    a.lastCd = u.cd;
    const f = faceOf(u.fx, u.fy);
    if (f !== a.face) { if (!a.faceHold || t > a.faceHold) { a.face = f; a.faceHold = t + 0.25; } }
    if (u.z === 0 && a.mv > 6) {
      const pc = parcelAt(u.x, u.y);
      if (pc === 'creek') { if (RR() < 0.35) this.spawn('splash', u.x + (RR() - 0.5) * 3, u.y + 1, 0.5, { vx: (RR() - 0.5) * 30, vy: (RR() - 0.5) * 8, vz: 18 + RR() * 22, T: 0.45 }); if (RR() < 0.12) this.spawn('ripple', u.x, u.y + 1, 0, { T: 0.8, s: 1.2 }); }
      else if (pc === 'wheat' && RR() < 0.08) this.decalQ.push({ k: 'trample', x: u.x, y: u.y + 0.5, a: Math.atan2(u.y - u.py, u.x - u.px) });
      else if (RR() < 0.004) this.decalQ.push({ k: 'print', x: u.x, y: u.y + 1 });
    }
  }
  for (const d of this.dying) { d.t += dt; if (d.fall > 0) { d.fall = Math.max(0, d.fall - dt * 90); d.z = d.fall; if (d.fall === 0 && !d.landed) { d.landed = 1; d.t = 0; d.y = WY1 + 14 + RR() * 6; } } }
  const done = this.dying.filter((d) => d.t > 0.62 && d.fall === 0);
  for (const d of done) this.decalQ.push({ k: 'corpse', kind: d.kind, x: d.x, y: d.y, face: d.face, mir: d.mir, onWall: d.onWall, fire: d.fire });
  this.dying = this.dying.filter((d) => !(d.t > 0.62 && d.fall === 0));
  for (const l of this.ladderFx) l.t += dt;
  this.ladderFx = this.ladderFx.filter((l) => l.t < 1.2);
  // the siege tower's wheels cut ruts as it rolls
  { const T = S.tower; if (!this._rutY) this._rutY = T.y; if (this._rutY - T.y > 2.5) { this._rutY = T.y; for (const wx of [T.x - 19, T.x + 19]) this.decalQ.push({ k: 'rut', x: wx, y: T.y + 15 }); } }
  // emitters
  const wind = M.wind;
  for (const f of this.fires) {
    if (RR() < 0.75) this.spawn('flame', f.x + (RR() - 0.5) * 22 * f.s, f.y + (RR() - 0.5) * 6, f.z + RR() * 6, { vz: 16 + RR() * 14, T: 0.45 + RR() * 0.3, s: f.s * (0.8 + RR() * 0.5) });
    if (RR() < 0.2) this.spawn('smoke', f.x + (RR() - 0.5) * 14, f.y, f.z + 14, { vz: 20 + RR() * 10, vx: wind * 0.4, T: 6 + RR() * 3, s: 1.1 + RR() * 0.8, c: RR() < 0.55 ? 0 : 1 });
    if (RR() < 0.25) this.spawn('ember', f.x + (RR() - 0.5) * 18, f.y, f.z + 8, { vz: 24 + RR() * 30, vx: wind * 0.6 + (RR() - 0.5) * 20, T: 1.2 + RR(), s: 1 });
  }
  for (const b of S.burn) {
    if (RR() < 0.5) this.spawn('flame', b.x + (RR() - 0.5) * 8, b.y + (RR() - 0.5) * 4, 0, { vz: 14 + RR() * 10, T: 0.35 + RR() * 0.25, s: 0.75 + RR() * 0.3 });
    if (RR() < 0.12) this.spawn('smoke', b.x, b.y, 6, { vz: 12, vx: wind * 0.3, T: 3, s: 0.7, c: 0 });
  }
  for (const tch of this.torches) if (RR() < 0.25) this.spawn('flame', tch.x + (RR() - 0.5) * 1.5, tch.y, tch.z, { vz: 10, T: 0.3, s: tch.br ? 0.55 : 0.35 });
  for (const p of this.props) if (p.smoke && RR() < 0.06) this.spawn('wisp', p.chimney[0], p.chimney[1], 40, { vz: 7, vx: wind * 0.3, T: 4.5, s: 0.45, c: 2 });
  if (M.rain > 0.4 && RR() < 0.5 * M.rain) { const pd = this.puddles[(RR() * this.puddles.length) | 0]; this.spawn('ripple', pd.x + (RR() - 0.5) * pd.rx, pd.y + (RR() - 0.5) * pd.ry, 0, { T: 0.6, s: 0.5 + RR() * 0.4 }); }
  for (const tr of this.trees) if (t < 14 && RR() < 0.012 * (wind / 14)) this.spawn('leaf', tr.x + (RR() - 0.5) * tr.r * 2, tr.y, tr.trunkH + tr.r, { vz: -6, vx: wind * 0.8, T: 3, s: 1, c: RR() < 0.5 ? 0 : 1 });
  // particles
  for (const p of this.parts) {
    p.t += dt;
    switch (p.k) {
      case 'smoke': case 'wisp': case 'steam': p.vx = lerp(p.vx, wind * (p.k === 'steam' ? 0.25 : 0.6), dt * 0.6); p.x += p.vx * dt; p.z += p.vz * dt; p.vz *= 1 - dt * 0.15; break;
      case 'dust': p.x += p.vx * dt; p.z = Math.max(0, p.z + (p.vz || 2) * dt); break;
      case 'flame': p.z += p.vz * dt; p.x += wind * 0.15 * dt; break;
      case 'ember': p.x += p.vx * dt; p.z += p.vz * dt; p.vz -= 6 * dt; p.x += Math.sin(p.t * 9 + p.r) * 0.3; break;
      case 'spark': case 'blood': case 'splinter': case 'splash': p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 160 * dt; if (p.z < 0) { p.z = 0; p.vx *= 0.3; p.vy *= 0.3; p.vz = 0; } p.r += dt * 12; break;
      case 'leaf': p.x += (p.vx + Math.sin(p.t * 3 + p.r) * 8) * dt; p.z = Math.max(0, p.z + p.vz * dt); p.r += dt * 4; if (p.z === 0) p.vx *= 0.9; break;
    }
  }
  this.parts = this.parts.filter((p) => p.t < p.T);
  // camera fx (render-only)
  this.shake = Math.max(0, this.shake - dt * 14); this.impulse = Math.max(0, this.impulse - dt * 5); this.flash = Math.max(0, this.flash - dt * 4);
  if (t > 17.4 && !this.thunder) { this.thunder = 1; this.flash = 1; }
};

// ---------- drawing helpers ----------
Battle.prototype.unitFrame = function (u, a) {
  const t = this.t;
  if (u.role === 'climbing' || u.role === 'intower') return frameOf('climb', Math.floor(u.z / 5) % 2);
  if (u.hitT > 0.05) return frameOf('hit', 0);
  const since = t - a.atkT, dur = Math.min(0.42, u.kd.cd * 0.6);
  if (since < dur) return frameOf('atk', Math.floor((since / dur) * 3));
  if (a.mv > 3.5) return frameOf('walk', Math.floor(a.walk) % 4);
  const s = (t * 1.1 + a.idle) % 9;
  return frameOf('idle', s < 4 ? (Math.floor(s * 1.6) % 2) : s < 4.7 ? 2 : (Math.floor(s * 1.4) % 2));
};
Battle.prototype.drawUnit = function (g, u, z) {
  const a = this.ra.get(u.id); if (!a) return;
  const A = this.atlas, PX = CAM.PX;
  const fi = this.unitFrame(u, a);
  let face = a.face;
  if (u.role === 'climbing' || u.role === 'intower') face = 1;
  let x = u.x, y = u.y;
  if (u.hitT > 0.05) { x -= Math.sign(u.fx || 1) * 0.6; y -= Math.sign(u.fy || 1) * 0.6; }
  const dx = Math.round(SX(x) - AX * PX), dy = Math.round(SY(y, z === undefined ? u.z : z) - AY * PX);
  g.drawImage(A.pages[u.k], fi * A.cw, face * A.ch, A.cw, A.ch, dx, dy, A.cw, A.ch);
};
Battle.prototype.drawDying = function (g, d) {
  const A = this.atlas, PX = CAM.PX;
  const fi = d.fall > 0 ? frameOf('hit', 0) : frameOf('die', Math.min(2, Math.floor(d.t / 0.2)));
  const x = Math.round(SX(d.x)), y = Math.round(SY(d.y, d.z));
  g.save(); g.translate(x, y); if (d.mir && d.face < 2) g.scale(-1, 1);
  g.drawImage(A.pages[d.kind], fi * A.cw, d.face * A.ch, A.cw, A.ch, -AX * PX, -AY * PX, A.cw, A.ch);
  g.restore();
};
Battle.prototype.sprite = function (g, sp, x, y, z) { g.drawImage(sp.c, Math.round(SX(x) - sp.ax), Math.round(SY(y, z || 0) - sp.ay)); };
Battle.prototype.drawTree = function (g, tr) {
  // canopies lean with the wind: 6 pre-sheared frames per tree (axis-aligned blits, no per-frame transform)
  if (!tr.sway) {
    tr.sway = [];
    for (let k = 0; k < 6; k++) {
      const sh = k * 0.018, src = tr.can.c, ay = tr.can.ay, c = mkCanvas(src.width + Math.ceil(0.1 * ay) + 2, src.height), h = c.getContext('2d');
      h.setTransform(1, 0, -sh, 1, sh * ay, 0); h.drawImage(src, 0, 0); tr.sway.push({ c, ax: tr.can.ax, ay });
    }
  }
  this.sprite(g, tr.trunk, tr.x, tr.y);
  const sway = (Math.sin(this.t * 1.3 + tr.ph) * 0.5 + 0.5) * (this.mood.wind / 22) * 0.07 + 0.012;
  const fr = tr.sway[clamp(Math.round(sway / 0.018), 0, 5)];
  g.drawImage(fr.c, Math.round(SX(tr.x) - fr.ax), Math.round(SY(tr.y, tr.trunkH - 1) - fr.ay));
};
Battle.prototype.drawLadder = function (g, x, footY, k, fall) {
  const PX = CAM.PX;
  // k: 1 = planted; fall: 0..1 swinging away from the wall
  const topY = lerp(WY1 - 1, footY + WZ, fall), topZ = lerp(WZ + 3, 0, fall);
  const bx = SX(x), by = SY(footY, 0), tx = SX(x), ty = SY(topY, topZ);
  const w = 2.3 * PX;
  g.strokeStyle = '#5c3b23'; g.lineWidth = 1.1 * PX; g.lineCap = 'round';
  g.beginPath(); g.moveTo(bx - w, by); g.lineTo(tx - w, ty); g.moveTo(bx + w, by); g.lineTo(tx + w, ty); g.stroke();
  g.strokeStyle = '#7a5232'; g.lineWidth = 0.75 * PX; g.beginPath();
  const n = 11; for (let i = 1; i < n; i++) { const q = i / n; g.moveTo(lerp(bx, tx, q) - w, lerp(by, ty, q)); g.lineTo(lerp(bx, tx, q) + w, lerp(by, ty, q)); } g.stroke();
  g.strokeStyle = 'rgba(255,230,190,0.25)'; g.lineWidth = 0.35 * PX; g.beginPath(); g.moveTo(bx - w - 0.3 * PX, by); g.lineTo(tx - w - 0.3 * PX, ty); g.stroke();
};
Battle.prototype.drawCarriedLadder = function (g, li) {
  const S = this.sim, PX = CAM.PX;
  const cs = S.units.filter((u) => u.role === 'carry' && u.lad === li && u.st !== 'dead');
  if (!cs.length) return;
  const x = cs.reduce((s, u) => s + u.x, 0) / cs.length, y = cs.reduce((s, u) => s + u.y, 0) / cs.length;
  const a = SY(y - 18, 13), b = SY(y + 14, 13), sx = SX(x);
  const w = 2.2 * PX;
  g.strokeStyle = '#5c3b23'; g.lineWidth = 1.1 * PX; g.beginPath(); g.moveTo(sx - w, a); g.lineTo(sx - w, b); g.moveTo(sx + w, a); g.lineTo(sx + w, b); g.stroke();
  g.strokeStyle = '#7a5232'; g.lineWidth = 0.7 * PX; g.beginPath(); for (let y2 = a + 2 * PX; y2 < b; y2 += 2.8 * PX) { g.moveTo(sx - w, y2); g.lineTo(sx + w, y2); } g.stroke();
};
Battle.prototype.drawSiegeTower = function (g, T) {
  // seen from behind (the open side faces us): planked base with a door, an open middle storey where the
  // boarders climb, hide-draped flanks and a wet-hide roof; a Concord banner on top
  const PX = CAM.PX, S = this.sim;
  const x0 = T.x - 20, x1 = T.x + 20, yN = T.y - 17, yS = T.y + 17, H = 66;
  const sy = (y, z) => y * KY - z;
  if (!this._stTex) {
    // cache the static parts once (they never change shape): back planks, hides, frame
    const pc = propCanvas(26, 26, H + 34, 4, (h) => {
      const L = -20, R = 20, Y = (z) => -z; // local: x relative to centre, y = -z (south face line)
      // interior: inner face of the front hides
      h.fillStyle = '#3b2a1e'; h.fillRect(L, Y(H), 40, H - 20);
      // lower storey planks with a door
      for (let x = L; x < R; x += 2.6) { h.fillStyle = (x | 0) % 2 ? '#7a5434' : '#6c4a2e'; h.fillRect(x, Y(20), 2.4, 20); }
      h.fillStyle = 'rgba(255,230,190,0.12)'; h.fillRect(L, Y(20), 40, 1);
      h.fillStyle = '#1c130d'; h.fillRect(-6, Y(15), 12, 15);
      h.strokeStyle = '#4e331f'; h.lineWidth = 0.5; for (let z = 4; z < 20; z += 5) { h.beginPath(); h.moveTo(L, Y(z)); h.lineTo(-6, Y(z)); h.moveTo(6, Y(z)); h.lineTo(R, Y(z)); h.stroke(); }
      // upper storey: wicker breastwork
      for (let x = L; x < R; x += 1.8) { h.fillStyle = (x * 3 | 0) % 2 ? '#9a7444' : '#8a6438'; h.fillRect(x, Y(52), 1.5, 12); }
      h.strokeStyle = '#5c3b23'; h.lineWidth = 0.5; for (const z of [44, 48]) { h.beginPath(); h.moveTo(L, Y(z)); h.lineTo(R, Y(z)); h.stroke(); }
      // frame posts + braces of the open middle storey
      h.strokeStyle = '#4e331f'; h.lineWidth = 2.6; h.beginPath(); h.moveTo(L, Y(0)); h.lineTo(L, Y(H)); h.moveTo(R, Y(0)); h.lineTo(R, Y(H)); h.stroke();
      h.lineWidth = 1.4; h.strokeStyle = '#5c3b23'; h.beginPath(); h.moveTo(L, Y(20)); h.lineTo(R, Y(20)); h.moveTo(L, Y(40)); h.lineTo(R, Y(40)); h.moveTo(L, Y(52)); h.lineTo(R, Y(52)); h.moveTo(L, Y(20)); h.lineTo(-4, Y(40)); h.moveTo(R, Y(20)); h.lineTo(4, Y(40)); h.stroke();
      // hides hanging down the flanks (irregular, stitched)
      for (const side of [-1, 1]) {
        const xe = side * 20;
        h.fillStyle = side < 0 ? '#7d5a3e' : '#5e4230'; h.beginPath(); h.moveTo(xe - side * 0.5, Y(H + 2)); h.lineTo(xe + side * 4.5, Y(H)); h.lineTo(xe + side * 5, Y(34)); h.lineTo(xe + side * 3.2, Y(30)); h.lineTo(xe + side * 4.4, Y(12)); h.lineTo(xe + side * 2, Y(6)); h.lineTo(xe - side * 0.5, Y(8)); h.closePath(); h.fill();
        h.strokeStyle = 'rgba(30,18,12,0.6)'; h.lineWidth = 0.35; h.setLineDash([0.8, 0.8]); h.beginPath(); h.moveTo(xe + side * 1, Y(H)); h.lineTo(xe + side * 2.4, Y(32)); h.stroke(); h.setLineDash([]);
      }
      // roof seen from above: wet hides over the whole depth of the tower
      const D = (yS - yN) * KY;
      h.fillStyle = '#7a563a'; h.fillRect(L - 2.5, Y(H) - D, 45, D + 1);
      h.strokeStyle = 'rgba(40,24,14,0.55)'; h.lineWidth = 0.45; for (let yy = Y(H) - D + 4; yy < Y(H); yy += 5) { h.beginPath(); h.moveTo(L - 2.5, yy); h.lineTo(R + 2.5, yy + (Math.sin(yy) * 0.6)); h.stroke(); }
      h.fillStyle = 'rgba(255,232,196,0.16)'; h.fillRect(L - 2.5, Y(H) - D, 45, 1.2);
      h.fillStyle = '#4a3222'; h.fillRect(L - 2.5, Y(H), 45, 1.6);
      // shade the whole right half (light from the left)
      const sg = h.createLinearGradient(L, 0, R + 5, 0); sg.addColorStop(0, 'rgba(255,236,200,0.10)'); sg.addColorStop(0.5, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(20,12,16,0.35)'); h.fillStyle = sg; h.globalCompositeOperation = 'source-atop'; h.fillRect(L - 6, Y(H + 12), 52, H + 14); h.globalCompositeOperation = 'source-over';
      // wheels (edge-on) and axle ends
      for (const wx of [L + 1, R - 1]) { h.fillStyle = '#2e2018'; h.beginPath(); h.ellipse(wx, Y(5), 2.2, 5.6, 0, 0, 6.28); h.fill(); h.fillStyle = '#6e4a2c'; h.beginPath(); h.ellipse(wx - 0.5, Y(5), 0.9, 4.6, 0, 0, 6.28); h.fill(); }
    });
    this._stTex = pc;
  }
  // interior climbers first (seen through the open storey)
  for (const u of S.units) if (u.role === 'intower' && u.st !== 'dead') this.drawUnit(g, { ...u, y: T.y + 14 }, Math.min(u.z, 44));
  this.sprite(g, this._stTex, T.x, T.y + 17, 0);
  // the drawbridge falls toward the wall: visible as a plank tilting away above the roof line
  if (T.bridge > 0) {
    const zt = H - 6, ang = T.bridge;
    g.fillStyle = '#8a5e36'; g.beginPath();
    g.moveTo(SX(x0 + 7), SY(yN, zt)); g.lineTo(SX(x1 - 7), SY(yN, zt)); g.lineTo(SX(x1 - 7), SY(yN - 18 * ang, zt + 18 * (1 - ang) - 3 * ang)); g.lineTo(SX(x0 + 7), SY(yN - 18 * ang, zt + 18 * (1 - ang) - 3 * ang)); g.closePath(); g.fill();
    g.strokeStyle = '#4e331f'; g.lineWidth = 0.4 * PX; g.stroke();
  }
  // arrows bristling from the hides (render-only, grows with time under fire)
  g.strokeStyle = '#ece4cf'; g.lineWidth = 0.45 * PX; const r = RNG(12); g.beginPath();
  for (let k = 0; k < Math.min(30, Math.floor(this.t * 1.6)); k++) { const side = r() < 0.5 ? -1 : 1, ax = T.x + side * (20 + r() * 4), az = 8 + r() * (H - 10); g.moveTo(SX(ax), SY(yS, az)); g.lineTo(SX(ax + side * 1.6), SY(yS, az) + 1.4 * PX); }
  g.stroke();
  // the Concord's banner rides on top
  this.drawBanner(g, 1, T.x - 8, T.y + 4, H, true);
};
Battle.prototype.drawLaundry = function (g) {
  const PX = CAM.PX, w = this.mood.wind / 20, t = this.t;
  const a = [84, 138], b = [128, 142];
  const pa = [SX(a[0]), SY(a[1], 9)], pb = [SX(b[0]), SY(b[1], 9)];
  g.strokeStyle = '#5c3b23'; g.lineWidth = 0.8 * PX; g.beginPath(); g.moveTo(pa[0], SY(a[1], 0)); g.lineTo(pa[0], pa[1]); g.moveTo(pb[0], SY(b[1], 0)); g.lineTo(pb[0], pb[1]); g.stroke();
  g.strokeStyle = '#d9cfb3'; g.lineWidth = 0.3 * PX; g.beginPath(); g.moveTo(pa[0], pa[1]); g.quadraticCurveTo((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 + 2 * PX, pb[0], pb[1]); g.stroke();
  const cols = ['#ece6d6', '#7d93a8', '#c9a36a', '#e4dccb', '#a65e4a'];
  for (let i = 0; i < 5; i++) {
    const q = (i + 0.7) / 5.6, x = lerp(pa[0], pb[0], q), y = lerp(pa[1], pb[1], q) + Math.sin(q * Math.PI) * 2 * PX;
    const cw = (3.6 + (i % 2)) * PX, ch = (4.5 + (i % 3)) * PX;
    const sw = (Math.sin(t * 5 + i * 1.3) * 0.5 + 0.7) * w * 2.4 * PX;
    g.fillStyle = cols[i]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + cw, y); g.lineTo(x + cw + sw, y + ch * (1 - w * 0.2)); g.lineTo(x + sw * 0.8, y + ch); g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,20,20,0.18)'; g.beginPath(); g.moveTo(x + cw * 0.6, y); g.lineTo(x + cw, y); g.lineTo(x + cw + sw, y + ch * (1 - w * 0.2)); g.lineTo(x + cw * 0.6 + sw * 0.9, y + ch); g.closePath(); g.fill();
  }
};
Battle.prototype.drawBanner = function (g, sqi, x, y, z, enemy) {
  const fr = enemy ? this.enemyBanner : this.banners[sqi];
  const i = Math.floor(this.t * (5 + this.mood.wind * 0.15) + sqi * 3) % fr.length;
  this.sprite(g, fr[i], x, y, z);
};

// ---------- the frame ----------
Battle.prototype.draw = function () {
  const PRF = window.__prof; PRF && PRF.start();
  const g = this.g, PX = CAM.PX, S = this.sim, t = this.t, M = this.mood || (this.mood = moodAt(t));
  const W = CAM.W, H = CAM.H;
  const shx = (RR() - 0.5) * this.shake * PX * 0.6, shy = (RR() - 0.5) * this.shake * PX * 0.6;
  const zi = 1 + this.impulse * 0.025, cx = SX(GATE_X), cy = SY(BAR_Y, 0);
  g.setTransform(zi, 0, 0, zi, cx - cx * zi + shx, cy - cy * zi + shy);
  const base = g.getTransform();
  g.drawImage(this.ground, 0, 0);
  // puddles fill with the rain and catch the sky
  const wet = smooth(12.5, 18, t);
  if (wet > 0) for (const p of this.puddles) {
    const a = wet * (0.4 + p.d * 0.3); g.fillStyle = `rgba(92,96,108,${a * 0.75})`; g.beginPath(); g.ellipse(SX(p.x), SY(p.y), p.rx * PX * (0.5 + wet * 0.5), p.ry * PX * (0.5 + wet * 0.5), 0, 0, 6.28); g.fill();
    g.fillStyle = `rgba(200,205,220,${a * 0.35})`; g.beginPath(); g.ellipse(SX(p.x) - p.rx * PX * 0.25, SY(p.y) - p.ry * PX * 0.2, p.rx * PX * 0.4, p.ry * PX * 0.25, 0, 0, 6.28); g.fill();
  }
  PRF && PRF.mark('land');
  this.drawLandFx(g);
  PRF && PRF.mark('shadow0');
  // ---- shadows (one sun; length and strength follow the time of day) ----
  const L = M.L, sdx = 0.8 * L, sdy = -0.55 * L * KY;
  g.fillStyle = `rgba(38,26,34,${M.shA})`;
  g.beginPath();
  for (const u of S.units) { if (u.st === 'dead' || u.role === 'intower') continue; const h = u.z > 0 ? 0 : 1; if (!h) continue; const x = SX(u.x + sdx * 3.5), y = SY(u.y) + sdy * 3.5 * PX; const rw = (2.6 + L * 1.6) * PX; g.moveTo(x + rw, y); g.ellipse(x, y, rw, 1.5 * PX, 0, 0, 6.28); }
  for (const d of this.dying) { if (d.z > 0) continue; const x = SX(d.x + sdx * 2), y = SY(d.y) + sdy * 2 * PX; g.moveTo(x + 4 * PX, y); g.ellipse(x, y, 4 * PX, 1.5 * PX, 0, 0, 6.28); }
  for (const tr of this.trees) { const hh = tr.trunkH + tr.r; const x = SX(tr.x + sdx * hh * 0.8), y = SY(tr.y) + sdy * hh * 0.8 * PX; g.moveTo(x + tr.r * 1.2 * PX, y); g.ellipse(x, y, tr.r * 1.2 * PX, tr.r * 0.55 * PX, -0.3, 0, 6.28); }
  for (const p of this.props) { const hh = p.kind === 'house' || p.kind === 'barn' ? 22 : (p.kind === 'fence' || p.kind === 'hedge' || p.kind === 'hedgeH') ? 0 : 8; if (!hh) continue; const w = p.sp.c.width / PX * 0.42; const x = SX(p.x + sdx * hh * 0.6) + (p.kind === 'fence' ? 0 : 0), y = SY(p.y) + sdy * hh * 0.6 * PX; g.moveTo(x + w * PX, y); g.ellipse(x, y, w * PX, Math.min(w, 6) * 0.5 * PX, -0.2, 0, 6.28); }
  for (const b of this.life.birds) { if (b.z < 1) continue; const x = SX(b.x + b.z * 0.5), y = SY(b.y); g.moveTo(x + 1.6 * PX, y); g.ellipse(x, y, 1.6 * PX, 0.7 * PX, 0, 0, 6.28); }
  g.fill();
  // projectile shadows
  g.fillStyle = `rgba(38,26,34,${M.shA * 0.8})`; g.beginPath();
  for (const p of S.proj) { const q = p.t / p.T, x = lerp(p.x0, p.x1, q), y = lerp(p.y0, p.y1, q); if (y < WY1 + 2) continue; g.rect(SX(x) - 1.2 * PX, SY(y) - 0.3 * PX, 2.4 * PX, 0.6 * PX); }
  g.fill();
  // the curtain wall's own shadow falls into the courtyard (so the crenels read dark against it)
  { const len = (10 + 9 * L) * PX, y0 = SY(WY0, 0); const gr = g.createLinearGradient(0, y0 - len, 0, y0); gr.addColorStop(0, 'rgba(38,26,34,0)'); gr.addColorStop(0.35, `rgba(38,26,34,${M.shA * 0.85})`); gr.addColorStop(1, `rgba(38,26,34,${M.shA * 1.1})`); g.fillStyle = gr; g.fillRect(0, y0 - len, W, len); }
  // siege tower and tower shadows (long parallelograms)
  const T = S.tower;
  const shadowBox = (x0, x1, y, h, a) => { g.fillStyle = `rgba(38,26,34,${a})`; g.beginPath(); g.moveTo(SX(x0), SY(y)); g.lineTo(SX(x1), SY(y)); g.lineTo(SX(x1 + sdx * h), SY(y) + sdy * h * PX); g.lineTo(SX(x0 + sdx * h), SY(y) + sdy * h * PX); g.closePath(); g.fill(); };
  shadowBox(T.x - 20, T.x + 20, T.y + 17, 50, M.shA * 0.9);
  shadowBox(TWR.x0, TWR.x1, TW_F, 20, M.shA * 0.6); shadowBox(TWL.x0, TWL.x1, TW_F, 20, M.shA * 0.6);
  shadowBox(GATE_X - 56, GATE_X + 56, BAR_Y + 4, 8, M.shA * 0.7);
  PRF && PRF.mark('shadow');
  // ---- y-sorted world ----
  const items = this._items || (this._items = []); items.length = 0;
  const push = (y, ty, o) => items.push({ y, ty, o });
  const walkUnits = [], towerTop = [[], []], wallDying = [];
  for (const u of S.units) {
    if (u.st === 'dead' || u.role === 'intower') continue;
    if (u.role === 'climbing') { push(WY1 + 3 + u.z * 0.01, 0, u); continue; }
    if (u.z === WZ) { walkUnits.push(u); continue; }
    if (u.z === TZ) { towerTop[u.x < GATE_X ? 0 : 1].push(u); continue; }
    push(u.y, 0, u);
  }
  for (const d of this.dying) { if (d.onWall) wallDying.push(d); else push(d.fall > 0 ? WY1 + 3 : d.y, 10, d); }
  for (const p of this.props) push(p.y, 1, p);
  for (const tr of this.trees) push(tr.y, 2, tr);
  push(WY1 + 0.5, 3, null);
  this.towers.forEach((tw, i) => push(TW_F, 4, i));
  this.rtowers.forEach((rt, i) => push(rt.R.cy + rt.R.r * 0.5, 5, i));
  push(116, 6, null);
  push(BAR_Y + 3, 7, null);
  push(T.y + 17, 8, null);
  S.ladders.forEach((Ld, i) => { if (Ld.up) push(WY1 + 2, 9, i); else if (Ld.cool <= 0) { const cs = S.units.find((u) => u.role === 'carry' && u.lad === i && u.st !== 'dead'); if (cs) push(cs.y + 4, 15, i); } });
  for (const l of this.ladderFx) if (l.fall) push(WY1 + 2.2, 16, l);
  const Lf = this.life;
  for (const f of Lf.folk) { const s = (t - f.s0) * f.v; if (s < 0) continue; const pos = pathAt(f.path, s); if (!pos) continue; push(pos[1] + f.off * 0.3, 11, { f, pos }); }
  if (t > Lf.child.t0) push(this.childPos()[1], 12, null);
  for (const b of Lf.beasts) if (!b.gone) push(b.y, 13, b);
  push(GATE_X - 36 + 0.1 > 0 ? BAR_Y - 13 : 0, 14, 0); push(BAR_Y - 25, 14, 1);
  push(410, 14, 9);
  push(140, 17, null);
  PRF && PRF.mark('build');
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const _t0 = PRF ? performance.now() : 0;
    switch (it.ty) {
      case 0: this.drawUnit(g, it.o); break;
      case 10: this.drawDying(g, it.o); break;
      case 1: this.sprite(g, it.o.sp, it.o.x, it.o.y); break;
      case 2: this.drawTree(g, it.o); break;
      case 3: {
        g.drawImage(this.wall.c, this.wall.dx, this.wall.dy);
        // the left tower's afternoon shadow falls across the gatehouse
        g.fillStyle = `rgba(38,26,34,${M.shA * 0.55})`; g.beginPath(); g.moveTo(SX(TWL.x1), SY(GH_F, GHZ + 2)); g.lineTo(SX(TWL.x1 + 6 + L * 9), SY(GH_F, GHZ + 2)); g.lineTo(SX(TWL.x1 + 2 + L * 4), SY(GH_F, 0)); g.lineTo(SX(TWL.x1), SY(GH_F, 0)); g.closePath(); g.fill();
        // projecting towers throw their shadow sideways across the curtain face (the sun is low in the south-west)
        { const sw = 6 + 9 * L, fT = WY1 * KY - WZ, fB = (WY1 + 5) * KY; g.fillStyle = `rgba(38,26,34,${M.shA * 0.75})`; g.beginPath();
          for (const x of [TWR.x1, RTOW[0].cx + RTOW[0].r * 0.7]) { g.moveTo(SX(x), (fT - CAM.sy) * PX); g.lineTo(SX(x + sw), (fT - CAM.sy) * PX); g.lineTo(SX(x + sw * 0.45), (fB - CAM.sy) * PX); g.lineTo(SX(x), (fB - CAM.sy) * PX); g.closePath(); }
          g.fill(); }
        walkUnits.sort((a, b) => a.y - b.y);
        this.drawBanner(g, 2, 150, WY0 + 9, WZ); this.drawBanner(g, 3, 736, WY0 + 9, WZ);
        for (const d of wallDying) this.drawDying(g, d);
        for (const u of walkUnits) this.drawUnit(g, u, WZ);
        g.drawImage(this.parapet.c, this.parapet.dx, this.parapet.dy);
        break;
      }
      case 4: {
        const tw = this.towers[it.o];
        g.drawImage(tw.body.c, tw.body.dx, tw.body.dy);
        // long March banner hanging from the parapet; its tail moves with the wind
        const bx = (tw.T.x0 + tw.T.x1) / 2, top = SY(TW_F, TZ - 2), bot = SY(TW_F, TZ - 30), sw = Math.sin(t * 1.4 + it.o) * this.mood.wind * 0.04 * PX;
        g.fillStyle = '#2c5d93'; g.beginPath(); g.moveTo(SX(bx - 6), top); g.lineTo(SX(bx + 6), top); g.lineTo(SX(bx + 6) + sw, bot); g.lineTo(SX(bx) + sw, bot - 4 * PX); g.lineTo(SX(bx - 6) + sw, bot); g.closePath(); g.fill();
        g.save(); g.clip(); paintChargePx(g, 'wave', SX(bx) + sw * 0.5, (top + bot) / 2 - 2 * PX, PX * 1.15, '#efe2bf'); g.fillStyle = 'rgba(20,10,30,0.25)'; g.fillRect(SX(bx + 1), top, 5 * PX + Math.abs(sw), bot - top); g.restore();
        g.strokeStyle = '#1c3c63'; g.lineWidth = 0.4 * PX; g.stroke();
        const tu = towerTop[it.o].sort((a, b) => a.y - b.y);
        for (const u of tu) this.drawUnit(g, u, TZ);
        g.drawImage(tw.top.c, tw.top.dx, tw.top.dy);
        // brazier on the platform
        const brx = SX(bx), bry = SY(TW_F - 4, TZ);
        g.fillStyle = '#3a3330'; g.fillRect(brx - 2 * PX, bry - 3 * PX, 4 * PX, 3 * PX);
        break;
      }
      case 5: { const rt = this.rtowers[it.o]; g.drawImage(rt.L.c, rt.L.dx, rt.L.dy); const fr = this.enemyBanner; void fr; const [fx, fy] = rt.R.finial; const ph = t * 6 + it.o; g.fillStyle = '#2c5d93'; g.beginPath(); g.moveTo(SX(fx), (fy - CAM.sy) * PX); g.lineTo(SX(fx) + (9 + Math.sin(ph) * 1.2) * PX, (fy - CAM.sy + 2 + Math.sin(ph * 1.3)) * PX); g.lineTo(SX(fx), (fy - CAM.sy + 4) * PX); g.closePath(); g.fill(); break; }
      case 6: g.drawImage(this.keep.c, this.keep.dx, this.keep.dy); break;
      case 7: { const sp = S.bar.broken ? this.barricadeBroken : this.barricade; this.sprite(g, sp, GATE_X, BAR_Y + 3); break; }
      case 8: this.drawSiegeTower(g, T); break;
      case 9: { const Ld = S.ladders[it.o]; const lf = this.ladderFx.find((l) => l.li === it.o && !l.fall); this.drawLadder(g, Ld.x, Ld.foot, 1, lf ? Math.max(0, 0.35 - lf.t) : 0); break; }
      case 15: this.drawCarriedLadder(g, it.o); break;
      case 16: { const Ld = S.ladders[it.o.li]; this.drawLadder(g, Ld.x, Ld.foot, 1, clamp(it.o.t / 0.7, 0, 1) ** 2); break; }
      case 11: { const { f, pos } = it.o; const fi = frameOf('walk', Math.floor((t - f.s0) * f.v / 4.5) % 4); const A = this.atlas; const fc = pos[2] > 0 ? 2 : 3; g.drawImage(A.pages[f.k], fi * A.cw, fc * A.ch, A.cw, A.ch, Math.round(SX(pos[0] + f.off * 0.4) - AX * PX), Math.round(SY(pos[1] + f.off * 0.3) - AY * PX), A.cw, A.ch); break; }
      case 12: { const p = this.childPos(); const A = this.atlas; const fi = p[3] ? frameOf('walk', Math.floor(t * 9) % 4) : frameOf('idle', 0); g.drawImage(A.pages.v_child, fi * A.cw, p[2] * A.ch, A.cw, A.ch, Math.round(SX(p[0]) - AX * PX), Math.round(SY(p[1]) - AY * PX), A.cw, A.ch); break; }
      case 13: { const b = it.o, An = this.animals, k = An.types.indexOf(b.type); const moving = Math.abs(b.vx) + Math.abs(b.vy) > 3; const fr = moving ? 1 + (Math.floor(b.ph) % 2) : (b.type === 'goose' && Math.sin(b.ph * 0.5) > 0.6 ? 3 : 0); const m = b.vx < 0 ? 1 : 0; g.drawImage(An.page, fr * An.cw, (k * 2 + m) * An.ch, An.cw, An.ch, Math.round(SX(b.x) - An.ax), Math.round(SY(b.y) - An.ay), An.cw, An.ch); break; }
      case 14: if (it.o === 9) this.drawBanner(g, 0, 232, 410, 0, true); else if (it.o === 0) this.drawBanner(g, 0, GATE_X - 36, BAR_Y - 13, 0); else this.drawBanner(g, 1, GATE_X + 30, BAR_Y - 25, 0); break;
      case 17: this.drawLaundry(g); break;
    }
    if (PRF) PRF.ty(it.ty, performance.now() - _t0);
  }
  PRF && PRF.mark('items');
  // ---- projectiles: arcs with a slight lead line ----
  g.lineCap = 'round';
  for (const p of S.proj) {
    const q = p.t / p.T, q2 = Math.max(0, q - 0.06);
    const pos = (qq) => [lerp(p.x0, p.x1, qq), lerp(p.y0, p.y1, qq), lerp(p.z0, p.z1, qq) + p.arc * 4 * qq * (1 - qq)];
    const a = pos(q), b = pos(q2);
    const ax = SX(a[0]), ay = SY(a[1], a[2]), bx = SX(b[0]), by = SY(b[1], b[2]);
    const dx = ax - bx, dy = ay - by, l = Math.hypot(dx, dy) || 1, len = (p.kind === 'jav' ? 8 : 5.5) * PX;
    g.strokeStyle = p.kind === 'jav' ? '#5c3b23' : '#3e2a1a'; g.lineWidth = (p.kind === 'jav' ? 0.8 : 0.55) * PX;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - dx / l * len, ay - dy / l * len); g.stroke();
    if (p.kind !== 'jav') { g.strokeStyle = p.side ? '#d8b9a0' : '#f0e8d4'; g.lineWidth = 0.8 * PX; g.beginPath(); g.moveTo(ax - dx / l * len * 0.8, ay - dy / l * len * 0.8); g.lineTo(ax - dx / l * len, ay - dy / l * len); g.stroke(); }
  }
  PRF && PRF.mark('proj');
  // ---- particles (normal blend) ----
  for (const p of this.parts) {
    const life = p.t / p.T, x = SX(p.x), y = SY(p.y, p.z);
    switch (p.k) {
      case 'smoke': case 'wisp': case 'steam': case 'dust': {
        const tex = p.k === 'steam' ? this.tex.steam : p.k === 'dust' ? this.tex.dust : this.tex.smoke[p.c || 0];
        const s = (p.k === 'wisp' ? 0.4 + life * 1.2 : 0.5 + life * 1.9) * p.s * (p.k === 'dust' ? 0.9 : 1);
        g.globalAlpha = (p.k === 'wisp' ? 0.35 : p.k === 'steam' ? 0.7 : 0.62) * Math.min(1, life * 5) * (1 - life);
        const w = tex.width * s; g.drawImage(tex, x - w / 2, y - w / 2, w, w); break;
      }
      case 'splash': g.globalAlpha = 0.85 * (1 - life); g.fillStyle = '#e4ecef'; g.fillRect(x - 0.4 * PX, y - 0.4 * PX, 0.8 * PX, 0.8 * PX); break;
      case 'blood': g.globalAlpha = 1; g.fillStyle = '#6e1a17'; g.fillRect(x - 0.5 * PX, y - 0.5 * PX, PX, PX); break;
      case 'splinter': g.globalAlpha = 1 - life * 0.5; g.strokeStyle = '#7a5232'; g.lineWidth = 0.6 * PX; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(p.r) * 2 * PX, y + Math.sin(p.r) * 1.2 * PX); g.stroke(); break;
      case 'leaf': g.globalAlpha = 1 - life * 0.3; g.fillStyle = p.c ? '#b3672b' : '#c8963c'; g.beginPath(); g.ellipse(x, y, 1.1 * PX, Math.abs(Math.sin(p.r)) * 0.6 * PX + 0.2 * PX, p.r, 0, 6.28); g.fill(); break;
      case 'ripple': g.globalAlpha = (1 - life) * 0.6; g.strokeStyle = '#c8cedb'; g.lineWidth = 0.4 * PX; g.beginPath(); g.ellipse(x, y, (0.5 + life * 3) * p.s * PX, (0.25 + life * 1.3) * p.s * PX, 0, 0, 6.28); g.stroke(); break;
    }
  }
  g.globalAlpha = 1;
  PRF && PRF.mark('parts');
  // birds (in the air, above everything that stands)
  for (const b of Lf.birds) {
    const x = SX(b.x), y = SY(b.y, b.z), fl = b.z > 0.5 ? Math.sin(b.ph) : -0.2;
    g.strokeStyle = '#1e1714'; g.lineWidth = 0.75 * PX; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - 2.4 * PX, y - fl * 1.6 * PX); g.lineTo(x, y + 0.3 * PX); g.lineTo(x + 2.4 * PX, y - fl * 1.6 * PX); g.stroke();
    if (b.z < 0.5) { g.fillStyle = '#1e1714'; g.beginPath(); g.ellipse(x, y - 0.6 * PX, 1.4 * PX, 0.8 * PX, 0, 0, 6.28); g.fill(); }
  }
  PRF && PRF.mark('birds');
  // ---- light: time-of-day tint, then additive fire light ----
  g.setTransform(1, 0, 0, 1, 0, 0);
  const tn = M.tint;
  const tg = g.createLinearGradient(0, 0, W * 0.4, H);
  tg.addColorStop(0, rgb(tn[0] * 0.92, tn[1] * 0.93, tn[2] * 0.98)); tg.addColorStop(0.5, rgb(tn[0], tn[1], tn[2])); tg.addColorStop(1, rgb(Math.min(255, tn[0] * 1.03), tn[1] * 0.99, tn[2] * 0.95));
  g.globalCompositeOperation = 'multiply'; g.fillStyle = tg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  g.setTransform(base);
  const gk = 0.25 + M.glow * 0.75;
  const glow = (x, y, z, r, k) => { const s = r * PX * 2 * (0.94 + RR() * 0.12); g.globalAlpha = clamp(k * gk, 0, 1); g.drawImage(this.tex.glow, SX(x) - s / 2, SY(y, z) - s / 2, s, s); };
  for (const f of this.fires) glow(f.x, f.y, f.z, 46 * f.s, 0.55);
  for (const b of S.burn) glow(b.x, b.y, 4, 22, 0.5);
  for (const tch of this.torches) glow(tch.x, tch.y, tch.z, tch.br ? 26 : 18, M.glow * 0.9 + 0.1);
  for (const p of this.parts) {
    const life = p.t / p.T;
    if (p.k === 'flame') { const s = p.s * PX * (1 - life * 0.5); g.globalAlpha = (1 - life) * 0.9; g.drawImage(this.tex.flame, SX(p.x) - 4 * s, SY(p.y, p.z) - 12 * s, 8 * s, 14 * s); }
    else if (p.k === 'ember') { g.globalAlpha = (1 - life); g.fillStyle = '#ffb060'; g.fillRect(SX(p.x), SY(p.y, p.z), 0.7 * PX, 0.7 * PX); }
    else if (p.k === 'spark') { g.globalAlpha = 1 - life; g.fillStyle = '#fff2c0'; g.fillRect(SX(p.x), SY(p.y, p.z), 0.8 * PX, 0.8 * PX); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  PRF && PRF.mark('light');
  // ---- rain (screen space, wind-slanted, one stroke) ----
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (M.rain > 0.02) {
    const n = Math.floor(this.rain.length * M.rain * (P_LOW ? 0.4 : 1)), sl = M.wind * 0.012;
    g.strokeStyle = `rgba(196,204,224,${0.22 + M.rain * 0.18})`; g.lineWidth = Math.max(1, PX * 0.35); g.beginPath();
    for (let i = 0; i < n; i++) { const r = this.rain[i]; const l = r.l * PX * 0.6; g.moveTo(r.x, r.y); g.lineTo(r.x + l * sl, r.y + l); }
    g.stroke();
  }
  PRF && PRF.mark('rain');
  // ---- vignette + a slight tilt-shift darkening at the top and bottom (diorama lens) ----
  if (!this.vig) { const c = mkCanvas(W / 4, H / 4), vg = c.getContext('2d'); const gr = vg.createRadialGradient(W / 8, H / 8 * 1.05, H / 8 * 0.6, W / 8, H / 8, W / 8 * 1.05); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(18,10,8,0.42)'); vg.fillStyle = gr; vg.fillRect(0, 0, W / 4, H / 4); const lg = vg.createLinearGradient(0, 0, 0, H / 4); lg.addColorStop(0, 'rgba(20,12,10,0.18)'); lg.addColorStop(0.18, 'rgba(0,0,0,0)'); lg.addColorStop(0.85, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(20,12,10,0.22)'); vg.fillStyle = lg; vg.fillRect(0, 0, W / 4, H / 4); this.vig = c; }
  g.drawImage(this.vig, 0, 0, W, H);
  PRF && PRF.mark('vig');
  if (this.flash > 0) { g.fillStyle = `rgba(235,240,255,${this.flash * 0.28})`; g.fillRect(0, 0, W, H); }
};
function paintChargePx(g, emb, cx, cy, s, col) { paintCharge(g, emb, cx, cy, s, col); }
function pathAt(path, s) {
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1], l = Math.hypot(bx - ax, by - ay);
    if (s <= l) return [lerp(ax, bx, s / l), lerp(ay, by, s / l), bx - ax];
    s -= l;
  }
  return null;
}
Battle.prototype.childPos = function () {
  // runs back from the path toward the geese, then is called back by her mother (render-only vignette)
  const c = this.life.child, t = this.t - c.t0;
  if (t < 3) return [300 + t * 14, 130 - t * 2, 2, 1];
  if (t < 5) return [342, 124, 0, 0];
  const s = (t - 5) * 18; const p = pathAt([[342, 124], [440, 150], [560, 131], [742, 119]], s);
  return p ? [p[0], p[1], 2, 1] : [742, 119, 1, 0];
};

// ============================================================================
window.__profile = () => { const acc = {}; let t0 = 0, last = 0; window.__prof = { start() { t0 = last = performance.now(); }, mark(k) { const n = performance.now(); acc[k] = (acc[k] || 0) + n - last; last = n; }, ty(k, d) { acc['ty' + k] = (acc['ty' + k] || 0) + d; } }; return acc; };
function runBattle() {
  const B = new Battle();
  window.__B = B;
  hudInit(B);
  const steps = Math.round(P_T / DT);
  const t0 = performance.now();
  for (let i = 0; i < steps; i++) B.tick();
  const ffMs = performance.now() - t0;
  B.mood = moodAt(B.t);
  B.draw(); hudUpdate(B, true);
  const S = B.sim;
  window.__info = { t: +B.t.toFixed(2), units: S.units.filter((u) => u.st !== 'dead').length, def: S.units.filter((u) => u.st !== 'dead' && u.side === 0).length, att: S.units.filter((u) => u.st !== 'dead' && u.side === 1).length, proj: S.proj.length, parts: B.parts.length, bootMs: Math.round(B.bootMs), ffMs: Math.round(ffMs), bar: Math.round(S.bar.hp), dock: S.tower.docked };
  window.__ready = true;
  // perf probe: average update+draw ms per frame over a duration (optionally forcing raster with a 1px readback)
  window.__perf = (ms, readback) => new Promise((res) => {
    const up = [], dr = [], tot = [];
    let last = performance.now(), acc = 0, frames = 0; const start = last;
    function f(now) {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
      const a = performance.now(); B.tick();
      const b = performance.now(); B.draw(); if (readback) B.g.getImageData(0, 0, 1, 1); hudUpdate(B); const c = performance.now();
      up.push(b - a); dr.push(c - b); tot.push(c - a); frames++;
      if (now - start < ms) requestAnimationFrame(f);
      else { const avg = (v) => v.reduce((s, x) => s + x, 0) / v.length; const p95 = (v) => v.slice().sort((x, y) => x - y)[Math.floor(v.length * 0.95)]; res({ frames, fps: frames / ((now - start) / 1000), update: avg(up), draw: avg(dr), total: avg(tot), p95: p95(tot), units: S.units.filter((u) => u.st !== 'dead').length, parts: B.parts.length, proj: S.proj.length }); }
    }
    requestAnimationFrame(f);
  });
  if (P_PERF) return;
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; acc += dt;
    let n = 0; while (acc >= DT && n < 4) { B.tick(); acc -= DT; n++; } if (n === 4) acc = 0;
    B.draw(); hudUpdate(B);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
