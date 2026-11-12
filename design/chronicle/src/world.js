const WALLSTONE = mix(P.stone, P.stoneMid, 0.32);
// ============================================================================
// world: the printed page. Ground (paper + snow + road + courtyard + baked shadows)
// and structure sprites (wall rows, towers, gate states), all at device scale.
// ============================================================================
const PR = (x, y, z) => [x + HX * z, y - HY * z]; // project

// ---------- ground ----------
function bakeGround(R, S) {
  const c = mkCanvas(R.w * S, R.h * S);
  const g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, -R.x * S, -R.y * S);
  const x0 = R.x, y0 = R.y, x1 = R.x + R.w, y1 = R.y + R.h;

  // 1. base paper/snow with soft low-frequency mottling (computed at 1/4 res, smoothed up)
  const nW = Math.ceil(R.w / 4), nH = Math.ceil(R.h / 4);
  const nc = mkCanvas(nW, nH), ng = nc.getContext('2d');
  const id = ng.createImageData(nW, nH);
  const base = [parseInt(P.snow.slice(1, 3), 16), parseInt(P.snow.slice(3, 5), 16), parseInt(P.snow.slice(5, 7), 16)];
  const court = [206, 200, 189];
  for (let j = 0; j < nH; j++) for (let i = 0; i < nW; i++) {
    const wx = x0 + i * 4, wy = y0 + j * 4;
    const n = fbm(wx / 70, wy / 55, 3, 4), m = fbm(wx / 18, wy / 14, 9, 3);
    const inside = wx > WX + WW;
    const b = inside ? court : base;
    const k = (n - 0.5) * 26 + (m - 0.5) * 9;
    const o = (j * nW + i) * 4;
    id.data[o] = b[0] + k; id.data[o + 1] = b[1] + k; id.data[o + 2] = b[2] + k * 0.8; id.data[o + 3] = 255;
  }
  ng.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(nc, x0, y0, nW * 4, nH * 4);

  const rr = RNG(911);
  // 2. wind-cut snow: woodcut gouges (sparse, clustered by noise) in the field
  g.lineCap = 'round';
  for (let i = 0; i < 1400; i++) {
    const x = rr.range(x0, Math.min(x1, WX - 4)), y = rr.range(y0, y1);
    const n = fbm(x / 60, y / 40, 21, 3);
    if (n < 0.5 || rr() > (n - 0.45) * 2.2) continue;
    const L = 3 + rr() * 9 * n, a = -0.22 + (rr() - 0.5) * 0.12;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L * 0.5, y + Math.sin(a) * L * 0.5 - 0.6, x + L, y + Math.sin(a) * L);
    g.strokeStyle = hexA(P.wash1, 0.16 + 0.14 * rr()); g.lineWidth = 0.35 + rr() * 0.35; g.stroke();
    g.beginPath(); g.moveTo(x + 0.4, y - 0.7); g.lineTo(x + L * 0.8, y - 0.7 + Math.sin(a) * L * 0.8);
    g.strokeStyle = hexA(P.paperHi, 0.5); g.lineWidth = 0.6; g.stroke();
  }

  // 2b. a frozen creek crossing the field (ice plates, ink cracks, reeds on the banks)
  const creek = []; for (let i = 0; i <= 30; i++) { const t = i / 30; creek.push([400 - t * 210 + Math.sin(t * 7) * 14, -12 + t * 460]); }
  brush(g, creek, () => 30, '#9EA6AE', 0.55);
  brush(g, creek, () => 22, '#C7CDD1', 0.9);
  for (let i = 0; i < 46; i++) { const k = rr.int(1, 29), p = creek[k], q = creek[k + 1]; const ox = rr.range(-8, 8); g.beginPath(); wobLine(g, p[0] + ox, p[1], q[0] + ox + rr.range(-4, 4), q[1], 1.2, i); g.strokeStyle = hexA(P.ink, 0.45); g.lineWidth = 0.35 + rr() * 0.3; g.stroke(); }
  for (let i = 0; i < 28; i++) { const k = rr.int(0, 29), p = creek[k]; inkBlob(g, p[0] + rr.range(-7, 7), p[1] + rr.range(-6, 6), 2 + rr() * 4, 600 + i, P.paperHi, 0.85, 0.5); }
  for (const side of [-1, 1]) { g.beginPath(); creek.forEach(([x, y], i) => { const xx = x + side * (14 + hash2(side + 5, i) * 2); i ? g.lineTo(xx, y) : g.moveTo(xx, y); }); g.strokeStyle = hexA(P.ink, 0.55); g.lineWidth = 0.8; g.stroke(); }
  for (let i = 0; i < 36; i++) { const k = rr.int(0, 30), p = creek[k], side = rr() < 0.5 ? -1 : 1; const bx = p[0] + side * rr.range(14, 20), by = p[1] + rr.range(-4, 4); for (let j = 0; j < 5; j++) { const L = rr.range(4, 8), a2 = -1.57 + rr.range(-0.4, 0.4); brush(g, qpts(bx + j * 0.7, by, bx + j * 0.7 + Math.cos(a2) * L * 0.5 + 0.7, by + Math.sin(a2) * L * 0.5, bx + j * 0.7 + Math.cos(a2) * L + 1.3, by + Math.sin(a2) * L), nib(0.55), P.ink2, 0.8); } }
  // paper fibres (world-fixed): the page is felt even under the snow
  for (let i = 0; i < (R.w * R.h) / 22; i++) { const x = rr.range(x0, x1), y = rr.range(y0, y1), a2 = rr() * 3.14, L = 0.8 + rr() * 2.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a2) * L * 0.5 + 0.3, y + Math.sin(a2) * L * 0.5, x + Math.cos(a2) * L, y + Math.sin(a2) * L); g.strokeStyle = rr() < 0.55 ? 'rgba(110,92,64,0.09)' : 'rgba(255,252,244,0.35)'; g.lineWidth = 0.22 + rr() * 0.2; g.stroke(); }
  // 3. road: trampled slush from the west edge to the gate, with ruts
  const road = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; const x = x0 - 10 + (WX - (x0 - 10)) * t; road.push([x, GYC + Math.sin(t * 5.2 + 1) * 10 * (1 - t) + (fbm(t * 4, 2, 5, 2) - 0.5) * 10 * (1 - t)]); }
  for (let pass = 0; pass < 9; pass++) {
    const off = (pass - 4) * 2.6, w = 3 + rr() * 4;
    brush(g, road.map(([x, y], i) => [x, y + off + (hash2(pass, i) - 0.5) * 2]), () => w, pass % 3 ? P.wash2 : P.wash1, 0.09 + 0.05 * rr());
  }
  for (const off of [-4.5, 4.5]) {
    g.beginPath(); road.forEach(([x, y], i) => { const yy = y + off + (hash2(77 + off, i) - 0.5) * 0.8; i ? g.lineTo(x, yy) : g.moveTo(x, yy); });
    g.strokeStyle = hexA(P.ink2, 0.35); g.lineWidth = 0.9; g.stroke();
  }
  // footprints along the road (older traffic)
  for (let i = 0; i < 700; i++) {
    const t = rr(), k = Math.min(39, Math.floor(t * 40)), p = road[k];
    const x = p[0] + rr.range(-2, 2), y = p[1] + rr.range(-12, 12);
    g.fillStyle = hexA(P.ink2, 0.12 + rr() * 0.12); g.beginPath(); g.ellipse(x, y, 0.9, 0.45, -0.2, 0, 7); g.fill();
  }

  // 4. courtyard: packed snow, flagstones near the gate (running bond, no grid), mud lanes
  g.save();
  g.beginPath(); g.rect(WX + WW, y0, x1 - WX - WW, R.h); g.clip();
  const fs = RNG(5);
  // a cobble apron just inside the gate (small irregular setts, half buried in snow)
  for (let i = 0; i < 520; i++) {
    const ang = fs.range(-1.25, 1.25), d = Math.sqrt(fs()) * 58;
    const x = WX + WW + 2 + Math.cos(ang) * d * 1.15, y = GYC + Math.sin(ang) * d * 0.95;
    const cov = fbm(x / 14, y / 14, 33, 3);
    if (cov > 0.6 - (1 - d / 58) * 0.25) continue;
    const r0 = 1.3 + fs() * 1.1, rot0 = fs() * 0.6 - 0.3;
    g.globalAlpha = 0.85 - d / 110;
    g.beginPath(); g.ellipse(x, y, r0, r0 * 0.68, rot0, 0, 7); g.fillStyle = mix(P.stone, P.stoneMid, 0.3 + fs() * 0.6); g.fill();
    g.beginPath(); g.ellipse(x, y, r0, r0 * 0.68, rot0, -0.2, 2.2); g.strokeStyle = P.ink2; g.lineWidth = 0.45; g.stroke();
    g.beginPath(); g.ellipse(x - r0 * 0.2, y - r0 * 0.15, r0 * 0.55, r0 * 0.3, rot0, 3.3, 4.6); g.strokeStyle = P.paperHi; g.lineWidth = 0.4; g.stroke();
    g.globalAlpha = 1;
  }
  // mud lanes from the gate into the courtyard (carts, boots)
  for (let pass = 0; pass < 6; pass++) {
    const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([WX + WW + t * 330, GYC + Math.sin(t * 3 + pass) * 6 + (pass - 3) * 3 - t * t * 70 * (pass % 2 ? 1 : -0.6)]); }
    brush(g, pts, () => 4 + pass, P.wash1, 0.07);
  }
  // trampled paths: gate→keep door, well→infirmary, depot→north stair, gate→infirmary (stretchers)
  const MUD = '#7A6A52';
  const trail = (pts, w, seed) => {
    const P2 = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 10; k++) { const t = k / 10; P2.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]); } P2.push(pts[pts.length - 1]);
    for (let pass = 0; pass < 5; pass++) brush(g, P2.map(([x, y], i) => [x, y + (hash2(seed + pass, i) - 0.5) * 2.2 + (pass - 2) * w * 0.18]), (u) => w * (0.55 + 0.45 * Math.sin(Math.PI * u)), MUD, 0.07);
    for (let i = 0; i < 90; i++) { const k = Math.floor(fs() * (P2.length - 1)), p = P2[k]; g.fillStyle = hexA(P.ink2, 0.1 + fs() * 0.12); g.beginPath(); g.ellipse(p[0] + fs.range(-w * 0.5, w * 0.5), p[1] + fs.range(-w * 0.4, w * 0.4), 0.8, 0.4, -0.2, 0, 7); g.fill(); }
  };
  trail([[WX + WW + 4, GYC], [640, GYC + 4], [760, 214], [846, 216]], 12, 101);
  trail([[762, 246], [776, 282], [788, 314]], 6, 102);
  trail([[724, 140], [640, 132], [556, 124]], 6, 103);
  trail([[600, GYC + 20], [668, 262], [718, 292], [774, 330]], 7, 104);
  // a frozen puddle by the well, catching the last light
  { const x = 742, y = 262; g.beginPath(); g.ellipse(x, y, 9, 3, -0.1, 0, 7); g.fillStyle = '#C9D3DC'; g.fill(); g.strokeStyle = hexA(P.ink2, 0.6); g.lineWidth = 0.5; g.stroke(); g.beginPath(); g.moveTo(x - 5, y - 1); g.lineTo(x + 2, y - 1.6); g.strokeStyle = P.paperHi; g.lineWidth = 0.6; g.stroke(); }
  // straw
  for (let i = 0; i < 420; i++) {
    const x = fs.range(WX + WW + 10, 900), y = fs.range(60, 400), a = fs() * 3.14;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4); g.strokeStyle = hexA(P.gold, 0.35); g.lineWidth = 0.35; g.stroke();
  }
  g.restore();

  // 5. dead reeds and grass tufts in the field (brush flicks), pines at the margins
  for (let i = 0; i < 60; i++) {
    const x = rr.range(x0 + 10, WX - 60), y = rr.range(y0 + 10, y1 - 10);
    if (Math.abs(y - GYC) < 26) continue;
    const n = rr.int(4, 9);
    for (let j = 0; j < n; j++) {
      const bx = x + rr.range(-3, 3), by = y + rr.range(-1, 1), L = rr.range(4, 9), a = -Math.PI / 2 + rr.range(-0.5, 0.4) + 0.15;
      brush(g, qpts(bx, by, bx + Math.cos(a) * L * 0.5 + 0.8, by + Math.sin(a) * L * 0.5, bx + Math.cos(a) * L + 1.6, by + Math.sin(a) * L), nib(0.6), P.ink2, 0.75);
    }
    g.fillStyle = hexA(P.ink, 0.1); g.beginPath(); g.ellipse(x + 3, y + 0.5, 5, 1.2, -0.25, 0, 7); g.fill();
  }
  const forest = [];
  for (let i = 0; i < 70; i++) { const t = rr(); const x = rr.range(-10, 250) * (0.4 + 0.6 * t), y = rr.range(-6, 30 + 70 * (1 - x / 250)); forest.push([x, y, 0.75 + rr() * 0.6]); }
  for (let i = 0; i < 55; i++) { const x = rr.range(-10, 230), y = 440 - rr.range(0, 36 + 60 * (1 - x / 230)); forest.push([x, y, 0.7 + rr() * 0.6]); }
  for (let i = 0; i < 6; i++) forest.push([rr.range(120, 330), rr.range(60, 380), 0.6 + rr() * 0.3]);
  forest.sort((a2, b2) => a2[1] - b2[1]);
  for (const [tx, ty, sc] of forest) pine(g, tx, ty, sc, rr);
  // a few stones
  for (let i = 0; i < 14; i++) {
    const x = rr.range(x0 + 20, WX - 30), y = rr.range(y0, y1); if (Math.abs(y - GYC) < 24) continue;
    const r = rr.range(1.5, 3.2);
    g.fillStyle = hexA(P.ink, 0.12); g.beginPath(); g.ellipse(x + r * 1.4, y + 0.3, r * 1.6, r * 0.5, -0.25, 0, 7); g.fill();
    inkBlob(g, x, y, r, 300 + i, P.stoneMid, 1, 0.7);
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 7); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
    g.beginPath(); g.arc(x - r * 0.2, y - r * 0.15, r * 0.6, 3.4, 4.6); g.strokeStyle = P.paperHi; g.lineWidth = 0.5; g.stroke();
  }

  // 6. baked structure shadows (sun low in the WSW: shadows run east, slightly north)
  const shadowPoly = (xa, ya, xb, yb, h) => { // footprint rect → swept shadow polygon
    const dx = SUN.dx * h, dy = SUN.dy * h;
    return [[xb, ya], [xb + dx, ya + dy], [xb + dx, yb + dy], [xb, yb]];
  };
  const shades = [];
  for (const [a, b] of WALLSEG) shades.push(shadowPoly(WX, a, WX + WW, b, WH + 4));
  for (const T of TOWERS) shades.push(shadowPoly(T.x0, T.y0, T.x1, T.y1, T.h + (T.roof ? 12 : 4)));
  for (const B of WARD) shades.push(shadowPoly(B.x0, B.y0, B.x1, B.y1, B.h + (B.roof || 0) * 0.6));
  g.save();
  g.beginPath(); for (const s of shades) { g.moveTo(s[0][0], s[0][1]); for (let i = 1; i < 4; i++) g.lineTo(s[i][0], s[i][1]); g.closePath(); }
  g.clip();
  g.fillStyle = hexA('#2E3550', 0.3); g.fillRect(WX, y0, x1 - WX, R.h);
  hatch(g, WX, y0, x1, y1, 1.05, 1.7, 0.42, P.ink, 0.42, 41);
  g.restore();

  // 7. courtyard props (static, low; their shadows too)
  props(g, rr);
  return c;
}

