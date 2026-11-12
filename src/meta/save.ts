/**
 * Local-only save system. No accounts, no server.
 * - Two copies (main + backup) with a checksum; a corrupt main falls back to the backup automatically.
 * - Versioned schema with migration + sanitising so old/garbled saves never crash the game.
 * - Export/import as a text code so players can move or back up progress themselves.
 */
import type { SquadTypeId } from '../sim/defs';
import { SQUAD_TYPES } from '../sim/defs';
import { DEFAULT_COSMETICS } from './cosmetics';

export const SAVE_VERSION = 2;

export interface Soldier {
  id: number;
  xp: number;
  /** battles until recovered (0 = ready) */
  wounded: number;
}

export interface RosterSquad {
  id: string;
  type: SquadTypeId;
  name: string;
  soldiers: Soldier[];
  xp: number;
  kills: number;
  battles: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  autoCommand: boolean;
  leftHanded: boolean;
  bigText: boolean;
  quality: 'low' | 'high';
  reduceMotion: boolean;
  showTips: boolean;
}

export interface SaveData {
  v: number;
  created: number;
  nextId: number;
  gold: number;
  medals: number;
  stars: Record<string, number>;
  cleared: Record<string, number>; // times cleared
  roster: RosterSquad[];
  upgrades: Record<string, number>;
  owned: string[]; // cosmetics
  equipped: { dye: string; banner: string; castle: string; title: string };
  entitlements: string[]; // store product ids owned (non-consumables)
  processedTx: string[];
  pass: { season: number; xp: number; claimedFree: number[]; claimedPrem: number[] };
  achievements: string[];
  daily: { lastKey: string; maxKey: string; streak: number };
  endlessBest: number;
  stats: { battles: number; wins: number; kills: number; dead: number; dragons: number; playSeconds: number };
  settings: Settings;
  tutorialDone: boolean;
  seenTips: string[];
  firstWinKey: string;
  lastPlayed: number;
  /** saved lineups (roster ids); slot 0 is free, slots 1-4 come with the commander kit */
  lineups: string[][];
  sweep: { key: string; n: number };
  /** highest wall-clock time seen, to ignore device clock rollback for daily rewards */
  maxTime: number;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  difficulty: 'normal',
  autoCommand: false,
  leftHanded: false,
  bigText: false,
  quality: 'high',
  reduceMotion: false,
  showTips: true,
};

export function newSquad(save: SaveData, type: SquadTypeId, name?: string): RosterSquad {
  const st = SQUAD_TYPES[type];
  const sq: RosterSquad = {
    id: 'q' + save.nextId++,
    type,
    name: name ?? `${st.name} ${romanSuffix(save.roster.filter((r) => r.type === type).length + 1)}`,
    soldiers: [],
    xp: 0,
    kills: 0,
    battles: 0,
  };
  for (let i = 0; i < st.size; i++) sq.soldiers.push({ id: save.nextId++, xp: 0, wounded: 0 });
  return sq;
}

function romanSuffix(n: number) {
  return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] ?? String(n);
}

export function newSave(now = Date.now()): SaveData {
  const s: SaveData = {
    v: SAVE_VERSION,
    created: now,
    nextId: 1,
    gold: 150,
    medals: 0,
    stars: {},
    cleared: {},
    roster: [],
    upgrades: {},
    owned: Object.values(DEFAULT_COSMETICS),
    equipped: { ...DEFAULT_COSMETICS },
    entitlements: [],
    processedTx: [],
    pass: { season: 0, xp: 0, claimedFree: [], claimedPrem: [] },
    achievements: [],
    daily: { lastKey: '', maxKey: '', streak: 0 },
    endlessBest: 0,
    stats: { battles: 0, wins: 0, kills: 0, dead: 0, dragons: 0, playSeconds: 0 },
    settings: { ...DEFAULT_SETTINGS },
    tutorialDone: false,
    seenTips: [],
    firstWinKey: '',
    lastPlayed: now,
    lineups: [],
    sweep: { key: '', n: 0 },
    maxTime: now,
  };
  s.roster.push(newSquad(s, 'spear', '창병대 I'));
  s.roster.push(newSquad(s, 'sword', '방패검병대 I'));
  s.roster.push(newSquad(s, 'archer', '궁수대 I'));
  s.roster.push(newSquad(s, 'archer', '궁수대 II'));
  return s;
}

