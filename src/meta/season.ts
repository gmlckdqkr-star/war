/**
 * "전쟁 연대기" season pass. Seasons rotate by local date and their rewards are generated from the
 * season number, so the game keeps a fresh pass every 6 weeks without any server or content upload.
 *
 * Premium = one pre-registered NON-CONSUMABLE store product per season (chronicle_s01 ...):
 *  - buying it permanently grants that season's 5 premium cosmetics at once (restorable from the store
 *    forever, even after the season ended), plus a medal-only bonus track for the rest of the season.
 *  - premium never gives gold or anything that changes battle power.
 * Robustness (no server, no support tickets):
 *  - when a season ends, everything already earned is claimed automatically (nothing is lost);
 *  - progress is archived per season, so moving the device clock back and forth never wipes it.
 */
import { premiumSeasonCosmeticIds, seasonCosmetics, seasonTheme } from './cosmetics';
import type { SaveData } from './save';

export const SEASON_EPOCH = Date.UTC(2026, 11, 1); // 2026-12-01
export const SEASON_DAYS = 42;
export const PASS_TIERS = 30;
export const XP_PER_TIER = 1000;
/** Product ids registered once in the stores. After this many seasons the premium track simply isn't offered. */
export const MAX_REGISTERED_SEASONS = 24;
/** How many past seasons' progress is kept for clock-rollback safety. */
const ARCHIVE_KEEP = 6;

export function seasonAt(now: Date): number {
  const d = Math.floor((now.getTime() - SEASON_EPOCH) / 86400000);
  return Math.max(1, Math.floor(d / SEASON_DAYS) + 1);
}

export function seasonStarts(season: number): Date {
  return new Date(SEASON_EPOCH + (season - 1) * SEASON_DAYS * 86400000);
}

export function seasonEnds(season: number): Date {
  return new Date(SEASON_EPOCH + season * SEASON_DAYS * 86400000);
}

export function seasonDaysLeft(season: number, now: Date): number {
  return Math.max(0, Math.ceil((seasonEnds(season).getTime() - now.getTime()) / 86400000));
}

export function seasonProductId(season: number) {
  return `chronicle_s${String(season).padStart(2, '0')}`;
}

export function seasonOfProduct(id: string): number | null {
  const m = /^chronicle_s(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

export function premiumAvailable(season: number) {
  return season >= 1 && season <= MAX_REGISTERED_SEASONS;
}

export interface PassReward {
  tier: number;
  kind: 'gold' | 'medals' | 'cosmetic';
  amount?: number;
  cosmetic?: string;
}

export function passRewards(season: number): { free: PassReward[]; prem: PassReward[] } {
  const cos = seasonCosmetics(season);
  const free: PassReward[] = [];
  const prem: PassReward[] = [];
  for (let t = 1; t <= PASS_TIERS; t++) {
    // free track: earned by playing (gold is fine here because nobody pays for it)
    if (t === 10) free.push({ tier: t, kind: 'cosmetic', cosmetic: cos[5].id });
    else if (t % 3 === 0) free.push({ tier: t, kind: 'medals', amount: 10 });
    else free.push({ tier: t, kind: 'gold', amount: 50 + t * 8 });
    // premium bonus track: medals only (cosmetics are granted at purchase; never gold)
    prem.push({ tier: t, kind: 'medals', amount: t % 5 === 0 ? 50 : 20 });
  }
  return { free, prem };
}

export interface SeasonChange {
  from: number;
  to: number;
  autoClaimed: number;
}

/**
 * Bring the pass to the season of `now`. Leaving a season auto-claims everything already earned in it
 * and archives its progress; entering a season restores archived progress (clock moved back) or
 * starts fresh. Returns what happened so the UI can tell the player, or null if nothing changed.
 */
export function syncSeason(s: SaveData, now: Date): SeasonChange | null {
  const cur = seasonAt(now);
  const from = s.pass.season;
  if (cur === from) return null;
  let autoClaimed = 0;
  if (from > 0) {
    autoClaimed = claimAll(s);
    s.passArchive[String(from)] = { xp: s.pass.xp, claimedFree: [...s.pass.claimedFree], claimedPrem: [...s.pass.claimedPrem] };
  }
  const prev = s.passArchive[String(cur)];
  s.pass = prev ? { season: cur, xp: prev.xp, claimedFree: [...prev.claimedFree], claimedPrem: [...prev.claimedPrem] } : { season: cur, xp: 0, claimedFree: [], claimedPrem: [] };
  // keep only the seasons nearest to the current one
  const keys = Object.keys(s.passArchive)
    .map(Number)
    .filter((k) => k !== cur)
    .sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur));
  for (const k of keys.slice(ARCHIVE_KEEP)) delete s.passArchive[String(k)];
  delete s.passArchive[String(cur)];
  return from > 0 ? { from, to: cur, autoClaimed } : null;
}

export function addPassXp(s: SaveData, xp: number, now: Date) {
  syncSeason(s, now);
  s.pass.xp = Math.min(PASS_TIERS * XP_PER_TIER, s.pass.xp + Math.max(0, xp));
}

export function passTier(s: SaveData) {
  return Math.min(PASS_TIERS, Math.floor(s.pass.xp / XP_PER_TIER));
}

export function hasPremium(s: SaveData, season = s.pass.season) {
  return s.entitlements.includes(seasonProductId(season));
}

export function claimReward(s: SaveData, tier: number, track: 'free' | 'prem'): string | null {
  if (tier > passTier(s)) return '아직 도달하지 않은 단계입니다.';
  if (track === 'prem' && !hasPremium(s)) return '프리미엄 연대기가 필요합니다.';
  const list = track === 'free' ? s.pass.claimedFree : s.pass.claimedPrem;
  if (list.includes(tier)) return '이미 받았습니다.';
  const r = passRewards(s.pass.season)[track].find((x) => x.tier === tier);
  if (!r) return '보상이 없습니다.';
  list.push(tier);
  if (r.kind === 'gold') s.gold += r.amount ?? 0;
  if (r.kind === 'medals') s.medals += r.amount ?? 0;
  if (r.kind === 'cosmetic' && r.cosmetic && !s.owned.includes(r.cosmetic)) s.owned.push(r.cosmetic);
  return null;
}

export function claimAll(s: SaveData): number {
  let n = 0;
  const top = passTier(s);
  for (let t = 1; t <= top; t++) {
    if (!claimReward(s, t, 'free')) n++;
    if (hasPremium(s) && !claimReward(s, t, 'prem')) n++;
  }
  return n;
}

export function seasonName(season: number) {
  return `시즌 ${season}: ${seasonTheme(season).name}`;
}

export { premiumSeasonCosmeticIds };