function pine(g, x, y, s, rr) {
  // woodcut pine: stacked tiers of ink, carved light lines on the west, snow on the tiers
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = hexA(P.ink, 0.16); g.beginPath(); g.ellipse(16, 1, 18, 3.2, -0.25, 0, 7); g.fill();
  g.fillStyle = P.ink; g.fillRect(-0.8, -4, 1.6, 4.5);
  for (let i = 0; i < 4; i++) {
    const ty = -4 - i * 6.2, w = 9 - i * 1.8, h = 9;
    g.beginPath(); g.moveTo(-w, ty); g.lineTo(0, ty - h); g.lineTo(w, ty); g.quadraticCurveTo(0, ty + 1.8, -w, ty); g.closePath(); g.fillStyle = P.ink; g.fill();
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-w * 0.75 + k * 1.4, ty - 0.8); g.lineTo(-1 + k * 0.4, ty - h * 0.75); g.strokeStyle = hexA(P.paperHi, 0.55); g.lineWidth = 0.45; g.stroke(); }
    g.beginPath(); g.moveTo(-w * 0.95, ty - 0.3); g.quadraticCurveTo(-w * 0.4, ty - 2.6, 0.5, ty - h + 1.4); g.lineTo(-w * 0.2, ty - 1.2); g.closePath(); g.fillStyle = P.paperHi; g.fill();
  }
  g.restore();
}