// ---------------------------------------------------------------- integrity

export function checksum(str: string): string {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'));
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => {
  const n = typeof v === 'number' && isFinite(v) ? v : d;
  return Math.min(max, Math.max(min, n));
};
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
const numArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'number' && isFinite(x)) : []);

/** Repair any structurally invalid data instead of crashing. Unknown fields are dropped. */
export function sanitize(raw: any): SaveData {
  const base = newSave(num(raw?.created, Date.now()));
  if (!raw || typeof raw !== 'object') return base;
  const s: SaveData = { ...base };
  s.v = SAVE_VERSION;
  s.nextId = num(raw.nextId, base.nextId, 1);
  s.gold = Math.floor(num(raw.gold, base.gold, 0, 1e9));
  s.medals = Math.floor(num(raw.medals, 0, 0, 1e8));
  s.stars = {};
  if (raw.stars && typeof raw.stars === 'object') for (const k of Object.keys(raw.stars)) s.stars[k] = num(raw.stars[k], 0, 0, 3);
  s.cleared = {};
  if (raw.cleared && typeof raw.cleared === 'object') for (const k of Object.keys(raw.cleared)) s.cleared[k] = num(raw.cleared[k], 0, 0, 1e6);
  s.upgrades = {};
  if (raw.upgrades && typeof raw.upgrades === 'object') for (const k of Object.keys(raw.upgrades)) s.upgrades[k] = Math.floor(num(raw.upgrades[k], 0, 0, 10));
  if (Array.isArray(raw.roster)) {
    const roster: RosterSquad[] = [];
    for (const r of raw.roster) {
      if (!r || typeof r !== 'object' || !(r.type in SQUAD_TYPES) || r.type === 'militia') continue;
      const max = SQUAD_TYPES[r.type as SquadTypeId].size;
      const soldiers: Soldier[] = Array.isArray(r.soldiers)
        ? r.soldiers
            .filter((x: any) => x && typeof x.id === 'number')
            .slice(0, max)
            .map((x: any) => ({ id: x.id, xp: num(x.xp, 0, 0, 1e6), wounded: Math.floor(num(x.wounded, 0, 0, 5)) }))
        : [];
      roster.push({
        id: typeof r.id === 'string' ? r.id : 'q' + s.nextId++,
        type: r.type,
        name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 24) : SQUAD_TYPES[r.type as SquadTypeId].name,
        soldiers,
        xp: num(r.xp, 0, 0, 1e7),
        kills: num(r.kills, 0, 0, 1e9),
        battles: num(r.battles, 0, 0, 1e7),
      });
    }
    if (roster.length) s.roster = roster;
  }
  // ids must stay unique
  let maxId = s.nextId;
  for (const r of s.roster) for (const so of r.soldiers) maxId = Math.max(maxId, so.id + 1);
  s.nextId = maxId;
  s.owned = Array.from(new Set([...strArr(raw.owned), ...Object.values(DEFAULT_COSMETICS)]));
  s.equipped = { ...DEFAULT_COSMETICS };
  if (raw.equipped && typeof raw.equipped === 'object')
    for (const k of ['dye', 'banner', 'castle', 'title'] as const) if (typeof raw.equipped[k] === 'string' && s.owned.includes(raw.equipped[k])) s.equipped[k] = raw.equipped[k];
  s.entitlements = Array.from(new Set(strArr(raw.entitlements)));
  s.processedTx = strArr(raw.processedTx).slice(-500);
  const p = raw.pass ?? {};
  s.pass = { season: Math.floor(num(p.season, 0, 0, 1e4)), xp: num(p.xp, 0, 0, 1e8), claimedFree: numArr(p.claimedFree), claimedPrem: numArr(p.claimedPrem) };
  s.achievements = strArr(raw.achievements);
  const d = raw.daily ?? {};
  s.daily = { lastKey: typeof d.lastKey === 'string' ? d.lastKey : '', maxKey: typeof d.maxKey === 'string' ? d.maxKey : '', streak: num(d.streak, 0, 0, 1e5) };
  s.endlessBest = Math.floor(num(raw.endlessBest, 0, 0, 1e4));
  const st = raw.stats ?? {};
  s.stats = {
    battles: num(st.battles, 0, 0),
    wins: num(st.wins, 0, 0),
    kills: num(st.kills, 0, 0),
    dead: num(st.dead, 0, 0),
    dragons: num(st.dragons, 0, 0),
    playSeconds: num(st.playSeconds, 0, 0),
  };
  const se = raw.settings ?? {};
  s.settings = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const dv = DEFAULT_SETTINGS[k];
    if (typeof se[k] === typeof dv) (s.settings as any)[k] = se[k];
  }
  if (!['easy', 'normal', 'hard'].includes(s.settings.difficulty)) s.settings.difficulty = 'normal';
  if (!['low', 'high'].includes(s.settings.quality)) s.settings.quality = 'high';
  s.tutorialDone = !!raw.tutorialDone;
  s.seenTips = strArr(raw.seenTips).slice(0, 200);
  s.firstWinKey = typeof raw.firstWinKey === 'string' ? raw.firstWinKey : '';
  s.lastPlayed = num(raw.lastPlayed, Date.now());
  s.lineups = Array.isArray(raw.lineups) ? raw.lineups.slice(0, 5).map((l: unknown) => strArr(l).slice(0, 12)) : [];
  const sw = raw.sweep ?? {};
  s.sweep = { key: typeof sw.key === 'string' ? sw.key : '', n: Math.floor(num(sw.n, 0, 0, 100)) };
  s.maxTime = num(raw.maxTime, 0, 0);
  return s;
}

