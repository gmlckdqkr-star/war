import { GH, GW, TILE, Tile, TILE_INFO, type FieldKind, type TileId } from './defs';
import type { RNG } from './rng';

export const N8: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export const idx = (x: number, y: number) => y * GW + x;
export const tx = (i: number) => i % GW;
export const ty = (i: number) => (i / GW) | 0;
export const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < GW && y < GH;
export const tileAt = (px: number, py: number) => {
  let x = Math.floor(px / TILE);
  let y = Math.floor(py / TILE);
  if (x < 0) x = 0;
  else if (x >= GW) x = GW - 1;
  if (y < 0) y = 0;
  else if (y >= GH) y = GH - 1;
  return y * GW + x;
};
export const cx = (i: number) => (tx(i) + 0.5) * TILE;
export const cy = (i: number) => (ty(i) + 0.5) * TILE;

/** Small binary min-heap keyed by float priority, storing tile indices. */
class Heap {
  private k: Float64Array;
  private v: Int32Array;
  n = 0;
  constructor(cap: number) {
    this.k = new Float64Array(cap);
    this.v = new Int32Array(cap);
  }
  clear() {
    this.n = 0;
  }
  push(key: number, val: number) {
    if (this.n >= this.k.length) {
      const k2 = new Float64Array(this.k.length * 2);
      k2.set(this.k);
      const v2 = new Int32Array(this.v.length * 2);
      v2.set(this.v);
      this.k = k2;
      this.v = v2;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= key) break;
      this.k[i] = this.k[p];
      this.v[i] = this.v[p];
      i = p;
    }
    this.k[i] = key;
    this.v[i] = val;
  }
  popKey = 0;
  pop(): number {
    const top = this.v[0];
    this.popKey = this.k[0];
    const lk = this.k[--this.n];
    const lv = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= lk) break;
      this.k[i] = this.k[c];
      this.v[i] = this.v[c];
      i = c;
    }
    this.k[i] = lk;
    this.v[i] = lv;
    return top;
  }
}

export interface Field {
  dist: Float64Array;
  next: Int32Array;
}

export function newField(): Field {
  return { dist: new Float64Array(GW * GH), next: new Int32Array(GW * GH) };
}

export class Grid {
  readonly n = GW * GH;
  tiles = new Uint8Array(GW * GH);
  hp = new Float32Array(GW * GH);
  maxHp = new Float32Array(GW * GH);
  /** 1 = inside the castle (ground reachable from the keep without crossing structures) */
  inside = new Uint8Array(GW * GH);
  /** 1 = tile touches the keep (enemies here attack the keep) */
  keepAdj = new Uint8Array(GW * GH);
  /** number of ladders/siege towers docked against this wall tile */
  ladders = new Uint8Array(GW * GH);
  keepTiles: number[] = [];
  depots: number[] = [];
  infirmaries: number[] = [];
  structTiles: number[] = [];
  keepX = 0;
  keepY = 0;
  version = 0;
  /** path-search scratch heap, owned by this grid (no shared module state) */
  private heap = new Heap(GW * GH * 4);

  get(x: number, y: number): TileId {
    return this.tiles[idx(x, y)] as TileId;
  }
  set(x: number, y: number, t: TileId) {
    if (inb(x, y)) this.tiles[idx(x, y)] = t;
  }
  info(i: number) {
    return TILE_INFO[this.tiles[i]];
  }
  isStruct(i: number) {
    return TILE_INFO[this.tiles[i]].struct;
  }
  isElev(i: number) {
    const t = this.tiles[i];
    return t === Tile.WALL || t === Tile.TOWER;
  }
  /** wall line tiles that count as castle boundary (not plain outside ground) */
  isBoundary(i: number) {
    const t = this.tiles[i];
    return t === Tile.WALL || t === Tile.TOWER || t === Tile.GATE || t === Tile.GATE_BROKEN || t === Tile.RUBBLE;
  }
  outsideGround(i: number) {
    return !this.inside[i] && !this.isBoundary(i);
  }

