/**
 * Pre-battle helpers: planned supply packs (paid only when a result is recorded), lineup strength,
 * food forecast and "ready first" lineups after losses. Pure functions over the save, no DOM.
 */
import { SQUAD_TYPES } from '../sim/defs';
import type { StageDef, Supplies } from '../sim/stages';
import type { SaveData } from '../meta/save';
import { SUPPLY_PRICE, baseSupplies, defaultLineup, foodNeeded, lineupSoldiers, rankOf, readyCount, refillCost, refillSquad, squadCap, treatCost, treatSquad } from '../meta/progression';

export const MAX_PACKS = 3;

export function packsOf(extra: Partial<Supplies>, k: keyof Supplies): number {
  return Math.round((extra[k] ?? 0) / SUPPLY_PRICE[k].per);
}

/** Gold the planned packs will cost. Nothing is paid while planning. */
export function planCost(extra: Partial<Supplies>): number {
  let c = 0;
  for (const k of Object.keys(SUPPLY_PRICE) as (keyof Supplies)[]) c += Math.max(0, packsOf(extra, k)) * SUPPLY_PRICE[k].pack;
  return c;
}

export interface Strength {
  ready: number;
  full: number;
  wounded: number;
  missing: number;
}

/** Soldiers of a lineup that can fight now vs. the squads' full size. */
export function lineupStrength(s: SaveData, ids: string[]): Strength {
  const out: Strength = { ready: 0, full: 0, wounded: 0, missing: 0 };
  for (const id of ids) {
    const r = s.roster.find((x) => x.id === id);
    if (!r) continue;
    const size = SQUAD_TYPES[r.type].size;
    out.ready += readyCount(r);
    out.full += size;
    out.wounded += r.soldiers.filter((x) => x.wounded > 0).length;
    out.missing += Math.max(0, size - r.soldiers.length);
  }
  return out;
}

/** Gold to refill / treat every squad in the roster (same as the barracks "모두" buttons). */
export function careCosts(s: SaveData) {
  return { fill: s.roster.reduce((a, r) => a + refillCost(r), 0), heal: s.roster.reduce((a, r) => a + treatCost(r), 0) };
}

/** Refill or treat every squad that needs it; stops at the first squad the gold no longer covers. */
export function careAll(s: SaveData, kind: 'fill' | 'heal'): { done: number; err: string | null } {
  let done = 0;
  for (const r of s.roster) {
    const need = kind === 'fill' ? refillCost(r) : treatCost(r);
    if (need <= 0) continue;
    const err = kind === 'fill' ? refillSquad(s, r) : treatSquad(s, r);
    if (err) return { done, err };
    done++;
  }
  return { done, err: null };
}

/**
 * Lineup that prefers squads able to fight: keeps the chosen squads that still have ready soldiers,
 * swaps squads that are mostly out (under half) for idle squads that are at least 3/4 ready, then fills
 * free slots the way the default lineup would.
 */
export function readyLineup(s: SaveData, st: StageDef, ids: string[]): string[] {
  const cap = squadCap(s, st);
  const ratio = (id: string) => {
    const r = s.roster.find((x) => x.id === id);
    return r ? readyCount(r) / SQUAD_TYPES[r.type].size : 0;
  };
  const keep = ids.filter((id) => ratio(id) > 0).slice(0, cap);
  const idle = s.roster
    .filter((r) => !keep.includes(r.id) && readyCount(r) > 0)
    .sort((a, b) => readyCount(b) / SQUAD_TYPES[b.type].size - readyCount(a) / SQUAD_TYPES[a.type].size || rankOf(b) - rankOf(a))
    .map((r) => r.id);
  for (let i = 0; i < keep.length; i++) {
    if (ratio(keep[i]) >= 0.5) continue;
    const j = idle.findIndex((id) => ratio(id) >= 0.75);
    if (j < 0) break;
    const out = keep[i];
    keep[i] = idle[j];
    idle.splice(j, 1, out);
  }
  for (const id of [...defaultLineup(s, st), ...idle]) {
    if (keep.length >= cap) break;
    if (!keep.includes(id) && ratio(id) > 0) keep.push(id);
  }
  return keep;
}

export interface FoodForecast {
  /** food the battle needs if nobody falls (campaign / daily) or per wave (endless) */
  need: number;
  have: number;
  perWave: number;
  short: number;
  /** packs to add to cover the shortfall, limited by the pack cap */
  packs: number;
  /** true when even the extra packs cannot cover it */
  stillShort: boolean;
}

export function foodForecast(s: SaveData, st: StageDef, ids: string[], extra: Partial<Supplies>, endless: boolean): FoodForecast {
  const soldiers = lineupSoldiers(s, ids);
  const perWave = Math.ceil(soldiers / 2);
  const have = baseSupplies(s, st).food + (extra.food ?? 0);
  const need = endless ? perWave : foodNeeded(st, soldiers);
  const short = endless ? 0 : Math.max(0, need - have);
  const per = SUPPLY_PRICE.food.per;
  const left = Math.max(0, MAX_PACKS - packsOf(extra, 'food'));
  const want = Math.ceil(short / per);
  return { need, have, perWave, short, packs: Math.min(want, left), stillShort: want > left };
}
