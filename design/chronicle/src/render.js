// ============================================================================
// render: reads the sim, never writes to it (except draining sim.fx, which the sim
// never reads). Animation state lives here, keyed by unit id.
// ============================================================================
class Renderer {
  constructor(canvas, sim) {
    this.cv = canvas; this.g = canvas.getContext('2d', { alpha: false });
    this.sim = sim;
    this.vw = window.innerWidth; this.vh = window.innerHeight;
    canvas.width = Math.round(this.vw * DPR); canvas.height = Math.round(this.vh * DPR);
    canvas.style.width = this.vw + 'px'; canvas.style.height = this.vh + 'px';
    this.zoom = PARAM.zoom || this.vw / 838;
    this.cam = PARAM.cx ? { x: PARAM.cx, y: PARAM.cy } : PARAM.zoom ? { x: WX + 14, y: GYC + 4 } : { x: 471, y: 214 };
    this.S = this.zoom * DPR;
    this.rr = RNG(4242); // render-only randomness (particles, flicker): never touches the sim
    this.time = 0;
    // ground region: the view plus a margin for shake
    const vwW = this.vw / this.zoom, vhW = this.vh / this.zoom, m = 18;
    this.R = { x: Math.floor(this.cam.x - vwW / 2 - m), y: Math.floor(this.cam.y - vhW / 2 - m), w: Math.ceil(vwW + 2 * m), h: Math.ceil(vhW + 2 * m) };
    const t0 = performance.now();
    this.ground = bakeGround(this.R, this.S);
    this.gctx = this.ground.getContext('2d');
    this.gctx.setTransform(this.S, 0, 0, this.S, -this.R.x * this.S, -this.R.y * this.S);
    this.structs = buildStructures(this.S);
    this.gates = { intact: gateSprite(this.S, 'intact'), splintered: gateSprite(this.S, 'splintered'), broken: gateSprite(this.S, 'broken') };
    ATLAS = new Atlas(this.S, 36, 34, 18, 28);
    // print every plate during loading (the game does this behind its loading screen): no frame is cut mid-battle
    { const tA = performance.now();
      for (let k = 0; k < KINDS.length; k++) for (let v = 0; v < 2; v++) for (const dir of [-1, 1]) {
        for (const a of ANIM_ORDER) for (let f = 0; f < ANIMS[a]; f++) unitFrame(k, v, a, f, dir);
        for (let f = 0; f < 3; f++) corpseFrame(k, v, f, dir);
      }
      this.atlasMs = performance.now() - tA; }
    this.big = this.buildBig();
    this.bakeMs = performance.now() - t0;
    this.overlay = this.buildOverlay();
    this.smokeSpr = this.buildBlobs(); this.dustSpr = this.buildDust();
    this.glow = this.buildGlow();
    this.A = new Map();
    this.dying = []; this.wallCorpses = []; this.parts = []; this.decalQ = []; this.foot = new Uint8Array(Math.ceil(WORLD.w / 6) * Math.ceil(WORLD.h / 6));
    this.shake = 0; this.impulse = 0; this.flash = 0;
    this.flakes = [];
    const nf = PARAM.low ? 90 : 230;
    for (let i = 0; i < nf; i++) this.flakes.push({ x: this.rr() * this.vw, y: this.rr() * this.vh, s: 0.6 + this.rr() ** 2 * 2.2, v: 14 + this.rr() * 26, ph: this.rr() * 6.28 });
    this.banners = new Map();
    this.ladderDecal = new Set();
    this.preDecals();
  }

