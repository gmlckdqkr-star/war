/**
 * "War council": coordinated squad AI for auto-mode squads, plus the optional auto-commander.
 * Squads cover each other: threats are scored, the nearest free melee squads are dispatched
 * (with hysteresis so they don't thrash), archers drift to the walls with the best field of fire,
 * engineers pick safe repairs, and idle squads return to their posts.
 */
import { GH, GW, TILE, Tile, UNITS } from './defs';
import { cx, cy, idx, inb, tileAt, tx, ty } from './grid';
import type { Squad, World } from './world';
import { ST } from './world';

const T = TILE;
const CS = 4; // threat cell size in tiles
const CW = Math.ceil(GW / CS);
const CH = Math.ceil(GH / CS);

interface Threat {
  weight: number;
  x: number;
  y: number;
  n: number;
  tile: number;
}

const DCS = 2;
const DW = Math.ceil(GW / DCS);
const DH = Math.ceil(GH / DCS);

/**
 * Scratch buffers and tick counters of the council. One per World: nothing here may live at module
 * level, or a battle's outcome would depend on whatever battle ran before it in the same process.
 */
export class CouncilState {
  tw = new Float32Array(CW * CH);
  tsx = new Float32Array(CW * CH);
  tsy = new Float32Array(CW * CH);
  tn = new Int32Array(CW * CH);
  dens = new Float32Array(DW * DH);
  danger = new Float32Array(DW * DH);
  /** enemies on the ground inside the walls / at the keep (extra weight for the shooters) */
  idens = new Float32Array(DW * DH);
  rangedTick = 0;
}

const MELEE = new Set(['spear', 'sword', 'knight', 'militia']);
/** extra weight of an enemy inside the walls for the shooters' choice of position (doubled at the keep) */
const INTRUDER_W = 2;

