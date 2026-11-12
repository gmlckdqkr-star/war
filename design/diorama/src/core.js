'use strict';
// ============================================================================
// 잿빛 성벽 — "축경(縮景)" direction prototype. Everything is drawn by code.
// core: params, RNG, noise, world constants, camera
// ============================================================================
const Q = new URLSearchParams(location.search);
const P_T = Math.max(0, parseFloat(Q.get('t') || '0'));
const P_ZOOM = parseFloat(Q.get('zoom') || '0');
const P_SHEET = Q.get('sheet') === '1';
const P_UI = Q.get('ui') === '1';
const P_N = Math.max(30, Math.min(800, parseInt(Q.get('n') || '100', 10)));
const P_SEED = parseInt(Q.get('seed') || '11', 10);
const P_HUD = Q.get('hud') !== '0';
const P_PERF = Q.get('perf') === '1';
const P_LOW = Q.get('tier') === 'low';
const DPR = Math.min(window.devicePixelRatio || 1, P_LOW ? 1.25 : 2);

// ---------- deterministic RNG (mulberry32) ----------
function RNG(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}

// ---------- value noise (hash based, no tables) ----------
function hash2(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) {
  return vnoise(x, y, s) * 0.5 + vnoise(x * 2.03, y * 2.03, s + 1) * 0.25 + vnoise(x * 4.1, y * 4.1, s + 2) * 0.15 + vnoise(x * 8.3, y * 8.3, s + 3) * 0.1;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- colour helpers ----------
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(r, g, b, a) { return a === undefined ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function shade(c, k) { const [r, g, b] = hex(c); return k >= 0 ? rgb(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : rgb(r * (1 + k), g * (1 + k), b * (1 + k)); }
function mix(c1, c2, t) { const a = hex(c1), b = hex(c2); return rgb(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); }
function mixA(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

// ---------- world layout (world px, 16 px = 1 sim tile) ----------
// 3/4 projection: screen = (x, y*KY - z). KY<1 tilts the table toward the camera.
const WW = 880, WH = 520, KY = 0.8;
const WY0 = 196, WY1 = 216, WZ = 36;            // curtain wall: back line, front line, height
const GATE_X = 440;
const TWL = { x0: 334, x1: 390 }, TWR = { x0: 490, x1: 546 }; // twin gate towers (x span)
const TW_F = WY1 + 24, TW_B = WY0 - 4, TZ = 60;
const GH_F = WY1 + 3, GHZ = WZ + 8;              // gatehouse face line and height
const BAR_Y = WY1 + 34;                           // barricade line in front of the broken gate
const RTOW = [{ cx: 62, cy: WY1 - 8, r: 30, z: 54 }, { cx: 818, cy: WY1 - 8, r: 30, z: 54 }];
const WALK_Y = WY0 + 14;                          // where wall-walk soldiers stand (near parapet)

// ---------- camera ----------
const CAM = { zoom: 1, x: 0, sy: 0, PX: 1, W: 0, H: 0, cssW: 844, cssH: 390, shakeX: 0, shakeY: 0 };
function setupCamera(cssW, cssH) {
  CAM.cssW = cssW; CAM.cssH = cssH;
  if (P_ZOOM > 0) {
    CAM.zoom = P_ZOOM;
    const vw = cssW / CAM.zoom, vh = cssH / CAM.zoom;
    CAM.x = GATE_X - 30 - vw / 2;
    CAM.sy = (BAR_Y) * KY - 22 - vh / 2;
  } else {
    CAM.zoom = cssW / WW;
    CAM.x = 0;
    CAM.sy = 2;
  }
  CAM.PX = CAM.zoom * DPR;
  CAM.W = Math.round(cssW * DPR); CAM.H = Math.round(cssH * DPR);
}
// world -> device px
const SX = (x) => (x - CAM.x) * CAM.PX;
const SY = (y, z) => (y * KY - (z || 0) - CAM.sy) * CAM.PX;