function props(g, rr) {
  const crate = (x, y, w, h, d) => {
    const top = [[x, y - d], [x + w, y - d], [x + w + HX * d * 0.6, y - d - HY * d * 0.6], [x + HX * d * 0.6, y - d - HY * d * 0.6]];
    g.fillStyle = hexA(P.ink, 0.18); g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w + SUN.dx * d, y + SUN.dy * d); g.lineTo(x + w + SUN.dx * d, y - h + SUN.dy * d); g.lineTo(x + w, y - h); g.fill();
    g.fillStyle = P.woodHi; g.fillRect(x, y - d, w, d); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.strokeRect(x, y - d, w, d);
    g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + w, y); g.moveTo(x + w, y - d); g.lineTo(x, y); g.strokeStyle = hexA(P.ink, 0.5); g.lineWidth = 0.4; g.stroke();
    poly(g, top); g.fillStyle = P.paperHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
  };
  const barrel = (x, y) => {
    g.fillStyle = hexA(P.ink, 0.18); g.beginPath(); g.ellipse(x + 6, y - 1, 6, 2, -0.25, 0, 7); g.fill();
    g.fillStyle = P.wood; g.beginPath(); g.roundRect(x - 2.6, y - 7, 5.2, 7, 1.2); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke();
    g.beginPath(); g.moveTo(x - 2.6, y - 5); g.lineTo(x + 2.6, y - 5); g.moveTo(x - 2.6, y - 2); g.lineTo(x + 2.6, y - 2); g.strokeStyle = P.ink; g.lineWidth = 0.45; g.stroke();
    g.beginPath(); g.ellipse(x, y - 7, 2.6, 1.0, 0, 0, 7); g.fillStyle = P.paperHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.45; g.stroke();
    g.beginPath(); g.moveTo(x - 1.8, y - 6); g.lineTo(x - 1.8, y - 1); g.strokeStyle = hexA(P.paperHi, 0.6); g.lineWidth = 0.5; g.stroke();
  };
  // depot: crates, barrels, arrow sheaves
  crate(705, 120, 9, 9, 6); crate(716, 124, 8, 8, 6); crate(708, 110, 8, 8, 5);
  for (const [x, y] of [[730, 118], [736, 122], [731, 127], [742, 114], [699, 132]]) barrel(x, y);
  for (let i = 0; i < 5; i++) { const x = 752 + i * 3.2, y = 128 - i * 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.2, y - 8); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke(); g.fillStyle = P.paperHi; g.fillRect(x + 0.6, y - 9.2, 1.4, 1.6); }
  // well
  { const x = 760, y = 236; g.fillStyle = hexA(P.ink, 0.2); g.beginPath(); g.ellipse(x + 9, y - 2, 10, 4, -0.25, 0, 7); g.fill();
    g.fillStyle = P.stone; g.beginPath(); g.ellipse(x, y - 3, 7, 4, 0, 0, 7); g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
    g.fillStyle = P.ink; g.beginPath(); g.ellipse(x + 0.6, y - 3.6, 4.6, 2.4, 0, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - 6, y - 3); g.lineTo(x - 5, y - 15); g.moveTo(x + 6, y - 3); g.lineTo(x + 7, y - 15); g.moveTo(x - 6, y - 14); g.lineTo(x + 8, y - 14.5); g.strokeStyle = P.ink; g.lineWidth = 0.9; g.stroke(); }
  // infirmary tent (canvas, indigo stripe, herb-leaf sign, not a cross)
  { const x = 800, y = 318; g.fillStyle = hexA(P.ink, 0.2); g.beginPath(); g.moveTo(x + 18, y); g.lineTo(x + 50, y - 12); g.lineTo(x + 26, y - 26); g.lineTo(x - 2, y - 8); g.fill();
    poly(g, [[x - 18, y], [x - 4, y - 24], [x + 12, y - 24], [x + 22, y]]); g.fillStyle = P.paperHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
    poly(g, [[x + 4, y], [x + 12, y - 24], [x + 22, y]]); g.fillStyle = P.paperLo; g.fill(); g.stroke();
    hatch(g, x + 6, y - 24, x + 22, y, 1.2, 1.4, 0.3, P.ink, 0.3, 8);
    g.beginPath(); g.moveTo(x - 11, y - 12); g.lineTo(x + 5, y - 12); g.strokeStyle = P.indigo; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(x - 3, y - 1); g.lineTo(x + 2, y - 12); g.lineTo(x + 5, y - 1); g.closePath(); g.fillStyle = P.ink; g.fill();
    g.fillStyle = P.indigo; g.beginPath(); g.ellipse(x - 8, y - 18, 1.5, 2.6, 0.5, 0, 7); g.fill();
    // stretchers
    for (const [sx, sy] of [[778, 334], [790, 342]]) { g.fillStyle = hexA(P.ink, 0.15); g.fillRect(sx + 3, sy - 1, 14, 3); g.fillStyle = P.paperLo; g.fillRect(sx, sy - 3, 13, 3.2); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.strokeRect(sx, sy - 3, 13, 3.2); g.fillStyle = P.indigoLo; g.fillRect(sx + 3, sy - 3.6, 6, 2.6); }
  }
  // cart with hay
  { const x = 640, y = 352; g.fillStyle = hexA(P.ink, 0.18); g.beginPath(); g.ellipse(x + 16, y - 2, 18, 4, -0.25, 0, 7); g.fill();
    g.fillStyle = P.wood; g.fillRect(x - 12, y - 9, 22, 5); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.strokeRect(x - 12, y - 9, 22, 5);
    inkBlob(g, x - 1, y - 12, 8, 51, P.goldHi, 1, 0.55);
    for (let i = 0; i < 18; i++) { const a = rr() * 3.14 + 3.14, r = rr() * 7; g.beginPath(); g.moveTo(x - 1 + Math.cos(a) * r, y - 12 + Math.sin(a) * r * 0.5); g.lineTo(x - 1 + Math.cos(a) * r + 1.6, y - 12 + Math.sin(a) * r * 0.5 - 0.4); g.strokeStyle = hexA(P.goldLo, 0.8); g.lineWidth = 0.35; g.stroke(); }
    for (const wx of [-8, 6]) { g.beginPath(); g.arc(x + wx, y - 3, 3, 0, 7); g.fillStyle = P.woodLo; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke(); }
    g.beginPath(); g.moveTo(x + 10, y - 7); g.lineTo(x + 22, y - 4); g.strokeStyle = P.ink; g.lineWidth = 0.9; g.stroke(); }
  // woodpile + braziers stones near the inner gate
  for (let i = 0; i < 7; i++) { const x = 600 + (i % 4) * 3.4 + (i > 3 ? 1.7 : 0), y = 300 - (i > 3 ? 3 : 0); g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fillStyle = P.woodHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke(); g.beginPath(); g.arc(x, y, 0.6, 0, 7); g.stroke(); }

}

