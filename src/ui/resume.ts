/**
 * Resume a battle after the app was killed (phone call, OS memory pressure, swipe-away, WebView reload).
 *
 * The simulation is deterministic, so instead of serialising the whole world we record the battle's
 * inputs: how the stage was made, the battle config, and every player command with the step it was
 * issued at. Resuming = rebuild the same World and replay those commands (a few seconds at most).
 * Commands issued from inside world.step() (auto commander, council auto-pick) are NOT recorded: the
 * replay reproduces them by itself.
 *
 * Rule for the UI (and anything else outside the simulation): the world may only be changed through
 * the methods in COMMAND_METHODS and world.step(). Reading it is fine as long as the read does not
 * change state or draw from world.rng.
 */
import { checksum, type KV } from '../meta/save';
import type { BattleConfig, Stance, World } from '../sim/world';
import { dailyChallenge, endlessStage, stageById, type StageDef, type Supplies } from '../sim/stages';

export const RESUME_KEY = 'ashen.battle';
/** records older than this are not worth offering */
export const RESUME_MAX_AGE = 7 * 86400000;

export type BattleMode = 'campaign' | 'daily' | 'endless';

/** How to rebuild the stage (StageDef holds a build function, so it can't be stored itself). */
export type StageRef = { kind: 'campaign'; id: string } | { kind: 'daily'; key: string; maxIdx: number } | { kind: 'endless'; seed: number };

export interface Cmd {
  /** number of world.step() calls made before this command */
  k: number;
  m: string;
  a: unknown[];
}

/** A melee charge in progress (UI bookkeeping that later orders depend on), by squad and unit id. */
export interface ChargeRec {
  sq: number;
  t: number;
  prev: Stance;
}

export interface BattleRecord {
  /** app + simulation build; a record from another build is discarded (replay could diverge) */
  ver: string;
  /** unique per battle; the save remembers the last settled one (SaveData.battleDone) */
  id: string;
  mode: BattleMode;
  ref: StageRef;
  cfg: Omit<BattleConfig, 'stage'>;
  modName?: string;
  /** supply packs planned in the pre-battle screen (charged when the result is recorded) */
  extra?: Partial<Supplies>;
  lineup: string[];
  /** fingerprint of the stage data and the map it built: the rebuilt stage must match it */
  sig: string;
  /** stage name, for the "continue?" prompt */
  name: string;
  steps: number;
  cmds: Cmd[];
  savedAt: number;
  /** sim time, wave and state when saved (shown in the prompt) */
  t?: number;
  wave?: number;
  waves?: number;
  state?: string;
  charges?: ChargeRec[];
}

/** Everything about a record except what the recorder fills in. */
export type RecordBase = Omit<BattleRecord, 'steps' | 'cmds' | 'savedAt' | 't' | 'wave' | 'waves' | 'state' | 'charges'>;

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

/** A new battle id (unique enough for one device). */
export function newBattleId(): string {
  return Date.now().toString(36) + '-' + Math.floor(Math.random() * 2 ** 31).toString(36);
}

/** The stage reference for a pre-battle selection; null if this kind of stage can't be rebuilt. */
export function stageRefFor(mode: BattleMode, stage: StageDef, seed: number, daily?: { key: string; maxIdx: number }): StageRef | null {
  if (mode === 'campaign') return stageById(stage.id) === stage ? { kind: 'campaign', id: stage.id } : null;
  if (mode === 'endless') return { kind: 'endless', seed };
  if (mode === 'daily' && daily) return { kind: 'daily', key: daily.key, maxIdx: daily.maxIdx };
  return null;
}

/** Rebuild the stage a record was played on (the same builders the pre-battle screens use). */
export function resolveStage(ref: StageRef): StageDef | null {
  try {
    if (ref.kind === 'campaign') return stageById(ref.id) ?? null;
    if (ref.kind === 'daily') return dailyChallenge(ref.key, ref.maxIdx).stage;
    if (ref.kind === 'endless') return endlessStage(ref.seed);
  } catch {
    /* unreadable reference */
  }
  return null;
}

/** Fingerprint of a freshly built world's stage: its data and the map its build function made. */
export function stageSig(w: World): string {
  const data: Record<string, unknown> = { ...w.stage };
  delete data.build;
  return checksum(JSON.stringify(data) + '|' + Array.from(w.grid.tiles).join(','));
}

/** The config as stored in a record: plain data, without the stage (which holds a function). */
export function storableCfg(cfg: BattleConfig): Omit<BattleConfig, 'stage'> {
  const { stage: _stage, ...rest } = cfg;
  return JSON.parse(JSON.stringify(rest));
}

/**
 * Records the inputs of a live battle. Wraps the world's command methods and step() on this instance.
 * `resume` continues an earlier record (the world must already be replayed up to it).
 */
export class BattleRecorder {
  steps = 0;
  cmds: Cmd[] = [];
  private inStep = false;
  /** >0 while a command runs: commands it calls internally (e.g. preset -> commandAuto) aren't recorded */
  private depth = 0;

