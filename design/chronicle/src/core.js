'use strict';
// ============================================================================
// 잿빛 성벽 — "먹과 안료의 연대기" prototype. Everything here is drawn by code.
// core: params, deterministic RNG, palette, projection, ink/brush helpers
// ============================================================================
const Q = new URLSearchParams(location.search);
const PARAM = {
  t: Math.max(0, +Q.get('t') || 0),
  zoom: +Q.get('zoom') || 0,
  sheet: Q.get('sheet') === '1',
  ui: Q.get('ui') === '1',
  n: Math.max(20, Math.min(600, +Q.get('n') || 100)),
  seed: +Q.get('seed') || 7,
  low: Q.get('tier') === 'low',
  hud: Q.get('hud') !== '0',
  still: Q.get('still') === '1',
  cx: +Q.get('cx') || 0, cy: +Q.get('cy') || 0,
  prof: Q.get('prof') === '1',
  off: new Set((Q.get('off') || '').split(',')),
};
const DPR = Math.min(window.devicePixelRatio || 1, PARAM.low ? 1.25 : 2);
const DT = 1 / 30;

// --- deterministic RNG (sim) and hash (render-only variation) ----------------
function RNG(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}
function hash2(a, b) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 0x9e3779b9, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi + seed * 131, yi), b = hash2(xi + 1 + seed * 131, yi);
  const c = hash2(xi + seed * 131, yi + 1), d = hash2(xi + 1 + seed * 131, yi + 1);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed, oct = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) { v += amp * vnoise(x * f, y * f, seed + i * 17); tot += amp; amp *= 0.5; f *= 2.03; }
  return v / tot;
}

// --- palette: paper, ink, two washes, one cool pigment (ours), warm pigments (theirs),
//     cinnabar (blood, rubric) and gold (light, glory). Nothing else.
const P = {
  paper: '#E8DFCB', paperHi: '#F5EFE1', paperLo: '#D6CAB0', paperDk: '#BFB194',
  snow: '#ECE7DB', snowLo: '#D3CEC4', snowSh: '#B9BAC0',
  ink: '#1E1916', ink2: '#3A322B', wash1: '#5A5249', wash2: '#877E71', wash3: '#B2A895',
  indigo: '#2B4A78', indigoLo: '#1B3153', indigoHi: '#5D7FB0', indigoPale: '#A9B9D2',
  cinnabar: '#B3271D', blood: '#8C1A13', bloodDk: '#5E120D',
  gold: '#C8962D', goldHi: '#EBC56A', goldLo: '#8E6618',
  rust: '#8C4F2B', rustLo: '#5F331B', rustHi: '#B47448', cream: '#D9C59C',
  orc: '#6C7A47', orcLo: '#475330', gob: '#949C4E', gobLo: '#69702F', leather: '#5C4232', bone: '#E0D5B8', fur: '#4A3D32',
  wood: '#7C5B3B', woodLo: '#4F3925', woodHi: '#A07C55',
  stone: '#D3C8B2', stoneMid: '#ADA28E', stoneLo: '#7E7564', stoneDk: '#585044',
  skin: '#E6D2B0', skinLo: '#C4A983',
  fire1: '#E9A23A', fire2: '#C9411F', fireCore: '#FBE9AE', ember: '#F2B54B',
};
const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const mix = (h1, h2, t) => {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
};

// --- 3/4 oblique projection: sim is top-down (x,y); height z leans up-right ------
// The light comes from the west-south-west, low (dusk): every lit edge is on the left.
const HX = 0.46, HY = 0.64;
const SUN = { dx: 1.5, dy: -0.42 }; // shadow vector per unit height

// --- world layout (world px; 16 px = one sim tile, same as the game) --------
const WORLD = { w: 920, h: 430 };
const WX = 520, WW = 16, WH = 26; // curtain wall: west face x, thickness, height
const GY0 = 194, GY1 = 226, GYC = 210; // gate opening
const TOWERS = [
  { x0: WX - 6, x1: WX + WW + 4, y0: 36, y1: 66, h: 44, roof: true },
  { x0: WX - 8, x1: WX + WW + 2, y0: 168, y1: GY0, h: 34, roof: false, gate: true },
  { x0: WX - 8, x1: WX + WW + 2, y0: GY1, y1: 252, h: 34, roof: false, gate: true },
  { x0: WX - 6, x1: WX + WW + 4, y0: 352, y1: 382, h: 44, roof: true },
];
const WALLSEG = [ [66, 168], [252, 352], [0, 36], [382, 430] ];

