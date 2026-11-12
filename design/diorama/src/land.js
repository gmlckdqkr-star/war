// ============================================================================
// land: the fields in front of the wall are a patchwork of parcels, each with
// its own surface and its own story (cut stubble, ploughed earth, standing
// wheat that the attackers trample, a meadow, the orchard, the creek they must
// ford). Hedgerows give the plain a structure and read as depth.
// ============================================================================
const HEDGE_Y = 300, HEDGE_XW = 170, HEDGE_XE = 716, CREEK_HW = 8.5;
function creekY(x) { return 438 + 15 * Math.sin(x / 95 + 0.6) + 6 * Math.sin(x / 37 + 2); }
function parcelAt(x, y) {
  if (y < WY0 + 4) return 'court';
  const cy = creekY(x);
  if (Math.abs(y - cy) < CREEK_HW) return 'creek';
  if (y > cy) return 'south';
  if (y < HEDGE_Y) return x < GATE_X ? 'stubN' : 'plough';
  if (x < HEDGE_XW) return 'meadow';
  if (x > HEDGE_XE) return 'orchard';
  return x < roadX(y) ? 'stubble' : 'wheat';
}
const PAL_LAND = {
  stub: [[186, 156, 94], [204, 176, 110]], stubDark: [150, 120, 72],
  plough: [[118, 88, 62], [132, 100, 70]], furrow: [88, 64, 46],
  wheat: [[192, 152, 70], [178, 138, 60]],
  meadow: [[116, 128, 64], [94, 108, 52]], orchard: [[108, 120, 60], [90, 104, 50]],
  south: [[104, 108, 62], [84, 92, 50]], heather: [128, 98, 96],
  mud: [96, 80, 60], water: [[78, 104, 112], [128, 152, 150]],
  road: [[150, 122, 86], [126, 100, 68]], court: [[128, 105, 78], [152, 128, 92]],
};
function groundColor(x, y) {
  const n1 = fbm(x * 0.017, y * 0.02, 3), n2 = fbm(x * 0.055, y * 0.06, 9), n3 = vnoise(x * 0.3, y * 0.3, 17);
  const P = PAL_LAND;
  let c;
  const pc = parcelAt(x, y);
  if (pc === 'court') {
    c = mixA(P.court[0], P.court[1], smooth(0.3, 0.75, n1));
    if (n2 > 0.58) c = mixA(c, [172, 148, 98], clamp((n2 - 0.58) * 3, 0, 0.8));
    const dp = distPaths(x, y) + (n2 - 0.5) * 6;
    if (dp < 9) c = mixA(c, [152, 145, 132], smooth(9, 4, dp) * 0.85);
    c = mixA(c, [118, 98, 74], (n3 - 0.5) * 0.3 + 0.1);
    const k = 0.93 + n1 * 0.14; return [c[0] * k, c[1] * k, c[2] * k];
  }
  const cy = creekY(x), dc = Math.abs(y - cy);
  if (pc === 'creek') {
    const q = dc / CREEK_HW;
    c = mixA(P.water[0], P.water[1], smooth(0.2, 1, q) * 0.8 + (n2 - 0.5) * 0.3);
    if (q > 0.78) c = mixA(c, P.mud, smooth(0.78, 1, q));
    return c;
  }
  if (pc === 'stubN' || pc === 'stubble') {
    // straight drill rows, barely warped: a harvested field, combed
    const d = pc === 'stubble' ? x * 0.62 + y * 0.78 : x * 0.12 + y;
    const row = Math.sin((d + n1 * 5) * 1.05);
    c = mixA(P.stub[0], P.stub[1], smooth(0.25, 0.75, n1));
    c = mixA(c, P.stubDark, (row > 0.55 ? 0.34 : 0) + (n3 - 0.5) * 0.14);
    if (pc === 'stubN') c = mixA(c, [150, 126, 86], smooth(WY1 + 30, WY1 + 4, y) * 0.5);
  } else if (pc === 'plough') {
    const row = Math.sin((y + n1 * 2.5) * 2.0);
    c = mixA(P.plough[0], P.plough[1], n2);
    c = mixA(c, row > 0.2 ? P.furrow : [150, 116, 82], row > 0.2 ? 0.45 : clamp(-row, 0, 1) * 0.35);
  } else if (pc === 'wheat') {
    c = mixA(P.wheat[0], P.wheat[1], smooth(0.3, 0.7, n2));
    c = mixA(c, [212, 176, 96], clamp(n1 - 0.55, 0, 0.3) * 2);
  } else if (pc === 'meadow') {
    c = mixA(P.meadow[0], P.meadow[1], n2);
    if (n3 > 0.82) c = mixA(c, [196, 190, 150], 0.25);
  } else if (pc === 'orchard') {
    c = mixA(P.orchard[0], P.orchard[1], n2);
  } else {
    c = mixA(P.south[0], P.south[1], n2);
    if (n1 > 0.6) c = mixA(c, P.heather, (n1 - 0.6) * 1.6);
    if (n2 < 0.3) c = mixA(c, [146, 136, 66], (0.3 - n2) * 1.8);
  }
  // creek banks: wet, darker earth and greener grass
  if (dc < CREEK_HW + 6) c = mixA(c, mixA(P.mud, [88, 104, 52], smooth(CREEK_HW, CREEK_HW + 6, dc)), smooth(CREEK_HW + 6, CREEK_HW + 1, dc) * 0.85);
  // weeds along the wall foot
  c = mixA(c, [104, 106, 58], smooth(WY1 + 22, WY1 + 6, y) * 0.8);
  // hedgerow feet: shaded, grassy
  const dh = Math.min(Math.abs(y - HEDGE_Y), Math.abs(x - HEDGE_XW) + (y < HEDGE_Y ? 99 : 0), Math.abs(x - HEDGE_XE) + (y < HEDGE_Y ? 99 : 0));
  if (dh < 7) c = mixA(c, [90, 100, 54], smooth(7, 2, dh) * 0.7);
  // road
  const rx = roadX(y), rh = roadHalf(y);
  const dr = Math.abs(x - rx) - rh + (n2 - 0.5) * 7;
  if (dr < 5) c = mixA(c, [112, 118, 64], smooth(5, 0, dr) * 0.55);
  if (dr < 0) c = mixA(P.road[0], P.road[1], n2 * 0.9 + n3 * 0.2);
  // trampled earth in front of the gate yard and under the ladders
  const tr = Math.max(smooth(70, 20, Math.hypot((x - GATE_X) * 0.8, y - BAR_Y - 20)), smooth(26, 8, Math.hypot(x - 214, (y - WY1 - 14) * 1.4)) * 0.8, smooth(26, 8, Math.hypot(x - 596, (y - WY1 - 14) * 1.4)) * 0.8, smooth(26, 8, Math.hypot(x - 300, (y - WY1 - 14) * 1.4)) * 0.8);
  c = mixA(c, mixA([112, 88, 60], [96, 74, 50], n3), tr * 0.8);
  // the barn's scorched yard
  const br = smooth(70, 20, Math.hypot(x - 58, (y - 486) * 1.3));
  c = mixA(c, [64, 54, 42], br * 0.75);
  const k = 0.94 + n1 * 0.12;
  return [c[0] * k, c[1] * k, c[2] * k];
}