// ---------- structures: wall rows, towers, gate (sprites with world anchors) ----------
function structSprite(S, wx0, wy0, ww, wh, drawFn) {
  const c = mkCanvas(ww * S, wh * S), g = c.getContext('2d');
  g.setTransform(S, 0, 0, S, -wx0 * S, -wy0 * S);
  g.lineJoin = 'round'; g.lineCap = 'round';
  drawFn(g);
  return { img: c, x: wx0, y: wy0, w: ww, h: wh };
}

function faceStones(g, xa, ya, yb, z0, z1, lit, seed) {
  // west-facing face: courses at fixed z (vertical on screen), joints diagonal
  const pts = [PR(xa, ya, z0), PR(xa, yb, z0), PR(xa, yb, z1), PR(xa, ya, z1)];
  poly(g, pts); g.fillStyle = lit; g.fill();
  g.save(); poly(g, pts); g.clip();
  let row = 0;
  for (let z = z0; z < z1; z += 4.2, row++) {
    const zz = Math.min(z1, z + 4.2);
    // tinted stones
    let y = ya - ((row * 5.3) % 7);
    while (y < yb) {
      const L = 5 + hash2(seed + row, Math.floor(y)) * 6;
      const t = hash2(seed - row, Math.floor(y) + 3);
      if (t > 0.62) { poly(g, [PR(xa, y, z), PR(xa, y + L, z), PR(xa, y + L, zz), PR(xa, y, zz)]); g.fillStyle = hexA(t > 0.85 ? P.stoneLo : P.stoneMid, 0.45); g.fill(); }
      const a = PR(xa, y, z), b = PR(xa, y, zz);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = hexA(P.ink, 0.55); g.lineWidth = 0.45; g.stroke();
      y += L;
    }
    const a = PR(xa, ya, z), b = PR(xa, yb, z);
    g.beginPath(); wobLine(g, a[0], a[1], b[0], b[1], 0.25, seed + row); g.strokeStyle = hexA(P.ink, 0.6); g.lineWidth = 0.5; g.stroke();
  }
  // grime + snow at the foot
  const gA = PR(xa, ya, 0), gB = PR(xa, yb, 0);
  g.fillStyle = hexA(P.ink, 0.12); poly(g, [gA, gB, PR(xa, yb, 7), PR(xa, ya, 7)]); g.fill();
  g.restore();
}
function shadeFaceS(g, xa, xb, y, z0, z1) { // south face (in shade): hatched
  const pts = [PR(xa, y, z0), PR(xb, y, z0), PR(xb, y, z1), PR(xa, y, z1)];
  poly(g, pts); g.fillStyle = P.stoneLo; g.fill();
  g.save(); poly(g, pts); g.clip(); const bb = [Math.min(pts[0][0], pts[3][0]) - 2, pts[3][1] - 2, Math.max(pts[1][0], pts[2][0]) + 2, pts[0][1] + 2];
  hatch(g, bb[0], bb[1], bb[2], bb[3], 0.95, 1.25, 0.42, P.ink, 0.7, Math.floor(xa + y)); g.restore();
  poly(g, pts); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
}
function topFace(g, xa, xb, ya, yb, z, col, snowSeed) {
  const pts = [PR(xa, ya, z), PR(xb, ya, z), PR(xb, yb, z), PR(xa, yb, z)];
  poly(g, pts); g.fillStyle = col; g.fill();
  if (snowSeed) { g.save(); poly(g, pts); g.clip(); for (let y = ya; y < yb; y += 3) { const s = hash2(snowSeed, Math.floor(y)); if (s > 0.45) { const p = PR(xa + s * (xb - xa) * 0.6, y, z); inkBlob(g, p[0] + 2, p[1], 1.6 + s * 2, snowSeed + y, P.paperHi, 0.9, 0.6); } } g.restore(); }
  poly(g, pts); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
}
function merlon(g, x, ya, yb, z, h, d) {
  // west face lit, top with a snow cap, south face shaded
  const xa = x, xb = x + d;
  faceStonesSimple(g, xa, ya, yb, z, z + h);
  shadeFaceS(g, xa, xb, yb, z, z + h);
  const t = [PR(xa, ya, z + h), PR(xb, ya, z + h), PR(xb, yb, z + h), PR(xa, yb, z + h)];
  poly(g, t); g.fillStyle = P.paperHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke();
}
function faceStonesSimple(g, xa, ya, yb, z0, z1) {
  const pts = [PR(xa, ya, z0), PR(xa, yb, z0), PR(xa, yb, z1), PR(xa, ya, z1)];
  poly(g, pts); g.fillStyle = P.stone; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke();
}