// --- canvas helpers -------------------------------------------------------------
function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
function ctx2(c, opts) { return c.getContext('2d', opts); }

// quadratic bezier sample
function qpts(x0, y0, cx, cy, x1, y1, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    out.push([a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1]);
  }
  return out;
}
// Tapered brush stroke along a polyline; wfn(u) gives the full width at u in [0,1].
function brush(g, pts, wfn, color, alpha = 1) {
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const w = wfn(i / (n - 1)) * 0.5;
    L.push([p[0] - dy * w, p[1] + dx * w]);
    R.push([p[0] + dy * w, p[1] - dx * w]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  const ga = g.globalAlpha; g.globalAlpha = ga * alpha;
  g.fillStyle = color; g.fill();
  g.globalAlpha = ga;
}
const taper = (w0, w1) => (u) => w0 + (w1 - w0) * u;
const swell = (w) => (u) => w * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.92 + 0.04)));
const nib = (w) => (u) => w * (u < 0.15 ? 0.55 + 3 * u : u > 0.7 ? Math.max(0.1, (1 - u) / 0.3) : 1);

// Irregular ink blob (wet edge), seeded.
function inkBlob(g, x, y, r, seed, color, alpha = 1, sq = 1) {
  const n = 14;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.72 + 0.5 * hash2(seed, i % n);
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k * sq;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
  const ga = g.globalAlpha; g.globalAlpha = ga * alpha; g.fillStyle = color; g.fill(); g.globalAlpha = ga;
}
// Ink splatter: core blob + droplets + a drag tail
function splat(g, x, y, r, seed, color, alpha = 1, dirx = 1, diry = 0) {
  inkBlob(g, x, y, r, seed, color, alpha, 0.7);
  for (let i = 0; i < 7; i++) {
    const a = Math.atan2(diry, dirx) + (hash2(seed, 40 + i) - 0.5) * 2.2;
    const d = r * (1.1 + hash2(seed, 60 + i) * 1.8);
    inkBlob(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.12 + 0.22 * hash2(seed, 80 + i)), seed + i, color, alpha, 0.8);
  }
}
// Hatching inside the current clip: parallel lines at angle, with tiny gaps (woodcut gouge)
function hatch(g, x0, y0, x1, y1, ang, gap, w, color, alpha, seed = 1) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  g.save();
  g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath();
  let i = 0;
  for (let d = -R; d <= R; d += gap, i++) {
    const ox = cx - sa * d, oy = cy + ca * d;
    // break each line into 2-3 dashes (hand gouge)
    let s = -R;
    while (s < R) {
      const len = R * (0.35 + 0.8 * hash2(seed + i, Math.floor(s))) ;
      const e = Math.min(R, s + len);
      g.moveTo(ox + ca * s, oy + sa * s);
      g.lineTo(ox + ca * e, oy + sa * e);
      s = e + gap * (0.6 + hash2(seed - i, Math.floor(e)) * 1.4);
    }
  }
  g.stroke();
  g.restore();
}
function poly(g, pts) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}
// wobbly line (hand-cut): small perpendicular jitter
function wobLine(g, x0, y0, x1, y1, amp, seed) {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 3));
  const dx = (x1 - x0) / n, dy = (y1 - y0) / n, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  g.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) {
    const j = i === n ? 0 : (hash2(seed, i) - 0.5) * 2 * amp;
    g.lineTo(x0 + dx * i + nx * j, y0 + dy * i + ny * j);
  }
}

// Korean particle helper (josa) for generated chronicle lines
function josa(word, pair) {
  const c = word.charCodeAt(word.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  const [a, b] = pair.split('/');
  return word + (has ? a : b);
}
