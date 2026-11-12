import { WORLD_H, WORLD_W } from '../sim/defs';

/** World <-> screen transform (CSS pixels). */
export class Camera {
  x = WORLD_W / 2; // world point at screen centre
  y = WORLD_H / 2;
  zoom = 1;
  w = 800; // viewport css px
  h = 450;
  insetTop = 0;
  insetBottom = 0;
  minZoom = 0.5;
  maxZoom = 4;

  resize(w: number, h: number, top: number, bottom: number) {
    this.w = w;
    this.h = h;
    this.insetTop = top;
    this.insetBottom = bottom;
    this.minZoom = this.fitZoom() * 0.9;
    this.maxZoom = Math.max(3.2, this.fitZoom() * 4);
    this.clamp();
  }

  /** zoom that fits the whole map into the free area between HUD bars */
  fitZoom() {
    const ah = Math.max(100, this.h - this.insetTop - this.insetBottom);
    return Math.min(this.w / WORLD_W, ah / WORLD_H);
  }

  fit() {
    this.zoom = this.fitZoom();
    this.x = WORLD_W / 2;
    this.y = WORLD_H / 2 - (this.insetTop - this.insetBottom) / 2 / this.zoom;
    this.clamp();
  }

  /**
   * Opening view: fill the free height and keep the castle (east side) in view. With `box` (the castle's
   * walls in world px) the whole wall ring stays between the HUD bars: the view shifts, and zooms out
   * only as far as it must.
   */
  focusCastle(kx: number, _ky: number, box?: { x0: number; y0: number; x1: number; y1: number }) {
    const ah = Math.max(100, this.h - this.insetTop - this.insetBottom);
    const pad = 8; // screen px kept free between the walls and a HUD bar
    let z = Math.min(this.maxZoom, Math.max(this.fitZoom(), ah / (WORLD_H * 0.78)));
    if (box && (box.y1 - box.y0) * z > ah - 2 * pad) z = Math.max(this.fitZoom(), (ah - 2 * pad) / Math.max(1, box.y1 - box.y0));
    this.zoom = z;
    const vw = this.w / this.zoom;
    this.x = vw >= WORLD_W ? WORLD_W / 2 : Math.min(WORLD_W - vw / 2, Math.max(vw / 2, kx - vw * 0.2));
    this.y = WORLD_H / 2;
    if (box) {
      const half = ah / 2 / z;
      const p = pad / z;
      if (box.y1 + p > this.y + half) this.y = box.y1 + p - half;
      if (box.y0 - p < this.y - half) this.y = box.y0 - p + half;
    }
    this.clamp();
  }

  centerOffsetY() {
    return (this.insetTop - this.insetBottom) / 2;
  }

  toScreenX(wx: number) {
    return (wx - this.x) * this.zoom + this.w / 2;
  }
  toScreenY(wy: number) {
    return (wy - this.y) * this.zoom + this.h / 2 + this.centerOffsetY();
  }
  toWorldX(sx: number) {
    return (sx - this.w / 2) / this.zoom + this.x;
  }
  toWorldY(sy: number) {
    return (sy - this.h / 2 - this.centerOffsetY()) / this.zoom + this.y;
  }

  pan(dx: number, dy: number) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
    this.clamp();
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const wx = this.toWorldX(sx);
    const wy = this.toWorldY(sy);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    // keep (wx, wy) under the finger
    this.x = wx - (sx - this.w / 2) / this.zoom;
    this.y = wy - (sy - this.h / 2 - this.centerOffsetY()) / this.zoom;
    this.clamp();
  }

  clamp() {
    const vw = this.w / this.zoom;
    const vh = (this.h - this.insetTop - this.insetBottom) / this.zoom;
    const mx = Math.max(0, (vw - WORLD_W) / 2) + vw * 0.15;
    const my = Math.max(0, (vh - WORLD_H) / 2) + vh * 0.15;
    this.x = Math.min(WORLD_W - vw / 2 + mx, Math.max(vw / 2 - mx, this.x));
    this.y = Math.min(WORLD_H - vh / 2 + my, Math.max(vh / 2 - my, this.y));
  }
}
