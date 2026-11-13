// ============================================================================
// world: ground bake (+ persistent decals), architecture strips, props
// Everything is drawn in "projected world" space: (x, sy) where sy = y*KY - z.
// ============================================================================
const STONE = { face: '#a39b8e', faceD: '#8a8277', top: '#b7afa1', mortar: '#6f685e', deep: '#4f4943', moss: '#5e6b38', repair: '#b9ae93' };
function layer(x0, sy0, x1, sy1) {
  const dx = Math.floor((x0 - CAM.x) * CAM.PX), dy = Math.floor((sy0 - CAM.sy) * CAM.PX);
  const w = Math.ceil((x1 - x0) * CAM.PX) + 2, h = Math.ceil((sy1 - sy0) * CAM.PX) + 2;
  const c = mkCanvas(w, h), g = c.getContext('2d');
  g.setTransform(CAM.PX, 0, 0, CAM.PX, -CAM.x * CAM.PX - dx, -CAM.sy * CAM.PX - dy);
  return { c, g, dx, dy };
}
function blit(ctx, L) { ctx.drawImage(L.c, L.dx + CAM.shakeX, L.dy + CAM.shakeY); }

// ---------- road / regions ----------
function roadX(y) { return GATE_X + 14 * Math.sin((y - 240) / 85) - (y - 240) * 0.1; }
function roadHalf(y) { return lerp(54, 15 + 4 * Math.sin(y * 0.05), smooth(BAR_Y + 6, BAR_Y + 64, y)); }

// ---------- stone courses ----------
function stoneCourses(g, x0, y0, x1, y1, rng, base, opt = {}) {
  const ch = opt.ch || 4.3;
  g.fillStyle = opt.mortar || STONE.mortar; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const bc = hex(base);
  let row = 0;
  for (let y = y1; y > y0 - 0.01; y -= ch, row++) {
    const yt = Math.max(y0, y - ch);
    let x = x0 - (row % 2 ? rng() * 6 : rng() * 3);
    while (x < x1) {
      const w = (opt.minW || 5.5) + rng() * (opt.varW || 7);
      const xa = Math.max(x0, x + 0.35), xb = Math.min(x1, x + w - 0.35);
      if (xb > xa) {
        const k = (rng() - 0.5) * 0.16 + (opt.tone ? opt.tone(xa, yt) : 0);
        const warm = (rng() - 0.5) * 10;
        const c = [bc[0] * (1 + k) + warm, bc[1] * (1 + k), bc[2] * (1 + k) - warm * 0.6];
        g.fillStyle = rgb(c[0], c[1], c[2]);
        g.fillRect(xa, yt + 0.35, xb - xa, y - yt - 0.6);
        g.fillStyle = 'rgba(255,244,222,0.22)'; g.fillRect(xa, yt + 0.35, xb - xa, 0.5);
        g.fillStyle = 'rgba(30,20,20,0.18)'; g.fillRect(xa, y - 0.85, xb - xa, 0.5);
        if (rng() < 0.08) { g.fillStyle = 'rgba(40,30,25,0.35)'; g.beginPath(); g.moveTo(xb, yt + 0.4); g.lineTo(xb - 1.6, yt + 0.4); g.lineTo(xb, yt + 2); g.fill(); }
      }
      x += w;
    }
  }
}
function weather(g, x0, y0, x1, y1, rng, opt = {}) {
  // grime at the foot, streaks under gaps, sun-washed top
  let gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, 'rgba(255,240,210,0.10)'); gr.addColorStop(0.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(45,40,24,0.38)');
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let k = 0; k < (x1 - x0) / 9; k++) {
    const x = x0 + rng() * (x1 - x0), len = (y1 - y0) * (0.2 + rng() * 0.5);
    g.fillStyle = `rgba(40,34,28,${0.05 + rng() * 0.08})`; g.fillRect(x, y0 + rng() * 3, 0.6 + rng() * 1.2, len);
  }
  if (opt.moss) for (let k = 0; k < (x1 - x0) / 14; k++) {
    const x = x0 + rng() * (x1 - x0), y = y1 - rng() * 6;
    g.fillStyle = rng() < 0.5 ? 'rgba(86,104,52,0.55)' : 'rgba(110,122,62,0.45)';
    g.beginPath(); g.ellipse(x, y, 1.5 + rng() * 3, 0.8 + rng() * 1.3, 0, 0, 6.28); g.fill();
  }
}
function arrowSlit(g, x, y, h) {
  g.fillStyle = 'rgba(255,240,215,0.25)'; g.fillRect(x - 1.2, y - 0.6, 2.4, h + 1.2);
  g.fillStyle = '#231a14'; g.fillRect(x - 0.55, y, 1.1, h); g.fillRect(x - 1.8, y + h * 0.42, 3.6, 0.9);
  g.fillStyle = 'rgba(30,22,16,0.25)'; g.fillRect(x - 0.4, y + h, 0.8, 4);
}