function wallRow(S, ya, yb, seg, idx) {
  const zTop = WH, pad = 3;
  const x0 = WX - pad, y0 = ya - HY * (WH + 7) - pad;
  const w = WW + HX * (WH + 7) + pad * 2 + 2, h = yb - ya + HY * (WH + 7) + pad * 2;
  return structSprite(S, x0, y0, w, h, (g) => {
    // west face: a touch darker than the snow, stained by melt-water, with a corbel band under the parapet
    faceStones(g, WX, ya, yb, 0, zTop, WALLSTONE, 100 + idx);
    { const band = [PR(WX, ya, zTop - 3.2), PR(WX, yb, zTop - 3.2), PR(WX, yb, zTop), PR(WX, ya, zTop)]; poly(g, band); g.fillStyle = hexA(P.ink, 0.62); g.fill();
      for (let y = Math.ceil(ya / 3) * 3; y < yb - 0.5; y += 3) { const q = [PR(WX - 0.01, y, zTop - 2.6), PR(WX - 0.01, y + 1.4, zTop - 2.6), PR(WX - 0.01, y + 1.4, zTop - 0.4), PR(WX - 0.01, y, zTop - 0.4)]; poly(g, q); g.fillStyle = P.stoneMid; g.fill(); }
      for (let y = ya + 1; y < yb; y += 2.3) { const k = hash2(idx * 7, Math.floor(y * 3)); if (k < 0.55) continue; const p0 = PR(WX, y, zTop - 3.4), p1 = PR(WX, y + 0.3, zTop - 3.4 - (4 + k * 12)); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.strokeStyle = hexA(P.ink2, 0.13 + k * 0.08); g.lineWidth = 0.7; g.stroke(); } }
    // walkway (top) with snow
    topFace(g, WX + 3, WX + WW, ya, yb, zTop, P.stoneMid, 500 + idx);
    // east parapet (low)
    topFace(g, WX + WW - 2, WX + WW, ya, yb, zTop + 2, P.stone, 0);
    // west parapet base strip + merlons every 8px (world y), crenels between
    topFace(g, WX, WX + 3, ya, yb, zTop + 1.5, P.stone, 0);
    const first = Math.ceil(ya / 8) * 8;
    for (let y = first - 8; y < yb; y += 8) {
      const a = Math.max(ya, y), b = Math.min(yb, y + 5);
      if (b - a > 0.5) merlon(g, WX, a, b, zTop + 1.5, 4.5, 3);
    }
    // seam line at the outer edge
    const a = PR(WX, ya, 0), b = PR(WX, yb, 0);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = P.ink; g.lineWidth = 1.3; g.stroke();
    const ta = PR(WX, ya, zTop + 1.5), tb = PR(WX, yb, zTop + 1.5);
    g.beginPath(); g.moveTo(ta[0], ta[1]); g.lineTo(tb[0], tb[1]); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke();
    // snow drift at the foot
    g.beginPath(); g.moveTo(a[0] - 3, a[1]); for (let y = ya; y <= yb; y += 2) g.lineTo(WX - 2 - 2.2 * hash2(idx, y), y); g.lineTo(b[0] + 0.5, b[1]); g.lineTo(a[0] + 0.5, a[1]); g.closePath(); g.fillStyle = P.paperHi; g.fill();
  });
}

function towerSprite(S, T, idx) {
  const top = T.h, roofH = T.roof ? 22 : 0;
  const x0 = T.x0 - 3, y0 = T.y0 - HY * (top + roofH + 8) - 4;
  const w = T.x1 - T.x0 + HX * (top + roofH + 8) + 8, h = T.y1 - T.y0 + HY * (top + roofH + 8) + 8;
  return structSprite(S, x0, y0, w, h, (g) => {
    faceStones(g, T.x0, T.y0, T.y1, 0, top, P.stone, 700 + idx);
    shadeFaceS(g, T.x0, T.x1, T.y1, 0, top);
    // arrow slits on the west face
    for (const fz of [16, 30]) { const p0 = PR(T.x0, (T.y0 + T.y1) / 2 - 1, fz), p1 = PR(T.x0, (T.y0 + T.y1) / 2 - 1, fz + 6); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke(); }
    // hanging banner on gate towers: indigo cloth with the hawk, our mark seen from the field
    if (T.gate) {
      const yc = (T.y0 + T.y1) / 2, a = PR(T.x0, yc - 5, top - 4), b = PR(T.x0, yc + 5, top - 4), c = PR(T.x0, yc + 5, top - 20), d = PR(T.x0, yc, top - 23), e = PR(T.x0, yc - 5, top - 20);
      poly(g, [a, b, c, d, e]); g.fillStyle = P.indigo; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
      const m = PR(T.x0, yc, top - 11);
      g.beginPath(); g.moveTo(m[0] - 1, m[1] - 3); g.lineTo(m[0] + 0.3, m[1] + 1.5); g.lineTo(m[0] + 1.6, m[1] - 3.2); g.strokeStyle = P.paperHi; g.lineWidth = 1.0; g.stroke();
    }
    topFace(g, T.x0, T.x1, T.y0, T.y1, top, P.stoneMid, 900 + idx);
    // crenellations on west and south edges
    for (let y = T.y0; y < T.y1 - 1; y += 7) merlon(g, T.x0, y, Math.min(T.y1, y + 4.5), top, 5, 3);
    for (let x = T.x0 + 3; x < T.x1 - 2; x += 7) { const xa = x, xb = Math.min(T.x1, x + 4); faceStonesSimple(g, xa, T.y1 - 3, T.y1, top, top + 5); shadeFaceS(g, xa, xb, T.y1, top, top + 5); topFace(g, xa, xb, T.y1 - 3, T.y1, top + 5, P.paperHi, 0); }
    if (T.roof) {
      // conical slate roof: lit west half, hatched east half, scalloped courses
      const cx = (T.x0 + T.x1) / 2, cy = (T.y0 + T.y1) / 2, r = (T.x1 - T.x0) / 2 + 2;
      const apex = PR(cx, cy, top + roofH + 8), L = PR(cx - r, cy, top + 3), Rr = PR(cx + r, cy, top + 3), F = PR(cx, cy + r * 0.75, top + 3);
      poly(g, [L, apex, Rr, F]); g.fillStyle = P.ink2; g.fill();
      poly(g, [L, apex, F]); g.fillStyle = P.wash2; g.fill();
      g.save(); poly(g, [L, apex, Rr, F]); g.clip();
      for (let k = 1; k < 7; k++) { const t = k / 7; g.beginPath(); g.moveTo(L[0] + (apex[0] - L[0]) * t, L[1] + (apex[1] - L[1]) * t); g.quadraticCurveTo(F[0] + (apex[0] - F[0]) * t, F[1] + (apex[1] - F[1]) * t + 2.5 * (1 - t), Rr[0] + (apex[0] - Rr[0]) * t, Rr[1] + (apex[1] - Rr[1]) * t); g.strokeStyle = hexA(P.ink, 0.7); g.lineWidth = 0.45; g.stroke(); }
      hatch(g, F[0], apex[1], Rr[0] + 4, F[1] + 2, 1.25, 1.2, 0.4, P.ink, 0.65, idx);
      g.restore();
      poly(g, [L, apex, Rr, F]); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
      // snow on the west flank
      g.beginPath(); g.moveTo(L[0] + 1, L[1] - 1); g.quadraticCurveTo((L[0] + apex[0]) / 2 - 1, (L[1] + apex[1]) / 2, apex[0] - 0.5, apex[1] + 3); g.lineTo((L[0] + apex[0]) / 2 + 2, (L[1] + apex[1]) / 2 + 2); g.closePath(); g.fillStyle = P.paperHi; g.fill();
    }
  });
}

