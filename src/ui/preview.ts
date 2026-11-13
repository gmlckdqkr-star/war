/**
 * Drawn previews of cosmetics, so players see exactly what they get before spending medals or money
 * (banner with its heraldry, a small castle in its stone colours, a soldier line in the dye).
 */
import type { Cosmetic } from '../meta/cosmetics';
import { h } from './dom';

type Size = 'sm' | 'lg';

const DIM: Record<Size, [number, number]> = { sm: [44, 44], lg: [104, 78] };

function canvasFor(size: Size): [HTMLCanvasElement, CanvasRenderingContext2D | null, number, number] {
  const [w, hgt] = DIM[size];
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const cv = h('canvas', { class: 'pv-canvas ' + size, width: String(Math.round(w * dpr)), height: String(Math.round(hgt * dpr)), 'aria-hidden': 'true' }) as HTMLCanvasElement;
  cv.style.width = w + 'px';
  cv.style.height = hgt + 'px';
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = cv.getContext('2d');
    ctx?.scale(dpr, dpr);
  } catch {
    ctx = null;
  }
  return [cv, ctx, w, hgt];
}

function drawPattern(c: CanvasRenderingContext2D, pattern: string, x: number, y: number, w: number, hh: number, charge: string) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, hh);
  c.clip();
  c.fillStyle = charge;
  c.strokeStyle = charge;
  const cx = x + w / 2;
  const cy = y + hh / 2;
  const t = Math.max(2, w * 0.14);
  switch (pattern) {
    case 'cross':
      c.fillRect(cx - t / 2, y, t, hh);
      c.fillRect(x, cy - t / 2, w, t);
      break;
    case 'saltire':
      c.lineWidth = t;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w, y + hh);
      c.moveTo(x + w, y);
      c.lineTo(x, y + hh);
      c.stroke();
      break;
    case 'chevron':
      c.lineWidth = t * 1.1;
      c.beginPath();
      c.moveTo(x - 1, y + hh);
      c.lineTo(cx, y + hh * 0.3);
      c.lineTo(x + w + 1, y + hh);
      c.stroke();
      break;
    case 'quarter':
      c.fillRect(x, y, w / 2, hh / 2);
      c.fillRect(cx, cy, w / 2, hh / 2);
      break;
    case 'pale':
      c.fillRect(x + w / 3, y, w / 3, hh);
      break;
    case 'star': {
      const r = Math.min(w, hh) * 0.36;
      c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      c.closePath();
      c.fill();
      break;
    }
    case 'tower': {
      const tw = w * 0.34;
      const th = hh * 0.6;
      const tx = cx - tw / 2;
      const ty = cy - th / 2 + hh * 0.06;
      c.fillRect(tx, ty, tw, th);
      const m = tw / 5;
      for (let i = 0; i < 3; i++) c.fillRect(tx + i * 2 * m, ty - m, m, m);
      break;
    }
    default:
      c.fillRect(x, y + hh * 0.72, w, hh * 0.12);
  }
  c.restore();
}

function drawBanner(c: CanvasRenderingContext2D, w: number, hh: number, field: string, charge: string, pattern: string) {
  const pole = Math.max(2, w * 0.05);
  const px = w * 0.2;
  c.fillStyle = '#6b5232';
  c.fillRect(px, hh * 0.08, pole, hh * 0.86);
  c.fillStyle = '#c9a24a';
  c.beginPath();
  c.arc(px + pole / 2, hh * 0.08, pole * 0.9, 0, Math.PI * 2);
  c.fill();
  const fx = px + pole;
  const fy = hh * 0.14;
  const fw = w * 0.66;
  const fh = hh * 0.5;
  c.fillStyle = field;
  c.beginPath();
  c.moveTo(fx, fy);
  c.lineTo(fx + fw, fy);
  c.lineTo(fx + fw * 0.9, fy + fh * 0.5);
  c.lineTo(fx + fw, fy + fh);
  c.lineTo(fx, fy + fh);
  c.closePath();
  c.fill();
  drawPattern(c, pattern, fx, fy, fw * 0.9, fh, charge);
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = 1;
  c.strokeRect(fx + 0.5, fy + 0.5, fw * 0.9 - 1, fh - 1);
}