// ---------- the curtain wall: body (face + plinth + walk), then parapet strip ----------
function buildWall() {
  const rng = RNG(901);
  const top = WY0 * KY - WZ - 14, bot = (WY1 + 6) * KY;
  const body = layer(-4, top, WW + 4, bot + 2), g = body.g;
  const fT = WY1 * KY - WZ, fB = WY1 * KY;
  // walk top (flagstones, lighter: faces the sky)
  const wT = WY0 * KY - WZ;
  g.fillStyle = '#6f675c'; g.fillRect(-4, wT, WW + 8, fT - wT);
  for (let y = wT; y < fT; y += 3.3) for (let x = -4 + (rng() * 5); x < WW + 4; x += 5 + rng() * 6) {
    const c = hex('#8f877a'), k = (rng() - 0.5) * 0.12;
    g.fillStyle = rgb(c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)); g.fillRect(x + 0.3, y + 0.3, 4.6 + rng() * 4, 2.7);
  }
  g.fillStyle = 'rgba(40,30,22,0.35)'; g.fillRect(-4, wT, WW + 8, 1.0); // inner edge
  { const sg = g.createLinearGradient(0, fT - 19, 0, fT); sg.addColorStop(0, 'rgba(24,18,14,0)'); sg.addColorStop(0.3, 'rgba(24,18,14,0.42)'); sg.addColorStop(1, 'rgba(24,18,14,0.55)'); g.fillStyle = sg; g.fillRect(-4, fT - 19, WW + 8, 19); } // the parapet shades the walk, so the crenels read dark
  // wooden rail along the inner edge
  g.strokeStyle = '#5c3b23'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-4, wT - 2.4); g.lineTo(WW + 4, wT - 2.4); g.stroke();
  for (let x = 4; x < WW; x += 22) { g.fillStyle = '#4e331f'; g.fillRect(x, wT - 2.6, 0.9, 3.2); }
  // front face
  stoneCourses(g, -4, fT, WW + 4, fB - 6, rng, STONE.face, { tone: (x, y) => 0.05 * Math.sin(x * 0.03) });
  // repair patch: newer, yellower stone where a breach was mended (the castle remembers)
  stoneCourses(g, 180, fT + 8, 236, fB - 9, RNG(77), STONE.repair, { ch: 3.8, minW: 4, varW: 4 });
  g.strokeStyle = 'rgba(60,45,30,0.5)'; g.lineWidth = 0.5; g.strokeRect(180, fT + 8, 56, fB - 9 - fT - 8);
  // plinth (battered base: lit slope)
  const pT = fB - 6, pB = (WY1 + 5) * KY;
  stoneCourses(g, -4, pT, WW + 4, pB, rng, '#aea596', { ch: 3.0, minW: 8, varW: 8 });
  g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(-4, pT, WW + 8, 0.7);
  weather(g, -4, fT, WW + 4, pB, rng, { moss: true });
  for (let x = 30; x < WW; x += 64) if (!(x > TWL.x0 - 6 && x < TWR.x1 + 6) && Math.abs(x - 650) > 30) arrowSlit(g, x, fT + 9, 13);
  // the wall has an age: lighter and darker builds, putlog holes, ivy where the creek mist reaches
  for (const [a, b, k] of [[-4, 96, -0.06], [96, 180, 0.03], [560, 640, -0.05], [640, 760, 0.05]]) { g.fillStyle = k > 0 ? `rgba(255,244,222,${k})` : `rgba(40,30,24,${-k})`; g.fillRect(a, fT, b - a, fB - fT); }
  for (let x = 12; x < WW; x += 11 + rng() * 6) if (!(x > TWL.x0 - 4 && x < TWR.x1 + 4)) { g.fillStyle = 'rgba(28,20,16,0.55)'; g.fillRect(x, fT + 4.5, 1.3, 1.1); g.fillStyle = 'rgba(28,20,16,0.12)'; g.fillRect(x + 0.2, fT + 5.6, 0.9, 3); }
  for (const ix of [118, 268, 610, 742, 862]) {
    const n = 70 + ((ix * 7) % 40);
    for (let k = 0; k < n; k++) {
      const h = rng() * (fB - fT) * (0.4 + 0.6 * rng()), x = ix + (rng() - 0.5) * (14 + h * 0.5), y = fB - h;
      g.fillStyle = rng() < 0.5 ? '#4c5e2c' : rng() < 0.5 ? '#61753a' : '#3a4a24'; g.beginPath(); g.ellipse(x, y, 1.1 + rng() * 0.8, 0.8 + rng() * 0.5, rng() * 3, 0, 6.28); g.fill();
    }
    g.strokeStyle = 'rgba(58,42,28,0.5)'; g.lineWidth = 0.35; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(ix + (rng() - 0.5) * 6, fB); g.quadraticCurveTo(ix + (rng() - 0.5) * 16, fB - 10, ix + (rng() - 0.5) * 20, fB - 18 - rng() * 8); g.stroke(); }
  }
  // gatehouse face (slightly forward of the curtain)
  const gT = GH_F * KY - GHZ, gB = GH_F * KY;
  stoneCourses(g, TWL.x1, gT, TWR.x0, gB, RNG(33), '#a69e90');
  weather(g, TWL.x1, gT, TWR.x0, gB, rng, { moss: true });
  // soot climbing the gatehouse from earlier fires
  let sg = g.createRadialGradient(GATE_X, gB - 6, 2, GATE_X, gB - 18, 34);
  sg.addColorStop(0, 'rgba(25,18,14,0.55)'); sg.addColorStop(1, 'rgba(25,18,14,0)'); g.fillStyle = sg; g.fillRect(TWL.x1, gT, TWR.x0 - TWL.x1, gB - gT);
  // arch
  const aw = 17, ah = 19;
  g.save(); g.beginPath(); g.moveTo(GATE_X - aw, gB); g.lineTo(GATE_X - aw, gB - ah); g.arc(GATE_X, gB - ah, aw, Math.PI, 0); g.lineTo(GATE_X + aw, gB); g.closePath(); g.clip();
  let ag = g.createLinearGradient(0, gB - ah - aw, 0, gB); ag.addColorStop(0, '#120d0a'); ag.addColorStop(1, '#2b2018'); g.fillStyle = ag; g.fillRect(GATE_X - aw, gB - ah - aw, aw * 2, ah + aw);
  // jammed portcullis (half down) and the broken left leaf
  g.strokeStyle = '#3b3530'; g.lineWidth = 0.9;
  for (let x = GATE_X - aw + 2; x < GATE_X + aw; x += 3.4) { g.beginPath(); g.moveTo(x, gB - ah - aw); g.lineTo(x, gB - 15); g.stroke(); g.beginPath(); g.moveTo(x - 0.6, gB - 15); g.lineTo(x, gB - 13.2); g.lineTo(x + 0.6, gB - 15); g.fillStyle = '#56504a'; g.fill(); }
  for (let y = gB - ah - aw + 4; y < gB - 15; y += 4) { g.beginPath(); g.moveTo(GATE_X - aw, y); g.lineTo(GATE_X + aw, y); g.stroke(); }
  g.fillStyle = '#5a3b22'; g.beginPath(); g.moveTo(GATE_X - aw, gB - 13); g.lineTo(GATE_X - 4, gB - 9); g.lineTo(GATE_X - 2, gB); g.lineTo(GATE_X - aw, gB); g.closePath(); g.fill();
  g.strokeStyle = '#3a2616'; g.lineWidth = 0.4; for (let x = GATE_X - aw + 3; x < GATE_X - 2; x += 3) { g.beginPath(); g.moveTo(x, gB - 12 + (x - GATE_X + aw) * 0.2); g.lineTo(x + 0.6, gB); g.stroke(); }
  g.fillStyle = '#2e2e30'; g.fillRect(GATE_X - aw, gB - 8, 13, 1);
  g.restore();
  // voussoirs around the arch
  g.strokeStyle = '#b8b0a2'; g.lineWidth = 2.2; g.beginPath(); g.arc(GATE_X, gB - ah, aw + 1.2, Math.PI, 0); g.stroke();
  g.strokeStyle = STONE.mortar; g.lineWidth = 0.35; for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += Math.PI / 9) { g.beginPath(); g.moveTo(GATE_X + Math.cos(a) * aw, gB - ah + Math.sin(a) * aw); g.lineTo(GATE_X + Math.cos(a) * (aw + 2.3), gB - ah + Math.sin(a) * (aw + 2.3)); g.stroke(); }
  // carved panel with the March's wave sign above the arch
  g.fillStyle = '#b3aa9a'; g.fillRect(GATE_X - 7, gT + 4, 14, 8);
  g.strokeStyle = '#6a6156'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(GATE_X - 5, gT + 8.4); g.quadraticCurveTo(GATE_X - 2.5, gT + 5.6, GATE_X, gT + 8.4); g.quadraticCurveTo(GATE_X + 2.5, gT + 11.2, GATE_X + 5, gT + 8.4); g.stroke();
  // machicolation: corbelled gallery over the gate with murder holes
  g.fillStyle = '#958d80'; g.fillRect(TWL.x1, gT - 1, TWR.x0 - TWL.x1, 3);
  for (let x = TWL.x1 + 4; x < TWR.x0 - 2; x += 7) { g.fillStyle = '#1e1712'; g.fillRect(x, gT + 2, 3.2, 1.6); g.fillStyle = '#8a8276'; g.fillRect(x - 1.2, gT + 2, 1.2, 2.4); }
  // gatehouse wall-walk top & its merlons belong to the parapet strip
  return body;
}
function merlonRow(g, x0, x1, yFront, z, rng, opt = {}) {
  // continuous parapet then merlons with crenels
  const ph = opt.ph || 6, mh = opt.mh || 6, depth = 3 * KY;
  const s = yFront * KY - z;
  g.fillStyle = STONE.top; g.fillRect(x0, s - ph - depth, x1 - x0, depth);
  stoneCourses(g, x0, s - ph, x1, s, rng, STONE.face, { ch: 3 });
  const mw = opt.mw || 7, gap = opt.gap || 4.6;
  for (let x = x0 + 1; x + mw <= x1 + 0.1; x += mw + gap) {
    g.fillStyle = '#c0b8aa'; g.fillRect(x, s - ph - mh - depth, mw, depth);
    stoneCourses(g, x, s - ph - mh, x + mw, s - ph, rng, STONE.face, { ch: 3, minW: 3.2, varW: 3 });
    g.fillStyle = 'rgba(30,22,18,0.18)'; g.fillRect(x + mw - 0.8, s - ph - mh, 0.8, mh);
    g.fillStyle = 'rgba(255,244,222,0.3)'; g.fillRect(x, s - ph - mh - depth, mw, 0.5);
  }
  g.fillStyle = 'rgba(30,22,18,0.14)'; g.fillRect(x0, s - 1.2, x1 - x0, 1.2);
}
function buildParapet() {
  const rng = RNG(902);
  const top = WY1 * KY - GHZ - 20, bot = WY1 * KY - WZ + 2;
  const L = layer(-4, top, WW + 4, bot + 10), g = L.g;
  merlonRow(g, -4, TWL.x0, WY1, WZ, rng);
  merlonRow(g, TWR.x1, WW + 4, WY1, WZ, rng);
  // gatehouse top (forward + higher)
  const gT = GH_F * KY - GHZ;
  g.fillStyle = STONE.top; g.fillRect(TWL.x1, WY0 * KY - GHZ, TWR.x0 - TWL.x1, gT - WY0 * KY + GHZ);
  merlonRow(g, TWL.x1, TWR.x0, GH_F, GHZ, rng, { ph: 4 });
  return L;
}
function buildSquareTower(T) {
  const rng = RNG(T.x0 * 7);
  const fT = TW_F * KY - TZ, fB = TW_F * KY, tT = TW_B * KY - TZ;
  const body = layer(T.x0 - 3, tT - 16, T.x1 + 3, (TW_F + 6) * KY + 2), g = body.g;
  // top platform
  g.fillStyle = '#5e4a36'; g.fillRect(T.x0, tT, T.x1 - T.x0, fT - tT);
  for (let y = tT; y < fT; y += 3.4) for (let x = T.x0 + rng() * 4; x < T.x1; x += 5 + rng() * 5) { g.fillStyle = rng() < 0.5 ? '#7a5f42' : '#6e5539'; g.fillRect(x + 0.3, y + 0.3, Math.min(4.5, T.x1 - x - 0.3), 2.8); }
  { const sg = g.createLinearGradient(0, fT - 10, 0, fT); sg.addColorStop(0, 'rgba(20,14,10,0)'); sg.addColorStop(1, 'rgba(20,14,10,0.45)'); g.fillStyle = sg; g.fillRect(T.x0, fT - 10, T.x1 - T.x0, 10); g.fillStyle = 'rgba(20,14,10,0.3)'; g.fillRect(T.x0, tT, 4, fT - tT); }
  // hatch with ladder down
  g.fillStyle = '#3a2a1c'; g.fillRect(T.x0 + 6, tT + 5, 7, 5); g.strokeStyle = '#7a5230'; g.lineWidth = 0.5; g.strokeRect(T.x0 + 6, tT + 5, 7, 5);
  // front face
  stoneCourses(g, T.x0, fT, T.x1, fB - 5, rng, '#a79f92');
  stoneCourses(g, T.x0 - 1.5, fB - 5, T.x1 + 1.5, (TW_F + 4) * KY, rng, '#aea596', { ch: 3, minW: 8 });
  weather(g, T.x0, fT, T.x1, (TW_F + 4) * KY, rng, { moss: true });
  // corbel band
  g.fillStyle = '#958d80'; g.fillRect(T.x0 - 1, fT, T.x1 - T.x0 + 2, 2.6);
  for (let x = T.x0 + 1; x < T.x1 - 1; x += 4.4) { g.fillStyle = '#1e1712'; g.fillRect(x + 1.2, fT + 2.6, 2, 1.4); g.fillStyle = '#8c8478'; g.fillRect(x, fT + 2.6, 1.2, 2.6); }
  const cx = (T.x0 + T.x1) / 2;
  arrowSlit(g, cx - 12, fT + 14, 12); arrowSlit(g, cx + 12, fT + 30, 12);
  return body;
}
function buildSquareTowerParapet(T) {
  const rng = RNG(T.x0 * 11);
  const tT = TW_B * KY - TZ, fT = TW_F * KY - TZ;
  const L = layer(T.x0 - 3, tT - 16, T.x1 + 3, fT + 2), g = L.g;
  // side parapets (thin strips seen from above)
  for (const x of [T.x0, T.x1 - 3]) {
    g.fillStyle = '#b9b1a3'; g.fillRect(x, tT - 6, 3, fT - tT);
    for (let y = tT - 6; y < fT - 10; y += 8) { g.fillStyle = '#c2baac'; g.fillRect(x, y - 5, 3, 4); g.fillStyle = 'rgba(30,22,18,0.25)'; g.fillRect(x, y - 1, 3, 1); }
  }
  // back parapet
  g.fillStyle = '#b9b1a3'; g.fillRect(T.x0, tT - 6, T.x1 - T.x0, 3);
  merlonRow(g, T.x0, T.x1, TW_F, TZ, rng, { mw: 6.4, gap: 4.4 });
  return L;
}
function buildRoundTower(R) {
  const rng = RNG(R.cx * 3);
  const topY = R.cy * KY - R.z, baseY = R.cy * KY;
  const L = layer(R.cx - R.r - 6, topY - R.r * KY - 44, R.cx + R.r + 6, baseY + R.r * KY + 3), g = L.g;
  const ry = R.r * KY;
  // body: front half cylinder
  g.save(); g.beginPath(); g.moveTo(R.cx - R.r, topY); g.lineTo(R.cx - R.r, baseY); g.ellipse(R.cx, baseY, R.r, ry, 0, Math.PI, 0, true); g.lineTo(R.cx + R.r, topY); g.ellipse(R.cx, topY, R.r, ry, 0, 0, Math.PI); g.closePath(); g.clip();
  g.fillStyle = STONE.mortar; g.fillRect(R.cx - R.r, topY - ry, R.r * 2, R.z + ry * 2 + 2);
  for (let z = 0, row = 0; z < R.z + ry; z += 4.3, row++) {
    let a = Math.PI - (row % 2) * 0.12;
    while (a > 0) {
      const da = 0.2 + rng() * 0.18, a2 = Math.max(0, a - da);
      const xA = R.cx + Math.cos(a) * R.r, xB = R.cx + Math.cos(a2) * R.r;
      const yy = baseY + Math.sin((a + a2) / 2) * ry - z;
      const lit = 0.18 - ((a + a2) / 2 < Math.PI / 2 ? 0 : 0) - ((Math.PI - (a + a2) / 2) / Math.PI) * 0.36;
      const c = hex(STONE.face), k = lit + (rng() - 0.5) * 0.12;
      g.fillStyle = rgb(c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k)); g.fillRect(xA + 0.3, yy - 3.9, xB - xA - 0.6, 3.7);
      a = a2;
    }
  }
  weather(g, R.cx - R.r, topY - 4, R.cx + R.r, baseY + ry, rng, { moss: true });
  const cg = g.createLinearGradient(R.cx - R.r, 0, R.cx + R.r, 0); cg.addColorStop(0, 'rgba(255,236,200,0.18)'); cg.addColorStop(0.35, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(25,18,30,0.42)');
  g.fillStyle = cg; g.fillRect(R.cx - R.r, topY - ry, R.r * 2, R.z + ry * 2 + 2);
  g.restore();
  arrowSlit(g, R.cx - 6, topY + 16, 12);
  // conical roof (wood shingles) with overhang
  const rr = R.r + 3.5, rry = rr * KY, apex = topY - 44;
  g.save(); g.beginPath(); g.moveTo(R.cx - rr, topY); g.ellipse(R.cx, topY, rr, rry, 0, Math.PI, 0, true); g.lineTo(R.cx, apex); g.closePath(); g.clip();
  g.fillStyle = '#5a4436'; g.fillRect(R.cx - rr, apex, rr * 2, topY - apex + rry);
  for (let t = 0.04; t < 1.0; t += 0.07) {
    const yy = lerp(apex, topY, t), w = rr * t;
    for (let x = -w; x < w; x += 2.6) {
      const k = (x / w) * -0.22 + (rng() - 0.5) * 0.1;
      const c = hex('#6e5442');
      g.fillStyle = rgb(c[0] * (1 + k), c[1] * (1 + k), c[2] * (1 + k));
      g.beginPath(); g.ellipse(R.cx + x + 1.3, yy + rry * t * Math.sqrt(Math.max(0, 1 - (x / w) ** 2)) + 1.2, 1.4, 2.3, 0, 0, Math.PI); g.fill();
    }
  }
  const rg = g.createLinearGradient(R.cx - rr, 0, R.cx + rr, 0); rg.addColorStop(0, 'rgba(255,230,190,0.2)'); rg.addColorStop(0.4, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(20,12,20,0.45)');
  g.fillStyle = rg; g.fillRect(R.cx - rr, apex, rr * 2, topY - apex + rry);
  g.restore();
  g.strokeStyle = '#3a2a1c'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(R.cx, topY, rr, rry, 0, 0.05, Math.PI - 0.05); g.stroke();
  g.strokeStyle = '#4a3a2a'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(R.cx, apex); g.lineTo(R.cx, apex - 9); g.stroke();
  R.finial = [R.cx, apex - 9];
  return L;
}

// ---------- the keep (top-right, partly under the HUD) ----------
function buildKeep() {
  const rng = RNG(55);
  const x0 = 690, x1 = 850, fy = 116, h = 120;
  const L = layer(x0 - 4, fy * KY - h - 20, x1 + 4, fy * KY + 4), g = L.g;
  stoneCourses(g, x0, fy * KY - h, x1, fy * KY, rng, '#9a9285');
  weather(g, x0, fy * KY - h, x1, fy * KY, rng, { moss: true });
  // door where the villagers go in
  const dx = 742;
  g.fillStyle = '#1b130e'; g.beginPath(); g.moveTo(dx - 9, fy * KY); g.lineTo(dx - 9, fy * KY - 13); g.arc(dx, fy * KY - 13, 9, Math.PI, 0); g.lineTo(dx + 9, fy * KY); g.closePath(); g.fill();
  g.fillStyle = '#6b4a2c'; g.fillRect(dx + 3, fy * KY - 18, 6, 18);
  g.strokeStyle = '#b8b0a2'; g.lineWidth = 1.6; g.beginPath(); g.arc(dx, fy * KY - 13, 10, Math.PI, 0); g.stroke();
  for (const [ax, ay] of [[715, 40], [790, 40], [815, 70], [715, 70]]) arrowSlit(g, ax, fy * KY - h + ay, 12);
  // steps
  for (let k = 0; k < 3; k++) { g.fillStyle = k % 2 ? '#a9a194' : '#b5ad9f'; g.fillRect(dx - 13 + k * 1.5, fy * KY + k * 1.8 - 1, 26 - k * 3, 2); }
  return L;
}

// ---------- props (painted once, anchored at the base centre) ----------
function propCanvas(wL, wR, hU, hD, fn) {
  const PX = CAM.PX;
  const c = mkCanvas((wL + wR) * PX, (hU + hD) * PX), g = c.getContext('2d');
  g.setTransform(PX, 0, 0, PX, wL * PX, hU * PX); fn(g);
  return { c, ax: wL * PX, ay: hU * PX };
}
function paintCanopy(g, rng, r, tones, apples) {
  const blobs = [];
  for (let k = 0; k < 26; k++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 0.75;
    blobs.push([Math.cos(a) * d * 1.1, -r - Math.sin(a) * d * 0.85, r * (0.32 + rng() * 0.22)]);
  }
  blobs.sort((p, q) => q[1] - p[1] + (q[0] - p[0]) * 0.3);
  g.fillStyle = shade(tones[0], -0.45); g.beginPath(); g.ellipse(0, -r * 0.92, r * 1.12, r * 0.86, 0, 0, 6.28); g.fill();
  for (const [x, y, br] of blobs) {
    const lightK = clamp((-x - (y + r)) / (r * 1.6), -1, 1);
    const t = tones[Math.floor(rng() * tones.length)];
    g.fillStyle = shade(t, lightK * 0.22 - 0.06);
    g.beginPath(); g.arc(x, y, br, 0, 6.28); g.fill();
    if (lightK > 0.2) { g.fillStyle = 'rgba(255,236,190,0.18)'; g.beginPath(); g.arc(x - br * 0.3, y - br * 0.3, br * 0.5, 0, 6.28); g.fill(); }
  }
  if (apples) for (let k = 0; k < 9; k++) { g.fillStyle = rng() < 0.6 ? '#b8392a' : '#d8a03a'; g.beginPath(); g.arc((rng() - 0.5) * r * 1.4, -r + (rng() - 0.3) * r, 0.7, 0, 6.28); g.fill(); }
}
function makeTree(seed, kind) {
  const rng = RNG(seed);
  const r = kind === 'oak' ? 19 + rng() * 3 : 12 + rng() * 2.5;
  const trunkH = kind === 'oak' ? 12 : 8;
  const tones = kind === 'oak' ? ['#7d7a34', '#9a7f30', '#b1672a', '#8a8a3c', '#6b6e30'] : ['#7b8a3a', '#9a8a36', '#c08a34', '#6f7d34'];
  const trunk = propCanvas(4, 4, trunkH + 2, 2, (g) => { g.strokeStyle = '#4e3522'; g.lineWidth = kind === 'oak' ? 3.2 : 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0.8, -trunkH * 0.5, -0.3, -trunkH); g.stroke(); g.strokeStyle = '#6b4a30'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-0.6, -0.5); g.lineTo(-0.9, -trunkH + 1); g.stroke(); });
  const can = propCanvas(r * 1.3 + 2, r * 1.3 + 2, r * 2 + 3, 2, (g) => paintCanopy(g, rng, r, tones, kind === 'apple'));
  return { trunk, can, r, trunkH };
}
function makeCottage(seed, w, d, h, opt = {}) {
  const rng = RNG(seed);
  const rh = d * 0.75;
  return propCanvas(w / 2 + 4, w / 2 + 4, h + rh * 0.9 + d * KY + 14, 3, (g) => {
    // front wall: plaster with timber frame
    g.fillStyle = opt.burnt ? '#5a4a3a' : '#d6c8aa'; g.fillRect(-w / 2, -h, w, h);
    g.fillStyle = 'rgba(80,60,40,0.18)'; g.fillRect(-w / 2, -2.5, w, 2.5);
    g.strokeStyle = opt.burnt ? '#241a12' : '#5c3b23'; g.lineWidth = 1.1;
    g.strokeRect(-w / 2, -h, w, h);
    for (let x = -w / 2 + w / 4; x < w / 2; x += w / 4) { g.beginPath(); g.moveTo(x, -h); g.lineTo(x, 0); g.stroke(); }
    g.beginPath(); g.moveTo(-w / 2, -h * 0.5); g.lineTo(w / 2, -h * 0.5); g.stroke();
    g.lineWidth = 0.8; g.beginPath(); g.moveTo(-w / 2, -h * 0.5); g.lineTo(-w / 4, -h); g.moveTo(w / 2, -h * 0.5); g.lineTo(w / 4, -h); g.stroke();
    // door + window
    g.fillStyle = '#4e331f'; g.fillRect(-w / 8 - 2.5, -h * 0.68, 5, h * 0.68); g.fillStyle = '#6b4a2c'; g.fillRect(-w / 8 - 2, -h * 0.64, 4, h * 0.64);
    g.fillStyle = '#2a1d14'; g.fillRect(w / 4 - 3.5 + w / 8, -h * 0.82, 4.5, 3.4); g.fillStyle = '#7a5230'; g.fillRect(w / 4 - 5 + w / 8, -h * 0.84, 1.4, 3.8); g.fillRect(w / 4 + 1 + w / 8, -h * 0.84, 1.4, 3.8);
    if (opt.window) { g.fillStyle = 'rgba(255,190,90,0.0)'; }
    // thatch roof (front slope from the eave to the ridge)
    const eave = -h, ridge = -h - rh - d * KY * 0.5;
    g.fillStyle = opt.burnt ? '#2e241c' : '#a3814a';
    g.beginPath(); g.moveTo(-w / 2 - 3, eave + 1.5); g.lineTo(w / 2 + 3, eave + 1.5); g.lineTo(w / 2 + 1.5, ridge); g.lineTo(-w / 2 - 1.5, ridge); g.closePath(); g.fill();
    g.save(); g.clip();
    for (let k = 0; k < w * 3.2; k++) {
      const x = -w / 2 - 3 + rng() * (w + 6), y = ridge + rng() * (eave - ridge + 1.5);
      g.strokeStyle = opt.burnt ? (rng() < 0.5 ? '#1a140f' : '#4a3a2c') : (rng() < 0.5 ? '#8a6a38' : '#c09a5a'); g.lineWidth = 0.45;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 0.6, y + 2.2); g.stroke();
    }
    const tg = g.createLinearGradient(0, ridge, 0, eave); tg.addColorStop(0, 'rgba(255,240,200,0.18)'); tg.addColorStop(1, 'rgba(40,24,10,0.3)'); g.fillStyle = tg; g.fillRect(-w / 2 - 3, ridge, w + 6, eave - ridge + 2);
    if (opt.burnt) { g.fillStyle = '#120c08'; g.beginPath(); g.moveTo(-2, ridge); g.lineTo(w / 2 - 2, ridge); g.lineTo(w / 2 - 6, eave); g.lineTo(2, eave + 1); g.closePath(); g.fill(); g.strokeStyle = '#3a2618'; g.lineWidth = 0.9; for (let x = 0; x < w / 2 - 2; x += 4) { g.beginPath(); g.moveTo(x, ridge); g.lineTo(x - 1, eave); g.stroke(); } }
    g.restore();
    g.fillStyle = opt.burnt ? '#1a140f' : '#6e5430'; g.fillRect(-w / 2 - 1.5, ridge - 1.2, w + 3, 2.2);
    g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-w / 2 - 3, eave + 1.5); g.lineTo(w / 2 + 3, eave + 1.5); g.stroke();
    if (opt.chimney) { const cx = opt.chimney * w / 2; g.fillStyle = '#8a8276'; g.fillRect(cx - 2, ridge - 7, 4, 9); g.fillStyle = '#6f685e'; g.fillRect(cx - 2.4, ridge - 8, 4.8, 1.4); }
  });
}
function makeStook(seed) {
  const rng = RNG(seed);
  return propCanvas(6, 6, 9, 2, (g) => {
    for (let k = 0; k < 5; k++) {
      const a = -0.5 + k * 0.25 + (rng() - 0.5) * 0.1;
      g.save(); g.rotate(a); g.fillStyle = k % 2 ? '#c9a356' : '#ddb968';
      g.beginPath(); g.moveTo(-1.4, 0); g.lineTo(-0.7, -7); g.lineTo(0.7, -7); g.lineTo(1.4, 0); g.closePath(); g.fill();
      g.strokeStyle = '#8a6a30'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-1, -2.8); g.lineTo(1, -2.8); g.stroke(); g.restore();
    }
    g.strokeStyle = 'rgba(255,240,200,0.4)'; g.lineWidth = 0.3; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(-2 + k * 0.8, -6.8); g.lineTo(-2.4 + k * 0.9, -8.2); g.stroke(); }
  });
}
function makeHay() {
  const rng = RNG(4);
  return propCanvas(9, 9, 12, 2, (g) => {
    g.fillStyle = '#b9934c'; g.beginPath(); g.ellipse(0, -4.5, 8, 6, 0, Math.PI, 0); g.lineTo(8, 0); g.lineTo(-8, 0); g.fill();
    for (let k = 0; k < 90; k++) { const x = (rng() - 0.5) * 15, y = -rng() * 10; if (Math.hypot(x / 8, (y + 4.5) / 6) > 1 && y < -4.5) continue; g.strokeStyle = rng() < 0.5 ? '#8f6e34' : '#d6b06a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5), y + 1.6); g.stroke(); }
    const sg = g.createLinearGradient(-8, 0, 8, 0); sg.addColorStop(0, 'rgba(255,236,190,0.18)'); sg.addColorStop(1, 'rgba(30,18,10,0.3)'); g.fillStyle = sg; g.beginPath(); g.ellipse(0, -4.5, 8, 6, 0, Math.PI, 0); g.lineTo(8, 0); g.lineTo(-8, 0); g.fill();
  });
}
function makeBarrels(n, seed) {
  const rng = RNG(seed);
  return propCanvas(10, 10, 10, 3, (g) => {
    for (let k = 0; k < n; k++) {
      const x = -6 + k * 4.6 + (rng() - 0.5), y = (k % 2) * 1.6;
      g.fillStyle = '#7a5232'; g.fillRect(x - 2, y - 6, 4, 6);
      g.fillStyle = '#8f6440'; g.beginPath(); g.ellipse(x, y - 6, 2, 0.9, 0, 0, 6.28); g.fill();
      g.strokeStyle = '#3e3a36'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 2, y - 4.8); g.lineTo(x + 2, y - 4.8); g.moveTo(x - 2, y - 1.4); g.lineTo(x + 2, y - 1.4); g.stroke();
      g.fillStyle = 'rgba(20,10,10,0.3)'; g.fillRect(x + 0.8, y - 6, 1.2, 6);
    }
  });
}
function makeCrates(seed) {
  const rng = RNG(seed);
  return propCanvas(10, 10, 12, 2, (g) => {
    const box = (x, y, s) => { g.fillStyle = '#9a7246'; g.fillRect(x, y - s, s, s); g.fillStyle = '#b08656'; g.fillRect(x, y - s - s * 0.45, s, s * 0.45); g.strokeStyle = '#5c3b23'; g.lineWidth = 0.45; g.strokeRect(x, y - s, s, s); g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.stroke(); };
    box(-8, 0, 6); box(-1.5, 0.5, 6.5); box(-5, -6.2, 5);
    // arrow bundles
    for (let k = 0; k < 2; k++) { const x = 6 + k * 3; g.strokeStyle = '#8a6a3a'; g.lineWidth = 0.35; for (let j = -3; j <= 3; j++) { g.beginPath(); g.moveTo(x + j * 0.25, 0); g.lineTo(x + j * 0.55, -8); g.stroke(); } g.fillStyle = '#e7dcc0'; g.fillRect(x - 1.8, -9.2, 3.6, 1.3); g.fillStyle = '#5a3a22'; g.fillRect(x - 1.1, -3.4, 2.2, 1); }
    void rng;
  });
}
function makeWell() {
  return propCanvas(9, 9, 18, 4, (g) => {
    g.fillStyle = '#8f877a'; g.fillRect(-6, -5, 12, 5); g.fillStyle = '#a69e90'; g.beginPath(); g.ellipse(0, -5, 6, 2.4, 0, 0, 6.28); g.fill();
    g.fillStyle = '#1b1612'; g.beginPath(); g.ellipse(0, -5, 4.2, 1.5, 0, 0, 6.28); g.fill();
    g.strokeStyle = '#5c3b23'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-5, -5); g.lineTo(-5, -14); g.moveTo(5, -5); g.lineTo(5, -14); g.moveTo(-6.5, -13.5); g.lineTo(6.5, -13.5); g.stroke();
    g.fillStyle = '#7a4a2c'; g.beginPath(); g.moveTo(-7.5, -13); g.lineTo(0, -17); g.lineTo(7.5, -13); g.closePath(); g.fill();
    g.strokeStyle = '#c9b98f'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(1, -13.5); g.lineTo(1, -8); g.stroke(); g.fillStyle = '#6b4a2c'; g.fillRect(0, -8.5, 2, 2);
  });
}
function makeTent() {
  return propCanvas(14, 14, 16, 3, (g) => {
    g.fillStyle = '#d9d2c0'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-9, -11); g.lineTo(9, -11); g.lineTo(12, 0); g.closePath(); g.fill();
    g.fillStyle = '#bdb4a0'; g.beginPath(); g.moveTo(-3, 0); g.lineTo(-1, -9); g.lineTo(1, -9); g.lineTo(3, 0); g.closePath(); g.fill();
    g.fillStyle = '#2f2820'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(0, -7); g.lineTo(2, 0); g.fill();
    g.strokeStyle = '#2c5d93'; g.lineWidth = 1.0; g.beginPath(); g.moveTo(-11.3, -3); g.lineTo(11.3, -3); g.stroke();
    // herb-sprig emblem (the surgeons' sign; deliberately not a cross)
    g.strokeStyle = '#4f7a3a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-6, -5); g.lineTo(-6, -9); g.stroke();
    for (let k = 0; k < 3; k++) { g.fillStyle = '#5f8a44'; g.beginPath(); g.ellipse(-6 - 1, -6 - k * 1.2, 0.9, 0.45, -0.5, 0, 6.28); g.ellipse(-6 + 1, -6.5 - k * 1.2, 0.9, 0.45, 0.5, 0, 6.28); g.fill(); }
    const sg = g.createLinearGradient(-12, 0, 12, 0); sg.addColorStop(0, 'rgba(255,240,210,0.15)'); sg.addColorStop(1, 'rgba(30,25,40,0.25)'); g.fillStyle = sg; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-9, -11); g.lineTo(9, -11); g.lineTo(12, 0); g.closePath(); g.fill();
    g.strokeStyle = '#5c3b23'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-9, -11); g.lineTo(-9, -14); g.moveTo(9, -11); g.lineTo(9, -14); g.stroke();
  });
}
function makeCart(seed, broken) {
  const rng = RNG(seed);
  return propCanvas(11, 11, 12, 3, (g) => {
    g.fillStyle = '#7a5232'; g.fillRect(-9, -7, 15, 4); g.fillStyle = '#9a6b42'; g.fillRect(-9, -9.5, 15, 2.5);
    g.strokeStyle = '#4e331f'; g.lineWidth = 0.4; for (let x = -8; x < 6; x += 3) { g.beginPath(); g.moveTo(x, -7); g.lineTo(x, -3); g.stroke(); }
    g.strokeStyle = '#5c3b23'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(6, -5); g.lineTo(11, -3); g.stroke();
    if (!broken) { g.fillStyle = '#c9a356'; g.beginPath(); g.ellipse(-2, -10, 6, 2.2, 0, Math.PI, 0); g.fill(); }
    const wheel = (x, y, r) => { g.strokeStyle = '#3e2a1a'; g.lineWidth = 1.0; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.stroke(); g.lineWidth = 0.4; for (let a = 0; a < 6.28; a += 1.05) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a + rng() * 0.1) * r, y + Math.sin(a) * r); g.stroke(); } };
    wheel(-3, -3.2, 3.2);
  });
}
function makeBarricade(broken) {
  const rng = RNG(broken ? 66 : 65);
  return propCanvas(60, 60, 16, 6, (g) => {
    const plank = (x0, y0, x1, y1, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    if (!broken) {
      // stakes pointing at the field
      for (let x = -54; x <= 54; x += 6 + rng() * 3) { plank(x, 1, x + (rng() - 0.5) * 2, -10 - rng() * 3, 1.3, rng() < 0.5 ? '#6b4a2c' : '#7d5634'); g.fillStyle = '#c9b48a'; g.beginPath(); g.arc(x, -11 - rng(), 0.5, 0, 6.28); g.fill(); }
      // overturned cart in the middle (wheel faces the camera)
      g.fillStyle = '#6e4a2c'; g.fillRect(-16, -10, 30, 9); g.fillStyle = '#8a5e36'; g.fillRect(-16, -12, 30, 2.4);
      g.strokeStyle = '#3e2a1a'; g.lineWidth = 0.5; for (let x = -14; x < 14; x += 4) { g.beginPath(); g.moveTo(x, -10); g.lineTo(x, -1); g.stroke(); }
      g.strokeStyle = '#2e2018'; g.lineWidth = 1.4; g.beginPath(); g.arc(8, -13, 5, 0, 6.28); g.stroke(); g.lineWidth = 0.5; for (let a = 0; a < 6.28; a += 0.9) { g.beginPath(); g.moveTo(8, -13); g.lineTo(8 + Math.cos(a) * 5, -13 + Math.sin(a) * 5); g.stroke(); }
      // barrels, sacks, a door torn off its hinges
      for (const [x, y] of [[-30, 0], [-24, 1], [26, 0]]) { g.fillStyle = '#7a5232'; g.fillRect(x - 2.4, y - 7, 4.8, 7); g.strokeStyle = '#3e3a36'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 2.4, y - 5); g.lineTo(x + 2.4, y - 5); g.moveTo(x - 2.4, y - 1.8); g.lineTo(x + 2.4, y - 1.8); g.stroke(); }
      for (const [x, y] of [[-40, 1], [-44, 0], [36, 1], [41, 0], [46, 1]]) { g.fillStyle = '#b39a6a'; g.beginPath(); g.ellipse(x, y - 2.2, 3, 2.2, 0, 0, 6.28); g.fill(); g.strokeStyle = '#7a6440'; g.lineWidth = 0.35; g.stroke(); }
      g.save(); g.translate(-2, -1); g.rotate(-0.25); g.fillStyle = '#5c3b23'; g.fillRect(-26, -6, 12, 6); g.restore();
    } else {
      for (let k = 0; k < 26; k++) { const x = (rng() - 0.5) * 110, y = (rng() - 0.3) * 6; const a = rng() * 3.14, l = 3 + rng() * 7; plank(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.5, 1 + rng(), rng() < 0.5 ? '#5e3f25' : '#7a5232'); }
      g.strokeStyle = '#2e2018'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(14, -2, 5, 2.2, 0.2, 0, 6.28); g.stroke();
      for (const [x, y] of [[-30, 1], [30, 2]]) { g.fillStyle = '#6a4628'; g.beginPath(); g.ellipse(x, y - 1.6, 3.6, 1.8, 0.3, 0, 6.28); g.fill(); }
    }
  });
}
function makeScarecrow() {
  return propCanvas(7, 7, 18, 2, (g) => {
    g.strokeStyle = '#5c3b23'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -15); g.moveTo(-6, -11); g.lineTo(6, -11); g.stroke();
    g.fillStyle = '#6a5a3a'; g.beginPath(); g.moveTo(-5, -11.5); g.lineTo(5, -11.5); g.lineTo(3, -5); g.lineTo(1, -6); g.lineTo(-1, -4.5); g.lineTo(-3, -6); g.closePath(); g.fill();
    g.fillStyle = '#d9c9a3'; g.beginPath(); g.arc(0, -13.4, 1.8, 0, 6.28); g.fill();
    g.fillStyle = '#4a3a28'; g.beginPath(); g.ellipse(0, -14.6, 3.4, 0.9, 0, 0, 6.28); g.fill(); g.fillRect(-1.6, -17, 3.2, 2.6);
    g.strokeStyle = '#c9a356'; g.lineWidth = 0.4; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-5.5, -11); g.lineTo(-6.5, -10 + k * 0.6); g.moveTo(5.5, -11); g.lineTo(6.5, -10 + k * 0.6); g.stroke(); }
  });
}
function makeFence(len, seed) {
  const rng = RNG(seed);
  return propCanvas(2, len + 2, 7, 2, (g) => {
    g.strokeStyle = '#6b4a2c'; g.lineWidth = 0.8;
    for (let x = 0; x <= len; x += 8) { if (rng() < 0.12) continue; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rng() - 0.5), -5.5); g.stroke(); }
    g.lineWidth = 0.6;
    for (const h of [-2, -4.4]) { let x = 0; while (x < len) { const l = 8 + rng() * 16; if (rng() < 0.82) { g.beginPath(); g.moveTo(x, h + (rng() - 0.5) * 0.6); g.lineTo(Math.min(len, x + l), h + (rng() - 0.5) * 0.6); g.stroke(); } x += l; } }
  });
}
function makeWoodpile() {
  const rng = RNG(8);
  return propCanvas(10, 10, 8, 2, (g) => {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6 - r; k++) { const x = -7 + k * 2.6 + r * 1.3, y = -1.2 - r * 2.2; g.fillStyle = '#8a6a44'; g.beginPath(); g.arc(x, y, 1.25, 0, 6.28); g.fill(); g.fillStyle = '#c9a36a'; g.beginPath(); g.arc(x, y, 0.75, 0, 6.28); g.fill(); g.strokeStyle = '#6b4a2c'; g.lineWidth = 0.2; g.beginPath(); g.arc(x, y, 0.4 + rng() * 0.2, 0, 6.28); g.stroke(); }
  });
}