function gateSprite(S, state) {
  const x = WX + 6, zt = 21;
  const x0 = WX - 14, y0 = GY0 - HY * (zt + 4) - 3, w = 40, h = GY1 - GY0 + HY * (zt + 4) + 18;
  return structSprite(S, x0, y0, w, h, (g) => {
    // passage floor
    poly(g, [PR(WX, GY0, 0), PR(WX + WW, GY0, 0), PR(WX + WW, GY1, 0), PR(WX, GY1, 0)]); g.fillStyle = hexA(P.wash1, 0.35); g.fill();
    if (state === 'broken') {
      // north leaf hangs open inward; south leaf lies flat in the passage
      const hang = [PR(x, GY0, 1), PR(x + 10, GY0 + 2, 1), PR(x + 10, GY0 + 2, zt - 1), PR(x, GY0, zt)];
      poly(g, hang); g.fillStyle = P.woodLo; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
      const fl = [[x - 12, GY1 - 3], [x + 6, GY1 - 1], [x + 8, GY1 - 13], [x - 10, GY1 - 15]];
      poly(g, fl); g.fillStyle = P.wood; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
      for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x - 12 + i * 3.6, GY1 - 3 + i * 0.4); g.lineTo(x - 10 + i * 3.6, GY1 - 15 + i * 0.4); g.strokeStyle = hexA(P.ink, 0.7); g.lineWidth = 0.4; g.stroke(); }
      // splinters
      for (let i = 0; i < 12; i++) { const a = hash2(i, 9) * 6.28, r = 3 + hash2(i, 3) * 10, px = x - 6 + Math.cos(a) * r, py = GYC + Math.sin(a) * r * 0.8; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a * 3) * 2.4, py + Math.sin(a * 3) * 1.2); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke(); }
      return;
    }
    // closed doors: planks + iron bands, facing west (narrow parallelogram in this view)
    const pts = [PR(x, GY0, 0), PR(x, GY1, 0), PR(x, GY1, zt), PR(x, GY0, zt)];
    poly(g, pts); g.fillStyle = P.wood; g.fill();
    g.save(); poly(g, pts); g.clip();
    for (let y = GY0 + 2.6; y < GY1; y += 2.8) { const a = PR(x, y, 0), b = PR(x, y, zt); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = hexA(P.ink, 0.6); g.lineWidth = 0.4; g.stroke(); }
    for (const z of [4, 11, 18]) { const a = PR(x, GY0, z), b = PR(x, GY1, z); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke(); }
    const m = PR(x, GYC, 0), m2 = PR(x, GYC, zt); g.beginPath(); g.moveTo(m[0], m[1]); g.lineTo(m2[0], m2[1]); g.strokeStyle = P.ink; g.lineWidth = 0.9; g.stroke();
    if (state === 'splintered') {
      // gouged planks, a hole, scorch
      g.fillStyle = hexA(P.ink, 0.55); inkBlob(g, PR(x, GYC + 2, 8)[0], PR(x, GYC + 2, 8)[1], 4.5, 77, P.ink, 0.9, 1.3);
      for (let i = 0; i < 6; i++) { const p = PR(x, GY0 + 4 + i * 4.5, 4 + (i % 3) * 5); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + 3, p[1] - 2 - i % 2); g.strokeStyle = P.paperHi; g.lineWidth = 0.6; g.stroke(); }
      g.fillStyle = hexA(P.ink, 0.35); g.fillRect(x - 4, GY0 - 18, 14, 30);
    }
    g.restore();
    poly(g, pts); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
  });
}