  constructor(
    world: World,
    readonly base: RecordBase,
    resume?: { steps: number; cmds: Cmd[] },
  ) {
    if (resume) {
      this.steps = resume.steps;
      this.cmds = resume.cmds.slice();
    }
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
        if (!this.inStep && this.depth === 0) {
          const a = args.map(enc);
          this.cmds.push({ k: this.steps, m, a });
          // the live call gets exactly the squads/units the replay will find by id (a unit already
          // removed from the world becomes null in both), so the two can't drift apart
          args = args.map((x, i) => (isSquad(x) || isUnit(x) ? dec(world, a[i]) : x));
        }
        this.depth++;
        try {
          return orig(...args);
        } finally {
          this.depth--;
        }
      };
    }
  }

  record(live: Partial<Pick<BattleRecord, 't' | 'wave' | 'waves' | 'state' | 'charges'>> = {}): BattleRecord {
    return { ...this.base, ...live, steps: this.steps, cmds: this.cmds.slice(), savedAt: Date.now() };
  }
}

/** Store the record. Never throws: storage full or blocked just means no resume for this battle. */
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

const MODES: readonly string[] = ['campaign', 'daily', 'endless'];
const STANCES: readonly string[] = ['hold', 'defend', 'aggressive'];

function validRef(r: any): r is StageRef {
  if (!r || typeof r !== 'object') return false;
  if (r.kind === 'campaign') return typeof r.id === 'string';
  if (r.kind === 'daily') return typeof r.key === 'string' && Number.isInteger(r.maxIdx);
  if (r.kind === 'endless') return Number.isFinite(r.seed);
  return false;
}

function validCmds(cmds: unknown, steps: number): cmds is Cmd[] {
  if (!Array.isArray(cmds)) return false;
  let last = 0;
  const names: readonly string[] = COMMAND_METHODS;
  for (const c of cmds) {
    if (!c || typeof c !== 'object' || !Number.isInteger(c.k) || c.k < last || c.k > steps || !names.includes(c.m) || !Array.isArray(c.a)) return false;
    last = c.k;
  }
  return true;
}

/**
 * The stored record if it can be resumed by this build: anything unreadable, from another version,
 * older than a week or structurally wrong gives null (the caller then clears it).
 */
export function loadRecord(kv: KV, ver: string, now = Date.now()): BattleRecord | null {
  try {
    const raw = kv.get(RESUME_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as BattleRecord;
    if (!r || typeof r !== 'object' || r.ver !== ver) return null;
    if (typeof r.id !== 'string' || !MODES.includes(r.mode) || !validRef(r.ref) || typeof r.sig !== 'string') return null;
    if (!r.cfg || typeof r.cfg !== 'object' || !Array.isArray(r.cfg.squads) || !Number.isFinite(r.cfg.seed)) return null;
    if (!Array.isArray(r.lineup) || !r.lineup.every((x) => typeof x === 'string')) return null;
    if (!Number.isInteger(r.steps) || r.steps < 0 || !validCmds(r.cmds, r.steps)) return null;
    if (typeof r.savedAt !== 'number' || now - r.savedAt > RESUME_MAX_AGE) return null;
    if (r.charges !== undefined && !(Array.isArray(r.charges) && r.charges.every((c) => c && Number.isInteger(c.sq) && Number.isInteger(c.t) && STANCES.includes(c.prev)))) return null;
    if (typeof r.name !== 'string') r.name = '';
    return r;
  } catch {
    return null;
  }
}

export interface ReplayStats {
  steps: number;
  ms: number;
  chunks: number;
  /** longest uninterrupted stretch of work (the UI is frozen that long) */
  maxChunkMs: number;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Let the browser paint and handle input. A message is not clamped like a nested setTimeout(0). */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });
}

/**
 * Re-run the recorded battle on a fresh World built from the same config. Works in chunks of about
 * `budgetMs` and yields to the browser between them so a progress bar can update; resolves when the
 * world reached the saved step. A chunk ends early when the slowest step seen so far would push it past
 * `maxChunkMs`, so one heavy step (path fields) does not freeze the screen for long.
 */
export async function replay(world: World, rec: BattleRecord, onProgress?: (f: number) => void, budgetMs = 12, maxChunkMs = 45): Promise<ReplayStats> {
  let i = 0;
  let k = 0;
  const apply = (c: Cmd) => {
    const fn = (world as any)[c.m];
    if (typeof fn !== 'function') return;
    try {
      fn.apply(world, c.a.map((x) => dec(world, x)));
    } catch {
      /* the live call threw at the same point; its partial effect is reproduced, the error is not */
    }
  };
  const t0 = now();
  const stats: ReplayStats = { steps: rec.steps, ms: 0, chunks: 0, maxChunkMs: 0 };
  let slowStep = 0;
  onProgress?.(0);
  while (k < rec.steps) {
    const c0 = now();
    const until = c0 + budgetMs;
    let t = c0;
    while (k < rec.steps && t < until && (t === c0 || t - c0 + slowStep < maxChunkMs)) {
      while (i < rec.cmds.length && rec.cmds[i].k <= k) apply(rec.cmds[i++]);
      world.step();
      k++;
      const t1 = now();
      if (t1 - t > slowStep) slowStep = t1 - t;
      t = t1;
    }
    // an outlier step should not throttle the rest of the replay forever
    slowStep *= 0.9;
    stats.chunks++;
    stats.maxChunkMs = Math.max(stats.maxChunkMs, t - c0);
    onProgress?.(k / Math.max(1, rec.steps));
    if (k < rec.steps) await yieldToBrowser();
  }
  while (i < rec.cmds.length) apply(rec.cmds[i++]);
  onProgress?.(1);
  stats.ms = now() - t0;
  return stats;
}

export type { StageDef };
