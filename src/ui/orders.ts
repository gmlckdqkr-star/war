/**
 * Order bookkeeping that lives in the UI but changes squads: melee charges ordered by tapping an enemy.
 * Every change to a squad goes through a World command (commandMove / commandFocus / commandStance), so
 * a resumed battle records and replays it like any other order. No DOM here (unit-tested).
 */
import { ST, type Squad, type Stance, type Unit, type World } from '../sim/world';
import type { ChargeRec } from './resume';

const STANCES: readonly Stance[] = ['hold', 'defend', 'aggressive'];

export class Charges {
  /** target null = the target is gone (not in the world any more): the charge ends at the next check */
  private map = new Map<Squad, { target: Unit | null; prev: Stance }>();

  get size() {
    return this.map.size;
  }
  has(sq: Squad) {
    return this.map.has(sq);
  }
  delete(sq: Squad) {
    this.map.delete(sq);
  }
  clear() {
    this.map.clear();
  }

  /** Charge: pursue this target in the aggressive stance, then fall back to the stance the squad had. */
  start(w: World, sq: Squad, target: Unit) {
    const prev = this.map.get(sq)?.prev ?? sq.stance;
    w.commandMove(sq, target.x, target.y);
    w.commandFocus(sq, target);
    if (sq.stance !== 'aggressive') w.commandStance(sq, 'aggressive');
    this.map.set(sq, { target, prev });
  }

  /** End the charges whose target fell, fled or is no longer the focus. Returns the squads concerned. */
  check(w: World): Squad[] {
    const out: Squad[] = [];
    if (!this.map.size) return out;
    for (const [sq, c] of this.map) {
      const t = c.target;
      const gone = !t || sq.alive === 0 || sq.focus !== t || (t.state !== ST.ACTIVE && t.state !== ST.CLIMB) || t.fleeing || !!t.band?.broken;
      if (!gone) continue;
      this.map.delete(sq);
      if (sq.stance === 'aggressive' && c.prev !== 'aggressive') w.commandStance(sq, c.prev);
      out.push(sq);
    }
    return out;
  }

  save(): ChargeRec[] {
    const out: ChargeRec[] = [];
    for (const [sq, c] of this.map) out.push({ sq: sq.id, t: c.target?.id ?? -1, prev: c.prev });
    return out;
  }

  /** Restore charges saved with a resume record, on the replayed world. */
  load(w: World, recs: ChargeRec[] | undefined) {
    this.map.clear();
    for (const r of recs ?? []) {
      const sq = w.squads.find((s) => s.id === r.sq);
      if (!sq || !STANCES.includes(r.prev)) continue;
      this.map.set(sq, { target: w.units.find((u) => u.id === r.t) ?? null, prev: r.prev });
    }
  }
}
