/**
 * Resume a battle after the app was killed (phone call, OS memory pressure, swipe-away).
 *
 * The simulation is deterministic, so instead of serialising the whole world we record the battle's
 * inputs: how the stage was made, the battle config, and every player command with the step it was
 * issued at. Resuming = rebuild the same World and replay those commands (a few seconds at most).
 * Commands issued from inside world.step() (auto commander, council auto-pick) are NOT recorded: the
 * replay reproduces them by itself.
 */
import type { KV } from '../meta/save';
import type { BattleConfig, World } from '../sim/world';
import type { StageDef, Supplies } from '../sim/stages';

export const RESUME_KEY = 'ashen.battle';

/** How to rebuild the stage (StageDef holds a build function, so it can't be stored itself). */
export type StageRef = { kind: 'campaign'; id: string } | { kind: 'daily'; key: string; maxIdx: number } | { kind: 'endless'; seed: number };

interface Cmd {
  /** number of world.step() calls made before this command */
  k: number;
  m: string;
  a: unknown[];
}

export interface BattleRecord {
  /** app version; a record from another version is discarded (replay could diverge) */
  ver: string;
  mode: 'campaign' | 'daily' | 'endless';
  ref: StageRef;
  cfg: Omit<BattleConfig, 'stage'>;
  modName?: string;
  /** supply packs planned in the pre-battle screen (charged when the result is recorded) */
  extra?: Partial<Supplies>;
  lineup: string[];
  steps: number;
  cmds: Cmd[];
  savedAt: number;
}

/** World methods the UI uses to give orders. Anything else the UI does must not change the simulation. */
export const COMMAND_METHODS = [
  'placeSquad',
  'commandFocus',
  'commandMove',
  'commandStance',
  'commandAuto',
  'commandRetreat',
  'useAbility',
  'preset',
  'skipIntermission',
  'start',
  'surrender',
  'chooseCouncil',
] as const;

const isSquad = (v: any) => v && typeof v === 'object' && 'rosterId' in v && Array.isArray(v.units);
const isUnit = (v: any) => v && typeof v === 'object' && 'def' in v && 'side' in v && typeof v.id === 'number';

function enc(v: unknown): unknown {
  if (isSquad(v)) return { $sq: (v as any).id };
  if (isUnit(v)) return { $u: (v as any).id };
  if (v === undefined || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v === null) return v;
  // plain data only (no functions / cycles)
  return JSON.parse(JSON.stringify(v));
}

function dec(world: World, v: any): unknown {
  if (v && typeof v === 'object') {
    if ('$sq' in v) return world.squads.find((s) => s.id === v.$sq) ?? null;
    if ('$u' in v) return world.units.find((u) => u.id === v.$u) ?? null;
  }
  return v;
}

/**
 * Records the inputs of a live battle. Wraps the world's command methods and step() on this instance.
 */
export class BattleRecorder {
  steps = 0;
  cmds: Cmd[] = [];
  private inStep = false;
  /** >0 while a command runs: commands it calls internally (e.g. preset -> commandAuto) aren't recorded */
  private depth = 0;

  constructor(
    world: World,
    private base: Omit<BattleRecord, 'steps' | 'cmds' | 'savedAt'>,
  ) {
    const w = world as any;
    const step = w.step.bind(world);
    w.step = () => {
      this.inStep = true;
      try {
        return step();
      } finally {
        this.inStep = false;
        this.steps++;
      }
    };
    for (const m of COMMAND_METHODS) {
      if (typeof w[m] !== 'function') continue;
      const orig = w[m].bind(world);
      w[m] = (...args: unknown[]) => {
        if (!this.inStep && this.depth === 0) this.cmds.push({ k: this.steps, m, a: args.map(enc) });
        this.depth++;
        try {
          return orig(...args);
        } finally {
          this.depth--;
        }
      };
    }
  }

  record(): BattleRecord {
    return { ...this.base, steps: this.steps, cmds: this.cmds, savedAt: Date.now() };
  }
}

export function saveRecord(kv: KV, rec: BattleRecord): boolean {
  try {
    kv.set(RESUME_KEY, JSON.stringify(rec));
    return true;
  } catch {
    return false;
  }
}

export function clearRecord(kv: KV) {
  try {
    kv.remove(RESUME_KEY);
  } catch {
    /* ignore */
  }
}

export function loadRecord(kv: KV, ver: string): BattleRecord | null {
  try {
    const raw = kv.get(RESUME_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as BattleRecord;
    if (!r || r.ver !== ver || !r.cfg || !r.ref || !Array.isArray(r.cmds) || typeof r.steps !== 'number') return null;
    // stale records (a week old) are not worth offering
    if (Date.now() - (r.savedAt ?? 0) > 7 * 86400000) return null;
    return r;
  } catch {
    return null;
  }
}

/** Re-run the recorded battle on a fresh World built from the same config. Yields to the browser
 *  between chunks so a progress bar can update; resolves when the world reached the saved step. */
export async function replay(world: World, rec: BattleRecord, onProgress?: (f: number) => void, budgetMs = 12): Promise<void> {
  let i = 0;
  let k = 0;
  const apply = (c: Cmd) => {
    const fn = (world as any)[c.m];
    if (typeof fn !== 'function') return;
    try {
      fn.apply(world, c.a.map((x) => dec(world, x)));
    } catch {
      /* a command that no longer applies is skipped */
    }
  };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  while (k < rec.steps) {
    const until = now() + budgetMs;
    while (k < rec.steps && now() < until) {
      while (i < rec.cmds.length && rec.cmds[i].k <= k) apply(rec.cmds[i++]);
      world.step();
      k++;
    }
    onProgress?.(k / Math.max(1, rec.steps));
    if (k < rec.steps) await new Promise((r) => setTimeout(r, 0));
  }
  while (i < rec.cmds.length) apply(rec.cmds[i++]);
}

export type { StageDef };