export function findThreats(w: World): Threat[] {
  const g = w.grid;
  const { tw, tsx, tsy, tn } = w.council;
  tw.fill(0);
  tsx.fill(0);
  tsy.fill(0);
  tn.fill(0);
  for (const e of w.activeEnemies) {
    if (e.fleeing || e.def.role === 'dragon') continue;
    const ti = tileAt(e.x, e.y);
    const inner = e.elev || e.state === ST.CLIMB || g.inside[ti] === 1 || g.isBoundary(ti);
    let standTile = -1;
    let wgt = 0;
    if (inner) {
      wgt = 3;
      standTile = e.state === ST.CLIMB ? e.actTile : ti;
    } else {
      // attacking a wall/gate from outside?
      const x = tx(ti);
      const y = ty(ti);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (!inb(x + dx, y + dy)) continue;
        const j = idx(x + dx, y + dy);
        if (g.isStruct(j)) {
          wgt = g.tiles[j] === Tile.GATE ? 1.6 : 0.8;
          // defenders hold a gate from the courtyard side, walls from the wall-top
          standTile = j;
          break;
        }
      }
    }
    if (!wgt) continue;
    if (e.def.big) wgt *= 4;
    if (e.def.leader) wgt *= 2;
    const c = Math.floor(ty(standTile) / CS) * CW + Math.floor(tx(standTile) / CS);
    tw[c] += wgt;
    tsx[c] += cx(standTile);
    tsy[c] += cy(standTile);
    tn[c]++;
  }
  for (const l of w.ladders) {
    const c = Math.floor(ty(l.tile) / CS) * CW + Math.floor(tx(l.tile) / CS);
    const add = l.tower ? 10 : 4;
    tw[c] += add;
    tsx[c] += cx(l.tile) * 2;
    tsy[c] += cy(l.tile) * 2;
    tn[c] += 2;
  }
  const out: Threat[] = [];
  for (let c = 0; c < CW * CH; c++) {
    if (tw[c] < 3 || tn[c] === 0) continue;
    const x = tsx[c] / tn[c];
    const y = tsy[c] / tn[c];
    let tile = tileAt(x, y);
    if (!g.deployable(tile)) tile = g.nearestTile(tile, (j) => g.deployable(j), 4);
    if (tile < 0) continue;
    // gate under attack from outside: hold it from the inside
    if (g.tiles[tile] === Tile.GATE) {
      const inner = g.nearestTile(tile, (j) => g.inside[j] === 1, 2);
      if (inner >= 0) tile = inner;
    }
    out.push({ weight: tw[c], x, y, n: tn[c], tile });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

export function runCouncil(w: World) {
  const g = w.grid;
  const threats = findThreats(w);
  // ---------------- melee squads ----------------
  const melee = w.squads.filter((s) => s.auto && !s.routing && s.alive > 0 && MELEE.has(s.type.id));
  const assigned = new Map<Squad, Threat>();
  for (const th of threats) {
    const demand = Math.max(1, Math.min(3, Math.ceil(th.weight / 14)));
    const cands = melee
      .filter((s) => !assigned.has(s))
      .map((s) => {
        let d = Math.hypot(s.cx - th.x, s.cy - th.y) / (s.type.id === 'knight' ? 1.6 : 1);
        if (s.destTile >= 0 && Math.hypot(cx(s.destTile) - th.x, cy(s.destTile) - th.y) < 3 * T) d *= 0.5; // hysteresis
        if (s.engaged > 2 && Math.hypot(s.cx - th.x, s.cy - th.y) > 4 * T) d += 30 * T; // don't abandon a fight
        return { s, d };
      })
      .filter((c) => c.d < 34 * T)
      .sort((a, b) => a.d - b.d);
    for (let k = 0; k < demand && k < cands.length; k++) assigned.set(cands[k].s, th);
  }
  for (const s of melee) {
    const th = assigned.get(s);
    if (th) {
      if (s.destTile < 0 || Math.hypot(cx(s.destTile) - cx(th.tile), cy(s.destTile) - cy(th.tile)) > 2.2 * T) w.orderMove(s, th.tile, false);
    } else if (s.homeTile >= 0 && s.destTile !== s.homeTile && s.engaged === 0) {
      w.orderMove(s, s.homeTile, false);
    }
  }

  // ---------------- ranged squads (every 2 s) ----------------
  const cs = w.council;
  const { dens, danger, idens } = cs;
  cs.rangedTick++;
  if (cs.rangedTick % 4 === 0) {
    dens.fill(0);
    danger.fill(0);
    idens.fill(0);
    // intruders: enemies on the ground inside the walls or at the keep. Shooting them comes first,
    // so they weigh extra and shooters may leave their stretch of wall (or come down) to reach them.
    let inN = 0;
    let x0 = GW;
    let x1 = -1;
    let y0 = GH;
    let y1 = -1;
    for (const e of w.activeEnemies) {
      if (e.fleeing) continue;
      const c = Math.min(DH - 1, Math.floor(e.y / (DCS * T))) * DW + Math.min(DW - 1, Math.floor(e.x / (DCS * T)));
      if (c < 0) continue;
      const tiE = tileAt(e.x, e.y);
      dens[c] += e.def.role === 'ladder' || e.def.role === 'sapper' || e.def.big ? 2 : 1;
      if (e.elev || g.inside[tiE]) danger[c] += 1;
      if (!e.elev && !e.def.flying && (g.inside[tiE] === 1 || g.keepAdj[tiE] === 1)) {
        idens[c] += (g.keepAdj[tiE] ? INTRUDER_W * 2 : INTRUDER_W) * (e.def.big ? 2 : 1);
        inN++;
        x0 = Math.min(x0, tx(tiE));
        x1 = Math.max(x1, tx(tiE));
        y0 = Math.min(y0, ty(tiE));
        y1 = Math.max(y1, ty(tiE));
      }
    }
    const claimed: number[] = [];
    for (const s of w.squads) if (s.type.ranged && s.destTile >= 0 && (!s.auto || s.type.id === 'ballista')) claimed.push(s.destTile);
    for (const s of w.squads) {
      if (!s.auto || s.routing || s.alive === 0 || !s.type.ranged || s.type.id === 'ballista') continue;
      const crowd = (tile: number) => {
        let p = 0;
        for (const c of claimed) if (Math.max(Math.abs(tx(c) - tx(tile)), Math.abs(ty(c) - ty(tile))) < 4) p += 6;
        return p;
      };
      if (s.homeTile < 0) continue;
      const range = UNITS[s.type.unit].range;
      /** what this squad could shoot from `tile` (range in tiles; +25% from a wall top), minus the danger there */
      const score = (tile: number) => {
        const elev = g.isElev(tile);
        const x = tx(tile) / DCS;
        const y = ty(tile) / DCS;
        const r = (range * (elev ? 1.25 : 1)) / DCS;
        // reach of the squad as a whole is a bit less than a soldier's (they spread around the tile)
        const ri = r - 1 / DCS;
        // on the ground any intruder can close in: keep further from them
        const rz = elev ? 1.2 : 2.2;
        let sc = 0;
        let dz = 0;
        for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(DH - 1, Math.ceil(y + r)); yy++)
          for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(DW - 1, Math.ceil(x + r)); xx++) {
            const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
            const c = yy * DW + xx;
            if (d <= r) sc += dens[c];
            if (d <= ri) sc += idens[c];
            if (d <= rz) dz += danger[c];
          }
        return sc - dz * 5;
      };
      const cur = s.destTile >= 0 ? s.destTile : s.homeTile;
      const curScore = score(cur) - crowd(cur);
      let best = cur;
      let bs = curScore;
      const consider = (i: number) => {
        const sc = score(i) - crowd(i) - Math.hypot(tx(i) - tx(cur), ty(i) - ty(cur)) * 0.12;
        if (sc > bs) {
          bs = sc;
          best = i;
        }
      };
      const hx = tx(s.homeTile);
      const hy = ty(s.homeTile);
      for (let y = Math.max(0, hy - 12); y <= Math.min(GH - 1, hy + 12); y++)
        for (let x = Math.max(0, hx - 12); x <= Math.min(GW - 1, hx + 12); x++) {
          if ((x + y) % 2) continue;
          const i = idx(x, y);
          if (g.isElev(i) && g.deployable(i)) consider(i);
        }
      if (inN > 0) {
        // wall walks, towers and courtyard ground within reach of the intruders, wherever they are
        const m = Math.ceil(range * 1.25);
        for (let y = Math.max(0, y0 - m); y <= Math.min(GH - 1, y1 + m); y++)
          for (let x = Math.max(0, x0 - m); x <= Math.min(GW - 1, x1 + m); x++) {
            if ((x + y) % 2) continue;
            if (Math.abs(x - hx) <= 12 && Math.abs(y - hy) <= 12 && g.isElev(idx(x, y))) continue; // seen above
            const i = idx(x, y);
            if (g.deployable(i) && (g.isElev(i) || g.inside[i] === 1) && !g.keepAdj[i]) consider(i);
          }
      }
      if (curScore <= 0 && bs <= 0 && cur !== s.homeTile) {
        w.orderMove(s, s.homeTile, false);
        claimed.push(s.homeTile);
      } else if (best !== cur && bs > curScore * 1.25 + 2) {
        w.orderMove(s, best, false);
        claimed.push(best);
      } else claimed.push(cur);
    }
  }

  // ---------------- engineers ----------------
  for (const s of w.squads) {
    if (s.type.id !== 'engineer' || s.alive === 0 || s.routing || !s.auto) continue;
    const near = (tile: number, r: number) =>
      w.activeEnemies.some((e) => !e.fleeing && !e.def.flying && Math.hypot(e.x - cx(tile), e.y - cy(tile)) < r * T);
    const valid = () => {
      const t = s.taskTile;
      if (t < 0) return false;
      if (s.taskKind === 4) return w.fire[t] > 0;
      if (s.taskKind === 1) return g.isStruct(t) && g.hp[t] < g.maxHp[t] * 0.98 && !near(t, 2.2) && w.supplies.mats > 1;
      if (s.taskKind === 2) return g.tiles[t] === Tile.GATE_BROKEN && !near(t, 4) && w.supplies.mats >= 40;
      if (s.taskKind === 3) return g.tiles[t] === Tile.RUBBLE && g.wallLine[t] === 1 && !near(t, 4) && w.supplies.mats >= 60;
      return false;
    };
    if (valid()) continue;
    let best = -1;
    let bk = 0;
    let bs = 0;
    const consider = (i: number, kind: number, sc: number) => {
      sc -= Math.hypot(cx(i) - s.cx, cy(i) - s.cy) / (40 * T);
      if (sc > bs) {
        bs = sc;
        best = i;
        bk = kind;
      }
    };
    for (let i = 0; i < g.n; i++) {
      const t = g.tiles[i];
      if (w.fire[i] > 0 && g.isStruct(i)) {
        if (!near(i, 2.2)) consider(i, 4, 2.5);
        continue;
      }
      if (g.isStruct(i)) {
        const f = g.hp[i] / g.maxHp[i];
        if (f < 0.85 && w.supplies.mats > 1 && !near(i, 2.2)) consider(i, 1, (1 - f) * 2 * (t === Tile.GATE ? 1.6 : 1));
      } else if (t === Tile.GATE_BROKEN && w.supplies.mats >= 40 && !near(i, 4)) consider(i, 2, 2.2);
      else if (t === Tile.RUBBLE && w.supplies.mats >= 60 && !near(i, 4) && isWallGap(w, i)) consider(i, 3, 1.4);
    }
    if (best !== s.taskTile) s.rebuild = 0;
    s.taskTile = best;
    s.taskKind = bk;
  }
}