// ---------- inner ward: timber halls, the chronicler's scriptorium, the keep ----------
// Each is a sprite y-sorted with the courtyard crowd. Windows are lit from inside at dusk (glows added in the light pass).
const WARD = [
  { kind: 'hall', name: '병영', x0: 616, x1: 642, y0: 64, y1: 86, h: 13, roof: 12, seed: 3, win: [620], door: 632, loft: true },
  { kind: 'hall', name: '병영', x0: 650, x1: 676, y0: 67, y1: 89, h: 13, roof: 12, seed: 4, win: [654, 666], chimney: true },
  { kind: 'hall', name: '병영', x0: 684, x1: 710, y0: 64, y1: 86, h: 13, roof: 12, seed: 6, win: [700], door: 688, loft: true },
  { kind: 'hall', name: '사관의 서고', x0: 766, x1: 802, y0: 80, y1: 104, h: 18, roof: 15, seed: 5, win: [770, 792], door: 781, bell: true, seal: true },
  { kind: 'keep', name: '본성', x0: 846, x1: 960, y0: 112, y1: 318, h: 66, seed: 9 },
];
const FOLK = [
  { path: [[764, 250], [778, 282], [786, 306]], sp: 13, wait: 1.2, ph: 0, v: 0 },
  { path: [[756, 252], [770, 286], [778, 312]], sp: 12, wait: 1.6, ph: 4.5, v: 1 },
  { path: [[722, 140], [640, 132], [558, 124]], sp: 19, wait: 0.8, ph: 1.0, v: 1 },
  { path: [[668, 262], [718, 292], [772, 330]], sp: 10, wait: 1.4, ph: 2, v: 0, pair: true },
];
function timberFace(g, pts, lit, seed) {
  poly(g, pts); g.fillStyle = lit ? '#EEE6D3' : '#B3A88F'; g.fill();
  if (!lit) { g.save(); poly(g, pts); g.clip(); const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); hatch(g, Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2, 0.95, 1.35, 0.4, P.ink, 0.6, seed); g.restore(); }
  poly(g, pts); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
}
// A house with its ridge running north–south: the south gable faces the viewer as a pentagon
// (the silhouette everyone reads as "house"), the west slope takes the low sun, the east slope is hatched.
function hallSprite(S, B) {
  const { x0, x1, y0, y1, h, roof } = B, xm = (x0 + x1) / 2, top = h + roof, o = 1.6;
  return structSprite(S, x0 - 5, y0 - HY * (top + 12) - 4, x1 - x0 + HX * (top + 12) + 12, y1 - y0 + HY * (top + 12) + 10, (g) => {
    const tl = (a, b, w = 0.9, col = P.woodLo) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = col; g.lineWidth = w; g.stroke(); };
    // west wall: lit plaster, timber posts and a rail
    const wf = [PR(x0, y0, 0), PR(x0, y1, 0), PR(x0, y1, h), PR(x0, y0, h)];
    timberFace(g, wf, true, B.seed);
    for (let y = y0 + 1; y < y1; y += 9) tl(PR(x0, y, 0), PR(x0, y, h), 0.8);
    tl(PR(x0, y0, h * 0.55), PR(x0, y1, h * 0.55), 0.6);
    // south gable wall (facing us, in the evening shade): pentagon, hatched, timber frame, lit windows, door
    const sf = [PR(x0, y1, 0), PR(x1, y1, 0), PR(x1, y1, h), PR(xm, y1, top), PR(x0, y1, h)];
    timberFace(g, sf, false, B.seed + 1);
    tl(PR(x0, y1, h), PR(x1, y1, h), 0.8); tl(PR(xm, y1, h), PR(xm, y1, top - 1), 0.7);
    tl(PR(x0 + 1, y1, 0), PR(x0 + 1, y1, h), 0.8); tl(PR(x1 - 1, y1, 0), PR(x1 - 1, y1, h), 0.8);
    for (const wx of B.win || []) { const z0 = h * 0.38, q = [PR(wx, y1, z0), PR(wx + 4, y1, z0), PR(wx + 4, y1, z0 + 5), PR(wx, y1, z0 + 5)]; poly(g, q); g.fillStyle = P.fire1; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke(); tl(PR(wx + 2, y1, z0), PR(wx + 2, y1, z0 + 5), 0.5, P.ink); tl(PR(wx, y1, z0 + 2.5), PR(wx + 4, y1, z0 + 2.5), 0.4, P.ink); }
    if (B.door) { const q = [PR(B.door, y1, 0), PR(B.door + 5, y1, 0), PR(B.door + 5, y1, 8), PR(B.door + 2.5, y1, 9.5), PR(B.door, y1, 8)]; poly(g, q); g.fillStyle = B.seal ? P.cinnabar : P.woodLo; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke(); }
    if (B.loft) { const c = PR(xm, y1, h + roof * 0.42); g.beginPath(); g.arc(c[0], c[1], 1.6, 0, 7); g.fillStyle = P.fire1; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke(); }
    // east slope (away from the sun): snow in shade, hatched
    const es = [PR(xm, y0 - o, top), PR(x1 + o, y0 - o, h - 1), PR(x1 + o, y1 + o, h - 1), PR(xm, y1 + o, top)];
    poly(g, es); g.fillStyle = '#C7C6C6'; g.fill();
    g.save(); poly(g, es); g.clip(); const xs = es.map((p) => p[0]), ys = es.map((p) => p[1]); hatch(g, Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 2, Math.max(...ys) + 2, 1.15, 1.25, 0.38, P.ink, 0.55, B.seed + 4); g.restore();
    poly(g, es); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
    // west slope (in the low sun): a clean blanket of snow with a shingled eave and drips
    const ws = [PR(x0 - o, y0 - o, h - 1), PR(xm, y0 - o, top), PR(xm, y1 + o, top), PR(x0 - o, y1 + o, h - 1)];
    poly(g, ws); g.fillStyle = P.paperHi; g.fill();
    g.save(); poly(g, ws); g.clip();
    for (let k = 0; k < 2; k++) { const t = 0.84 + k * 0.08; const a = PR(x0 - o + (xm - x0 + o) * (1 - t), y0 - o, top - (top - h + 1) * t), b = PR(x0 - o + (xm - x0 + o) * (1 - t), y1 + o, top - (top - h + 1) * t); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = hexA(P.woodLo, 0.9); g.lineWidth = 1.2; g.stroke(); }
    for (let y = y0; y < y1 + o; y += 2.2) { const k = hash2(B.seed, Math.floor(y * 3)); if (k < 0.5) continue; const a = PR(x0 + 1.5, y, h + 0.6), b = PR(x0 + 1.5 + k * 3, y, h + 0.6 + k * 2); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = hexA(P.ink2, 0.25); g.lineWidth = 0.4; g.stroke(); }
    g.restore();
    poly(g, ws); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
    // barge boards on the south gable + ridge beam: the dark "roof" chevron that reads at 1x
    { const a = PR(x0 - o, y1 + o, h - 1), m = PR(xm, y1 + o, top), b = PR(x1 + o, y1 + o, h - 1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(m[0], m[1]); g.lineTo(b[0], b[1]); g.strokeStyle = P.woodLo; g.lineWidth = 1.7; g.stroke(); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
      const r0 = PR(xm, y0 - o, top), r1 = PR(xm, y1 + o, top); g.beginPath(); g.moveTo(r0[0], r0[1]); g.lineTo(r1[0], r1[1]); g.strokeStyle = P.ink; g.lineWidth = 1.1; g.stroke(); }
    // icicles along the west eave
    for (let y = y0; y < y1 + o; y += 1.9) { const L = 0.6 + 2.2 * hash2(B.seed + 9, Math.floor(y * 2)); const p = PR(x0 - o, y, h - 1); g.beginPath(); g.moveTo(p[0] - 0.35, p[1]); g.lineTo(p[0] - 0.05, p[1] + L); g.lineTo(p[0] + 0.35, p[1]); g.fillStyle = P.paperHi; g.fill(); }
    if (B.chimney) { const cy = y0 + (y1 - y0) * 0.35, cx = xm + 3; const c = [PR(cx, cy, top - 3), PR(cx + 3.4, cy, top - 3), PR(cx + 3.4, cy, top + 5), PR(cx, cy, top + 5)]; poly(g, c); g.fillStyle = P.stoneMid; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke(); const t = [PR(cx, cy - 3, top + 5), PR(cx + 3.4, cy - 3, top + 5), PR(cx + 3.4, cy, top + 5), PR(cx, cy, top + 5)]; poly(g, t); g.fillStyle = P.ink; g.fill(); }
    if (B.bell) { // a bell-cote on the south gable: the scriptorium rings the hours of the siege
      const a = PR(xm - 2.6, y1 + o, top - 1), b = PR(xm + 2.6, y1 + o, top - 1), c = PR(xm + 2.6, y1 + o, top + 6), d = PR(xm, y1 + o, top + 9), e = PR(xm - 2.6, y1 + o, top + 6);
      poly(g, [a, b, c, d, e]); g.fillStyle = P.stone; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.stroke();
      const bl = PR(xm, y1 + o, top + 3); g.beginPath(); g.arc(bl[0], bl[1], 1.3, Math.PI, 0); g.lineTo(bl[0] + 1.5, bl[1] + 1.2); g.lineTo(bl[0] - 1.5, bl[1] + 1.2); g.closePath(); g.fillStyle = P.goldLo; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.4; g.stroke();
    }
    if (B.seal) { // the chronicler's red cloth with a brush circle on the west wall
      const yc = (y0 + y1) / 2, q = [PR(x0, yc - 3.6, h - 1), PR(x0, yc + 3.6, h - 1), PR(x0, yc + 3.6, h - 12), PR(x0, yc, h - 14), PR(x0, yc - 3.6, h - 12)];
      poly(g, q); g.fillStyle = P.cinnabar; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
      const c = PR(x0, yc, h - 6.5); g.beginPath(); g.ellipse(c[0] + 0.6, c[1] - 0.6, 1.5, 2.3, -0.5, 0.4, 5.9); g.strokeStyle = P.paperHi; g.lineWidth = 0.55; g.stroke();
    }
  });
}
function keepSprite(S, B) {
  const { x0, x1, y0, y1, h } = B;
  return structSprite(S, x0 - 4, y0 - HY * (h + 10) - 4, Math.min(80, x1 - x0) + HX * (h + 10) + 8, y1 - y0 + HY * (h + 10) + 10, (g) => {
    faceStones(g, x0, y0, y1, 0, h, WALLSTONE, 1300);
    shadeFaceS(g, x0, x1, y1, 0, h);
    // pilaster buttresses on the west face
    for (const by of [y0 + 28, y0 + 92, y1 - 30]) { const q = [PR(x0, by, 0), PR(x0, by + 5, 0), PR(x0, by + 5, h - 6), PR(x0, by, h - 6)]; poly(g, q); g.fillStyle = hexA(P.ink, 0.22); g.fill(); g.strokeStyle = hexA(P.ink, 0.8); g.lineWidth = 0.6; g.stroke(); }
    // inner gate: deep arch, iron-studded doors ajar, a lit gap
    const gy0 = (y0 + y1) / 2 - 9, gy1 = gy0 + 18;
    const arch = [PR(x0, gy0, 0), PR(x0, gy1, 0), PR(x0, gy1, 14)]; const ac = PR(x0, (gy0 + gy1) / 2, 14);
    g.beginPath(); g.moveTo(arch[0][0], arch[0][1]); g.lineTo(arch[1][0], arch[1][1]); g.lineTo(arch[2][0], arch[2][1]);
    for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI; const p = PR(x0, (gy0 + gy1) / 2 + Math.cos(a) * 9, 14 + Math.sin(a) * 6); g.lineTo(p[0], p[1]); }
    g.closePath(); g.fillStyle = P.ink; g.fill();
    { const q = [PR(x0, (gy0 + gy1) / 2 - 1, 0), PR(x0, (gy0 + gy1) / 2 + 1.6, 0), PR(x0, (gy0 + gy1) / 2 + 1.6, 15), PR(x0, (gy0 + gy1) / 2 - 1, 15)]; poly(g, q); g.fillStyle = P.fire1; g.fill(); }
    // slit windows, two lit
    for (const [wy, wz, lit] of [[y0 + 50, 34, true], [y0 + 120, 40, false], [y1 - 52, 30, true], [y0 + 76, 52, false]]) { const a = PR(x0, wy, wz), b = PR(x0, wy, wz + 7); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.strokeStyle = lit ? P.fire1 : P.ink; g.lineWidth = 1.5; g.stroke(); if (lit) { g.strokeStyle = P.ink; g.lineWidth = 0.4; g.stroke(); } }
    // great banner: indigo, hawk, gold fringe
    { const yc = (y0 + y1) / 2 - 40, q = [PR(x0, yc - 8, h - 6), PR(x0, yc + 8, h - 6), PR(x0, yc + 8, h - 40), PR(x0, yc, h - 45), PR(x0, yc - 8, h - 40)]; poly(g, q); g.fillStyle = P.indigo; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
      const m = PR(x0, yc, h - 22); g.beginPath(); g.moveTo(m[0] - 2, m[1] - 6); g.lineTo(m[0] + 0.5, m[1] + 3); g.lineTo(m[0] + 3, m[1] - 6.4); g.strokeStyle = P.paperHi; g.lineWidth = 1.8; g.stroke();
      const f0 = PR(x0, yc - 8, h - 40), f1 = PR(x0, yc, h - 45), f2 = PR(x0, yc + 8, h - 40); g.beginPath(); g.moveTo(f0[0], f0[1]); g.lineTo(f1[0], f1[1]); g.lineTo(f2[0], f2[1]); g.strokeStyle = P.gold; g.lineWidth = 0.9; g.stroke(); }
    topFace(g, x0, x1, y0, y1, h, P.stoneMid, 1400);
    for (let y = y0; y < y1 - 1; y += 7) merlon(g, x0, y, Math.min(y1, y + 4.5), h, 5, 3);
  });
}