  // ---------- one-time art ----------
  buildBig() {
    const S = this.S;
    const mk = (w, h, ax, ay, fn) => { const c = mkCanvas(w * S, h * S), g = c.getContext('2d'); g.setTransform(S, 0, 0, S, ax * S, ay * S); fn(g); lightPass(c, S, 0.7, 0.28); return { img: c, ax: ax * S, ay: ay * S }; };
    return {
      shed: mk(60, 42, 30, 34, (g) => drawRamShed(g, 'ok')),
      wreck: mk(60, 42, 30, 34, (g) => drawRamShed(g, 'wreck')),
      log: mk(60, 42, 30, 34, (g) => drawRamLog(g)),
      pavise: mk(14, 16, 7, 13, (g) => {
        g.lineJoin = 'round';
        poly(g, [[-3.5, 0], [3.0, -1.2], [3.6, -11], [-2.8, -10]]); g.fillStyle = P.rust; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
        g.beginPath(); g.arc(0.2, -5.6, 1.5, 0, 7); g.fillStyle = P.gold; g.fill();
        g.beginPath(); g.moveTo(1.5, -1); g.lineTo(5.5, 0.5); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
      }),
    };
  }
  buildOverlay() {
    // dusk: warm west, cool east, darker corners. One multiply pass.
    const W = this.cv.width, H = this.cv.height;
    const c = mkCanvas(W, H), g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, W, H * 0.3);
    lg.addColorStop(0, '#F7D9A8'); lg.addColorStop(0.42, '#F3E8D4'); lg.addColorStop(0.78, '#DCD8D2'); lg.addColorStop(1, '#BDBEC6');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    const rg = g.createRadialGradient(W * 0.42, H * 0.52, H * 0.25, W * 0.5, H * 0.5, W * 0.62);
    rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(0.7, '#E9E2D6'); rg.addColorStop(1, '#8F8577');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // the print's grain: laid lines + fibres + a few specks, multiplied over everything (screen-fixed)
    g.globalCompositeOperation = 'source-over';
    const r = RNG(1234);
    for (let y = 0; y < H; y += 3 * DPR) { g.fillStyle = `rgba(120,100,70,${0.025 + r() * 0.02})`; g.fillRect(0, y, W, 0.6 * DPR); }
    for (let i = 0; i < (W * H) / 300; i++) { const x = r() * W, y = r() * H, a = r() * 3.14, L = (2 + r() * 7) * DPR; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + DPR, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.strokeStyle = `rgba(95,78,55,${0.05 + r() * 0.07})`; g.lineWidth = 0.5 * DPR; g.stroke(); }
    for (let i = 0; i < (W * H) / 9000; i++) { g.fillStyle = `rgba(60,48,36,${0.12 + r() * 0.2})`; g.beginPath(); g.arc(r() * W, r() * H, (0.3 + r() * 0.8) * DPR, 0, 7); g.fill(); }
    return c;
  }
  buildBlobs() {
    // ink-wash smoke: soft blobs with a darker, ragged wet edge (like ink bleeding into damp paper)
    const out = [];
    for (let k = 0; k < 5; k++) {
      const s = 64, c = mkCanvas(s, s), g = c.getContext('2d');
      for (let i = 0; i < 9; i++) {
        const a = hash2(k, i) * 6.28, d = hash2(k, i + 20) * 12;
        const x = 32 + Math.cos(a) * d, y = 32 + Math.sin(a) * d, r = 10 + hash2(k, i + 40) * 10;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(118,118,130,0.10)'); rg.addColorStop(0.75, 'rgba(110,110,124,0.08)'); rg.addColorStop(0.93, 'rgba(92,92,106,0.10)'); rg.addColorStop(1, 'rgba(92,92,106,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
      out.push(c);
    }
    return out;
  }
  buildDust() {
    const c = mkCanvas(48, 48), g = c.getContext('2d');
    for (let i = 0; i < 7; i++) { const x = 24 + (hash2(i, 1) - 0.5) * 16, y = 24 + (hash2(i, 2) - 0.5) * 12, r = 8 + hash2(i, 3) * 8; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(214,202,176,0.35)'); rg.addColorStop(1, 'rgba(214,202,176,0)'); g.fillStyle = rg; g.fillRect(0, 0, 48, 48); }
    return c;
  }
  buildGlow() {
    const s = 128, c = mkCanvas(s, s), g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,190,90,0.85)'); rg.addColorStop(0.35, 'rgba(240,140,50,0.35)'); rg.addColorStop(1, 'rgba(200,80,20,0)');
    g.fillStyle = rg; g.fillRect(0, 0, s, s);
    return c;
  }
  bannerFrame(emblem, f, sag, totem) {
    const key = emblem + '|' + f + '|' + Math.round(sag * 2) + (totem ? 't' : '');
    let b = this.banners.get(key);
    if (b) return b;
    const S = this.S, c = mkCanvas(18 * S, 32 * S), g = c.getContext('2d');
    g.setTransform(S, 0, 0, S, 4 * S, 29 * S);
    if (totem) drawTotem(g, f); else drawBanner(g, emblem, f, sag);
    b = { img: c, ax: 4 * S, ay: 29 * S };
    this.banners.set(key, b);
    return b;
  }

  // ---------- decals (stamped into the ground canvas; never fade) ----------
  preDecals() {
    // the field remembers the first two waves: old dead, arrows, scorch
    const r = RNG(77);
    for (let i = 0; i < 15; i++) {
      const x = r.range(330, WX - 22), y = r.range(60, 380);
      const k = r.pick([KIDX.h_levy, KIDX.h_levy, KIDX.h_maa, KIDX.o_goblin, KIDX.o_grunt]);
      this.stampCorpse(x, y, k, r.int(0, 1), r() < 0.5 ? 1 : -1, r.int(0, 2), 0.85);
      if (r() < 0.6) this.stampBlood(x + r.range(-2, 2), y + r.range(-1, 1), 0.6 + r() * 0.8, r.int(1, 999), 0.55);
    }
    for (let i = 0; i < 160; i++) this.stampArrow(r.range(300, WX - 6), r.range(30, 400), r.range(-0.6, 0.6), r.int(0, 99));
    for (let i = 0; i < 40; i++) this.stampArrow(r.range(WX + 30, 760), r.range(70, 360), Math.PI + r.range(-0.4, 0.4), r.int(0, 99));
    this.stampScorch(WX - 18, GYC + 2, 18, 5);
    this.stampScorch(338, 336, 14, 9);
  }
  stampCorpse(x, y, k, v, dir, pose, alpha = 1) {
    const f = corpseFrame(k, v, pose, dir);
    const g = this.gctx, S = this.S;
    g.save(); g.setTransform(1, 0, 0, 1, (x - this.R.x) * S - f.ax, (y - this.R.y) * S - f.ay);
    g.globalAlpha = alpha * 0.9;
    g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, f.sw, f.sh);
    g.restore();
  }
  stampBlood(x, y, s, seed, a = 0.8) {
    const g = this.gctx;
    splat(g, x, y, 2.2 * s, seed, P.blood, a * 0.85, 1, 0.2);
    inkBlob(g, x + 0.4, y + 0.2, 1.1 * s, seed + 3, P.bloodDk, a * 0.6, 0.7);
  }
  stampArrow(x, y, ang, seed) {
    const g = this.gctx, L = 3.6, ca = Math.cos(ang), sa = Math.sin(ang);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - ca * L + 0.6, y - sa * L * 0.5 - 2.2); g.strokeStyle = P.ink; g.lineWidth = 0.42; g.stroke();
    g.fillStyle = P.paperHi; g.fillRect(x - ca * L + 0.2, y - sa * L * 0.5 - 2.8, 1.0, 0.9);
    g.fillStyle = hexA(P.ink, 0.25); g.beginPath(); g.ellipse(x + 0.4, y + 0.2, 1.2, 0.5, 0, 0, 7); g.fill();
  }
  stampScorch(x, y, r, seed) {
    const g = this.gctx;
    for (let i = 0; i < 5; i++) inkBlob(g, x + (hash2(seed, i) - 0.5) * r * 0.6, y + (hash2(seed, i + 9) - 0.5) * r * 0.4, r * (0.5 + 0.4 * hash2(seed, i + 3)), seed + i, P.ink, 0.13, 0.55);
    for (let i = 0; i < 9; i++) { const a = hash2(seed, 50 + i) * 6.28, d = r * (0.6 + hash2(seed, 60 + i) * 0.6); brush(g, qpts(x, y, x + Math.cos(a) * d * 0.5, y + Math.sin(a) * d * 0.25, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5, 5), nib(1.4), P.ink, 0.22); }
  }
  stampOil(x, y, seed) {
    const g = this.gctx;
    inkBlob(g, x, y, 11, seed, '#5B3A16', 0.22, 0.5);
    inkBlob(g, x + 1, y, 7.5, seed + 1, '#3A2410', 0.45, 0.5);
    for (let i = 0; i < 9; i++) { const a = hash2(seed, i) * 6.28, d = 7 + hash2(seed, i + 9) * 8; inkBlob(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.5, 0.8 + hash2(seed, i + 30) * 1.6, seed + i, '#3A2410', 0.55, 0.6); }
    g.beginPath(); g.ellipse(x - 2, y - 1.2, 3.6, 0.9, -0.1, 0, 7); g.strokeStyle = 'rgba(235,197,106,0.55)'; g.lineWidth = 0.5; g.stroke();
  }
  stampFoot(x, y, side, inside) {
    const ci = ((x / 6) | 0) + ((y / 6) | 0) * Math.ceil(WORLD.w / 6);
    if (ci < 0 || ci >= this.foot.length || this.foot[ci] > 9) return;
    this.foot[ci]++;
    const g = this.gctx;
    g.fillStyle = inside ? 'rgba(70,58,46,0.16)' : 'rgba(60,62,72,0.15)';
    g.beginPath(); g.ellipse(x + side * 0.7, y, 0.8, 0.42, 0, 0, 7); g.fill();
  }

  // ---------- fx intake ----------
  intake(fx, live) {
    const r = this.rr;
    switch (fx.k) {
      case 'die': {
        this.dying.push({ x: fx.x, y: fx.y, z: fx.z, k: fx.kind, v: fx.v, dir: fx.dir, pose: fx.pose, t: 0, onWall: fx.onWall, fall: fx.fall });
        this.decalQ.push(() => this.stampBlood(fx.x + r.range(-1.5, 1.5), fx.y + r.range(-0.6, 1), 0.8 + r() * 0.8, (r() * 1e4) | 0, 0.85));
        if (live) for (let i = 0; i < 5; i++) this.part('blood', fx.x, fx.y, fx.z + 6, r.range(-30, 30), r.range(-10, 10), r.range(10, 45), 0.5);
        if (live && fx.z === 0) this.part('snowpuff', fx.x, fx.y, 1, 0, 0, 6, 0.6);
        break;
      }
      case 'hit': {
        if (!live) break;
        if (fx.kind === 'melee' && (fx.lethal || r() < 0.4) && this.parts.filter((p) => p.type === 'slash').length < 7) this.part('slash', fx.x, fx.y, fx.z + 8, fx.dx, fx.lethal ? 1 : 0, 0, 0.2);
        if (r() < 0.5) this.part('blood', fx.x, fx.y, fx.z + 7, fx.dx * r.range(10, 35), r.range(-8, 8), r.range(8, 30), 0.45);
        if (fx.kind === 'arrow' && r() < 0.5) this.part('spark', fx.x, fx.y, fx.z + 8, 0, 0, 0, 0.12);
        break;
      }
      case 'land': {
        if (!fx.wall) this.decalQ.push(() => (r() < 0.55 ? this.stampArrow(fx.x, fx.y, fx.a, 1) : null));
        if (live) this.part(fx.wall ? 'spark' : 'snowpuff', fx.x, fx.y, fx.z + 1, 0, 0, 4, fx.wall ? 0.15 : 0.45);
        break;
      }
      case 'ramhit': {
        if (live) { this.shake = Math.max(this.shake, 2.2); this.burst(fx.x, fx.y, 14, 0.45); for (let i = 0; i < 6; i++) this.part('dust', fx.x - 4 + r.range(-4, 4), fx.y + r.range(-14, 14), 2, r.range(-14, -4), r.range(-6, 6), r.range(4, 12), 1.4); }
        break;
      }
      case 'gatebreak': {
        if (live) { this.shake = 5; this.impulse = 1; this.flash = 0.16; this.burst(fx.x, fx.y, 26, 0.7); }
        for (let i = 0; i < 16; i++) this.part('dust', fx.x + r.range(-10, 14), fx.y + r.range(-18, 18), 3, r.range(-4, 22), r.range(-10, 10), r.range(4, 16), r.range(1.6, 2.8));
        for (let i = 0; i < 14; i++) this.part('debris', fx.x, fx.y + r.range(-12, 12), 10, r.range(10, 60), r.range(-30, 30), r.range(15, 45), 1.0);
        this.decalQ.push(() => { const g = this.gctx; for (let i = 0; i < 20; i++) { const x = WX + WW + r.range(0, 30), y = GYC + r.range(-14, 14); g.beginPath(); g.moveTo(x, y); g.lineTo(x + r.range(-2.5, 2.5), y + r.range(-1, 1)); g.strokeStyle = P.woodLo; g.lineWidth = 0.7; g.stroke(); } });
        break;
      }
      case 'oil': {
        for (let i = 0; i < 18; i++) this.part('oil', fx.x + 4, fx.y + r.range(-5, 5), WH + 4, r.range(-26, -8), r.range(-8, 8), r.range(-2, 6), 0.7);
        this.decalQ.push(() => this.stampOil(fx.x - 9, fx.y, 31));
        if (live) { this.shake = Math.max(this.shake, 1.5); }
        break;
      }
      case 'ignite': if (live) this.burst(fx.x, fx.y, 12, 0.3); break;
      case 'boom': { this.burst(fx.x, fx.y, 18, 0.5); for (let i = 0; i < 10; i++) this.part('debris', fx.x, fx.y, 8, r.range(-40, 40), r.range(-30, 30), r.range(15, 40), 1.0); this.decalQ.push(() => this.stampScorch(fx.x, fx.y, 20, 77)); break; }
      case 'thud': if (live) this.part('snowpuff', fx.x, fx.y, 1, 0, 0, 7, 0.7); break;
      case 'bark': if (window.HUD) HUD.bark(fx.key, this.sim, live); break;
    }
  }
  part(type, x, y, z, vx, vy, vz, life, extra) {
    if (this.parts.length > (PARAM.low ? 160 : 420)) return null;
    const p = { type, x, y, z, vx, vy, vz, life, max: life, s: this.rr(), rot: this.rr() * 6.28, ...extra };
    this.parts.push(p); return p;
  }
  burst(x, y, r, life) { this.part('burst', x, y, 6, 0, 0, 0, life, { R: r }); }

  // ---------- per-step / per-frame render-side updates ----------
  emit(dt) {
    const r = this.rr, sim = this.sim;
    this.nSmoke = 0; for (const p of this.parts) if (p.type === 'smoke') this.nSmoke++;
    // barracks chimney: a thin evening wisp (life goes on behind the wall)
    { const B = WARD[1], cx = (B.x0 + B.x1) / 2 + 4.7, cy = B.y0 + (B.y1 - B.y0) * 0.35 - 1.5; if (r() < dt * 3) this.part('wisp', cx, cy, B.h + B.roof + 6, r.range(3, 6), r.range(-1, 1), r.range(5, 8), r.range(3, 4.5)); }
    const fire = (x, y, z, rate, w, smoke = 1) => {
      let n = rate * 0.6 * dt; while (n > 0) { if (r() < n) { this.part('flame', x + r.range(-w, w), y + r.range(-w * 0.5, w * 0.5), z, r.range(-1, 4), 0, r.range(6, 12), r.range(0.45, 0.8)); } n -= 1; }
      let m = rate * 0.22 * smoke * dt; while (m > 0) { if (r() < m && this.nSmoke < 70) this.part('smoke', x + r.range(-w, w), y + r.range(-2, 2), z + 8, r.range(5, 12), r.range(-3, 1), r.range(9, 15), r.range(2.8, 4.4)); m -= 1; }
      if (r() < rate * 0.12 * dt) this.part('ember', x, y, z + 6, r.range(-6, 14), r.range(-5, 5), r.range(20, 40), r.range(0.8, 1.6));
    };
    // braziers on the gate towers (always), the burning cart from the last wave
    fire(TOWERS[1].x0 + 9, TOWERS[1].y0 + 8, TOWERS[1].h + 2, 10, 1.5, 0.4);
    if (!sim.gate.broken) fire(TOWERS[2].x0 + 9, TOWERS[2].y0 + 14, TOWERS[2].h + 2, 10, 1.5, 0.4);
    fire(338, 334, 2, 22, 5);
    for (const f of sim.fires) { const k = 1 - f.t / f.life; fire(f.x, f.y, 1, 40 * k, f.r * 0.45 * k + 2); }
    for (const L of sim.ladders) if (L && L.burning) { for (let i = 0; i < 3; i++) { const t = r(); const b = [WX - 14, L.y, 0], tp = [WX + 0.5, L.y, WH + 4]; fire(b[0] + (tp[0] - b[0]) * t, L.y, tp[2] * t, 6, 2); } }
    const ram = sim.ram;
    if (ram && (ram.burning || ram.wreck)) fire(ram.x + r.range(-10, 12), ram.y, ram.wreck ? 4 : 14, ram.wreck ? 18 : 34, 8, 1.4);
    // dust kicked by running feet, trampled snow
    for (const u of sim.units) {
      if (u.st !== ST.ACTIVE || u.z > 0) continue;
      const a = this.A.get(u.id); if (!a) continue;
      if (a.spd > 18 && r() < dt * 1.2) this.part('snowpuff', u.x, u.y, 0.5, -u.fx * 4, 0, 3, 0.5);
    }
  }
  track(dt) {
    // render-side animation bookkeeping from sim fields (cd jumps → attack, distance → walk phase)
    const sim = this.sim;
    for (const u of sim.units) {
      if (u.st === ST.DEAD) continue;
      let a = this.A.get(u.id);
      if (!a) { a = { cd: u.cd, atk: 9, dist: hash2(u.id, 1) * 12, lx: u.x, ly: u.y, ph: hash2(u.id, 2), spd: 0, step: 0, side: 1 }; this.A.set(u.id, a); }
      if (u.cd > a.cd + 0.05) a.atk = 0;
      a.cd = u.cd; a.atk += dt;
      const d = Math.hypot(u.x - a.lx, u.y - a.ly);
      a.spd = a.spd * 0.7 + (d / Math.max(dt, 1e-3)) * 0.3;
      a.dist += d; a.lx = u.x; a.ly = u.y;
      if (u.z === 0 && u.st === ST.ACTIVE) { a.step += d; if (a.step > 4.2) { a.step = 0; a.side = -a.side; this.decalQ.push(this.footFn(u.x, u.y + 0.2, a.side, u.x > WX + WW)); } }
    }
  }
  footFn(x, y, s, inside) { return () => this.stampFoot(x, y, s, inside); }
  stepParts(dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        if (p.type === 'blood' && p.z <= 1) this.decalQ.push(() => inkBlob(this.gctx, p.x, p.y, 0.5 + p.s * 0.6, (p.s * 1e4) | 0, P.blood, 0.75, 0.7));
        ps[i] = ps[ps.length - 1]; ps.pop(); continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      switch (p.type) {
        case 'blood': case 'debris': p.vz -= 140 * dt; if (p.z < 0) { p.z = 0; p.vx *= 0.3; p.vy *= 0.3; p.vz = 0; if (p.type === 'blood') p.life = Math.min(p.life, 0.01); } break;
        case 'oil': p.vz -= 90 * dt; if (p.z < 0) { p.z = 0; p.life = Math.min(p.life, 0.05); } break;
        case 'smoke': case 'wisp': p.vx += 6 * dt; p.vz *= 0.995; break;
        case 'flame': p.vx += 4 * dt; break;
        case 'dust': p.vx *= 0.97; p.vy *= 0.97; p.vz *= 0.95; break;
        case 'ember': p.vx += 8 * dt + Math.sin(p.life * 9 + p.s * 6) * 10 * dt; break;
      }
    }
  }
  flushDecals(cap) {
    const n = Math.min(cap, this.decalQ.length);
    for (let i = 0; i < n; i++) this.decalQ[i]();
    this.decalQ.splice(0, n);
  }
  advanceDying(dt) {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]; d.t += dt;
      if (d.t > 0.42) {
        if (d.onWall) { this.wallCorpses.push(d); if (this.wallCorpses.length > 40) this.wallCorpses.shift(); }
        else this.decalQ.unshift(() => this.stampCorpse(d.x, d.y, d.k, d.v, d.dir, d.pose, 1));
        this.dying.splice(i, 1);
      }
    }
  }
  // advance render-side state without drawing (fast-forward before the first frame)
  ffStep(dt, live) {
    for (const f of this.sim.fx) this.intake(f, live);
    this.sim.fx.length = 0;
    this.track(dt);
    if (live) { this.emit(dt); this.stepParts(dt); }
    this.advanceDying(dt);
    this.flushDecals(400);
    this.time += dt;
  }

  // ---------- frame ----------
  frame(alpha, dt) {
    const sim = this.sim, g = this.g, S = this.S, r = this.rr;
    const PF = window.__prof, mk = PF ? (n) => { const t = performance.now(); PF[PF._l] = (PF[PF._l] || 0) + t - PF._t; PF._l = n; PF._t = t; } : () => {};
    if (PF) { PF._t = performance.now(); PF._l = 'intake'; }
    this.time += dt;
    for (const f of sim.fx) this.intake(f, true);
    sim.fx.length = 0;
    mk('track'); this.track(dt); mk('emit'); this.emit(dt); mk('stepParts'); this.stepParts(dt); mk('dying'); this.advanceDying(dt);
    mk('decals'); this.flushDecals(PARAM.low ? 12 : 40);

    // camera: smooth shake + impulse zoom (render-only)
    this.shake = Math.max(0, this.shake - dt * 14);
    this.impulse = Math.max(0, this.impulse - dt * 6);
    this.flash = Math.max(0, this.flash - dt);
    const sx = this.shake * (Math.sin(this.time * 47) * 0.6 + Math.sin(this.time * 71 + 1) * 0.4);
    const sy = this.shake * (Math.sin(this.time * 53 + 2) * 0.6 + Math.sin(this.time * 83) * 0.4);
    const zi = 1 + 0.035 * Math.sin(Math.min(1, this.impulse) * Math.PI);
    const Sz = S * zi;
    const W = this.cv.width, H = this.cv.height;
    const ox = Math.round(W / 2 - this.cam.x * Sz + sx * DPR), oy = Math.round(H / 2 - this.cam.y * Sz + sy * DPR);
    this.Sz = Sz; this.ox = ox; this.oy = oy;
    const T = (wx, wy) => [wx * Sz + ox, wy * Sz + oy];

    mk('ground');
    // 1. ground (paper, snow, baked shadows, every decal so far)
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    const gp = T(this.R.x, this.R.y);
    if (!PARAM.off.has('ground')) g.drawImage(this.ground, gp[0], gp[1], this.ground.width * zi, this.ground.height * zi);
    g.setTransform(Sz, 0, 0, Sz, ox, oy);

    mk('shadows');
    // 2. ground-level dynamics: unit shadows (one path), selection ring, arrow shadows
    const lerp = (a, b) => a + (b - a) * alpha;
    g.beginPath();
    for (const u of sim.units) {
      if (u.st === ST.DEAD) continue;
      const x = lerp(u.px, u.x), y = lerp(u.py, u.y), z = lerp(u.pz, u.z);
      const base = PR(x, y, u.onWall ? WH : 0);
      // standing figures carry their shadow in the plate; only climbers/fallers cast one down onto the snow
      if (u.st === ST.CLIMB || u.st === ST.FALL) { const b0 = PR(x, y, 0); g.moveTo(b0[0] + 3 + z * 0.6, b0[1]); g.ellipse(b0[0] + 1 + z * 0.5, b0[1] - z * 0.15, 3, 1.1, -0.26, 0, 6.283); }
    }
    g.fillStyle = 'rgba(38,40,58,0.24)'; g.fill();
    this.drawSelection(g);
    g.beginPath();
    for (const p of sim.proj) { const t = Math.min(1, (p.t + alpha * DT) / p.dur); const x = p.x0 + (p.x1 - p.x0) * t, y = p.y0 + (p.y1 - p.y0) * t; g.rect(x - 0.6, y - 0.3, 1.6, 0.6); }
    g.fillStyle = 'rgba(30,26,22,0.22)'; g.fill();

    mk('items');
    // 3. y-sorted world: courtyard group, wall group (rows/towers/gate/wall-top), field group
    const A = [], Wl = [], C = [];
    for (const s of this.structs) (s.kind === 'ward' ? A : Wl).push({ key: s.key, t: 0, s });
    const folk = this.folkNow(sim.t);
    for (const f of folk) A.push({ key: f.y, t: 7, f });
    const gs = sim.gate.broken ? 'broken' : sim.gate.hp / sim.gate.max < 0.66 ? 'splintered' : 'intact';
    Wl.push({ key: GY0 + 0.2, t: 0, s: { spr: this.gates[gs] } });
    for (const u of sim.units) {
      if (u.st === ST.DEAD) continue;
      const x = lerp(u.px, u.x), y = lerp(u.py, u.y);
      const it = { key: y, t: 1, u, x, y, z: lerp(u.pz, u.z) };
      if (u.onWall) Wl.push(it);
      else if (u.st !== ST.CLIMB && u.st !== ST.FALL && x > WX + WW + 1) A.push(it);
      else if (x >= WX - 1 && u.st === ST.ACTIVE) Wl.push(it);
      else C.push(it);
    }
    for (const d of this.dying) { const it = { key: d.y, t: 2, d }; if (d.onWall) Wl.push(it); else if (d.x > WX + WW + 1) A.push(it); else C.push(it); }
    for (const d of this.wallCorpses) Wl.push({ key: d.y - 0.1, t: 3, d });
    sim.ladders.forEach((L, i) => { if (L && (L.alive || L.burning)) C.push({ key: L.y - 0.5, t: 4, L }); else if (L && !this.ladderDecal.has(i)) { this.ladderDecal.add(i); this.decalQ.push(() => this.stampLadder(L.y)); } });
    if (sim.ram) C.push({ key: lerp(sim.ram.py, sim.ram.y), t: 5 });
    for (let i = 0; i < 5; i++) C.push({ key: 118 + i * 44 + 6, t: 6, x: 280 + (i % 2) * 4, y: 118 + i * 44 + 6 });
    this.passageBusy = Wl.some((it) => it.t === 1 && !it.u.onWall && it.y > GY1 - HY * 34 - 4 && it.y < GY1);
    const byKey = (a, b) => a.key - b.key;
    A.sort(byKey); Wl.sort(byKey); C.sort(byKey);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!PARAM.off.has('items')) for (const L of [A, Wl, C]) for (const it of L) { if (PARAM.off.has('units') && it.t === 1) continue; if (PARAM.off.has('structs') && it.t === 0) continue; this.drawItem(g, it); }

    mk('proj');
    // 4. projectiles (one stroke for shafts, one fill for fletching), fire arrows glow later
    g.setTransform(Sz, 0, 0, Sz, ox, oy);
    g.beginPath();
    const fletch = [], fires = [];
    for (const p of sim.proj) {
      const t = Math.min(1, (p.t + alpha * DT) / p.dur), t2 = Math.min(1, t + 0.03);
      const pos = (tt) => { const x = p.x0 + (p.x1 - p.x0) * tt, y = p.y0 + (p.y1 - p.y0) * tt, z = p.z0 + (p.z1 - p.z0) * tt + p.h * 4 * tt * (1 - tt); return PR(x, y, z); };
      const a = pos(t), b = pos(t2); let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      g.moveTo(a[0] - dx * 4.2, a[1] - dy * 4.2); g.lineTo(a[0] + dx * 1.2, a[1] + dy * 1.2);
      fletch.push(a[0] - dx * 4.0, a[1] - dy * 4.0);
      if (p.kind === 'fire') fires.push(a[0] + dx, a[1] + dy);
    }
    g.strokeStyle = P.ink; g.lineWidth = 0.55; g.lineCap = 'round'; g.stroke();
    g.fillStyle = P.paperHi; for (let i = 0; i < fletch.length; i += 2) g.fillRect(fletch[i] - 0.55, fletch[i + 1] - 0.55, 1.1, 1.1);

    mk('partsPre');
    // 5. smoke, dust, oil (ink wash: before the light, so dusk tints it)
    if (!PARAM.off.has('pre')) this.drawParts(g, 'pre');

    mk('overlay');
    // 6. dusk light (single multiply pass; high tier only)
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!PARAM.low && !PARAM.off.has('overlay')) { g.globalCompositeOperation = 'multiply'; g.drawImage(this.overlay, 0, 0); g.globalCompositeOperation = 'source-over'; }

    mk('glows');
    // 7. light sources after the tint: glows (additive), flames, embers, fire arrows
    g.globalCompositeOperation = 'lighter';
    const glowAt = (wx, wy, wz, rad, a) => { const p = PR(wx, wy, wz), s = T(p[0], p[1]); const R = rad * Sz; g.globalAlpha = a; g.drawImage(this.glow, s[0] - R, s[1] - R, R * 2, R * 2); };
    const fl = 0.85 + 0.15 * Math.sin(this.time * 13) * Math.sin(this.time * 7.3 + 1);
    glowAt(TOWERS[1].x0 + 9, TOWERS[1].y0 + 8, TOWERS[1].h + 4, 26, 0.32 * fl);
    if (!sim.gate.broken) glowAt(TOWERS[2].x0 + 9, TOWERS[2].y0 + 14, TOWERS[2].h + 4, 26, 0.32 * fl);
    glowAt(338, 334, 6, 34, 0.38 * fl);
    for (const B of WARD) { if (B.win) for (const wx of B.win) glowAt(wx + 2, B.y1 + 1, B.h * 0.38 + 2.5, 9, 0.3 * fl); if (B.loft) glowAt((B.x0 + B.x1) / 2, B.y1 + 1, B.h + B.roof * 0.42, 6, 0.25 * fl); }
    { const K = WARD.find((b) => b.kind === 'keep'), yc = (K.y0 + K.y1) / 2; glowAt(K.x0, yc, 8, 16, 0.3 * fl); glowAt(K.x0, K.y0 + 50, 37, 8, 0.25); glowAt(K.x0, K.y1 - 52, 33, 8, 0.25); }
    for (const f of sim.fires) glowAt(f.x, f.y, 4, 44 * (1 - f.t / f.life * 0.6), 0.5 * fl);
    for (const L of sim.ladders) if (L && L.burning) glowAt(WX - 8, L.y, 14, 34, 0.42 * fl);
    if (sim.ram && (sim.ram.burning || sim.ram.wreck)) glowAt(sim.ram.x, sim.ram.y, 10, sim.ram.wreck ? 40 : 56, 0.5 * fl);
    g.globalAlpha = 1;
    g.setTransform(Sz, 0, 0, Sz, ox, oy);
    for (let i = 0; i < fires.length; i += 2) { g.globalAlpha = 0.9; g.drawImage(this.glow, fires[i] - 3, fires[i + 1] - 3, 6, 6); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (!PARAM.off.has('post')) this.drawParts(g, 'post');

    mk('banners');
    // 8. world UI: banners (cached sprites), after the light so they stay readable at dusk
    this.drawBanners(g, alpha);

    mk('snow');
    // 9. weather: snow in screen space (two depth layers, one fill each)
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!PARAM.off.has('snow')) this.drawSnow(g, dt);
    if (this.flash > 0) { g.globalAlpha = this.flash; g.fillStyle = P.paperHi; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    mk('end');
  }

  // Townsfolk (render-only, a pure function of sim time, so ?t= screenshots are exact):
  // water to the infirmary, arrows to the north stair, the wounded carried back from the gate.
  folkNow(t) {
    if (this._folkT === t) return this._folk;
    const out = [];
    const along = (path, d) => { for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= L) return [a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L, Math.sign(b[0] - a[0]) || 1]; d -= L; } const z = path[path.length - 1]; return [z[0], z[1], 1]; };
    for (const F of FOLK) {
      const L = F.path.reduce((acc, p, i) => i ? acc + Math.hypot(p[0] - F.path[i - 1][0], p[1] - F.path[i - 1][1]) : 0, 0);
      const T = 2 * L + 2 * F.wait * F.sp; let d = ((t + F.ph) * F.sp) % T;
      let back = false, idle = false;
      if (d < L) {} else if (d < L + F.wait * F.sp) { d = L; idle = true; } else if (d < 2 * L + F.wait * F.sp) { d = 2 * L + F.wait * F.sp - d; back = true; } else { d = 0; idle = true; }
      for (let m = 0; m < (F.pair ? 2 : 1); m++) {
        const dd = Math.max(0, Math.min(L, d - (m ? 9 : 0) * (back ? -1 : 1)));
        const [x, y, sx] = along(F.path, dd);
        const dir = back ? -sx : sx;
        out.push({ x, y, dir, f: idle ? 0 : Math.floor((t * F.sp + m * 7) / 3.2) % 4, idle, v: (F.v + m) % 2, pair: F.pair, m, back, F });
      }
    }
    this._folkT = t; this._folk = out;
    return out;
  }
  blit(g, f, wx, wy, a = 1) {
    const Sz = this.Sz, k = Sz / this.S;
    const x = Math.round(wx * Sz + this.ox - f.ax * k), y = Math.round(wy * Sz + this.oy - f.ay * k);
    if (a !== 1) g.globalAlpha = a;
    if (k === 1) g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, x, y, f.sw, f.sh);
    else g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, x, y, f.sw * k, f.sh * k);
    if (a !== 1) g.globalAlpha = 1;
  }
  drawItem(g, it) {
    const Sz = this.Sz, ox = this.ox, oy = this.oy;
    const blit = this._blit || (this._blit = (f, wx, wy, a) => this.blit(this.g, f, wx, wy, a));
    switch (it.t) {
      case 7: {
        const f = it.f, fr = f.idle ? unitFrame(KIDX.d_folk, f.v, 'idle', 0, f.dir) : unitFrame(KIDX.d_folk, f.v, 'walk', f.f, f.dir);
        if (f.pair && f.m === 0) { // the stretcher between the two bearers (a wounded spearman on it when outbound)
          const o = this._folk.find((q) => q.F === f.F && q.m === 1);
          if (o) { g.setTransform(Sz, 0, 0, Sz, ox, oy); const a = PR(f.x, f.y, 4.6), b = PR(o.x, o.y, 4.6); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = P.woodLo; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = P.paperLo; g.lineWidth = 1.8; g.stroke();
            if (!f.back) { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; g.fillStyle = P.indigo; g.beginPath(); g.ellipse(m[0], m[1] - 1, 2.6, 1.1, Math.atan2(b[1] - a[1], b[0] - a[0]), 0, 7); g.fill(); g.fillStyle = P.skin; g.beginPath(); g.arc(m[0] + (b[0] - a[0]) * 0.32, m[1] - 1 + (b[1] - a[1]) * 0.32, 0.9, 0, 7); g.fill(); g.fillStyle = P.blood; g.fillRect(m[0] - 0.5, m[1] - 1.6, 1.2, 0.8); }
            g.setTransform(1, 0, 0, 1, 0, 0); }
        }
        blit(fr, f.x, f.y);
        break;
      }
      case 0: { const s = it.s.cut && this.sim.gate.broken ? it.s.cut : it.s.spr;
        g.drawImage(s.img, Math.round(s.x * Sz + ox), Math.round(s.y * Sz + oy), s.img.width * Sz / this.S, s.img.height * Sz / this.S); break; }
      case 1: {
        const u = it.u, a = this.A.get(u.id); if (!a) return;
        let anim = 'idle', f = 0;
        const hasT = u.tgt && (u.tgt.st === ST.ACTIVE || u.tgt.st === ST.CLIMB);
        const bow = KINDS[u.k].wpn === 'bow';
        if (u.st === ST.CLIMB) { anim = 'climb'; f = Math.floor(this.time * 3.2 + a.ph * 2) % 2; }
        else if (u.st === ST.FALL) { anim = 'hit'; }
        else if (u.hitT > 0.04) anim = 'hit';
        else if (bow && a.atk < 0.5) { anim = 'attack'; f = a.atk < 0.14 ? 2 : 0; }
        else if (bow && hasT && u.cd < 0.45 && u.cd > 0) { anim = 'attack'; f = 1; }
        else if (!bow && a.atk < 0.3) { anim = 'attack'; f = a.atk < 0.13 ? 1 : 2; }
        else if (!bow && hasT && u.cd < 0.16 && a.spd < 6) { anim = 'attack'; f = 0; }
        else if (a.spd > 3.5) { anim = 'walk'; f = Math.floor(a.dist / 3.0) % 4; }
        else f = Math.floor(this.time * 1.25 + a.ph * 2) % 2;
        const dir = u.fx >= 0 ? 1 : -1;
        const fr = unitFrame(u.k, u.v, anim, f, dir);
        const p = PR(it.x, it.y, it.z);
        blit(fr, p[0], p[1] + (u.st === ST.CLIMB ? 0 : 0));
        break;
      }
      case 2: { const d = it.d; const fr = d.t < 0.18 ? unitFrame(d.k, d.v, 'die', 0, d.dir) : d.t < 0.34 ? unitFrame(d.k, d.v, 'die', 1, d.dir) : corpseFrame(d.k, d.v, d.pose, d.dir); const p = PR(d.x, d.y, d.onWall ? WH : 0); blit(fr, p[0], p[1]); break; }
      case 3: { const d = it.d; const fr = corpseFrame(d.k, d.v, d.pose, d.dir); const p = PR(d.x, d.y, WH); blit(fr, p[0], p[1], 0.92); break; }
      case 4: this.drawLadder(g, it.L); break;
      case 5: {
        const ram = this.sim.ram; const x = ram.px + (ram.x - ram.px) * 0.5, y = ram.y;
        const sh = ram.wreck ? this.big.wreck : this.big.shed;
        const px = Math.round(x * Sz + ox), py = Math.round(y * Sz + oy), k = Sz / this.S;
        // shadow
        g.save(); g.setTransform(Sz, 0, 0, Sz, ox, oy); g.fillStyle = 'rgba(38,40,58,0.26)'; g.beginPath(); g.ellipse(x + 12, y - 2, 26, 6, -0.25, 0, 7); g.fill(); g.restore();
        if (!ram.wreck) {
          const ph = ram.phase, dx = ph < 0.8 ? -6 * (ph / 0.8) : -6 + 11 * ((ph - 0.8) / 0.2);
          g.drawImage(this.big.log.img, px - this.big.log.ax * k + dx * Sz, py - this.big.log.ay * k, this.big.log.img.width * k, this.big.log.img.height * k);
        }
        g.drawImage(sh.img, px - sh.ax * k, py - sh.ay * k, sh.img.width * k, sh.img.height * k);
        break;
      }
      case 6: { const b = this.big.pavise, k = Sz / this.S; g.drawImage(b.img, Math.round(it.x * Sz + ox - b.ax * k), Math.round(it.y * Sz + oy - b.ay * k), b.img.width * k, b.img.height * k); break; }
    }
  }
  drawLadder(g, L) {
    const Sz = this.Sz;
    g.save(); g.setTransform(Sz, 0, 0, Sz, this.ox, this.oy);
    const bx = WX - 14, len = Math.hypot(14.5, WH + 4), full = Math.atan2(WH + 4, 14.5);
    const th = Math.PI + (full - Math.PI) * (L.raiseT * L.raiseT * (3 - 2 * L.raiseT));
    const top = (dy) => PR(bx + Math.cos(th) * len, L.y + dy, Math.sin(th) * len), base = (dy) => PR(bx, L.y + dy, 0);
    const col = L.burning ? P.ink2 : P.ink;
    g.lineCap = 'round';
    for (const dy of [-2.6, 2.6]) { const a = base(dy), b = top(dy); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.lineWidth = 1.1; g.stroke(); g.beginPath(); g.moveTo(a[0] + 0.3, a[1] + 0.2); g.lineTo(b[0] + 0.3, b[1] + 0.2); g.strokeStyle = L.burning ? P.fire2 : P.woodHi; g.lineWidth = 0.4; g.stroke(); }
    g.beginPath();
    for (let t = 0.08; t < 1; t += 0.11) { const a = [base(-2.6), top(-2.6)], b = [base(2.6), top(2.6)]; g.moveTo(a[0][0] + (a[1][0] - a[0][0]) * t, a[0][1] + (a[1][1] - a[0][1]) * t); g.lineTo(b[0][0] + (b[1][0] - b[0][0]) * t, b[0][1] + (b[1][1] - b[0][1]) * t); }
    g.strokeStyle = col; g.lineWidth = 0.55; g.stroke();
    g.restore();
  }
  stampLadder(y) {
    const g = this.gctx;
    for (const dy of [-2.2, 2.2]) { g.beginPath(); g.moveTo(WX - 14, y + dy); g.lineTo(WX - 44, y + dy * 1.3 + 3); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke(); }
    for (let t = 0.1; t < 1; t += 0.14) { const x = WX - 14 - 30 * t; g.beginPath(); g.moveTo(x, y - 2.2 + 3 * t); g.lineTo(x - 0.5, y + 2.2 + 3 * t); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke(); }
    this.stampScorch(WX - 26, y + 2, 12, 99);
  }
  drawSelection(g) {
    const sq = this.sim.squads.find((s) => s.sel); if (!sq) return;
    const alive = sq.units.filter((u) => u.st === ST.ACTIVE); if (!alive.length) return;
    let cx = 0, cy = 0; for (const u of alive) { cx += u.x; cy += u.y; } cx /= alive.length; cy /= alive.length;
    // a brush ring, open at the top-right like a hand-drawn circle; indigo wash + gold tick
    const R = 16 + Math.sqrt(alive.length) * 2.2;
    const pts = []; for (let i = 0; i <= 28; i++) { const a = -0.9 + (i / 28) * 5.75; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.62]); }
    brush(g, pts, (u) => 0.4 + 1.8 * Math.sin(Math.PI * Math.min(1, u * 1.05)), P.indigo, 0.55);
    g.beginPath(); g.moveTo(cx + Math.cos(-0.95) * R, cy + Math.sin(-0.95) * R * 0.62); g.lineTo(cx + Math.cos(-0.95) * R + 2.4, cy + Math.sin(-0.95) * R * 0.62 - 2.6); g.strokeStyle = P.gold; g.lineWidth = 1.1; g.stroke();
  }
  drawParts(g, phase) {
    const Sz = this.Sz, ox = this.ox, oy = this.oy;
    g.setTransform(Sz, 0, 0, Sz, ox, oy);
    for (const p of this.parts) {
      const pre = p.type === 'smoke' || p.type === 'wisp' || p.type === 'dust' || p.type === 'snowpuff' || p.type === 'oil' || p.type === 'debris' || p.type === 'blood';
      if (pre !== (phase === 'pre')) continue;
      const k = p.life / p.max, s = PR(p.x, p.y, p.z);
      switch (p.type) {
        case 'smoke': {
          const age = 1 - k, R = 6 + age * 30 + p.s * 8, spr = this.smokeSpr[(p.s * 5) | 0];
          g.globalAlpha = Math.min(1, age * 4) * Math.min(1, k * 1.6); g.drawImage(spr, s[0] - R, s[1] - R * 0.8, R * 2, R * 1.6); break;
        }
        case 'wisp': { const age = 1 - k, R = 1.5 + age * 9, spr = this.smokeSpr[(p.s * 5) | 0]; g.globalAlpha = Math.min(1, age * 5) * k * 0.9; g.drawImage(spr, s[0] - R, s[1] - R * 0.7, R * 2, R * 1.4); break; }
        case 'dust': { const age = 1 - k, R = 4 + age * 16, spr = this.smokeSpr[(p.s * 5) | 0]; g.globalAlpha = k * 0.55; g.drawImage(this.dustSpr, s[0] - R, s[1] - R * 0.75, R * 2, R * 1.5); break; }
        case 'snowpuff': { const age = 1 - k, R = 1.5 + age * 4.5; g.globalAlpha = k * 0.7; g.fillStyle = P.paperHi; g.beginPath(); g.arc(s[0], s[1] - 1, R, 0, 7); g.fill(); g.globalAlpha = k * 0.4; g.strokeStyle = P.wash2; g.lineWidth = 0.35; g.stroke(); break; }
        case 'oil': { g.globalAlpha = 0.9; g.fillStyle = '#4A2E12'; g.beginPath(); g.ellipse(s[0], s[1], 0.9, 1.6, 0.3, 0, 7); g.fill(); g.globalAlpha = 0.6; g.fillStyle = P.goldHi; g.fillRect(s[0] - 0.3, s[1] - 1.1, 0.4, 0.7); break; }
        case 'debris': { g.globalAlpha = 1; g.save(); g.translate(s[0], s[1]); g.rotate(p.rot + p.life * 9); g.fillStyle = P.woodLo; g.fillRect(-1.4, -0.4, 2.8, 0.8); g.restore(); break; }
        case 'blood': { g.globalAlpha = 0.95; g.fillStyle = P.blood; g.beginPath(); g.arc(s[0], s[1], 0.45 + p.s * 0.35, 0, 7); g.fill(); break; }
        case 'flame': {
          const age = 1 - k, grow = Math.sin(Math.PI * Math.min(1, age * 1.15 + 0.1));
          const h = (4 + 8.5 * p.s) * grow, w = (0.75 + 0.95 * p.s) * (1 - age * 0.4);
          const lean = 1.2 + age * 2.2 + Math.sin(this.time * 9 + p.s * 31) * 1.1;
          const tongue = (sc) => { const hh = h * sc, ww = w * sc; g.beginPath(); g.moveTo(s[0] - ww, s[1]); g.bezierCurveTo(s[0] - ww * 1.25, s[1] - hh * 0.4, s[0] + lean * 0.2 - ww * 0.5, s[1] - hh * 0.7, s[0] + lean, s[1] - hh); g.bezierCurveTo(s[0] + lean * 0.35 + ww * 0.25, s[1] - hh * 0.55, s[0] + ww * 1.2, s[1] - hh * 0.3, s[0] + ww, s[1]); g.closePath(); };
          const fa = Math.min(1, k * 3);
          tongue(1); g.globalAlpha = 0.95 * fa; g.fillStyle = age < 0.55 ? P.fire1 : P.fire2; g.fill();
          g.globalAlpha = 0.5 * fa; g.strokeStyle = P.ink; g.lineWidth = 0.28; g.stroke();
          if (age < 0.6) { tongue(0.5); g.globalAlpha = fa; g.fillStyle = P.fireCore; g.fill(); }
          break;
        }
        case 'ember': { g.globalAlpha = Math.min(1, k * 2); g.fillStyle = P.goldHi; g.fillRect(s[0] - 0.35, s[1] - 0.35, 0.7, 0.7); break; }
        case 'spark': { g.globalAlpha = k / p.max; g.strokeStyle = P.goldHi; g.lineWidth = 0.4; g.beginPath(); for (let i = 0; i < 3; i++) { const a = p.rot + i * 2.1; g.moveTo(s[0], s[1]); g.lineTo(s[0] + Math.cos(a) * 2.2, s[1] + Math.sin(a) * 2.2); } g.stroke(); break; }
        case 'slash': {
          // a calligraphic crescent: one confident brush cut across the target, ink (red when lethal)
          const age = 1 - k, dir = p.vx >= 0 ? 1 : -1, R = 4.6;
          const a0 = dir > 0 ? -2.4 : -0.7, a1 = dir > 0 ? 0.5 : 2.6 + 0.0;
          const pts = []; const n = 10, span = Math.min(1, age * 3.5);
          for (let i = 0; i <= n; i++) { const t = (i / n) * span; const a = a0 + (a1 - a0) * t * (dir > 0 ? 1 : 1); pts.push([s[0] + Math.cos(a) * R * dir, s[1] - 2 + Math.sin(a) * R * 0.75]); }
          g.globalAlpha = Math.min(1, k * 2.4);
          brush(g, pts, (u) => 1.6 * Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), p.vy ? P.cinnabar : P.ink, 1);
          break;
        }
        case 'burst': {
          // ink burst: radial brush strokes and a ring, the big hits only
          const age = 1 - k, R = p.R * (0.4 + age * 0.9);
          g.globalAlpha = k * 0.85;
          for (let i = 0; i < 11; i++) { const a = (i / 11) * 6.283 + p.rot; const r0 = R * 0.35, r1 = R * (0.75 + 0.4 * hash2(i, (p.rot * 100) | 0)); brush(g, [[s[0] + Math.cos(a) * r0, s[1] + Math.sin(a) * r0 * 0.6], [s[0] + Math.cos(a) * r1, s[1] + Math.sin(a) * r1 * 0.6]], taper(1.4, 0.1), P.ink, 1); }
          g.lineWidth = 0.8; g.strokeStyle = P.ink; g.beginPath(); g.ellipse(s[0], s[1], R, R * 0.6, 0, 0, 7); g.stroke();
          break;
        }
      }
    }
    g.globalAlpha = 1;
  }
  drawBanners(g, alpha) {
    const sim = this.sim, Sz = this.Sz, k = Sz / this.S;
    const f = Math.floor(this.time * 2.4) % 3;
    const put = (b, wx, wy) => g.drawImage(b.img, Math.round(wx * Sz + this.ox - b.ax * k), Math.round(wy * Sz + this.oy - b.ay * k), b.img.width * k, b.img.height * k);
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const s of sim.squads) {
      const alive = s.units.filter((u) => u.st === ST.ACTIVE); if (!alive.length) continue;
      let cx = 0, cy = 0; for (const u of alive) { cx += u.x; cy += u.y; } cx /= alive.length; cy /= alive.length;
      const sag = s.morale < 40 ? (40 - s.morale) / 12 : 0;
      const p = s.type === 'wall' ? PR(cx + 4, cy, WH) : PR(cx + 3, cy - 4, 0);
      put(this.bannerFrame(s.emblem, (f + s.name.length) % 3, sag), p[0], p[1]);
    }
    // enemy standards: the Concord sun near the longbows and each ladder party, the horde's totem by the gate
    put(this.bannerFrame('sun', f, 0), 268, 214);
    put(this.bannerFrame('sun', (f + 1) % 3, 0), WX - 48, 108);
    const ram = sim.ram; put(this.bannerFrame('hand', (f + 2) % 3, 0, true), (ram ? ram.x : WX - 60) - 40, GYC - 22);
  }
  drawSnow(g, dt) {
    const W = this.vw, H = this.vh;
    g.save(); g.scale(DPR, DPR);
    const wind = 18;
    for (const pass of [0, 1]) {
      g.beginPath();
      for (const f of this.flakes) {
        if ((f.s > 1.6) !== (pass === 1)) continue;
        f.y += f.v * dt; f.x += (wind + Math.sin(this.time * 0.9 + f.ph) * 8) * dt * (0.5 + f.s * 0.3);
        if (f.y > H + 4) { f.y = -4; f.x = this.rr() * W; } if (f.x > W + 4) f.x = -4;
        g.moveTo(f.x + f.s, f.y); g.arc(f.x, f.y, f.s, 0, 6.283);
      }
      g.fillStyle = pass ? 'rgba(250,247,240,0.92)' : 'rgba(246,242,234,0.7)'; g.fill();
      if (pass) { g.strokeStyle = 'rgba(120,118,125,0.35)'; g.lineWidth = 0.4; g.stroke(); }
    }
    g.restore();
  }
}