// ---------------------------------------------------------------- storage

export interface KV {
  get(k: string): string | null;
  set(k: string, v: string): void;
  remove(k: string): void;
}

export const memoryKV = (): KV => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) };
};

export function browserKV(): KV {
  try {
    const ls = window.localStorage;
    const probe = '__ar_probe';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v), remove: (k) => ls.removeItem(k) };
  } catch {
    return memoryKV();
  }
}

const KEY = 'ashen.save';
const BAK = 'ashen.save.bak';

function pack(s: SaveData): string {
  const body = JSON.stringify(s);
  return JSON.stringify({ c: checksum(body), b: body });
}

function unpack(str: string | null): SaveData | null {
  if (!str) return null;
  try {
    const o = JSON.parse(str);
    if (!o || typeof o.b !== 'string' || o.c !== checksum(o.b)) return null;
    return sanitize(JSON.parse(o.b));
  } catch {
    return null;
  }
}

export interface LoadResult {
  save: SaveData;
  source: 'main' | 'backup' | 'new';
  recovered: boolean;
}

export function loadSave(kv: KV): LoadResult {
  const main = unpack(kv.get(KEY));
  if (main) return { save: main, source: 'main', recovered: false };
  const bak = unpack(kv.get(BAK));
  const hadMain = kv.get(KEY) !== null;
  if (hadMain) {
    try {
      kv.set(KEY + '.corrupt', kv.get(KEY) ?? '');
    } catch {
      /* ignore */
    }
  }
  if (bak) {
    writeSave(kv, bak);
    return { save: bak, source: 'backup', recovered: hadMain };
  }
  return { save: newSave(), source: 'new', recovered: hadMain };
}

export function writeSave(kv: KV, s: SaveData): boolean {
  s.lastPlayed = Date.now();
  const packed = pack(s);
  try {
    const prev = kv.get(KEY);
    if (prev && unpack(prev)) kv.set(BAK, prev);
    kv.set(KEY, packed);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- export / import code

function toB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportCode(s: SaveData): string {
  return 'AR1.' + toB64(pack(s));
}

/**
 * Import a save code. Store purchases are NOT carried by codes (they are re-read from the store with
 * "구매 복원"), so a shared or edited code can never unlock paid items.
 */
export function importCode(code: string, paidCosmetics: string[] = []): SaveData | null {
  try {
    const t = code.replace(/\s+/g, '');
    if (!t.startsWith('AR1.')) return null;
    const s = unpack(fromB64(t.slice(4)));
    if (!s) return null;
    s.entitlements = [];
    s.processedTx = [];
    const paid = new Set(paidCosmetics);
    s.owned = s.owned.filter((id) => !paid.has(id));
    for (const k of ['dye', 'banner', 'castle', 'title'] as const) if (!s.owned.includes(s.equipped[k])) s.equipped[k] = DEFAULT_COSMETICS[k];
    return s;
  } catch {
    return null;
  }
}
