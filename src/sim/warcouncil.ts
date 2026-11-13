/**
 * War council between waves (작전 회의): each intermission offers three of the options below, drawn
 * from the seed and the wave number (so a replay offers the same choice). The player picks one; if
 * nobody picks, the council takes the most needed option itself when the next wave starts.
 * Every option names its exact effect, and amounts are fixed when the offer is made.
 */
import { BANDS, Tile } from './defs';
import { tileAt } from './grid';
import { josa } from './josa';
import { RNG } from './rng';
import type { Edge } from './stages';
import { ST, type World } from './world';

export interface CouncilOption {
  id: string;
  name: string;
  desc: string;
}

/** Option ids and their names (names are at most 6 Korean characters). */
export const COUNCIL_NAMES: Record<string, string> = {
  repair: '성벽 수리',
  gate: '성문 보강',
  resupply: '화살 보급',
  rest: '휴식',
  scout: '정찰',
  relief: '구호품',
  forage: '식량 징발',
  mats: '자재 반입',
};
export const COUNCIL_IDS = Object.keys(COUNCIL_NAMES);

/** share of a structure's full strength the masons put back ('repair') */
export const REPAIR_FRAC = 0.3;
/** intact gates are strengthened by this factor once ('gate') */
export const GATE_BOOST = 1.3;
export const REST_MORALE = 20;
/** share of their missing HP the soldiers recover while resting */
export const REST_HEAL = 0.4;
export const SCOUT_MORALE = 10;

const EDGE_KO: Record<Edge, string> = { W: '서쪽', N: '북쪽', S: '남쪽', E: '동쪽' };
const round10 = (x: number) => Math.round(x / 10) * 10;

function activeSoldiers(w: World) {
  let n = 0;
  for (const u of w.defs) if (u.state === ST.ACTIVE) n++;
  return n;
}
const hasSquad = (w: World, pred: (id: string) => boolean) => w.squads.some((q) => q.alive > 0 && pred(q.type.id));
function wallGates(w: World) {
  const g = w.grid;
  const out: number[] = [];
  for (let i = 0; i < g.n; i++) if (g.wallLine[i] && (g.tiles[i] === Tile.GATE || g.tiles[i] === Tile.GATE_BROKEN)) out.push(i);
  return out;
}

/** Draw this intermission's three options and fix their amounts. */
export function openCouncil(w: World) {
  w.councilPick = null;
  const sup = w.stage.supplies;
  const pool = COUNCIL_IDS.filter((id) => {
    if (id === 'resupply') return hasSquad(w, (t) => t === 'archer' || t === 'xbow' || t === 'ballista');
    if (id === 'relief') return hasSquad(w, (t) => t === 'surgeon');
    if (id === 'mats') return hasSquad(w, (t) => t === 'engineer');
    if (id === 'gate') return wallGates(w).length > 0;
    return true;
  });
  const rng = new RNG((w.cfg.seed ^ Math.imul(w.waveIdx + 1, 0x85ebca6b) ^ 0x1b873593) >>> 0);
  rng.shuffle(pool);
  w.councilOffer = pool.slice(0, 3);
  w.councilAmt = {
    resupply: Math.max(150, round10(sup.arrows * 0.4)),
    relief: Math.max(4, Math.round(sup.meds * 0.5)),
    forage: Math.max(5, Math.ceil(activeSoldiers(w) / 2)),
    mats: Math.max(40, round10(sup.mats * 0.5)),
  };
}

export function councilDesc(w: World, id: string): string {
  const a = w.councilAmt;
  switch (id) {
    case 'repair':
      return `성벽·탑·성문 내구도 ${Math.round(REPAIR_FRAC * 100)}% 복구`;
    case 'gate':
      return `성문 재건·완전 수리, 내구도 +${Math.round((GATE_BOOST - 1) * 100)}%`;
    case 'resupply':
      return `화살 +${a.resupply}`;
    case 'rest':
      return `전 분대 사기 +${REST_MORALE}, 잃은 체력 ${Math.round(REST_HEAL * 100)}% 회복`;
    case 'scout':
      return `다음 물결 구성·방향 보고, 사기 +${SCOUT_MORALE}`;
    case 'relief':
      return `의약품 +${a.relief}`;
    case 'forage':
      return `식량 +${a.forage} (한 물결분)`;
    case 'mats':
      return `자재 +${a.mats}`;
  }
  return '';
}

export function councilOptionList(w: World): CouncilOption[] {
  return w.councilOffer.map((id) => ({ id, name: COUNCIL_NAMES[id], desc: councilDesc(w, id) }));
}