/** rubble that sits in the castle's original wall line (a collapsed wall, not field debris) */
function isWallGap(w: World, i: number) {
  return w.grid.wallLine[i] === 1;
}

/**
 * Optional assistant that casts commander abilities with simple, readable rules.
 * Players can switch it on for hands-off play; the balance bot also uses it.
 */
export function autoCommander(w: World) {
  const g = w.grid;
  if (w.state !== 'battle' && w.state !== 'intermission') return;
  // rally a breaking squad
  if (!w.canUse('rally')) {
    const weak = w.squads.filter((s) => s.alive > 0 && (s.routing || s.morale < 28)).sort((a, b) => a.morale - b.morale)[0];
    if (weak) w.useAbility('rally', weak.cx, weak.cy);
  }
  // boiling oil on the most crowded wall/gate
  if (!w.canUse('oil')) {
    let best = -1;
    let bn = 5;
    for (const s of g.structTiles) {
      let n = 0;
      for (const e of w.activeEnemies) {
        if (e.def.flying || (e.elev && e.state !== ST.CLIMB)) continue;
        if (Math.abs(e.x - cx(s)) < 2.6 * T && Math.abs(e.y - cy(s)) < 2.6 * T) n += e.def.big ? 5 : 1;
      }
      if (n > bn) {
        bn = n;
        best = s;
      }
    }
    if (best >= 0) w.useAbility('oil', cx(best), cy(best));
  }
  // volley into the densest crowd within archer range
  if (!w.canUse('volley')) {
    const archers = w.activeDefs.filter((u) => u.def.range > 0 && u.def.id !== 'd_ballista' && u.ammo >= 1);
    if (archers.length >= 4) {
      let bx = 0;
      let by = 0;
      let bn = 11;
      for (const e of w.activeEnemies) {
        if (e.fleeing || e.def.flying) continue;
        const n = w.eHash.count(e.x, e.y, 2.3 * T);
        if (n > bn) {
          let inRange = 0;
          for (const a of archers) if (Math.hypot(a.x - e.x, a.y - e.y) < w.rangeOf(a) * 1.3) inRange++;
          if (inRange >= 4) {
            bn = n;
            bx = e.x;
            by = e.y;
          }
        }
      }
      if (bn > 11) w.useAbility('volley', bx, by);
    }
  }
  // reserves when the courtyard is overrun or the keep is hit
  if (!w.canUse('reserve')) {
    const inside = w.activeEnemies.filter((e) => !e.fleeing && (g.inside[tileAt(e.x, e.y)] === 1 || e.elev)).length;
    if (inside >= 10 || w.keepHp < w.keepMax * 0.85) w.useAbility('reserve', g.keepX, g.keepY);
  }
}
