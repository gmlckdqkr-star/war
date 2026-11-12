import { WORLD_H, WORLD_W } from './defs';

export interface HasPos {
  x: number;
  y: number;
}

/** Uniform-grid spatial hash rebuilt every tick (linked lists in typed arrays, no per-tick allocation). */
export class SpatialHash<T extends HasPos> {
  readonly cs: number;
  readonly cw: number;
  readonly ch: number;
  private heads: Int32Array;
  private nexts = new Int32Array(1024);
  items: T[] = [];

  constructor(cellSize = 32) {
    this.cs = cellSize;
    this.cw = Math.ceil(WORLD_W / cellSize) + 1;
    this.ch = Math.ceil(WORLD_H / cellSize) + 1;
    this.heads = new Int32Array(this.cw * this.ch);
  }

  private cell(x: number, y: number) {
    let cx = Math.floor(x / this.cs);
    let cy = Math.floor(y / this.cs);
    if (cx < 0) cx = 0;
    else if (cx >= this.cw) cx = this.cw - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.ch) cy = this.ch - 1;
    return cy * this.cw + cx;
  }

  build(items: T[]) {
    this.items = items;
    this.heads.fill(-1);
    if (this.nexts.length < items.length) this.nexts = new Int32Array(items.length * 2);
    for (let i = 0; i < items.length; i++) {
      const c = this.cell(items[i].x, items[i].y);
      this.nexts[i] = this.heads[c];
      this.heads[c] = i;
    }
  }

  /** Visit every item within radius r of (x, y). Return true from fn to stop early. */
  each(x: number, y: number, r: number, fn: (it: T, d2: number) => boolean | void) {
    const x0 = Math.max(0, Math.floor((x - r) / this.cs));
    const x1 = Math.min(this.cw - 1, Math.floor((x + r) / this.cs));
    const y0 = Math.max(0, Math.floor((y - r) / this.cs));
    const y1 = Math.min(this.ch - 1, Math.floor((y + r) / this.cs));
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        let i = this.heads[cy * this.cw + cx];
        while (i >= 0) {
          const it = this.items[i];
          const dx = it.x - x;
          const dy = it.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && fn(it, d2) === true) return;
          i = this.nexts[i];
        }
      }
  }

  /** Lowest-score item within radius; score(it, d2) returns Infinity to reject. */
  best(x: number, y: number, r: number, score: (it: T, d2: number) => number): T | null {
    let best: T | null = null;
    let bs = Infinity;
    this.each(x, y, r, (it, d2) => {
      const s = score(it, d2);
      if (s < bs) {
        bs = s;
        best = it;
      }
    });
    return best;
  }

  count(x: number, y: number, r: number, pred?: (it: T) => boolean): number {
    let n = 0;
    this.each(x, y, r, (it) => {
      if (!pred || pred(it)) n++;
    });
    return n;
  }
}