function bakeGround() {
  const W = CAM.W, H = CAM.H, PX = CAM.PX;
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const step = PX > 3 ? 2 : 2;
  const hw = Math.ceil(W / step), hh = Math.ceil(H / step);
  const lo = mkCanvas(hw, hh), lg = lo.getContext('2d');
  const id = lg.createImageData(hw, hh), d = id.data;
  for (let py = 0; py < hh; py++) {
    const sy = CAM.sy + (py * step + 1) / PX, wy = sy / KY;
    for (let px = 0; px < hw; px++) {
      const wx = CAM.x + (px * step + 1) / PX;
      const col = groundColor(wx, wy), o = (py * hw + px) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  lg.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, W, H);
  g.setTransform(PX, 0, 0, PX, -CAM.x * PX, -CAM.sy * PX);
  const r = RNG(808);
  // visible world rect (so a zoomed view gets the same density of detail)
  const vx0 = CAM.x - 6, vx1 = CAM.x + W / PX + 6, vy0 = CAM.sy / KY - 8, vy1 = (CAM.sy + H / PX) / KY + 8;
  const vis = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;
  const detail = clamp(PX / 1.9, 1, 2.2);
  // batched strokes by colour: one path per colour
  const B = new Map();
  const seg = (col, w, x0, y0, x1, y1) => { const k = col + '|' + w; let p = B.get(k); if (!p) { p = []; B.set(k, p); } p.push(x0, y0 * KY, x1, y1 * KY); };
  const flush = () => { for (const [k, p] of B) { const [col, w] = k.split('|'); g.strokeStyle = col; g.lineWidth = +w; g.beginPath(); for (let i = 0; i < p.length; i += 4) { g.moveTo(p[i], p[i + 1]); g.lineTo(p[i + 2], p[i + 3]); } g.stroke(); } B.clear(); };
  const onRoad = (x, y) => Math.abs(x - roadX(y)) < roadHalf(y) + 2;
  const area = (vx1 - vx0) * (vy1 - vy0);
  const N = (dens) => Math.floor(area * dens * detail);
  const rx = () => vx0 + r() * (vx1 - vx0), ry = () => Math.max(WY1 + 6, vy0) + r() * (vy1 - Math.max(WY1 + 6, vy0));
  // stubble: short stiff strokes, lit tips
  for (let k = 0, n = N(0.42); k < n; k++) {
    const x = rx(), y = ry(); const pc = parcelAt(x, y); if ((pc !== 'stubble' && pc !== 'stubN') || onRoad(x, y)) continue;
    const dd = pc === 'stubble' ? x * 0.62 + y * 0.78 : x * 0.12 + y; const row = Math.sin((dd + fbm(x * 0.017, y * 0.02, 3) * 5) * 1.05);
    if (row < 0.1 && r() < 0.7) continue;
    const h = 0.7 + r() * 0.9;
    seg(r() < 0.6 ? 'rgba(236,210,140,0.85)' : 'rgba(126,98,58,0.6)', 0.42, x, y, x + (r() - 0.5) * 0.5, y - h / KY * 0.6);
  }
  // ploughed clods
  for (let k = 0, n = N(0.18); k < n; k++) {
    const x = rx(), y = ry(); if (parcelAt(x, y) !== 'plough' || onRoad(x, y)) continue;
    const yy = Math.round(y * 2.0 / Math.PI) * Math.PI / 2.0 + 0.4;
    seg(r() < 0.5 ? 'rgba(160,124,88,0.7)' : 'rgba(70,50,36,0.55)', 0.6, x, yy, x + 0.8 + r() * 1.4, yy + (r() - 0.5) * 0.3);
  }
  // standing wheat: stalks with heads; the crop has a front edge you can read
  for (let k = 0, n = N(0.9); k < n; k++) {
    const x = rx(), y = ry(); if (parcelAt(x, y) !== 'wheat' || onRoad(x, y)) continue;
    const h = 2.2 + r() * 1.4, lean = 0.5 + r() * 0.5;
    seg(r() < 0.5 ? 'rgba(150,112,46,0.75)' : 'rgba(222,186,104,0.8)', 0.38, x, y, x + lean, y - h / KY * 0.7);
    if (r() < 0.5) seg('rgba(240,214,140,0.9)', 0.7, x + lean, y - h / KY * 0.7, x + lean * 1.25, y - (h + 0.9) / KY * 0.7);
  }
  // meadow, orchard, south pasture, verges: grass tufts and a few flowers
  const gcols = ['rgba(96,112,52,0.9)', 'rgba(132,140,66,0.9)', 'rgba(78,92,42,0.9)', 'rgba(150,150,80,0.85)'];
  for (let k = 0, n = N(0.3); k < n; k++) {
    const x = rx(), y = ry(); const pc = parcelAt(x, y);
    const dr = Math.abs(x - roadX(y)) - roadHalf(y);
    const ok = pc === 'meadow' || pc === 'orchard' || pc === 'south' || (dr > -1 && dr < 6) || y < WY1 + 20 || Math.abs(y - HEDGE_Y) < 5;
    if (!ok || pc === 'creek' || r() < 0.25) continue;
    for (let j = 0; j < 3; j++) seg(gcols[(r() * 4) | 0], 0.4, x + j * 0.5, y, x + j * 0.5 + (r() - 0.5) * 1.6, y - (1.2 + r() * 1.6) / KY * 0.8);
  }
  flush();
  for (let k = 0, n = N(0.006); k < n; k++) {
    const x = rx(), y = ry(); const pc = parcelAt(x, y); if (pc !== 'meadow' && pc !== 'south' && pc !== 'orchard') continue;
    g.fillStyle = r() < 0.5 ? '#ece3c6' : r() < 0.5 ? '#c78fb8' : '#e2c24e'; g.beginPath(); g.arc(x, y * KY - 1.4, 0.45, 0, 6.28); g.fill();
  }
  // reeds along the creek
  for (let k = 0, n = N(0.05); k < n; k++) {
    const x = rx(); const cy = creekY(x); const side = r() < 0.5 ? -1 : 1; const y = cy + side * (CREEK_HW - 0.5 + r() * 2.5);
    if (!vis(x, y) || Math.abs(x - roadX(y)) < 10) continue;
    for (let j = 0; j < 4; j++) seg(r() < 0.5 ? 'rgba(92,104,48,0.95)' : 'rgba(140,130,70,0.95)', 0.45, x + j * 0.6, y, x + j * 0.6 + (r() - 0.3) * 1.4, y - (3 + r() * 3) / KY * 0.8);
  }
  flush();
  for (let k = 0, n = N(0.008); k < n; k++) { const x = rx(); const cy = creekY(x); const y = cy + (r() < 0.5 ? -1 : 1) * (CREEK_HW + r() * 2); if (!vis(x, y)) continue; g.fillStyle = '#5a3a24'; g.beginPath(); g.ellipse(x + 0.6, y * KY - 4.2, 0.4, 1.1, 0.2, 0, 6.28); g.fill(); } // bulrush heads
  // creek: dark lip on the north bank (the water lies lower), light lip on the south
  g.lineWidth = 0.9; g.strokeStyle = 'rgba(40,34,26,0.55)'; g.beginPath(); for (let x = vx0; x < vx1; x += 2) { const y = creekY(x) - CREEK_HW + 0.6; x === vx0 ? g.moveTo(x, y * KY) : g.lineTo(x, y * KY); } g.stroke();
  g.lineWidth = 0.5; g.strokeStyle = 'rgba(230,236,226,0.35)'; g.beginPath(); for (let x = vx0; x < vx1; x += 2) { const y = creekY(x) + CREEK_HW - 1.2; x === vx0 ? g.moveTo(x, y * KY) : g.lineTo(x, y * KY); } g.stroke();
  // plank bridge where the road crosses
  { const by = creekY(roadX(438)), bx = roadX(by); g.save(); g.translate(bx, by * KY);
    g.fillStyle = 'rgba(30,24,20,0.35)'; g.fillRect(-11, -CREEK_HW * KY + 1.5, 22, CREEK_HW * 2 * KY);
    for (let i = -10; i < 10; i += 2.2) { g.fillStyle = r() < 0.5 ? '#8a6440' : '#9c744a'; g.fillRect(-9.5, -CREEK_HW * KY - 1 + (i + 10) * 0.55, 19, 1.9); }
    g.fillStyle = '#5c3b23'; g.fillRect(-10.5, -CREEK_HW * KY - 4, 1.2, CREEK_HW * 2 * KY + 5); g.fillRect(9.3, -CREEK_HW * KY - 4, 1.2, CREEK_HW * 2 * KY + 5);
    g.fillStyle = '#6e4a2c'; g.fillRect(-10.6, -CREEK_HW * KY - 4.5, 1.4, 1); g.fillRect(9.2, -CREEK_HW * KY - 4.5, 1.4, 1); g.restore(); }
  // cart ruts on the road and the courtyard path
  g.lineWidth = 0.9;
  for (const off of [-5.5, 5.5]) { g.strokeStyle = 'rgba(86,64,42,0.42)'; g.beginPath(); for (let y = BAR_Y + 30; y < WH + 10; y += 4) { const x = roadX(y) + off + Math.sin(y * 0.2) * 0.4; y === BAR_Y + 30 ? g.moveTo(x, y * KY) : g.lineTo(x, y * KY); } g.stroke(); }
  // pebbles
  for (let k = 0, n = N(0.0026); k < n; k++) { const x = rx(), y = vy0 + r() * (vy1 - vy0); const pc = parcelAt(x, y); if (pc === 'creek' || pc === 'wheat') continue; const sy = y * KY; g.fillStyle = r() < 0.5 ? '#8f877a' : '#a49b8c'; g.beginPath(); g.ellipse(x, sy, 0.6 + r() * 0.8, 0.4 + r() * 0.4, 0, 0, 6.28); g.fill(); g.fillStyle = 'rgba(255,245,225,0.35)'; g.fillRect(x - 0.4, sy - 0.5, 0.6, 0.25); }
  // flagstones along the courtyard paths
  for (const P of COURT_PATHS) for (let i = 0; i < P.length - 1; i++) {
    const [ax, ay] = P[i], [bx, by] = P[i + 1], L = Math.hypot(bx - ax, by - ay);
    for (let s = 0; s < L; s += 4.2) for (const side of [-1, 1]) {
      if (r() < 0.25) continue;
      const t = s / L, x = lerp(ax, bx, t) + (-(by - ay) / L) * side * (1.5 + r() * 3), y = lerp(ay, by, t) + ((bx - ax) / L) * side * (1.5 + r() * 3);
      g.fillStyle = r() < 0.5 ? '#9d968a' : '#aaa396'; g.beginPath(); g.ellipse(x, y * KY, 1.6 + r() * 1.2, 1.1 + r() * 0.5, r(), 0, 6.28); g.fill();
      g.fillStyle = 'rgba(255,245,225,0.25)'; g.fillRect(x - 1, y * KY - 1, 1.4, 0.35);
    }
  }
  // straw scattered in the courtyard
  for (let k = 0; k < 900; k++) { const x = r() * WW, y = 40 + r() * 160; if (!vis(x, y)) continue; g.strokeStyle = r() < 0.5 ? 'rgba(206,176,110,0.7)' : 'rgba(150,120,70,0.5)'; g.lineWidth = 0.35; const sy = y * KY, a = r() * 3; g.beginPath(); g.moveTo(x, sy); g.lineTo(x + Math.cos(a) * 1.6, sy + Math.sin(a) * 0.8); g.stroke(); }
  // windfall apples and leaves under the orchard
  for (let k = 0; k < 700; k++) { const x = 700 + r() * 190, y = 300 + r() * 140; if (!vis(x, y) || parcelAt(x, y) !== 'orchard') continue; g.fillStyle = r() < 0.15 ? '#a8382a' : r() < 0.5 ? '#b3672b' : r() < 0.5 ? '#c8963c' : '#8a5a2a'; g.beginPath(); g.ellipse(x, y * KY, 0.8, 0.45, r() * 3, 0, 6.28); g.fill(); }
  // old boot prints in the gate approach
  for (let k = 0; k < 260; k++) { const y = BAR_Y + 10 + r() * 180, x = roadX(y) + (r() - 0.5) * 60; g.fillStyle = 'rgba(70,52,34,0.28)'; g.beginPath(); g.ellipse(x, y * KY, 0.7, 0.45, 0, 0, 6.28); g.fill(); }
  // contact shadow along the wall foot (ambient occlusion)
  const ao = g.createLinearGradient(0, (WY1 + 1) * KY, 0, (WY1 + 9) * KY); ao.addColorStop(0, 'rgba(30,24,20,0.5)'); ao.addColorStop(1, 'rgba(30,24,20,0)');
  g.fillStyle = ao; g.fillRect(-10, (WY1 + 1) * KY, WW + 20, 8 * KY);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

// ---------- hedgerows (props, y-sorted), willows, pavises ----------
function makeHedgeChunk(seed, vertical) {
  const rng = RNG(seed);
  const tones = ['#5f7034', '#6f7d3a', '#7d8840', '#566a30', '#8a7a36'];
  return propCanvas(9, 9, 12, 3, (g) => {
    g.fillStyle = '#3d4a24'; g.beginPath(); g.ellipse(0, -3.6, vertical ? 5.2 : 6.6, 4.2, 0, 0, 6.28); g.fill();
    const blobs = [];
    for (let k = 0; k < 9; k++) blobs.push([(rng() - 0.5) * (vertical ? 6 : 10), -2.5 - rng() * 5.5, 1.8 + rng() * 1.6]);
    blobs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, br] of blobs) {
      const lk = clamp((-x - (y + 4)) / 8, -1, 1);
      g.fillStyle = shade(tones[(rng() * tones.length) | 0], lk * 0.2 - 0.05); g.beginPath(); g.arc(x, y, br, 0, 6.28); g.fill();
      if (lk > 0.1) { g.fillStyle = 'rgba(255,236,190,0.16)'; g.beginPath(); g.arc(x - br * 0.3, y - br * 0.35, br * 0.5, 0, 6.28); g.fill(); }
    }
    if (rng() < 0.4) for (let k = 0; k < 4; k++) { g.fillStyle = rng() < 0.5 ? '#a8382a' : '#e6dcc4'; g.beginPath(); g.arc((rng() - 0.5) * 8, -3 - rng() * 5, 0.45, 0, 6.28); g.fill(); } // hips and haws, bramble flowers
  });
}
function makeWillow(seed) {
  const rng = RNG(seed);
  const r = 15, trunkH = 9;
  const trunk = propCanvas(5, 5, trunkH + 2, 2, (g) => { g.strokeStyle = '#4a3a2a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-1.5, -trunkH * 0.6, 0.5, -trunkH); g.stroke(); });
  const can = propCanvas(r * 1.4, r * 1.4, r * 2 + 4, trunkH + 2, (g) => {
    g.fillStyle = '#4c5a34'; g.beginPath(); g.ellipse(0, -r, r * 1.05, r * 0.8, 0, 0, 6.28); g.fill();
    // falling curtains of thin leaves
    for (let k = 0; k < 120; k++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r * 0.95, x = Math.cos(a) * d * 1.1, y = -r - Math.sin(a) * d * 0.7 - 2;
      const lk = clamp((-x - (y + r)) / (r * 1.4), -1, 1), len = 4 + rng() * 9;
      g.strokeStyle = shade(rng() < 0.5 ? '#8c9a5a' : '#a3ad6c', lk * 0.25 - 0.08); g.lineWidth = 0.7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 1.2, y + len * 0.5, x + 0.6, y + len); g.stroke();
    }
  });
  return { trunk, can, r, trunkH };
}
function makePavise(seed) {
  // the Concord's tall standing shields: ivory and crimson, the sun-wheel painted on
  const rng = RNG(seed);
  return propCanvas(5, 5, 14, 2, (g) => {
    g.strokeStyle = '#4a3220'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(1.2, 0); g.lineTo(2.8, -5); g.stroke(); // prop stick behind
    g.fillStyle = '#e6dcc4'; g.beginPath(); g.moveTo(-3.2, 0); g.lineTo(-3.4, -10.5); g.quadraticCurveTo(0, -12.4, 3.4, -10.5); g.lineTo(3.2, 0); g.closePath(); g.fill();
    g.fillStyle = '#a12f2b'; g.fillRect(-3.3, -10.6 + rng() * 0.2, 1.6, 10.6); g.fillRect(1.7, -10.6, 1.6, 10.6);
    paintCharge(g, 'sun', 0, -5.6, 0.75, '#a12f2b');
    g.fillStyle = 'rgba(30,18,14,0.28)'; g.fillRect(0.6, -11, 2.8, 11);
    g.strokeStyle = '#2a1a12'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(-3.2, 0); g.lineTo(-3.4, -10.5); g.quadraticCurveTo(0, -12.4, 3.4, -10.5); g.lineTo(3.2, 0); g.closePath(); g.stroke();
    for (let k = 0; k < 2; k++) { g.strokeStyle = '#ece4cf'; g.lineWidth = 0.35; const x = (rng() - 0.5) * 4, y = -3 - rng() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 0.8, y - 2.4); g.stroke(); } // arrows already stuck in it
  });
}
Battle.prototype.buildLand = function () {
  const B = this;
  // hedgerows: chunks along the lines; gaps where the road and the siege tower went through
  const vH = [], vV = [];
  for (let i = 0; i < 6; i++) { vH.push(makeHedgeChunk(500 + i, false)); vV.push(makeHedgeChunk(600 + i, true)); }
  const r = RNG(515);
  // the long east-west hedge sits on one line, so it is baked into one strip (one draw, one sort key)
  const chunks = [];
  for (let x = -4; x < WW + 6; x += 8.5 + r() * 2) { const rx = roadX(HEDGE_Y); if (Math.abs(x - rx) < 30 || Math.abs(x - 664) < 26) continue; chunks.push([x + (r() - 0.5) * 2, (r() - 0.5) * 2, vH[(r() * 6) | 0]]); }
  const strip = propCanvas(10, WW + 10, 13, 4, (h) => { h.setTransform(1, 0, 0, 1, 0, 0); for (const [x, dy, sp] of chunks) h.drawImage(sp.c, Math.round((x + 10) * CAM.PX - sp.ax), Math.round((13 + dy * KY) * CAM.PX - sp.ay)); });
  B.props.push({ x: 0, y: HEDGE_Y, sp: strip, kind: 'hedgeH' });
  // hedge shadows are baked into the ground (they are low; their length barely reads)
  { const gg = B.ground.getContext('2d'); gg.fillStyle = 'rgba(38,26,34,0.24)'; gg.beginPath(); const PX = CAM.PX;
    for (const [x] of chunks) { const sx = SX(x + 6), sy = SY(HEDGE_Y) - 3.5 * PX; gg.moveTo(sx + 7 * PX, sy); gg.ellipse(sx, sy, 7 * PX, 3 * PX, 0, 0, 6.28); }
    gg.fill(); B._hedgeShadow = gg; }
  for (const hx of [HEDGE_XW, HEDGE_XE]) for (let y = HEDGE_Y + 6; y < creekY(hx) - CREEK_HW - 4; y += 6 + r() * 1.5) {
    if (hx === HEDGE_XW && Math.abs(y - 372) < 9) continue; // a stile
    B.props.push({ x: hx + (r() - 0.5) * 2, y, sp: vV[(r() * 6) | 0], kind: 'hedge' });
    { const gg = B.ground.getContext('2d'), PX = CAM.PX; gg.fillStyle = 'rgba(38,26,34,0.22)'; gg.beginPath(); gg.ellipse(SX(hx + 6), SY(y) - 3 * PX, 6 * PX, 2.6 * PX, 0, 0, 6.28); gg.fill(); }
  }
  // the Concord archers' pavise line, planted in the stubble
  for (let x = 128; x < 344; x += 14 + r() * 4) B.props.push({ x, y: 377 + (r() - 0.5) * 3, sp: makePavise(700 + x), kind: 'pavise' });
  // the wheat parcel outline (device px) for the wind sheen
  const P = new Path2D();
  const pts = [];
  for (let y = HEDGE_Y + 4; y < 430; y += 6) pts.push([roadX(y) + roadHalf(y) + 3, y]);
  for (let x = pts[pts.length - 1][0]; x < HEDGE_XE - 4; x += 8) pts.push([x, creekY(x) - CREEK_HW - 3]);
  pts.push([HEDGE_XE - 5, HEDGE_Y + 4]);
  pts.forEach(([x, y], i) => (i ? P.lineTo(SX(x), SY(y)) : P.moveTo(SX(x), SY(y))));
  P.closePath(); B.wheatPath = P;
  // a soft sheen sprite for gusts over the standing crop
  const s = 64, c = mkCanvas(s, s), g = c.getContext('2d'); const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,236,170,1)'); gr.addColorStop(1, 'rgba(255,236,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); B.tex.sheen = c;
  B.glints = []; const gr2 = RNG(616); for (let k = 0; k < 70; k++) B.glints.push({ s: gr2() * WW, o: (gr2() - 0.5) * 8, l: 1.5 + gr2() * 3, v: 9 + gr2() * 8, ph: gr2() * 6 });
};
Battle.prototype.drawLandFx = function (g) {
  const t = this.t, PX = CAM.PX, M = this.mood;
  // gusts rolling over the standing wheat
  g.save(); g.clip(this.wheatPath); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) {
    const x = 380 + ((t * (M.wind * 2.2) + k * 140) % 420), y = 330 + k * 34 + Math.sin(t * 0.7 + k) * 10;
    const w = 90 * PX, h = 26 * PX; g.globalAlpha = 0.085; g.drawImage(this.tex.sheen, SX(x) - w / 2, SY(y) - h / 2, w, h);
  }
  g.restore();
  // the creek flows east: short light glints drifting on the surface
  g.strokeStyle = 'rgba(214,226,232,0.55)'; g.lineWidth = 0.5 * PX; g.beginPath();
  for (const gl of this.glints) {
    const x = (gl.s + t * gl.v) % WW, y = creekY(x) + gl.o * (CREEK_HW - 2) / 4;
    if (Math.sin(t * 2 + gl.ph) < -0.3) continue;
    g.moveTo(SX(x), SY(y)); g.lineTo(SX(x + gl.l), SY(y));
  }
  g.stroke();
};
