/**
 * Canvas 2D renderer. All art is procedurally drawn (no external assets): terrain is baked into an
 * offscreen layer, corpses/blood/scorch accumulate on a decal layer, units are batched per type.
 */
import { GH, GW, TILE, Tile, WORLD_H, WORLD_W } from '../sim/defs';
import { cx, cy, idx, inb, tileAt, tx, ty } from '../sim/grid';
import { RNG } from '../sim/rng';
import { ST, type Squad, type Unit, type World } from '../sim/world';
import { Camera } from './camera';

const T = TILE;

export interface Theme {
  stone: string;
  stoneDark: string;
  dye: string;
  bannerField: string;
  bannerCharge: string;
  bannerPattern: string;
}

interface Particle {
  k: number; // kind
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  s: number;
  c: string;
  a?: number;
}

const P_SPARK = 0,
  P_SMOKE = 1,
  P_DUST = 2,
  P_FLAME = 3,
  P_BREATH = 4,
  P_HEAL = 5,
  P_RING = 6,
  P_DEBRIS = 8,
  P_OIL = 9;

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (f < 0) {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  } else {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam = new Camera();
  dpr = 1;
  scale = 2; // terrain bake resolution
  terrain: HTMLCanvasElement;
  tctx: CanvasRenderingContext2D;
  decals: HTMLCanvasElement;
  dctx: CanvasRenderingContext2D;
  world: World | null = null;
  theme: Theme;
  particles: Particle[] = [];
  maxParticles = 900;
  shake = 0;
  reduceMotion = false;
  lowQuality = false;
  time = 0;
  selected: Squad | null = null;
  hoverTile = -1;
  deployMode = false;
  targeting: string | null = null;
  dragLine: { x0: number; y0: number; x1: number; y1: number } | null = null;
  pings: { x: number; y: number; t: number; c: string }[] = [];
  /** banner text per squad id (type glyph + number when several squads share a type) */
  labels = new Map<number, string>();
  /** soldiers drawn in the last frame (debug / e2e) */
  drawnUnits = 0;
  /** screen rects (CSS px) covered by HUD panels: screen-space markers are kept out from under them */
  occluders: { x0: number; y0: number; x1: number; y1: number }[] = [];
  /** approach arrows drawn in the last frame (screen CSS px), for HUD placement and tests */
  approachPts: { x: number; y: number; edge: string; moved: boolean }[] = [];
  /** off-screen alert arrows drawn in the last frame (screen CSS px) */
  edgePts: { x: number; y: number }[] = [];
  private buckets = new Map<string, Unit[]>();
  private tileRng = new RNG(1);
  onSound: (k: string, x: number, y: number) => void = () => {};

  constructor(canvas: HTMLCanvasElement, theme: Theme) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.theme = theme;
    this.terrain = document.createElement('canvas');
    this.tctx = this.terrain.getContext('2d')!;
    this.decals = document.createElement('canvas');
    this.dctx = this.decals.getContext('2d')!;
  }

  setQuality(low: boolean) {
    this.lowQuality = low;
    this.maxParticles = low ? 300 : 900;
  }

  resize(cssW: number, cssH: number, top: number, bottom: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.lowQuality ? 1.25 : 2);
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.cam.resize(cssW, cssH, top, bottom);
  }

  attach(w: World) {
    this.world = w;
    this.particles = [];
    this.pings = [];
    this.scale = this.lowQuality ? 1 : 2;
    this.terrain.width = WORLD_W * this.scale;
    this.terrain.height = WORLD_H * this.scale;
    this.decals.width = WORLD_W * this.scale;
    this.decals.height = WORLD_H * this.scale;
    this.dctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.dctx.clearRect(0, 0, WORLD_W, WORLD_H);
    this.bakeAll();
  }

  // ------------------------------------------------------------------ terrain bake

  bakeAll() {
    const c = this.tctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    for (let i = 0; i < GW * GH; i++) this.drawTile(i, false);
    for (let i = 0; i < GW * GH; i++) this.drawTile(i, true);
    this.drawKeep();
  }

  rebake(tiles: number[]) {
    const set = new Set<number>();
    for (const i of tiles)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const x = tx(i) + dx;
          const y = ty(i) + dy;
          if (inb(x, y)) set.add(idx(x, y));
        }
    for (const i of set) this.drawTile(i, false);
    for (const i of set) this.drawTile(i, true);
    this.drawKeep();
  }

  private groundColor(t: number, i: number): string {
    const r = ((i * 2654435761) >>> 0) / 4294967296;
    const v = (r - 0.5) * 0.08;
    switch (t) {
      case Tile.GRASS:
        return shade('#5f7d3e', v);
      case Tile.ROUGH:
        return shade('#4a6532', v);
      case Tile.WATER:
        return shade('#2f5b78', v * 0.5);
      case Tile.ROAD:
        return shade('#8a7a58', v);
      case Tile.FLOOR:
      case Tile.DEPOT:
      case Tile.INFIRM:
        return shade('#7d7766', v);
      case Tile.CLIFF:
        return shade('#3d3a38', v);
      case Tile.BRIDGE:
        return '#7a5a3a';
      case Tile.RUBBLE:
        return shade('#6d6a62', v);
      case Tile.GATE_BROKEN:
        return '#6a5a44';
      default:
        return shade('#7d7766', v);
    }
  }

  /** pass 0: ground; pass 1: structures on top (so walls overlap ground seams) */
  private drawTile(i: number, structPass: boolean) {
    const w = this.world!;
    const g = w.grid;
    const c = this.tctx;
    const t = g.tiles[i];
    const x = tx(i) * T;
    const y = ty(i) * T;
    const rng = this.tileRng;
    const isStruct = t === Tile.WALL || t === Tile.TOWER || t === Tile.GATE;
    if (!structPass) {
      const base = isStruct || t === Tile.KEEP ? (g.inside[i] ? '#7d7766' : '#5f7d3e') : this.groundColor(t, i);
      c.fillStyle = base;
      c.fillRect(x, y, T + 0.5, T + 0.5);
      (rng as any).s = (i * 7919 + 13) >>> 0;
      if (t === Tile.GRASS || t === Tile.ROUGH) {
        for (let k = 0; k < (t === Tile.ROUGH ? 5 : 3); k++) {
          c.fillStyle = shade(t === Tile.ROUGH ? '#3a5428' : '#6e8f48', rng.range(-0.15, 0.15));
          const bx = x + rng.range(1, T - 1);
          const by = y + rng.range(1, T - 1);
          if (t === Tile.ROUGH) {
            c.beginPath();
            c.arc(bx, by, rng.range(1.5, 3.2), 0, Math.PI * 2);
            c.fill();
          } else c.fillRect(bx, by, 1, 2);
        }
      } else if (t === Tile.WATER) {
        c.strokeStyle = 'rgba(180,210,230,0.18)';
        c.lineWidth = 0.6;
        for (let k = 0; k < 2; k++) {
          const yy = y + rng.range(3, T - 3);
          c.beginPath();
          c.moveTo(x + 2, yy);
          c.quadraticCurveTo(x + T / 2, yy - 1.5, x + T - 2, yy);
          c.stroke();
        }
      } else if (t === Tile.FLOOR || t === Tile.DEPOT || t === Tile.INFIRM) {
        c.strokeStyle = 'rgba(0,0,0,0.10)';
        c.lineWidth = 0.5;
        c.strokeRect(x + 0.5, y + 0.5, T / 2 - 0.5, T / 2 - 0.5);
        c.strokeRect(x + T / 2, y + T / 2, T / 2 - 0.5, T / 2 - 0.5);
      } else if (t === Tile.CLIFF) {
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          const px = x + rng.range(2, T - 2);
          const py = y + rng.range(2, T - 2);
          c.moveTo(px, py - 3);
          c.lineTo(px + 3, py + 2);
          c.lineTo(px - 3, py + 2);
          c.fill();
        }
      } else if (t === Tile.RUBBLE) {
        for (let k = 0; k < 6; k++) {
          c.fillStyle = shade(this.theme.stone, rng.range(-0.35, 0.05));
          c.fillRect(x + rng.range(0, T - 4), y + rng.range(0, T - 4), rng.range(2, 4), rng.range(2, 4));
        }
      } else if (t === Tile.BRIDGE) {
        c.strokeStyle = 'rgba(40,25,10,0.5)';
        c.lineWidth = 0.6;
        for (let k = 2; k < T; k += 3) {
          c.beginPath();
          c.moveTo(x + k, y);
          c.lineTo(x + k, y + T);
          c.stroke();
        }
      } else if (t === Tile.GATE_BROKEN) {
        c.fillStyle = '#4a3420';
        for (let k = 0; k < 4; k++) c.fillRect(x + rng.range(0, T - 6), y + rng.range(0, T - 3), rng.range(4, 7), 2);
      }
      if (t === Tile.DEPOT) {
        c.fillStyle = '#8a6236';
        c.fillRect(x + 2, y + 3, 5, 5);
        c.fillRect(x + 8, y + 7, 6, 6);
        c.strokeStyle = '#4a3218';
        c.lineWidth = 0.8;
        c.strokeRect(x + 2, y + 3, 5, 5);
        c.strokeRect(x + 8, y + 7, 6, 6);
        c.fillStyle = '#c9b48a';
        c.fillRect(x + 9, y + 2, 1, 6);
      }
      if (t === Tile.INFIRM) {
        // tent with a green herb mark (not a red cross, which is a protected emblem)
        c.fillStyle = '#e8e2d0';
        c.beginPath();
        c.moveTo(x + 2, y + T - 2);
        c.lineTo(x + T / 2, y + 2);
        c.lineTo(x + T - 2, y + T - 2);
        c.fill();
        c.fillStyle = '#3f9b5a';
        c.beginPath();
        c.arc(x + T / 2, y + T - 6, 2.4, 0, Math.PI * 2);
        c.fill();
      }
      return;
    }
    if (!isStruct) return;
    const stone = this.theme.stone;
    const dark = this.theme.stoneDark;
    if (t === Tile.WALL) {
      c.fillStyle = stone;
      c.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
      c.strokeStyle = shade(dark, -0.2);
      c.lineWidth = 0.6;
      // masonry courses
      for (let k = 4; k < T; k += 4) {
        c.beginPath();
        c.moveTo(x, y + k);
        c.lineTo(x + T, y + k);
        c.stroke();
      }
      // crenellations on sides that face outside ground
      c.fillStyle = dark;
      const sides: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of sides) {
        const nx = tx(i) + dx;
        const ny = ty(i) + dy;
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (g.isBoundary(j) || g.inside[j] || g.tiles[j] === Tile.CLIFF) continue;
        for (let k = 1; k < T; k += 4) {
          if (dx === 1) c.fillRect(x + T - 3, y + k, 3, 2.5);
          if (dx === -1) c.fillRect(x, y + k, 3, 2.5);
          if (dy === 1) c.fillRect(x + k, y + T - 3, 2.5, 3);
          if (dy === -1) c.fillRect(x + k, y, 2.5, 3);
        }
      }
    } else if (t === Tile.TOWER) {
      c.fillStyle = shade(dark, -0.15);
      c.beginPath();
      c.arc(x + T / 2, y + T / 2, T * 0.72, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = stone;
      c.beginPath();
      c.arc(x + T / 2, y + T / 2, T * 0.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = dark;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        c.fillRect(x + T / 2 + Math.cos(a) * T * 0.55 - 1.5, y + T / 2 + Math.sin(a) * T * 0.55 - 1.5, 3, 3);
      }
    } else if (t === Tile.GATE) {
      c.fillStyle = '#6b4a2b';
      c.fillRect(x, y, T, T);
      c.strokeStyle = '#3a2614';
      c.lineWidth = 0.8;
      for (let k = 3; k < T; k += 3) {
        c.beginPath();
        c.moveTo(x + k, y);
        c.lineTo(x + k, y + T);
        c.stroke();
      }
      c.fillStyle = '#2a2a2e';
      c.fillRect(x, y + 3, T, 1.6);
      c.fillRect(x, y + T - 5, T, 1.6);
      c.strokeStyle = dark;
      c.lineWidth = 1.5;
      c.strokeRect(x + 0.75, y + 0.75, T - 1.5, T - 1.5);
    }
  }

  private drawKeep() {
    const w = this.world!;
    const g = w.grid;
    const c = this.tctx;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const k of g.keepTiles) {
      x0 = Math.min(x0, tx(k) * T);
      y0 = Math.min(y0, ty(k) * T);
      x1 = Math.max(x1, tx(k) * T + T);
      y1 = Math.max(y1, ty(k) * T + T);
    }
    const stone = this.theme.stone;
    c.fillStyle = shade(this.theme.stoneDark, -0.3);
    c.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
    c.fillStyle = stone;
    c.fillRect(x0 + 2, y0 + 2, x1 - x0 - 4, y1 - y0 - 4);
    c.fillStyle = shade(stone, -0.25);
    c.fillRect(x0 + 8, y0 + 8, x1 - x0 - 16, y1 - y0 - 16);
    c.fillStyle = shade(stone, 0.1);
    c.fillRect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24);
    for (const [px, py] of [
      [x0 + 4, y0 + 4],
      [x1 - 4, y0 + 4],
      [x0 + 4, y1 - 4],
      [x1 - 4, y1 - 4],
    ]) {
      c.fillStyle = shade(this.theme.stoneDark, -0.1);
      c.beginPath();
      c.arc(px, py, 5.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = stone;
      c.beginPath();
      c.arc(px, py, 4, 0, Math.PI * 2);
      c.fill();
    }
  }

  // ------------------------------------------------------------------ fx intake

  consumeFx() {
    const w = this.world!;
    const fx = w.fx;
    const d = this.dctx;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i];
      switch (f.k) {
        case 'corpse': {
          const r = (f.b ?? 3) * (f.a === 2 ? 1 : 1);
          d.globalAlpha = 0.55;
          d.fillStyle = f.a === 1 ? '#2a2420' : 'rgba(110,20,20,0.9)';
          d.beginPath();
          d.ellipse(f.x + 1, f.y + 1, r * 1.3, r * 0.9, Math.random() * 3, 0, Math.PI * 2);
          d.fill();
          d.globalAlpha = 0.85;
          d.fillStyle = shade(f.c ?? '#555', -0.35);
          d.beginPath();
          d.ellipse(f.x, f.y, r, r * 0.6, Math.random() * 3, 0, Math.PI * 2);
          d.fill();
          d.globalAlpha = 1;
          break;
        }
        case 'blood':
          if (!this.lowQuality) {
            d.fillStyle = 'rgba(120,20,20,0.35)';
            d.beginPath();
            d.arc(f.x + (Math.random() - 0.5) * 4, f.y + (Math.random() - 0.5) * 4, 1 + Math.random() * 1.2, 0, Math.PI * 2);
            d.fill();
          }
          break;
        case 'clash':
          this.spawn(P_SPARK, f.x, f.y, 2, '#ffe9a8', 0.25, 30);
          if (Math.random() < 0.15) this.onSound('clash', f.x, f.y);
          break;
        case 'shot':
          if (Math.random() < 0.08) this.onSound(f.c === 'bolt' ? 'bolt' : 'arrow', f.x, f.y);
          break;
        case 'down':
          break;
        case 'charge':
          this.spawn(P_DUST, f.x, f.y, 5, '#b8a888', 0.6, 25);
          break;
        case 'thud':
          this.spawn(P_DEBRIS, f.x, f.y, 4, this.theme.stone, 0.6, 40);
          this.spawn(P_DUST, f.x, f.y, 3, '#a89a80', 0.8, 15);
          this.onSound('thud', f.x, f.y);
          this.addShake(1.5);
          break;
        case 'chip':
          this.spawn(P_DEBRIS, f.x, f.y, 1, this.theme.stone, 0.4, 30);
          break;
        case 'collapse':
          this.spawn(P_DEBRIS, f.x, f.y, 18, this.theme.stone, 1, 60);
          this.spawn(P_DUST, f.x, f.y, 14, '#b0a490', 1.6, 25);
          this.onSound('collapse', f.x, f.y);
          this.addShake(6);
          this.ping(f.x, f.y, '#ff5040');
          break;
        case 'boom':
          this.spawn(P_DEBRIS, f.x, f.y, 8, '#8a8070', 0.7, 50);
          this.spawn(P_DUST, f.x, f.y, 6, '#a89a80', 1.1, 20);
          d.fillStyle = 'rgba(40,35,30,0.25)';
          d.beginPath();
          d.arc(f.x, f.y, 6, 0, Math.PI * 2);
          d.fill();
          this.onSound('boom', f.x, f.y);
          this.addShake(2.5);
          break;
        case 'treb':
          this.onSound('treb', f.x, f.y);
          break;
        case 'flame':
          this.spawn(P_FLAME, f.x, f.y, 1, '#ff8a30', 0.7, 6);
          if (Math.random() < 0.3) this.spawn(P_SMOKE, f.x, f.y, 1, '#3a3430', 1.6, 6);
          break;
        case 'breath': {
          const a = f.a ?? 0;
          for (let k = 0; k < (this.lowQuality ? 6 : 14); k++) {
            const sp = 40 + Math.random() * 90;
            const aa = a + (Math.random() - 0.5) * 0.9;
            this.push({ k: P_BREATH, x: f.x + Math.cos(a) * 10, y: f.y + Math.sin(a) * 10, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, t: 0, life: 0.55, s: 3 + Math.random() * 3, c: '#ff7a20' });
          }
          if (Math.random() < 0.3) {
            d.fillStyle = 'rgba(30,20,15,0.12)';
            d.beginPath();
            d.arc(f.x + Math.cos(a) * 40, f.y + Math.sin(a) * 40, 14, 0, Math.PI * 2);
            d.fill();
          }
          if (Math.random() < 0.2) this.onSound('fire', f.x, f.y);
          break;
        }
        case 'roar':
          this.onSound('roar', f.x, f.y);
          this.addShake(4);
          this.push({ k: P_RING, x: f.x, y: f.y, vx: 0, vy: 0, t: 0, life: 0.8, s: 60, c: '#ff6030' });
          break;
        case 'heal':
        case 'eheal':
          this.spawn(P_HEAL, f.x, f.y, 2, f.k === 'heal' ? '#7dff9a' : '#c8ff70', 0.9, 12);
          break;
        case 'repair':
          this.spawn(P_SPARK, f.x, f.y, 2, '#ffd27a', 0.3, 25);
          if (Math.random() < 0.2) this.onSound('hammer', f.x, f.y);
          break;
        case 'steam':
          this.spawn(P_SMOKE, f.x, f.y, 1, '#d8d8d8', 1, 10);
          break;
        case 'dust':
          this.spawn(P_DUST, f.x, f.y, 1, '#8a7a5a', 0.8, 10);
          break;
        case 'ladderfall':
          this.spawn(P_DEBRIS, f.x, f.y, 4, '#8a6236', 0.6, 30);
          this.onSound('wood', f.x, f.y);
          break;
        case 'rally':
          this.push({ k: P_RING, x: f.x, y: f.y, vx: 0, vy: 0, t: 0, life: 1, s: 11 * T, c: '#ffd54a' });
          this.onSound('horn', f.x, f.y);
          break;
        case 'volley':
          this.push({ k: P_RING, x: f.x, y: f.y, vx: 0, vy: 0, t: 0, life: 0.6, s: 2.3 * T, c: '#e8f0ff' });
          this.onSound('volley', f.x, f.y);
          break;
        case 'oil':
          for (let k = 0; k < 24; k++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 10 + Math.random() * 40;
            this.push({ k: P_OIL, x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 0.9, s: 3 + Math.random() * 3, c: '#ffb030' });
          }
          d.fillStyle = 'rgba(25,18,10,0.3)';
          d.beginPath();
          d.arc(f.x, f.y, 2.4 * T, 0, Math.PI * 2);
          d.fill();
          this.onSound('fire', f.x, f.y);
          break;
        case 'horn':
          this.onSound('wave', 0, 0);
          break;
      }
    }
    fx.length = 0;
    if (w.dirtyTiles.length) {
      this.rebake(w.dirtyTiles);
      w.dirtyTiles.length = 0;
    }
  }

  addShake(a: number) {
    if (!this.reduceMotion) this.shake = Math.min(8, this.shake + a);
  }

  ping(x: number, y: number, c: string) {
    this.pings.push({ x, y, t: 0, c });
  }

  private push(p: Particle) {
    if (this.particles.length >= this.maxParticles) return;
    this.particles.push(p);
  }

  private spawn(k: number, x: number, y: number, n: number, c: string, life: number, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random());
      this.push({ k, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (k === P_SMOKE || k === P_FLAME || k === P_HEAL ? 12 : 0), t: 0, life: life * (0.6 + Math.random() * 0.6), s: k === P_SMOKE ? 3 : k === P_DUST ? 3.5 : 1.4, c });
    }
  }

  // ------------------------------------------------------------------ frame

  render(alpha: number, dt: number) {
    const w = this.world;
    const ctx = this.ctx;
    this.time += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1b1d1a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!w) return;
    this.consumeFx();
    const cam = this.cam;
    let sx = 0;
    let sy = 0;
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 20);
    }
    const z = cam.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, (cam.w / 2 - cam.x * cam.zoom + sx) * this.dpr, (cam.h / 2 + cam.centerOffsetY() - cam.y * cam.zoom + sy) * this.dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrain, 0, 0, WORLD_W, WORLD_H);
    ctx.drawImage(this.decals, 0, 0, WORLD_W, WORLD_H);
    this.drawStructOverlays(w);
    if (this.deployMode) this.drawDeployZones(w);
    this.drawFires(w);
    this.drawLadders(w);
    this.drawSelection(w);
    this.drawUnits(w, alpha, false);
    this.drawUnits(w, alpha, true);
    this.drawProjectiles(w);
    this.drawParticles(dt);
    this.drawFlyers(w, alpha);
    this.drawBanners(w, alpha);
    this.drawPings(dt);
    if (this.dragLine) {
      const d = this.dragLine;
      ctx.strokeStyle = 'rgba(255,230,140,0.9)';
      ctx.lineWidth = 2 / cam.zoom;
      ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
      ctx.beginPath();
      ctx.moveTo(d.x0, d.y0);
      ctx.lineTo(d.x1, d.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(d.x1, d.y1, 7 / cam.zoom + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // screen-space overlays
    if (this.deployMode || w.state === 'intermission') this.drawApproach(w);
    else this.approachPts.length = 0;
    this.drawEdgeIndicators(w);
  }

  private drawStructOverlays(w: World) {
    const ctx = this.ctx;
    const g = w.grid;
    for (const i of g.structTiles) {
      const f = g.hp[i] / g.maxHp[i];
      if (f > 0.75) continue;
      const x = tx(i) * T;
      const y = ty(i) * T;
      ctx.strokeStyle = f < 0.35 ? 'rgba(20,10,5,0.85)' : 'rgba(30,20,10,0.6)';
      ctx.lineWidth = f < 0.35 ? 1.4 : 0.9;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 2);
      ctx.lineTo(x + 7, y + 7);
      ctx.lineTo(x + 5, y + 11);
      if (f < 0.5) {
        ctx.moveTo(x + 12, y + 3);
        ctx.lineTo(x + 9, y + 8);
        ctx.lineTo(x + 13, y + 13);
      }
      ctx.stroke();
      if (f < 0.35 && g.tiles[i] === Tile.GATE) {
        ctx.fillStyle = 'rgba(255,60,40,0.25)';
        ctx.fillRect(x, y, T, T);
      }
    }
  }

  private drawDeployZones(w: World) {
    const ctx = this.ctx;
    const g = w.grid;
    const z = this.cam.zoom;
    ctx.fillStyle = 'rgba(90,160,255,0.32)';
    ctx.beginPath();
    for (let i = 0; i < g.n; i++) if (g.deployable(i)) ctx.rect(tx(i) * T, ty(i) * T, T, T);
    ctx.fill();
    // outline the edge of the deployable area so it reads on grey stone and green grass alike
    const out = (nx: number, ny: number) => !inb(nx, ny) || !g.deployable(idx(nx, ny));
    ctx.beginPath();
    for (let i = 0; i < g.n; i++) {
      if (!g.deployable(i)) continue;
      const x = tx(i);
      const y = ty(i);
      if (out(x - 1, y)) {
        ctx.moveTo(x * T, y * T);
        ctx.lineTo(x * T, y * T + T);
      }
      if (out(x + 1, y)) {
        ctx.moveTo(x * T + T, y * T);
        ctx.lineTo(x * T + T, y * T + T);
      }
      if (out(x, y - 1)) {
        ctx.moveTo(x * T, y * T);
        ctx.lineTo(x * T + T, y * T);
      }
      if (out(x, y + 1)) {
        ctx.moveTo(x * T, y * T + T);
        ctx.lineTo(x * T + T, y * T + T);
      }
    }
    ctx.strokeStyle = 'rgba(150,200,255,0.95)';
    ctx.lineWidth = Math.max(1, 1.6 / z);
    ctx.stroke();
  }

  /**
   * Red arrows for the edges the next wave comes from (deploy and intermission only). Drawn in screen space
   * at the map edge where that wave's groups enter, but always inside the free area between the HUD bars and
   * pushed out from under HUD panels (`occluders`), so a northern wave is never announced under the top bar.
   */
  private drawApproach(w: World) {
    this.approachPts.length = 0;
    const edges = w.nextWaveEdges();
    if (!edges.length) return;
    const ctx = this.ctx;
    const cam = this.cam;
    // place arrows where that wave's groups enter when the stage data says so
    const waves = w.stage.waves;
    const wi = w.state === 'deploy' ? 0 : w.state === 'intermission' ? w.waveIdx + 1 : Math.max(0, w.waveIdx);
    const wave = waves[Math.min(Math.max(0, wi), waves.length - 1)];
    const R = 14; // half size of the arrow in screen px
    const x0 = R + 2;
    const x1 = cam.w - R - 2;
    const y0 = cam.insetTop + R + 2;
    const y1 = cam.h - cam.insetBottom - R - 2;
    for (const e of edges) {
      const mids = (wave?.groups ?? []).filter((gr) => gr.edge === e).map((gr) => Math.round((gr.span[0] + gr.span[1]) / 2));
      const along = [...new Set(mids)].slice(0, 3);
      const len = e === 'W' || e === 'E' ? GH : GW;
      const pts = along.length ? along.map((v) => (Math.max(1, Math.min(len - 2, v)) + 0.5) * T) : [len * T * 0.35, len * T * 0.65];
      for (const at of pts) {
        const ex = e === 'W' ? cam.toScreenX(0) + 18 : e === 'E' ? cam.toScreenX(WORLD_W) - 18 : cam.toScreenX(at);
        const ey = e === 'N' ? cam.toScreenY(0) + 18 : e === 'S' ? cam.toScreenY(WORLD_H) - 18 : cam.toScreenY(at);
        let x = Math.min(x1, Math.max(x0, ex));
        let y = Math.min(y1, Math.max(y0, ey));
        // out from under HUD panels, along the way the wave walks in
        for (let k = 0; k < 3; k++) {
          const o = this.occluders.find((r) => x + R > r.x0 && x - R < r.x1 && y + R > r.y0 && y - R < r.y1);
          if (!o) break;
          if (e === 'W') x = o.x1 + R + 2;
          else if (e === 'E') x = o.x0 - R - 2;
          else if (e === 'N') y = o.y1 + R + 2;
          else y = o.y0 - R - 2;
        }
        this.approachPts.push({ x, y, edge: e, moved: Math.abs(x - ex) + Math.abs(y - ey) > 2 });
      }
    }
    const pulse = this.reduceMotion ? 0 : 4 * Math.sin(this.time * 4);
    const ang: Record<string, number> = { W: 0, E: Math.PI, N: Math.PI / 2, S: -Math.PI / 2 };
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(235,70,55,0.92)';
    ctx.strokeStyle = 'rgba(40,10,5,0.85)';
    ctx.lineWidth = 1.5;
    for (const p of this.approachPts) {
      ctx.save();
      // brought in from an edge that is off screen or under the HUD: it lies over the map, so let units show through
      ctx.globalAlpha = p.moved ? 0.75 : 1;
      ctx.translate(p.x, p.y);
      ctx.rotate(ang[p.edge] ?? 0);
      ctx.translate(pulse - 3, 0);
      ctx.beginPath();
      ctx.moveTo(R, 0);
      ctx.lineTo(-R * 0.55, -R * 0.8);
      ctx.lineTo(-R * 0.2, 0);
      ctx.lineTo(-R * 0.55, R * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawFires(w: World) {
    const ctx = this.ctx;
    const g = w.grid;
    for (let i = 0; i < g.n; i++) {
      const f = w.fire[i];
      if (f <= 0) continue;
      const x = cx(i);
      const y = cy(i);
      const fl = 0.6 + 0.4 * Math.sin(this.time * 12 + i);
      ctx.fillStyle = `rgba(255,${(110 + 60 * fl) | 0},30,${Math.min(0.55, f / 6)})`;
      ctx.beginPath();
      ctx.arc(x, y, 5 + 2 * fl, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawLadders(w: World) {
    const ctx = this.ctx;
    for (const l of w.ladders) {
      const x1 = cx(l.tile);
      const y1 = cy(l.tile);
      if (l.tower) {
        ctx.fillStyle = 'rgba(255,60,40,0.18)';
        ctx.fillRect(x1 - T / 2, y1 - T / 2, T, T);
        continue;
      }
      const dx = x1 - l.bx;
      const dy = y1 - l.by;
      const d = Math.hypot(dx, dy) || 1;
      const nx = (-dy / d) * 2.2;
      const ny = (dx / d) * 2.2;
      ctx.strokeStyle = '#a07040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.bx + nx, l.by + ny);
      ctx.lineTo(x1 + nx, y1 + ny);
      ctx.moveTo(l.bx - nx, l.by - ny);
      ctx.lineTo(x1 - nx, y1 - ny);
      for (let k = 0.15; k < 1; k += 0.2) {
        ctx.moveTo(l.bx + dx * k + nx, l.by + dy * k + ny);
        ctx.lineTo(l.bx + dx * k - nx, l.by + dy * k - ny);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,70,50,0.7)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x1 - T / 2 + 1, y1 - T / 2 + 1, T - 2, T - 2);
    }
  }

  private drawSelection(w: World) {
    const sq = this.selected;
    if (!sq || sq.alive === 0) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,220,120,0.14)';
    for (const s of sq.slots) ctx.fillRect(tx(s) * T + 1, ty(s) * T + 1, T - 2, T - 2);
    if (sq.destTile >= 0) {
      ctx.strokeStyle = 'rgba(255,220,120,0.65)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(sq.cx, sq.cy);
      ctx.lineTo(cx(sq.destTile), cy(sq.destTile));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (sq.focus && (sq.focus.state === ST.ACTIVE || sq.focus.state === ST.CLIMB)) {
      ctx.strokeStyle = 'rgba(255,80,60,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sq.focus.x, sq.focus.y, sq.focus.def.r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    // range ring for ranged squads
    if (sq.type.ranged) {
      const u = sq.units.find((x) => x.state === ST.ACTIVE);
      if (u) {
        ctx.strokeStyle = 'rgba(160,200,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sq.cx, sq.cy, w.rangeOf(u), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawUnits(w: World, alpha: number, elevPass: boolean) {
    const ctx = this.ctx;
    const b = this.buckets;
    for (const arr of b.values()) arr.length = 0;
    const lerp = (u: Unit) => {
      u.fx = u.fx || 0;
    };
    void lerp;
    const add = (key: string, u: Unit) => {
      let a = b.get(key);
      if (!a) {
        a = [];
        b.set(key, a);
      }
      a.push(u);
    };
    for (const u of w.units) {
      if (u.def.flying) continue;
      if (u.state === ST.DEAD || u.state === ST.FLED || u.state === ST.EVAC) continue;
      const onTop = !!(u.elev || u.state === ST.CLIMB);
      if (onTop !== elevPass) continue;
      if (u.state === ST.DOWN || u.state === ST.CARRIED) {
        add('#down', u);
        continue;
      }
      if (u.def.big) {
        add('#big', u);
        continue;
      }
      add((u.side === 0 ? (u.squad ? u.squad.color : this.theme.dye) : u.def.color) + '|' + u.def.trim + '|' + u.side, u);
    }
    const ix = (u: Unit) => u.px + (u.x - u.px) * alpha;
    const iy = (u: Unit) => u.py + (u.y - u.py) * alpha;
    // downed
    const down = b.get('#down');
    if (down && down.length) {
      ctx.fillStyle = 'rgba(70,70,80,0.9)';
      ctx.beginPath();
      for (const u of down) {
        const x = ix(u);
        const y = iy(u);
        ctx.moveTo(x + 3.5, y);
        ctx.ellipse(x, y, 3.5, 2, 0.5, 0, Math.PI * 2);
      }
      ctx.fill();
      // pulsing marker so players/surgeons notice them
      ctx.fillStyle = `rgba(255,90,90,${0.35 + 0.25 * Math.sin(this.time * 5)})`;
      ctx.beginPath();
      for (const u of down) {
        if (u.side !== 0 || u.state !== ST.DOWN) continue;
        ctx.moveTo(ix(u) + 1.2, iy(u) - 4);
        ctx.arc(ix(u), iy(u) - 4, 1.2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    const zoom = this.cam.zoom;
    const zoomed = zoom > 1.6;
    // keep soldiers at least ~2.7 screen px in radius when zoomed far out (fit zoom on a phone is ~0.5)
    const minR = 2.7 / zoom;
    const R = (u: Unit): number => (u.def.r < minR ? minR : u.def.r);
    const outline = Math.max(0.7, 1 / zoom);
    let drawn = 0;
    for (const [key, arr] of b) {
      // the special buckets are exactly '#down' and '#big'; body colours are hex strings that also start with '#'
      if (!arr.length || key === '#down' || key === '#big') continue;
      drawn += arr.length;
      const [body, trim, side] = key.split('|');
      ctx.fillStyle = body;
      // defenders get a pale rim, attackers a dark one, so the sides read apart even as dots
      ctx.strokeStyle = side === '0' ? 'rgba(230,238,255,0.9)' : 'rgba(12,8,6,0.9)';
      ctx.lineWidth = outline;
      ctx.beginPath();
      for (const u of arr) {
        const x = ix(u);
        const y = iy(u);
        ctx.moveTo(x + R(u), y);
        ctx.arc(x, y, R(u), 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // helmet / trim
      ctx.fillStyle = trim;
      ctx.beginPath();
      for (const u of arr) {
        const x = ix(u) + u.fx * R(u) * 0.25;
        const y = iy(u) + u.fy * R(u) * 0.25;
        const r = R(u) * 0.45;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
      // weapons
      ctx.strokeStyle = 'rgba(225,225,230,0.85)';
      ctx.lineWidth = zoomed ? 0.8 : 0.6;
      ctx.beginPath();
      for (const u of arr) {
        const x = ix(u);
        const y = iy(u);
        const L = u.def.reach > 5 ? R(u) * 2.2 : u.def.range > 0 ? R(u) * 1.2 : R(u) * 1.6;
        const px = -u.fy;
        const py = u.fx;
        ctx.moveTo(x + px * R(u) * 0.7, y + py * R(u) * 0.7);
        ctx.lineTo(x + px * R(u) * 0.7 + u.fx * L, y + py * R(u) * 0.7 + u.fy * L);
      }
      ctx.stroke();
    }
    if (elevPass) this.drawnUnits += drawn;
    else this.drawnUnits = drawn;
    // hit flashes
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    for (const u of w.units) {
      if (u.hitFlash <= 0 || u.def.flying || (u.state !== ST.ACTIVE && u.state !== ST.CLIMB)) continue;
      if (!!(u.elev || u.state === ST.CLIMB) !== elevPass) continue;
      const x = ix(u);
      const y = iy(u);
      ctx.moveTo(x + R(u), y);
      ctx.arc(x, y, R(u), 0, Math.PI * 2);
    }
    ctx.fill();
    const big = b.get('#big');
    if (big) for (const u of big) this.drawBig(u, ix(u), iy(u));
    // health bars for big units & wounded defenders when zoomed in
    for (const u of w.units) {
      if (u.state !== ST.ACTIVE || u.def.flying) continue;
      if (!!u.elev !== elevPass) continue;
      const f = u.hp / u.maxHp;
      if (u.def.big || (zoomed && f < 0.99)) {
        const x = ix(u);
        const y = iy(u) - u.def.r - 3;
        const wdt = u.def.big ? 18 : 6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - wdt / 2, y, wdt, 1.6);
        ctx.fillStyle = u.side === 0 ? '#7ad07a' : '#e05040';
        ctx.fillRect(x - wdt / 2, y, wdt * f, 1.6);
      }
    }
  }

  private drawBig(u: Unit, x: number, y: number) {
    const ctx = this.ctx;
    const r = u.def.r;
    const ang = Math.atan2(u.fy, u.fx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const id = u.def.id;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1a1410';
    if (id === 'h_tower') {
      ctx.fillStyle = '#5a3c22';
      ctx.fillRect(-r, -r * 0.8, r * 2, r * 1.6);
      ctx.strokeRect(-r, -r * 0.8, r * 2, r * 1.6);
      ctx.fillStyle = '#7a5530';
      ctx.fillRect(-r * 0.7, -r * 0.55, r * 1.4, r * 1.1);
      ctx.fillStyle = '#b8333a';
      ctx.fillRect(-r * 0.2, -r * 0.8 - 6, 2, 6);
      ctx.fillRect(-r * 0.2, -r * 0.8 - 6, 6, 3);
    } else if (id === 'w_ram' || id === 'o_ram') {
      ctx.fillStyle = id === 'w_ram' ? '#4a4a52' : '#6a4a2a';
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.6);
      ctx.lineTo(r * 0.8, -r * 0.6);
      ctx.lineTo(r * 0.8, r * 0.6);
      ctx.lineTo(-r, r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(r * 0.6, -2, r * 0.6, 4);
      ctx.fillStyle = '#8a8a92';
      ctx.fillRect(r * 1.1, -3, 3, 6);
    } else if (id === 'h_treb') {
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(-r, -r * 0.5, r * 2, r);
      ctx.strokeRect(-r, -r * 0.5, r * 2, r);
      const swing = Math.sin(this.time * 2 + u.id) * 0.6;
      ctx.rotate(swing);
      ctx.fillStyle = '#4a3218';
      ctx.fillRect(-r * 1.2, -1.5, r * 2.4, 3);
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(-r * 1.2, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'e_ancient') {
      ctx.fillStyle = '#3d2a18';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f6b2a';
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + this.time * 0.2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // troll & generic giants
      ctx.fillStyle = u.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = u.def.trim;
      ctx.beginPath();
      ctx.arc(r * 0.35, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(r * 0.2, r * 0.5, r * 1.1, 3);
    }
    ctx.restore();
    if (u.hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFlyers(w: World, alpha: number) {
    const ctx = this.ctx;
    for (const u of w.units) {
      if (!u.def.flying || u.state !== ST.ACTIVE) continue;
      const x = u.px + (u.x - u.px) * alpha;
      const y = u.py + (u.y - u.py) * alpha;
      const r = u.def.r;
      const ang = Math.atan2(u.fy, u.fx);
      const flap = Math.sin(this.time * (u.def.role === 'dragon' ? 5 : 9) + u.id) * 0.35;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 10, y + 16, r * 1.1, r * 0.6, ang, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = u.def.role === 'dragon' ? '#5a1810' : u.def.color;
      ctx.strokeStyle = '#1a0805';
      ctx.lineWidth = 0.8;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.2, 0);
        ctx.lineTo(-r * 0.4, s * r * (1.6 + flap));
        ctx.lineTo(-r * 0.9, s * r * (1.2 + flap));
        ctx.lineTo(-r * 0.6, s * r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = u.def.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, 0);
      ctx.lineTo(-r * 1.6, Math.sin(this.time * 3 + u.id) * r * 0.3);
      ctx.lineWidth = r * 0.15;
      ctx.strokeStyle = u.def.color;
      ctx.stroke();
      ctx.fillStyle = u.def.trim;
      ctx.beginPath();
      ctx.arc(r * 0.85, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (u.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      const f = u.hp / u.maxHp;
      const bw = u.def.role === 'dragon' ? 40 : 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - bw / 2, y - r - 6, bw, 2.5);
      ctx.fillStyle = '#ff6a3a';
      ctx.fillRect(x - bw / 2, y - r - 6, bw * f, 2.5);
    }
  }

  private drawProjectiles(w: World) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(235,225,200,0.9)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const p of w.projectiles) {
      if (p.t < 0 || p.kind === 'stone' || p.kind === 'fire') continue;
      const dx = p.tx - p.sx;
      const dy = p.ty - p.sy;
      const d = Math.hypot(dx, dy) || 1;
      const k = p.t / p.dur;
      const h = Math.sin(k * Math.PI) * Math.min(14, d * 0.12);
      const L = p.kind === 'bolt' ? 5 : 4;
      ctx.moveTo(p.x, p.y - h);
      ctx.lineTo(p.x - (dx / d) * L, p.y - h - (dy / d) * L + (k - 0.5) * 1.5);
    }
    ctx.stroke();
    for (const p of w.projectiles) {
      if (p.kind === 'stone') {
        const k = p.t / p.dur;
        const h = Math.sin(k * Math.PI) * 50;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a7268';
        ctx.beginPath();
        ctx.arc(p.x, p.y - h, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fire') {
        ctx.fillStyle = '#ff9a30';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    const ps = this.particles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 2.5;
      p.vy *= 1 - dt * 2.5;
      ps[w++] = p;
      const k = p.t / p.life;
      ctx.globalAlpha = 1 - k;
      switch (p.k) {
        case P_RING:
          ctx.strokeStyle = p.c;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * (0.3 + 0.7 * k), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case P_SMOKE:
        case P_DUST:
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * (1 + k * 2), 0, Math.PI * 2);
          ctx.fill();
          break;
        case P_BREATH:
        case P_FLAME:
        case P_OIL:
          ctx.fillStyle = k < 0.4 ? '#ffe070' : p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * (1 - k * 0.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        default:
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
      }
    }
    ps.length = w;
    ctx.globalAlpha = 1;
  }

  private drawBanners(w: World, _alpha: number) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const s = Math.max(0.55, Math.min(1.6, 1.1 / z)) * 1.0;
    for (const sq of w.squads) {
      if (sq.alive === 0) continue;
      const x = sq.cx;
      const y = sq.cy - 10 * s;
      const sel = sq === this.selected;
      // pole
      ctx.strokeStyle = '#2a2016';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(x, y + 8 * s);
      ctx.lineTo(x, y - 12 * s);
      ctx.stroke();
      // flag with cosmetic pattern
      const fw = 15 * s;
      const fh = 10 * s;
      const fx0 = x;
      const fy0 = y - 12 * s;
      const wave = Math.sin(this.time * 3 + sq.id) * 1.2 * s;
      ctx.fillStyle = sq.routing ? '#777' : this.theme.bannerField;
      ctx.beginPath();
      ctx.moveTo(fx0, fy0);
      ctx.lineTo(fx0 + fw, fy0 + wave);
      ctx.lineTo(fx0 + fw, fy0 + fh + wave);
      ctx.lineTo(fx0, fy0 + fh);
      ctx.closePath();
      ctx.fill();
      if (!sq.routing) {
        // heraldic pattern from the equipped banner cosmetic
        ctx.save();
        ctx.clip();
        this.drawPattern(fx0, fy0 + wave / 2, fw, fh, s);
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(fx0, fy0);
      ctx.lineTo(fx0 + fw, fy0 + wave);
      ctx.lineTo(fx0 + fw, fy0 + fh + wave);
      ctx.lineTo(fx0, fy0 + fh);
      ctx.closePath();
      ctx.strokeStyle = sel ? '#ffe08a' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = sel ? 1.6 * s : 0.8 * s;
      ctx.stroke();
      const label = this.labels.get(sq.id) ?? sq.type.short;
      ctx.font = `bold ${(label.length > 1 ? 6.4 : 7) * s}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2 * s;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(label, fx0 + fw / 2, fy0 + fh / 2 + wave / 2 + 0.5 * s);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, fx0 + fw / 2, fy0 + fh / 2 + wave / 2 + 0.5 * s);
      // morale bar
      const mw = 14 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - mw / 2, y + 9 * s, mw, 2.2 * s);
      ctx.fillStyle = sq.morale >= 75 ? '#8fe08a' : sq.morale >= 40 ? '#e8d070' : '#e85a40';
      ctx.fillRect(x - mw / 2, y + 9 * s, (mw * sq.morale) / 100, 2.2 * s);
      if (!sq.auto) {
        ctx.fillStyle = '#ffd54a';
        ctx.beginPath();
        ctx.arc(x - mw / 2 - 2.5 * s, y + 10 * s, 1.6 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      if (sq.routing) {
        ctx.fillStyle = '#ff6a50';
        ctx.font = `bold ${8 * s}px sans-serif`;
        ctx.fillText('!', x - 4 * s, fy0 + fh / 2);
      }
    }
  }

  private drawPattern(x: number, y: number, w: number, h: number, s: number) {
    const ctx = this.ctx;
    ctx.fillStyle = this.theme.bannerCharge;
    ctx.strokeStyle = this.theme.bannerCharge;
    ctx.globalAlpha = 0.75;
    const cx0 = x + w / 2;
    const cy0 = y + h / 2;
    switch (this.theme.bannerPattern) {
      case 'cross':
        ctx.fillRect(cx0 - 1.2 * s, y, 2.4 * s, h);
        ctx.fillRect(x, cy0 - 1.2 * s, w, 2.4 * s);
        break;
      case 'saltire':
        ctx.lineWidth = 2.2 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.moveTo(x + w, y);
        ctx.lineTo(x, y + h);
        ctx.stroke();
        break;
      case 'chevron':
        ctx.lineWidth = 2.4 * s;
        ctx.beginPath();
        ctx.moveTo(x, y + h);
        ctx.lineTo(cx0, y + h * 0.3);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        break;
      case 'quarter':
        ctx.fillRect(x, y, w / 2, h / 2);
        ctx.fillRect(cx0, cy0, w / 2, h / 2);
        break;
      case 'pale':
        ctx.fillRect(x + w / 3, y, w / 3, h);
        break;
      case 'star': {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = (k % 2 ? 1.6 : 3.8) * s;
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          ctx.lineTo(cx0 + Math.cos(a) * r, cy0 + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'tower':
        ctx.fillRect(cx0 - 2.5 * s, cy0 - 1.5 * s, 5 * s, 5 * s);
        ctx.fillRect(cx0 - 2.5 * s, cy0 - 3 * s, 1.4 * s, 1.6 * s);
        ctx.fillRect(cx0 - 0.7 * s, cy0 - 3 * s, 1.4 * s, 1.6 * s);
        ctx.fillRect(cx0 + 1.1 * s, cy0 - 3 * s, 1.4 * s, 1.6 * s);
        break;
      default:
        ctx.fillRect(x, y + h - 2 * s, w, 2 * s);
    }
    ctx.globalAlpha = 1;
  }

  private drawPings(dt: number) {
    const ctx = this.ctx;
    let w = 0;
    for (const p of this.pings) {
      p.t += dt;
      if (p.t > 1.5) continue;
      this.pings[w++] = p;
      ctx.strokeStyle = p.c;
      ctx.globalAlpha = 1 - p.t / 1.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + p.t * 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    this.pings.length = w;
  }

  /** arrows on screen edges pointing at off-screen ladders/breaches/dragon */
  private drawEdgeIndicators(w: World) {
    const ctx = this.ctx;
    const cam = this.cam;
    const pts: { x: number; y: number; c: string }[] = [];
    for (const l of w.ladders) pts.push({ x: cx(l.tile), y: cy(l.tile), c: '#ff8040' });
    for (const u of w.activeEnemies) if (u.def.role === 'dragon' || (u.def.role === 'sapper' && u.act === 2)) pts.push({ x: u.x, y: u.y, c: '#ff4030' });
    const m = 22;
    const top = cam.insetTop + m;
    const bottom = cam.h - cam.insetBottom - m;
    this.edgePts.length = 0;
    for (const p of pts.slice(0, 12)) {
      const sx = cam.toScreenX(p.x);
      const sy = cam.toScreenY(p.y);
      if (sx > m && sx < cam.w - m && sy > top && sy < bottom) continue;
      const ex = Math.min(cam.w - m, Math.max(m, sx));
      const ey = Math.min(bottom, Math.max(top, sy));
      this.edgePts.push({ x: ex, y: ey });
      const ang = Math.atan2(sy - ey, sx - ex);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(this.time * 6);
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-6, -8);
      ctx.lineTo(-6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ------------------------------------------------------------------ picking

  /** banner flag centre on screen (the flag hangs right of the pole, above the squad) */
  bannerScreen(sq: Squad) {
    const s = Math.max(0.55, Math.min(1.6, 1.1 / this.cam.zoom));
    return { x: this.cam.toScreenX(sq.cx + 7.5 * s), y: this.cam.toScreenY(sq.cy - 17 * s) };
  }

  /**
   * Squad under a tap: nearest banner flag within `radiusPx` (or a per-squad radius from `radiusOf`),
   * then, with `bodies`, one of its soldiers.
   */
  squadAt(sx: number, sy: number, radiusPx = 30, bodies = true, radiusOf?: (sq: Squad) => number): Squad | null {
    const w = this.world;
    if (!w) return null;
    let best: Squad | null = null;
    let bd = Infinity;
    for (const sq of w.squads) {
      if (sq.alive === 0) continue;
      const r = radiusOf ? radiusOf(sq) : radiusPx;
      const p = this.bannerScreen(sq);
      const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
      if (d < r * r && d < bd) {
        bd = d;
        best = sq;
      }
    }
    if (best || !bodies) return best;
    // otherwise: tap on soldiers of a squad
    const wx = this.cam.toWorldX(sx);
    const wy = this.cam.toWorldY(sy);
    let bu: Unit | null = null;
    let bud = (14 / this.cam.zoom) ** 2;
    for (const u of w.defs) {
      if (u.state !== ST.ACTIVE) continue;
      const d = (u.x - wx) ** 2 + (u.y - wy) ** 2;
      if (d < bud) {
        bud = d;
        bu = u;
      }
    }
    return bu ? bu.squad : null;
  }

  /** Nearest attacker within ~16 screen px of a tap (on walls and ladders too). */
  enemyAt(sx: number, sy: number, radiusPx = 16): Unit | null {
    const w = this.world;
    if (!w) return null;
    const wx = this.cam.toWorldX(sx);
    const wy = this.cam.toWorldY(sy);
    let best: Unit | null = null;
    let bd = Infinity;
    for (const e of w.activeEnemies) {
      if (e.fleeing) continue;
      const R = e.def.r + radiusPx / this.cam.zoom;
      const d = (e.x - wx) ** 2 + (e.y - wy) ** 2;
      if (d < R * R && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  tileAtScreen(sx: number, sy: number) {
    const wx = this.cam.toWorldX(sx);
    const wy = this.cam.toWorldY(sy);
    if (wx < 0 || wy < 0 || wx >= WORLD_W || wy >= WORLD_H) return -1;
    return tileAt(wx, wy);
  }
}