/** Carry out a council decision. `auto` = the council chose it itself (no pick before the next wave). */
export function applyCouncil(w: World, id: string, auto: boolean) {
  const g = w.grid;
  const a = w.councilAmt;
  const desc = councilDesc(w, id);
  w.councilPick = id;
  w.councilLog.push(id);
  if (id === 'repair') {
    for (const i of g.structTiles) if (g.wallLine[i]) g.hp[i] = Math.min(g.maxHp[i], g.hp[i] + g.maxHp[i] * REPAIR_FRAC);
  } else if (id === 'gate') {
    let rebuilt = false;
    for (const i of wallGates(w)) {
      if (g.tiles[i] === Tile.GATE) {
        if (!w.gateBoosted.has(i)) {
          g.maxHp[i] *= GATE_BOOST;
          w.gateBoosted.add(i);
        }
        g.hp[i] = g.maxHp[i];
      } else if (!w.activeEnemies.some((e) => tileAt(e.x, e.y) === i)) {
        g.tiles[i] = Tile.GATE;
        g.maxHp[i] = w.gateBaseHp() * GATE_BOOST;
        w.gateBoosted.add(i);
        g.hp[i] = g.maxHp[i];
        w.dirtyTiles.push(i);
        rebuilt = true;
      }
    }
    if (rebuilt) {
      g.refreshStructs();
      w.fieldsDirty = true;
    }
  } else if (id === 'resupply') {
    w.supplies.arrows += a.resupply;
    w.arrowsIn += a.resupply;
  } else if (id === 'rest') {
    for (const q of w.squads) if (q.alive > 0) q.morale = Math.min(100, q.morale + REST_MORALE);
    for (const u of w.defs) if (u.state === ST.ACTIVE) u.hp += (u.maxHp - u.hp) * REST_HEAL;
  } else if (id === 'scout') {
    for (const q of w.squads) if (q.alive > 0) q.morale = Math.min(100, q.morale + SCOUT_MORALE);
    w.event('scout', scoutReport(w), 'info');
  } else if (id === 'relief') {
    w.supplies.meds += a.relief;
  } else if (id === 'forage') {
    w.supplies.food += a.forage;
  } else if (id === 'mats') {
    w.supplies.mats += a.mats;
  }
  const name = COUNCIL_NAMES[id];
  w.event('council', auto ? `작전 회의가 ${josa(name, '을/를')} 택했습니다: ${desc}` : `작전 회의 — ${name}: ${desc}`, 'good');
}

/** What the scouts saw of the next wave: its bands, side by side. */
export function scoutReport(w: World): string {
  const wv = w.stage.waves[w.waveIdx + 1];
  if (!wv) return '정찰 보고: 더 이상 다가오는 적이 보이지 않습니다.';
  const by = new Map<Edge, string[]>();
  for (const gr of wv.groups) {
    const name = BANDS[gr.band]?.name ?? gr.band;
    const list = by.get(gr.edge) ?? [];
    const n = gr.n ?? 1;
    list.push(n > 1 ? `${name} ${n}` : name);
    by.set(gr.edge, list);
  }
  return '정찰 보고 — ' + [...by].map(([e, l]) => `${EDGE_KO[e]}: ${l.join('·')}`).join(' / ');
}

/** How much the castle needs each option right now (the council's own pick; higher = more needed). */
export function councilNeed(w: World, id: string): number {
  const g = w.grid;
  const a = w.councilAmt;
  const wavesLeft = Math.max(1, w.totalWaves() - (w.waveIdx + 1));
  if (id === 'repair') {
    let m = 0;
    for (const i of g.structTiles) if (g.wallLine[i]) m += Math.min(REPAIR_FRAC, 1 - g.hp[i] / g.maxHp[i]) * (g.tiles[i] === Tile.GATE ? 2 : 1);
    return m * 0.6;
  }
  if (id === 'gate') {
    let s = 0;
    for (const i of wallGates(w)) s += g.tiles[i] === Tile.GATE ? (1 - g.hp[i] / g.maxHp[i]) * 2 + (w.gateBoosted.has(i) ? 0 : 0.25) : 3;
    return s;
  }
  if (id === 'resupply') {
    const used = Math.max(0, w.arrowsIn - w.supplies.arrows);
    const perWave = used / Math.max(1, w.waveIdx + 1);
    const short = perWave * wavesLeft - w.supplies.arrows;
    return short > 0 ? 1 + 2 * Math.min(1, short / a.resupply) : 0.2;
  }
  if (id === 'forage') {
    const per = Math.ceil(activeSoldiers(w) / 2);
    if (w.supplies.food < per) return 4;
    const short = per * wavesLeft - w.supplies.food;
    return short > 0 ? 1.5 + Math.min(1.5, short / per) : 0.1;
  }
  if (id === 'relief') {
    let downed = 0;
    for (const u of w.defs) if (u.state === ST.DOWN || u.state === ST.CARRIED) downed++;
    if (w.supplies.meds < 2) return 2.5 + downed * 0.1;
    return w.supplies.meds < a.relief ? 1.2 : 0.2;
  }
  if (id === 'mats') {
    let gaps = 0;
    for (let i = 0; i < g.n; i++) if (g.wallLine[i] && (g.tiles[i] === Tile.RUBBLE || g.tiles[i] === Tile.GATE_BROKEN)) gaps++;
    if (gaps && w.supplies.mats < 60) return 2;
    return w.supplies.mats < 40 ? 1.2 : 0.2;
  }
  if (id === 'rest') {
    let low = 0;
    let n = 0;
    let miss = 0;
    let max = 0;
    for (const q of w.squads) {
      if (q.alive === 0) continue;
      n++;
      low += Math.max(0, 75 - q.morale) / 25 + (q.routing ? 1 : 0);
    }
    for (const u of w.defs)
      if (u.state === ST.ACTIVE) {
        miss += u.maxHp - u.hp;
        max += u.maxHp;
      }
    return (n ? low / n : 0) + (max ? (miss / max) * 3 : 0);
  }
  return 0.5; // scout
}

/**
 * Next wave starting: an offer the player has not taken is decided by the council itself (the option
 * the castle needs most), whether or not the auto-commander is on. Letting the night pass is never worse
 * than a sensible pick, so a player who gives no orders is not punished for it; picking well still pays.
 */
export function closeCouncil(w: World) {
  if (!w.councilPick && w.councilOffer.length) {
    let best = w.councilOffer[0];
    let bs = -Infinity;
    for (const id of w.councilOffer) {
      const s = councilNeed(w, id);
      if (s > bs) {
        bs = s;
        best = id;
      }
    }
    applyCouncil(w, best, true);
  }
  w.councilOffer = [];
}