function cutaway(spr, S, yCut, seed) {
  const c = mkCanvas(spr.img.width, spr.img.height), g = c.getContext('2d');
  g.drawImage(spr.img, 0, 0);
  g.setTransform(S, 0, 0, S, -spr.x * S, -spr.y * S);
  const pts = []; for (let x = spr.x - 1; x <= spr.x + spr.w + 1; x += 1.4) pts.push([x, yCut + (hash2(seed, Math.floor(x * 3)) - 0.5) * 2.4 + Math.sin(x * 0.55) * 1.1]);
  const line = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(spr.x - 2, spr.y - 2); g.lineTo(spr.x + spr.w + 2, spr.y - 2); for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-atop';
  g.save(); line(); for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + 2.6); g.closePath(); g.fillStyle = P.stoneLo; g.fill(); g.clip(); hatch(g, spr.x, yCut - 4, spr.x + spr.w, yCut + 5, 0.785, 0.85, 0.32, P.ink, 0.9, seed); g.restore();
  line(); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke();
  g.globalCompositeOperation = 'source-over';
  return { ...spr, img: c };
}

function buildStructures(S) {
  const list = [];
  let idx = 0;
  for (const [a, b] of WALLSEG) {
    for (let y = a; y < b; y += 16) list.push({ key: y, kind: 'wall', spr: wallRow(S, y, Math.min(b, y + 16), 0, idx++) });
  }
  TOWERS.forEach((T, i) => { const spr = towerSprite(S, T, i); list.push({ key: T.y0 + 0.5, kind: 'tower', spr, T, cut: i === 2 ? cutaway(spr, S, GY1 - 5, 61) : null }); });
  for (const B of WARD) list.push({ key: B.y1, kind: 'ward', spr: B.kind === 'keep' ? keepSprite(S, B) : hallSprite(S, B), B });
  return list;
}
