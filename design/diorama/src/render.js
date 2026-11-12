// ============================================================================
// render: ground (with persistent decals), y-sorted 3/4 world, render-only life
// (villagers, livestock, birds, laundry, smoke), particles, light, weather.
// Render state lives in its own maps keyed by unit id; nothing is written to
// the sim. Render randomness uses its own RNG (never the sim's).
// ============================================================================
const RR = RNG(4242); // render-only randomness
const COURT_PATHS = [[[440, 200], [440, 152], [560, 132], [742, 119]], [[440, 152], [330, 132], [160, 112], [-20, 118]]];
function distSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; const t = clamp(((px - ax) * dx + (py - ay) * dy) / (l || 1), 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function distPaths(x, y) { let d = 1e9; for (const P of COURT_PATHS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, distSeg(x, y, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1])); return d; }

// groundColor / bakeGround live in land.js

// ---------- textures for particles and light ----------
function puffTex(PX, col, soft) {
  const s = Math.ceil(16 * PX), c = mkCanvas(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  const [r, gg, b] = hex(col);
  gr.addColorStop(0, rgb(r, gg, b, 1)); gr.addColorStop(soft ? 0.25 : 0.5, rgb(r, gg, b, 0.75)); gr.addColorStop(1, rgb(r, gg, b, 0));
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
}
function smokeTex(PX, col, seed) {
  // lumpy smoke: a few overlapping soft blobs (not one perfect gradient)
  const s = Math.ceil(18 * PX), c = mkCanvas(s, s), g = c.getContext('2d'), r = RNG(seed);
  const [cr, cg, cb] = hex(col);
  for (let k = 0; k < 6; k++) {
    const x = s / 2 + (r() - 0.5) * s * 0.35, y = s / 2 + (r() - 0.5) * s * 0.3, rad = s * (0.18 + r() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); const lk = 1 + (0.5 - (y / s)) * 0.3;
    gr.addColorStop(0, rgb(cr * lk, cg * lk, cb * lk, 0.55)); gr.addColorStop(1, rgb(cr, cg, cb, 0));
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  return c;
}
function glowTex(PX, inner, outer) {
  const s = Math.ceil(64 * PX * 0.5), c = mkCanvas(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return c;
}
function flameTex(PX) {
  const w = Math.ceil(8 * PX), h = Math.ceil(14 * PX), c = mkCanvas(w, h), g = c.getContext('2d');
  g.setTransform(PX, 0, 0, PX, 0, 0);
  const gr = g.createLinearGradient(0, 14, 0, 0); gr.addColorStop(0, 'rgba(255,214,120,0.95)'); gr.addColorStop(0.45, 'rgba(255,140,50,0.85)'); gr.addColorStop(1, 'rgba(200,60,20,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(4, 0.5); g.quadraticCurveTo(7.6, 7, 6, 11); g.quadraticCurveTo(4, 14.2, 2, 11); g.quadraticCurveTo(0.4, 7, 4, 0.5); g.fill();
  g.fillStyle = 'rgba(255,250,215,0.85)'; g.beginPath(); g.ellipse(4, 10.6, 1.3, 2.4, 0, 0, 6.28); g.fill();
  return c;
}

// ---------- time of day & weather ----------
function moodAt(t) {
  const ks = [
    [0, [255, 238, 212], 1.05, 0.36, 0.0],
    [8, [246, 228, 210], 1.35, 0.32, 0.05],
    [12, [214, 208, 214], 1.6, 0.2, 0.3],
    [17, [168, 168, 196], 1.9, 0.11, 0.65],
    [22, [138, 140, 180], 2.2, 0.08, 0.85],
    [34, [92, 96, 140], 2.6, 0.05, 1.0],
  ];
  let a = ks[0], b = ks[ks.length - 1];
  for (let i = 0; i < ks.length - 1; i++) if (t >= ks[i][0] && t <= ks[i + 1][0]) { a = ks[i]; b = ks[i + 1]; break; }
  if (t > ks[ks.length - 1][0]) a = b;
  const k = a === b ? 0 : (t - a[0]) / (b[0] - a[0]);
  return { tint: mixA(a[1], b[1], k), L: lerp(a[2], b[2], k), shA: lerp(a[3], b[3], k), glow: lerp(a[4], b[4], k), rain: smooth(10.5, 16, t), wind: 14 + 6 * Math.sin(t * 0.55) + 4 * Math.sin(t * 1.7 + 1) };
}

// ============================================================================
function Battle() {
  const B = this;
  const cv = document.getElementById('c');
  const cssW = innerWidth, cssH = innerHeight;
  setupCamera(cssW, cssH);
  cv.width = CAM.W; cv.height = CAM.H; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  B.cv = cv; B.g = cv.getContext('2d', { alpha: false });
  const PX = CAM.PX;
  const tb0 = performance.now();
  B.atlas = buildAtlas(PX, KIND_IDS);
  B.animals = buildAnimals(PX);
  B.ground = bakeGround();
  B.wall = buildWall(); B.parapet = buildParapet();
  B.towers = [TWL, TWR].map((T) => ({ T, body: buildSquareTower(T), top: buildSquareTowerParapet(T) }));
  B.rtowers = RTOW.map((R) => ({ R, L: buildRoundTower(R) }));
  B.keep = buildKeep();
  B.tex = {
    smoke: [smokeTex(PX, '#4a423d', 1), smokeTex(PX, '#6d645c', 2), smokeTex(PX, '#8f8780', 3)],
    dust: smokeTex(PX, '#a08a66', 4), steam: smokeTex(PX, '#e8e4dc', 5),
    glow: glowTex(PX, 'rgba(255,200,120,0.9)', 'rgba(255,120,40,0.35)'), glowS: glowTex(PX, 'rgba(255,230,170,0.8)', 'rgba(255,170,80,0.25)'),
    flame: flameTex(PX), puff: puffTex(PX, '#ffffff', true),
  };
  B.bootMs = performance.now() - tb0;
  // banners
  B.banners = SQUADS.map((sq) => makeBannerFrames(sq, PX, 8));
  B.enemyBanner = makeBannerFrames({ field: '#a12f2b', charge: '#e6d6b0', emb: 'sun', shape: 'swallow' }, PX, 8);
  // props
  B.props = [];
  const P = (x, y, sp, kind, extra) => B.props.push({ x, y, sp, kind, ...(extra || {}) });
  const trees = [[742, 384, 'apple'], [806, 410, 'apple'], [866, 372, 'apple'], [780, 352, 'apple'], [850, 420, 'apple'], [732, 424, 'apple'], [26, 350, 'oak'], [92, 404, 'apple'], [60, 302, 'oak'], [262, 303, 'oak'], [800, 302, 'oak'], [HEDGE_XW, 388, 'oak'], [HEDGE_XE, 344, 'oak']];
  B.trees = trees.map(([x, y, k], i) => ({ x, y, ...makeTree(31 + i * 7, k), ph: i * 1.7, kind: k }));
  for (const [x, dy, sd] of [[302, -10, 1], [586, 11, 2], [846, -10, 3], [146, 11, 4], [40, -9, 5]]) B.trees.push({ x, y: creekY(x) + dy, ...makeWillow(90 + sd), ph: sd * 2.1, kind: 'willow' });
  P(130, 112, makeCottage(5, 56, 26, 15, { chimney: -0.6 }), 'house', { chimney: [130 - 0.6 * 28, 112], smoke: 1 });
  P(252, 96, makeCottage(6, 44, 22, 13, { chimney: 0.5 }), 'house', { chimney: [252 + 0.5 * 22, 96], smoke: 1 });
  P(592, 124, makeCottage(7, 62, 24, 12, {}), 'house');
  P(52, 488, makeCottage(9, 70, 28, 16, { burnt: true }), 'barn');
  P(334, 132, makeWell(), 'well');
  P(508, 136, makeCrates(3), 'crates');
  P(468, 140, makeBarrels(3, 4), 'barrels');
  P(178, 120, makeWoodpile(), 'wood');
  P(628, 146, makeTent(), 'tent');
  P(380, 146, makeCart(2, false), 'cart');
  P(478, 338, makeCart(9, false), 'cart');
  P(118, 382, makeScarecrow(), 'scarecrow');
  P(30, 262, makeHay(), 'hay'); P(842, 268, makeHay(), 'hay');
  P(722, 296, makeFence(60, 4), 'fence');
  const stooks = [[200, 322], [252, 318], [330, 330], [196, 352], [282, 350], [214, 404], [262, 410], [318, 412], [372, 404], [236, 428], [298, 426], [96, 262], [140, 280], [56, 280]];
  stooks.forEach(([x, y], i) => P(x, y, makeStook(40 + i), 'stook'));
  B.buildLand();
  B.barricade = makeBarricade(false); B.barricadeBroken = makeBarricade(true);
  // static fire sources (render-only)
  B.fires = [{ x: 40, y: 486, z: 16, s: 1.5, smoke: 1 }, { x: 74, y: 482, z: 22, s: 1.1, smoke: 1 }];
  B.torches = [{ x: TWL.x1 + 4, y: GH_F + 1, z: 22 }, { x: TWR.x0 - 4, y: GH_F + 1, z: 22 }, { x: (TWL.x0 + TWL.x1) / 2, y: TW_F - 4, z: TZ + 6, br: 1 }, { x: (TWR.x0 + TWR.x1) / 2, y: TW_F - 4, z: TZ + 6, br: 1 }, { x: 742 - 14, y: 118, z: 14 }, { x: 742 + 14, y: 118, z: 14 }];
  // puddles that fill when the rain comes
  const pr = RNG(91); B.puddles = [];
  for (let k = 0; k < 16; k++) { const y = BAR_Y + 30 + pr() * 230; B.puddles.push({ x: roadX(y) + (pr() - 0.5) * 26, y, rx: 3 + pr() * 6, ry: 1.2 + pr() * 1.6, d: pr() }); }
  for (let k = 0; k < 5; k++) B.puddles.push({ x: 300 + pr() * 300, y: 120 + pr() * 26, rx: 3 + pr() * 4, ry: 1 + pr(), d: pr() });
  // sim
  B.sim = new Sim(P_SEED, P_N);
  // render-side state
  B.ra = new Map(); B.dying = []; B.parts = []; B.decalQ = [];
  B.ladderFx = []; B.flash = 0; B.shake = 0; B.impulse = 0;
  B.rain = []; for (let k = 0; k < 320; k++) B.rain.push({ x: RR() * CAM.W, y: RR() * CAM.H, l: 6 + RR() * 8, v: 520 + RR() * 220, gy: RR() * CAM.H });
  B.initLife();
  B.t = 0; B.lastEvent = null; B.barks = [];
}

// ---------- render-only life ----------
Battle.prototype.initLife = function () {
  const r = RNG(77);
  const L = (this.life = { folk: [], beasts: [], birds: [] });
  const path = [[-20, 120], [160, 113], [330, 133], [440, 150], [560, 131], [742, 119]];
  for (let i = 0; i < 16; i++) {
    const k = i % 5 === 0 ? 'v_man' : i % 3 === 0 ? 'v_child' : 'v_woman';
    L.folk.push({ k, path, s0: -28 + i * 2.4 + r() * 1.5, v: 15 + r() * 6, off: (r() - 0.5) * 10, ph: r() * 6 });
  }
  // the child who runs back for a goose (a small story, render-only)
  L.child = { k: 'v_child', x: 300, y: 128, t0: 3.0 };
  for (let i = 0; i < 7; i++) L.beasts.push({ type: 'goose', x: 280 + r() * 90, y: 118 + r() * 24, vx: 0, vy: 0, ph: r() * 6, flee: 0 });
  for (let i = 0; i < 4; i++) L.beasts.push({ type: 'goat', x: 70 + i * 16 + r() * 8, y: 122 + r() * 10, vx: 13, vy: 0, ph: r() * 6, herd: 1, s0: -6 + i * 1.5 });
  L.beasts.push({ type: 'dog', x: 220, y: 126, vx: 0, vy: 0, ph: 0, dog: 1 });
  for (let i = 0; i < 16; i++) L.birds.push({ x: 560 + r() * 90, y: 448 + r() * 44, z: 0, vx: 0, vy: 0, vz: 0, ph: r() * 6, up: 1.9 + r() * 0.8 });
};
Battle.prototype.updateLife = function (dt, t) {
  const L = this.life;
  for (const b of L.beasts) {
    b.ph += dt * 8;
    if (b.herd) { const s = Math.max(0, t - b.s0); b.x = 70 + (b.s0 + 6) * 10 + s * 12; b.y = 124 + Math.sin(b.ph * 0.2) * 3; b.vx = 12; if (b.x > 742) { b.gone = 1; } }
    else if (b.dog) { b.x = 220 + Math.sin(t * 0.9) * 60 + t * 6; b.y = 128 + Math.sin(t * 1.7) * 9; b.vx = Math.cos(t * 0.9) * 54 + 6; }
    else {
      // geese panic when arrows thud into the courtyard (render-only reaction)
      const wob = Math.sin(b.ph * 0.37) * 6;
      b.vx = lerp(b.vx, (Math.sin(b.ph * 0.13) * 10 + wob) * (1 + b.flee * 2.5), dt * 2); b.vy = lerp(b.vy, Math.cos(b.ph * 0.11) * 6 * (1 + b.flee * 2), dt * 2);
      b.x = clamp(b.x + b.vx * dt, 250, 430); b.y = clamp(b.y + b.vy * dt, 112, 148); b.flee = Math.max(0, b.flee - dt * 0.6);
    }
  }
  for (const b of L.birds) {
    if (t > b.up) { b.vz = Math.min(b.vz + dt * 60, 40); b.vx = lerp(b.vx, 46 + Math.sin(b.ph) * 20, dt * 2); b.vy = lerp(b.vy, -26 + Math.cos(b.ph) * 18, dt * 2); }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.ph += dt * (t > b.up ? 14 : 3);
  }
};

// ---------- fx intake: sim events -> particles, decals, camera ----------
Battle.prototype.spawn = function (k, x, y, z, o) {
  if (this.parts.length > (P_LOW ? 120 : 240)) return;
  this.parts.push({ k, x, y, z, vx: 0, vy: 0, vz: 0, t: 0, T: 1, s: 1, r: RR() * 6, ...o });
};
Battle.prototype.consumeFx = function () {
  const S = this.sim;
  for (const f of S.fx) {
    switch (f.k) {
      case 'die': {
        const ra = this.ra.get(f.id);
        this.dying.push({ kind: f.kind, x: f.x, y: f.y, z: f.z, face: faceOf(f.fx, f.fy), t: 0, mir: (f.id % 2), fall: f.z > 0 && f.onLad ? f.z : 0, onWall: f.z > 0 && !f.onLad, fire: f.cause === 1 });
        if (ra) this.ra.delete(f.id);
        break;
      }
      case 'blood': if (RR() < 0.7) this.decalQ.push({ k: 'blood', x: f.x + (RR() - 0.5) * 6, y: f.y + (RR() - 0.5) * 4, z: f.z, s: 0.6 + RR() * 0.7 }); for (let i = 0; i < 3; i++) this.spawn('blood', f.x, f.y, f.z + 7, { vx: (RR() - 0.5) * 30, vy: (RR() - 0.5) * 10, vz: 20 + RR() * 30, T: 0.4 }); break;
      case 'clash': for (let i = 0; i < 3; i++) this.spawn('spark', f.x, f.y, (f.z || 0) + 8, { vx: (RR() - 0.5) * 70, vy: (RR() - 0.5) * 30, vz: 10 + RR() * 40, T: 0.18 + RR() * 0.1 }); break;
      case 'land':
        if (f.c === 'arrow_wall') this.decalQ.push({ k: 'wallarrow', x: f.x, y: f.y, z: f.z, a: f.a });
        else if (f.z === 0 && f.y > WY0 - 80) { this.decalQ.push({ k: f.c === 'jav' ? 'jav' : 'arrow', x: f.x, y: f.y, a: f.a }); if (RR() < 0.3) this.spawn('dust', f.x, f.y, 0, { T: 0.5, s: 0.35 }); }
        if (f.y < WY0) for (const b of this.life.beasts) if (b.type === 'goose' && Math.hypot(b.x - f.x, b.y - f.y) < 60) b.flee = 1;
        break;
      case 'oil':
        this.impulse = 0.6; this.shake = Math.max(this.shake, 2);
        for (let i = 0; i < 26; i++) this.spawn('steam', f.x + (RR() - 0.5) * 80, f.y + (RR() - 0.5) * 24, 2, { vz: 12 + RR() * 16, vx: (RR() - 0.5) * 8, T: 2.2 + RR() * 1.5, s: 0.8 + RR() * 0.8 });
        this.decalQ.push({ k: 'scorch', x: f.x, y: f.y, s: 3.2 });
        break;
      case 'chip': if (RR() < 0.6) this.spawn('splinter', f.x + (RR() - 0.5) * 30, f.y, 6, { vx: (RR() - 0.5) * 40, vy: 10 + RR() * 20, vz: 20 + RR() * 30, T: 0.6 }); break;
      case 'break':
        this.impulse = 1; this.shake = Math.max(this.shake, 4);
        for (let i = 0; i < 40; i++) this.spawn('splinter', f.x + (RR() - 0.5) * 100, f.y, 6 + RR() * 8, { vx: (RR() - 0.5) * 90, vy: (RR() - 0.5) * 40, vz: 30 + RR() * 60, T: 0.9 });
        for (let i = 0; i < 16; i++) this.spawn('dust', f.x + (RR() - 0.5) * 100, f.y + (RR() - 0.5) * 10, 2, { T: 1.4, s: 1 + RR(), vx: (RR() - 0.5) * 10 });
        this.decalQ.push({ k: 'debris', x: f.x, y: f.y });
        break;
      case 'thud':
        this.shake = Math.max(this.shake, f.big ? 3.5 : 1.5); if (f.big) this.impulse = 0.8;
        for (let i = 0; i < (f.big ? 18 : 6); i++) this.spawn('dust', f.x + (RR() - 0.5) * 40, f.y + 2, f.z, { T: 1.2, s: 0.8 + RR() * 0.6, vx: (RR() - 0.5) * 16, vz: -4 });
        break;
      case 'ladder': this.ladderFx.push({ li: f.li, t: 0 }); for (let i = 0; i < 5; i++) this.spawn('dust', f.x + (RR() - 0.5) * 8, WY1 + 12, 0, { T: 0.8, s: 0.5 }); break;
      case 'ladderfall': this.ladderFx.push({ li: f.li, t: 0, fall: 1 }); this.decalQ.push({ k: 'ladderwreck', x: f.x, y: WY1 + 20 }); break;
      case 'shot': if (f.y < WY1 + 30 && f.c === 'arrow') this.shots = (this.shots || 0) + 1; break;
    }
  }
  S.fx.length = 0;
  // events become barks / HUD state
  for (const e of S.events) this.onEvent(e);
  S.events.length = 0;
};
function faceOf(fx, fy) { if (Math.abs(fy) * 0.9 > Math.abs(fx)) return fy > 0 ? 0 : 1; return fx >= 0 ? 2 : 3; }

// ---------- decals stamped into cached layers ----------
Battle.prototype.stampDecals = function (budget) {
  const PX = CAM.PX, g = this.ground.getContext('2d');
  let n = 0;
  while (this.decalQ.length && n < budget) {
    const d = this.decalQ.shift(); n++;
    const sx = SX(d.x) - CAM.shakeX * 0, sy = SY(d.y, 0);
    if (d.k === 'corpse') {
      const A = this.atlas, pg = A.pages[d.kind]; if (!pg) continue;
      if (d.onWall) {
        const wg = this.wall.c.getContext('2d');
        wg.save(); wg.globalAlpha = 0.95; wg.drawImage(pg, 16 * A.cw, d.face * A.ch, A.cw, A.ch, Math.round(sx - AX * PX - this.wall.dx), Math.round(SY(d.y, WZ) - AY * PX - this.wall.dy), A.cw, A.ch); wg.restore();
        continue;
      }
      if (RR() < 0.55) { g.fillStyle = 'rgba(78,22,18,0.42)'; g.beginPath(); g.ellipse(sx + (RR() - 0.5) * 3 * PX, sy, (3 + RR() * 3) * PX, (1.4 + RR()) * PX, 0, 0, 6.28); g.fill(); }
      if (d.fire) { g.fillStyle = 'rgba(22,15,11,0.5)'; g.beginPath(); g.ellipse(sx, sy - 1 * PX, 7 * PX, 2.6 * PX, 0, 0, 6.28); g.fill(); }
      g.save(); g.translate(Math.round(sx), Math.round(sy)); if (d.mir && d.face < 2) g.scale(-1, 1);
      g.drawImage(pg, 16 * A.cw, d.face * A.ch, A.cw, A.ch, -AX * PX, -AY * PX, A.cw, A.ch);
      g.restore();
    } else if (d.k === 'blood') {
      g.fillStyle = `rgba(${86 + RR() * 20},20,16,${0.35 + RR() * 0.25})`;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(sx + (RR() - 0.5) * 4 * PX, sy - d.z * PX * 0 + (RR() - 0.5) * 1.5 * PX, (0.6 + RR() * 1.4) * d.s * PX, (0.4 + RR() * 0.7) * d.s * PX, 0, 0, 6.28); g.fill(); }
    } else if (d.k === 'arrow' || d.k === 'jav') {
      const L = (d.k === 'jav' ? 8 : 5.5) * PX, a = d.a, dx = Math.cos(a) * L * 0.55, dy = -L * 0.75;
      g.strokeStyle = 'rgba(30,20,14,0.25)'; g.lineWidth = PX * 0.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + L * 0.6, sy - L * 0.25); g.stroke();
      g.strokeStyle = '#6e4a2a'; g.lineWidth = PX * (d.k === 'jav' ? 0.7 : 0.45); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - dx, sy + dy); g.stroke();
      if (d.k === 'arrow') { g.strokeStyle = '#ece4cf'; g.lineWidth = PX * 0.7; g.beginPath(); g.moveTo(sx - dx * 0.85, sy + dy * 0.85); g.lineTo(sx - dx, sy + dy); g.stroke(); }
    } else if (d.k === 'wallarrow') {
      const wg = this.wall.c.getContext('2d'), wx = sx - this.wall.dx, wy = SY(d.y, d.z) - this.wall.dy;
      const L = 4.5 * PX, dir = d.x > GATE_X ? 1 : -1;
      wg.fillStyle = 'rgba(30,22,16,0.5)'; wg.fillRect(wx - PX * 0.4, wy - PX * 0.4, PX * 0.8, PX * 0.8);
      wg.strokeStyle = '#6e4a2a'; wg.lineWidth = PX * 0.45; wg.beginPath(); wg.moveTo(wx, wy); wg.lineTo(wx + dir * L * 0.25, wy + L * 0.9); wg.stroke();
      wg.strokeStyle = '#ece4cf'; wg.lineWidth = PX * 0.7; wg.beginPath(); wg.moveTo(wx + dir * L * 0.21, wy + L * 0.72); wg.lineTo(wx + dir * L * 0.25, wy + L * 0.9); wg.stroke();
    } else if (d.k === 'scorch') {
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 22 * d.s * PX); gr.addColorStop(0, 'rgba(24,16,12,0.65)'); gr.addColorStop(0.6, 'rgba(40,28,20,0.35)'); gr.addColorStop(1, 'rgba(40,28,20,0)');
      g.fillStyle = gr; g.save(); g.translate(sx, sy); g.scale(1, 0.45); g.translate(-sx, -sy); g.beginPath(); g.arc(sx, sy, 22 * d.s * PX, 0, 6.28); g.fill(); g.restore();
    } else if (d.k === 'debris' || d.k === 'ladderwreck') {
      const n2 = d.k === 'debris' ? 40 : 10;
      for (let i = 0; i < n2; i++) { const x = sx + (RR() - 0.5) * (d.k === 'debris' ? 110 : 18) * PX, y = sy + (RR() - 0.3) * 8 * PX, a = RR() * 3, l = (2 + RR() * 5) * PX; g.strokeStyle = RR() < 0.5 ? '#5e3f25' : '#7a5232'; g.lineWidth = PX * (0.6 + RR() * 0.6); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l * 0.45); g.stroke(); }
    } else if (d.k === 'trample') {
      // flattened stalks laid along the direction of travel: the field remembers who went through
      g.strokeStyle = 'rgba(120,88,40,0.32)'; g.lineWidth = 0.5 * PX; g.beginPath();
      for (let i = 0; i < 5; i++) { const ox = (RR() - 0.5) * 4 * PX, oy = (RR() - 0.5) * 2 * PX, l = (1.5 + RR() * 2) * PX; g.moveTo(sx + ox, sy + oy); g.lineTo(sx + ox + Math.cos(d.a) * l, sy + oy + Math.sin(d.a) * l * KY); } g.stroke();
      g.fillStyle = 'rgba(150,112,52,0.18)'; g.beginPath(); g.ellipse(sx, sy, 3.2 * PX, 1.5 * PX, 0, 0, 6.28); g.fill();
    } else if (d.k === 'rut') {
      // a broad band of crushed crop with a faint groove: reads as a track, not a line
      g.fillStyle = 'rgba(150,118,70,0.16)'; g.fillRect(sx - 2.6 * PX, sy - 1.3 * PX, 5.2 * PX, 2.6 * PX);
      g.fillStyle = 'rgba(70,50,32,0.10)'; g.fillRect(sx - 0.7 * PX, sy - 1.3 * PX, 1.4 * PX, 2.6 * PX);
    } else if (d.k === 'print') {
      g.fillStyle = 'rgba(64,46,30,0.16)'; g.beginPath(); g.ellipse(sx, sy, PX * 0.8, PX * 0.45, 0, 0, 6.28); g.fill();
    }
  }
};