function drawCastle(c: CanvasRenderingContext2D, w: number, hh: number, stone: string, dark: string) {
  c.fillStyle = '#3d4a2e';
  c.fillRect(0, hh * 0.86, w, hh * 0.14);
  const base = hh * 0.88;
  const wallTop = hh * 0.48;
  const towerTop = hh * 0.22;
  const tw = w * 0.22;
  // wall
  c.fillStyle = stone;
  c.fillRect(w * 0.12, wallTop, w * 0.76, base - wallTop);
  // towers
  for (const x of [w * 0.06, w * 0.94 - tw]) {
    c.fillStyle = stone;
    c.fillRect(x, towerTop, tw, base - towerTop);
    c.fillStyle = dark;
    c.beginPath();
    c.moveTo(x - tw * 0.12, towerTop);
    c.lineTo(x + tw / 2, towerTop - hh * 0.16);
    c.lineTo(x + tw * 1.12, towerTop);
    c.closePath();
    c.fill();
  }
  // crenellations
  c.fillStyle = stone;
  const m = w * 0.06;
  for (let x = w * 0.3; x < w * 0.7; x += m * 2) c.fillRect(x, wallTop - m, m, m);
  // masonry lines
  c.strokeStyle = dark;
  c.globalAlpha = 0.5;
  c.lineWidth = 1;
  for (let y = wallTop + 5; y < base; y += 6) {
    c.beginPath();
    c.moveTo(w * 0.12, y);
    c.lineTo(w * 0.88, y);
    c.stroke();
  }
  c.globalAlpha = 1;
  // gate
  c.fillStyle = '#3a2817';
  const gw = w * 0.16;
  c.beginPath();
  c.moveTo(w / 2 - gw / 2, base);
  c.lineTo(w / 2 - gw / 2, base - hh * 0.16);
  c.arc(w / 2, base - hh * 0.16, gw / 2, Math.PI, 0);
  c.lineTo(w / 2 + gw / 2, base);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.5)';
  c.strokeRect(w * 0.12 + 0.5, wallTop + 0.5, w * 0.76 - 1, base - wallTop - 1);
}

function drawSoldiers(c: CanvasRenderingContext2D, w: number, hh: number, dye: string) {
  const n = w > 60 ? 5 : 3;
  const r = Math.min(w / (n * 2.6), hh * 0.16);
  for (let i = 0; i < n; i++) {
    const x = (w / (n + 1)) * (i + 1);
    const y = hh * 0.55 + (i % 2) * r * 0.5;
    // spear
    c.strokeStyle = '#8a8f98';
    c.lineWidth = Math.max(1, r * 0.18);
    c.beginPath();
    c.moveTo(x + r * 0.9, y + r);
    c.lineTo(x + r * 0.9, y - r * 2.4);
    c.stroke();
    c.fillStyle = dye;
    c.strokeStyle = 'rgba(10,10,12,0.75)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // helmet
    c.fillStyle = '#c7ccd4';
    c.beginPath();
    c.arc(x, y - r * 0.15, r * 0.45, 0, Math.PI * 2);
    c.fill();
  }
}

/** A drawn preview of a cosmetic ('sm' for lists, 'lg' for detail views). */
export function cosmeticPreview(c: Cosmetic, size: Size = 'sm'): HTMLElement {
  if (c.kind === 'title') return h('span', { class: 'pv title ' + size, title: c.name }, '❝');
  const [cv, ctx, w, hh] = canvasFor(size);
  if (ctx) {
    try {
      if (c.kind === 'banner') drawBanner(ctx, w, hh, c.colors[0], c.colors[1] ?? '#fff', c.pattern ?? 'plain');
      else if (c.kind === 'castle') drawCastle(ctx, w, hh, c.colors[0], c.colors[1] ?? c.colors[0]);
      else drawSoldiers(ctx, w, hh, c.colors[0]);
    } catch {
      /* preview is decoration only */
    }
  }
  return h('span', { class: 'pv-wrap ' + size }, cv);
}

/** Large card: preview + name + kind, used for season and product showcases. */
export function cosmeticCard(c: Cosmetic, extra?: string): HTMLElement {
  return h(
    'div',
    { class: 'pv-card' },
    cosmeticPreview(c, 'lg'),
    h('b', null, c.name),
    h('small', null, extra ?? { dye: '갑주 색', banner: '깃발', castle: '성채 외관', title: '칭호' }[c.kind]),
  );
}