  // ---------------- builder helpers ----------------
  fill(t: TileId) {
    this.tiles.fill(t);
  }
  rect(x0: number, y0: number, x1: number, y1: number, t: TileId) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, t);
  }
  line(x0: number, y0: number, x1: number, y1: number, t: TileId) {
    const dx = Math.sign(x1 - x0);
    const dy = Math.sign(y1 - y0);
    let x = x0;
    let y = y0;
    this.set(x, y, t);
    while (x !== x1 || y !== y1) {
      if (x !== x1) x += dx;
      if (y !== y1) y += dy;
      this.set(x, y, t);
    }
  }
  /** Walls around a rectangle, interior becomes courtyard, optional corner towers and gates. */
  wallRect(x0: number, y0: number, x1: number, y1: number, opts: { gates?: [number, number][]; towers?: boolean; floor?: boolean } = {}) {
    if (opts.floor !== false) this.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, Tile.FLOOR);
    this.line(x0, y0, x1, y0, Tile.WALL);
    this.line(x0, y1, x1, y1, Tile.WALL);
    this.line(x0, y0, x0, y1, Tile.WALL);
    this.line(x1, y0, x1, y1, Tile.WALL);
    if (opts.towers !== false) {
      this.set(x0, y0, Tile.TOWER);
      this.set(x1, y0, Tile.TOWER);
      this.set(x0, y1, Tile.TOWER);
      this.set(x1, y1, Tile.TOWER);
    }
    for (const [gx, gy] of opts.gates ?? []) this.set(gx, gy, Tile.GATE);
  }
  keep(cx0: number, cy0: number) {
    this.rect(cx0 - 1, cy0 - 1, cx0 + 1, cy0 + 1, Tile.KEEP);
  }
  /** Scatter random patches of a tile over plain grass (outside castle decoration / terrain). */
  patches(t: TileId, count: number, size: number, rng: RNG, x0 = 0, y0 = 0, x1 = GW - 1, y1 = GH - 1) {
    for (let k = 0; k < count; k++) {
      let x = rng.int(x0, x1);
      let y = rng.int(y0, y1);
      const len = rng.int(size, size * 3);
      for (let s = 0; s < len; s++) {
        if (inb(x, y) && this.get(x, y) === Tile.GRASS) this.set(x, y, t);
        x += rng.int(-1, 1);
        y += rng.int(-1, 1);
        if (x < x0 || x > x1 || y < y0 || y > y1) break;
      }
    }
  }

  /** Must be called once after building: computes inside region, HP, caches. */
  finalize(structHpMul = 1) {
    this.keepTiles = [];
    this.depots = [];
    this.infirmaries = [];
    for (let i = 0; i < this.n; i++) {
      const t = this.tiles[i];
      if (t === Tile.KEEP) this.keepTiles.push(i);
    }
    if (this.keepTiles.length === 0) throw new Error('stage has no keep');
    let sx = 0;
    let sy = 0;
    for (const k of this.keepTiles) {
      sx += cx(k);
      sy += cy(k);
    }
    this.keepX = sx / this.keepTiles.length;
    this.keepY = sy / this.keepTiles.length;
    // keep adjacency
    this.keepAdj.fill(0);
    for (const k of this.keepTiles) {
      for (const [dx, dy] of N8) {
        const x = tx(k) + dx;
        const y = ty(k) + dy;
        if (!inb(x, y)) continue;
        const j = idx(x, y);
        if (this.tiles[j] !== Tile.KEEP && TILE_INFO[this.tiles[j]].epass) this.keepAdj[j] = 1;
      }
    }
    // "outside" = ground reachable from the west/north/south map edges without crossing structures.
    // Everything else that is walkable ground is inside the castle (incl. outer baileys of multi-wall castles).
    const outside = new Uint8Array(this.n);
    const q: number[] = [];
    const seed = (i: number) => {
      if (outside[i]) return;
      const inf = TILE_INFO[this.tiles[i]];
      if (!inf.epass || inf.struct) return;
      outside[i] = 1;
      q.push(i);
    };
    for (let x = 0; x < GW; x++) {
      seed(idx(x, 0));
      seed(idx(x, GH - 1));
    }
    for (let y = 0; y < GH; y++) seed(idx(0, y));
    while (q.length) {
      const i = q.pop()!;
      const x = tx(i);
      const y = ty(i);
      for (let d = 0; d < 4; d++) {
        const nx = x + N8[d][0];
        const ny = y + N8[d][1];
        if (inb(nx, ny)) seed(idx(nx, ny));
      }
    }
    this.inside.fill(0);
    for (let i = 0; i < this.n; i++) {
      const inf = TILE_INFO[this.tiles[i]];
      if (!outside[i] && inf.dpass && !inf.struct && this.tiles[i] !== Tile.KEEP) this.inside[i] = 1;
    }
    for (let i = 0; i < this.n; i++) {
      const t = this.tiles[i];
      if (this.inside[i] && t === Tile.GRASS) this.tiles[i] = Tile.FLOOR;
      if (t === Tile.DEPOT) this.depots.push(i);
      if (t === Tile.INFIRM) this.infirmaries.push(i);
      const inf = TILE_INFO[this.tiles[i]];
      this.maxHp[i] = inf.maxHp * structHpMul;
      this.hp[i] = this.maxHp[i];
    }
    this.refreshStructs();
  }

  refreshStructs() {
    this.structTiles = [];
    for (let i = 0; i < this.n; i++) if (this.isStruct(i)) this.structTiles.push(i);
    this.version++;
  }

  /** Is the castle fully enclosed (no inside tile on the map edge)? */
  enclosed(): boolean {
    for (let x = 0; x < GW; x++) if (this.inside[idx(x, 0)] || this.inside[idx(x, GH - 1)]) return false;
    for (let y = 0; y < GH; y++) if (this.inside[idx(0, y)] || this.inside[idx(GW - 1, y)]) return false;
    return true;
  }

  // ---------------- movement rules ----------------
  /** Can a defender step from tile a to tile b? */
  defCanMove(a: number, b: number): boolean {
    const tb = this.tiles[b];
    const ib = TILE_INFO[tb];
    if (!ib.dpass) return false;
    if (a === b) return true;
    const elevA = this.isElev(a);
    const elevB = ib.elev;
    // cannot climb a wall from outside ground, cannot jump off a wall to outside ground
    if (elevB && !elevA && this.outsideGround(a)) return false;
    if (elevA && !elevB && this.outsideGround(b)) return false;
    return true;
  }

  /** Can an enemy ground unit step from tile a to tile b? elev = unit is on top of the wall. */
  enemyCanMove(a: number, b: number, elev: boolean): boolean {
    const tb = this.tiles[b];
    if (tb === Tile.KEEP || tb === Tile.CLIFF) return false;
    const ib = TILE_INFO[tb];
    if (ib.struct) return elev && ib.elev; // walk along the wall top only once climbed
    return ib.epass;
  }

  // ---------------- path fields ----------------
  enemyEnterCost(i: number, kind: FieldKind): number {
    const t = this.tiles[i];
    const inf = TILE_INFO[t];
    if (t === Tile.KEEP || t === Tile.CLIFF) return Infinity;
    if (!inf.struct) return inf.cost;
    const hp = this.hp[i];
    const lad = this.ladders[i] > 0;
    if (kind === 'ram') {
      if (t === Tile.GATE) return 1;
      return Infinity;
    }
    if (kind === 'escalade') {
      if (t === Tile.WALL) return lad ? 2 : 3 + hp / 450;
      if (t === Tile.GATE) return 9 + hp / 90;
      return 45 + hp / 60; // tower
    }
    // breach
    if (t === Tile.WALL) return lad ? 3 : 24 + hp / 55;
    if (t === Tile.GATE) return 5 + hp / 95;
    return 70 + hp / 40;
  }

  /** Reverse Dijkstra from keep-adjacent tiles. dist = cost-to-keep for enemies walking there. */
  enemyField(kind: FieldKind, f: Field) {
    const { dist, next } = f;
    const heap = this.heap;
    dist.fill(Infinity);
    next.fill(-1);
    heap.clear();
    for (let i = 0; i < this.n; i++)
      if (this.keepAdj[i]) {
        dist[i] = 0;
        heap.push(0, i);
      }
    const cost = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) cost[i] = this.enemyEnterCost(i, kind);
    while (heap.n) {
      const u = heap.pop();
      const du = heap.popKey;
      if (du > dist[u]) continue;
      const ux = tx(u);
      const uy = ty(u);
      const cu = cost[u];
      if (!isFinite(cu)) continue;
      for (let d = 0; d < 8; d++) {
        const [dx, dy, len] = N8[d];
        const vx = ux + dx;
        const vy = uy + dy;
        if (!inb(vx, vy)) continue;
        const v = idx(vx, vy);
        const tv = this.tiles[v];
        if (tv === Tile.KEEP || tv === Tile.CLIFF) continue;
        if (d >= 4) {
          // no diagonal corner cutting through anything that is not open ground
          const a = idx(ux, vy);
          const b = idx(vx, uy);
          if (!this.openGround(a) || !this.openGround(b) || !this.openGround(u) || !this.openGround(v)) continue;
        }
        const nd = du + cu * len;
        if (nd < dist[v]) {
          dist[v] = nd;
          next[v] = u;
          heap.push(nd, v);
        }
      }
    }
  }

  openGround(i: number) {
    const inf = TILE_INFO[this.tiles[i]];
    return inf.epass && !inf.struct;
  }

  /** Multi-source Dijkstra for defenders toward a set of goal tiles. */
  defenderField(goals: number[], f: Field) {
    const { dist, next } = f;
    const heap = this.heap;
    dist.fill(Infinity);
    next.fill(-1);
    heap.clear();
    for (const g of goals) {
      dist[g] = 0;
      heap.push(0, g);
    }
    while (heap.n) {
      const u = heap.pop();
      const du = heap.popKey;
      if (du > dist[u]) continue;
      const ux = tx(u);
      const uy = ty(u);
      const inf = TILE_INFO[this.tiles[u]];
      const cu = inf.elev ? 1.15 : inf.cost;
      for (let d = 0; d < 8; d++) {
        const [dx, dy, len] = N8[d];
        const vx = ux + dx;
        const vy = uy + dy;
        if (!inb(vx, vy)) continue;
        const v = idx(vx, vy);
        if (!TILE_INFO[this.tiles[v]].dpass) continue;
        if (!this.defCanMove(v, u)) continue;
        if (d >= 4) {
          const a = idx(ux, vy);
          const b = idx(vx, uy);
          if (!TILE_INFO[this.tiles[a]].dpass || !TILE_INFO[this.tiles[b]].dpass) continue;
          if (this.isElev(a) !== this.isElev(b)) continue;
        }
        const nd = du + cu * len;
        if (nd < dist[v]) {
          dist[v] = nd;
          next[v] = u;
          heap.push(nd, v);
        }
      }
    }
  }

  /** BFS formation slots: up to `count` tiles of the same "layer" (wall-top vs ground) around a destination. */
  slotTiles(dest: number, count: number): number[] {
    const elev = this.isElev(dest);
    const insideDest = this.inside[dest] || this.isBoundary(dest);
    const out: number[] = [];
    const seen = new Set<number>([dest]);
    const q = [dest];
    let qi = 0;
    while (qi < q.length && out.length < count) {
      const i = q[qi++];
      const ok = TILE_INFO[this.tiles[i]].dpass && this.isElev(i) === elev && (insideDest ? this.inside[i] || this.isBoundary(i) : true);
      if (ok) out.push(i);
      else if (i !== dest) continue;
      const x = tx(i);
      const y = ty(i);
      for (let d = 0; d < 8; d++) {
        const nx = x + N8[d][0];
        const ny = y + N8[d][1];
        if (!inb(nx, ny)) continue;
        const j = idx(nx, ny);
        if (seen.has(j)) continue;
        seen.add(j);
        const inf = TILE_INFO[this.tiles[j]];
        if (!inf.dpass) continue;
        if (this.isElev(j) !== elev) continue;
        q.push(j);
      }
    }
    if (out.length === 0) out.push(dest);
    return out;
  }

  /** Nearest tile satisfying pred, BFS by 8-neighbourhood (simple ring search). */
  nearestTile(from: number, pred: (i: number) => boolean, maxR = 40): number {
    if (pred(from)) return from;
    const fx = tx(from);
    const fy = ty(from);
    for (let r = 1; r <= maxR; r++) {
      let best = -1;
      let bd = Infinity;
      for (let y = fy - r; y <= fy + r; y++)
        for (let x = fx - r; x <= fx + r; x++) {
          if (Math.max(Math.abs(x - fx), Math.abs(y - fy)) !== r || !inb(x, y)) continue;
          const i = idx(x, y);
          if (!pred(i)) continue;
          const d = (x - fx) ** 2 + (y - fy) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Is a defender allowed to be deployed / ordered to this tile? */
  deployable(i: number) {
    const inf = TILE_INFO[this.tiles[i]];
    return inf.dpass && (this.inside[i] === 1 || this.isBoundary(i));
  }
}