// ---------- squad emblems & banners (cached, shared by HUD and world) ----------
const SQUADS = [
  { id: 0, nm: '개울목 방패대', field: '#2c5d93', charge: '#efe2bf', emb: 'wave', shape: 'rect' },
  { id: 1, nm: '버들골 창병대', field: '#efe2bf', charge: '#2c5d93', emb: 'leaf', shape: 'rect' },
  { id: 2, nm: '종탑 궁수대', field: '#2c5d93', charge: '#efe2bf', emb: 'bell', shape: 'swallow' },
  { id: 3, nm: '갈대 궁수대', field: '#efe2bf', charge: '#2c5d93', emb: 'reed', shape: 'swallow' },
];
function flagPath(g, shape, w, h, wave, ph) {
  // cloth hanging from a crossbar at (0,0), width w, height h; wave deforms it
  const N = 8; const pts = [];
  for (let k = 0; k <= N; k++) { const t = k / N; pts.push([t * w + Math.sin(ph + t * 3) * wave * 0.4, Math.sin(ph + t * 4.2) * wave * t]); }
  g.beginPath(); g.moveTo(0, 0);
  for (const p of pts) g.lineTo(p[0], p[1]);
  const last = pts[N];
  if (shape === 'swallow') { g.lineTo(last[0] + Math.sin(ph) * wave * 0.3, h); g.lineTo(w * 0.5 + Math.sin(ph + 2) * wave * 0.6, h * 0.72 + Math.sin(ph + 2) * wave * 0.3); g.lineTo(Math.sin(ph + 1) * wave * 0.3, h); }
  else { for (let k = N; k >= 0; k--) { const t = k / N; g.lineTo(t * w + Math.sin(ph + t * 3 + 0.6) * wave * 0.5, h + Math.sin(ph + t * 4.2 + 0.4) * wave * t); } }
  g.closePath();
}
function paintCharge(g, emb, cx, cy, s, col) {
  g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  if (emb === 'wave') { g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(cx - 3 * s, cy); g.quadraticCurveTo(cx - 1.5 * s, cy - 1.8 * s, cx, cy); g.quadraticCurveTo(cx + 1.5 * s, cy + 1.8 * s, cx + 3 * s, cy); g.stroke(); g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(cx - 3 * s, cy + 2.2 * s); g.quadraticCurveTo(cx - 1.5 * s, cy + 0.8 * s, cx, cy + 2.2 * s); g.quadraticCurveTo(cx + 1.5 * s, cy + 3.6 * s, cx + 3 * s, cy + 2.2 * s); g.stroke(); }
  else if (emb === 'leaf') { g.beginPath(); g.moveTo(cx, cy - 3.6 * s); g.quadraticCurveTo(cx + 2.4 * s, cy - 0.5 * s, cx, cy + 3.2 * s); g.quadraticCurveTo(cx - 2.4 * s, cy - 0.5 * s, cx, cy - 3.6 * s); g.fill(); g.strokeStyle = g.fillStyle === col ? 'rgba(255,255,255,0.0)' : col; }
  else if (emb === 'bell') { g.beginPath(); g.moveTo(cx - 2.6 * s, cy + 2 * s); g.quadraticCurveTo(cx - 2.2 * s, cy - 3 * s, cx, cy - 3 * s); g.quadraticCurveTo(cx + 2.2 * s, cy - 3 * s, cx + 2.6 * s, cy + 2 * s); g.closePath(); g.fill(); g.beginPath(); g.arc(cx, cy + 2.7 * s, 0.8 * s, 0, 6.28); g.fill(); }
  else if (emb === 'reed') { g.lineWidth = 0.7 * s; for (const dx of [-1.6, 0, 1.6]) { g.beginPath(); g.moveTo(cx + dx * s, cy + 3.4 * s); g.lineTo(cx + dx * s * 0.6, cy - 2.2 * s); g.stroke(); g.beginPath(); g.ellipse(cx + dx * s * 0.6, cy - 2.4 * s, 0.6 * s, 1.3 * s, 0, 0, 6.28); g.fill(); } }
  else if (emb === 'tusk') { g.lineWidth = 1.0 * s; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(cx + sd * 2.4 * s, cy + 3 * s); g.quadraticCurveTo(cx + sd * 3.2 * s, cy - 1 * s, cx + sd * 0.6 * s, cy - 3.4 * s); g.stroke(); } }
  else if (emb === 'sun') { g.lineWidth = 0.6 * s; g.beginPath(); g.arc(cx, cy, 2.2 * s, 0, 6.28); g.stroke(); g.beginPath(); g.moveTo(cx, cy - 2.2 * s); g.lineTo(cx, cy + 2.2 * s); g.moveTo(cx - 2.2 * s, cy); g.lineTo(cx + 2.2 * s, cy); g.stroke(); }
}
function makeBannerFrames(sq, PX, nFrames) {
  // pole + flag + finial; flags are cached per wave phase so the frame costs one drawImage
  const w = 9, h = 7.5, poleH = 22;
  const frames = [];
  for (let f = 0; f < nFrames; f++) {
    frames.push(propCanvas(3, w + 6, poleH + 3, 2, (g) => {
      g.strokeStyle = '#4a3220'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -poleH); g.stroke();
      g.fillStyle = '#c9a36a'; g.beginPath(); g.arc(0, -poleH - 0.6, 0.9, 0, 6.28); g.fill();
      g.save(); g.translate(0.4, -poleH + 0.5);
      const ph = (f / nFrames) * Math.PI * 2;
      flagPath(g, sq.shape, w, h, 1.0, ph);
      g.fillStyle = sq.field; g.fill(); g.save(); g.clip();
      paintCharge(g, sq.emb, w * 0.45, h * 0.45 + Math.sin(ph + 2) * 0.4, 0.95, sq.charge);
      const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); for (let k = 1; k < 4; k++) sh.addColorStop(k / 4, `rgba(${Math.sin(ph + k * 1.6) > 0 ? '255,240,210,0.12' : '20,10,20,0.18'})`); g.fillStyle = sh; g.fillRect(0, -3, w + 3, h + 6);
      g.restore(); g.strokeStyle = 'rgba(30,20,15,0.85)'; g.lineWidth = 0.45; g.stroke(); g.restore();
    }));
  }
  return frames;
}
function paintEmblemIcon(cv, sq) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const s = W / 20;
  g.save(); g.scale(s, s);
  g.beginPath();
  if (sq.shape === 'swallow') { g.moveTo(2, 1); g.lineTo(18, 1); g.lineTo(18, 25); g.lineTo(10, 19); g.lineTo(2, 25); }
  else { g.moveTo(2, 1); g.lineTo(18, 1); g.lineTo(18, 17); g.quadraticCurveTo(18, 23, 10, 25.5); g.quadraticCurveTo(2, 23, 2, 17); }
  g.closePath(); g.fillStyle = sq.field; g.fill(); g.lineWidth = 1.1; g.strokeStyle = '#1a120d'; g.stroke();
  g.save(); g.clip(); paintCharge(g, sq.emb, 10, 11.5, 1.85, sq.charge); g.restore();
  g.restore();
}
