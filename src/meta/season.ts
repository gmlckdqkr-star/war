/**
 * "전쟁 연대기" season pass. Seasons rotate by local date and their rewards are generated from the
 * season number, so the game keeps a fresh pass every 6 weeks without any server or content upload.
 * The premium track is a pre-registered non-consumable store product per season (restorable).
 */
import { seasonCosmetics, seasonTheme } from './cosmetics';
import type { SaveData } from './save';

export const SEASON_EPOCH = Date.UTC(2026, 11, 1); // 2026-12-01
export const SEASON_DAYS = 42;
export const PASS_TIERS = 30;
export const XP_PER_TIER = 1000;
/** Product ids registered once in the stores. After this many seasons the premium track simply isn't offered. */
export const MAX_REGISTERED_SEASONS = 24;

export function seasonAt(now: Date): number {
  const d = Math.floor((now.getTime() - SEASON_EPOCH) / 86400000);
  return Math.max(1, Math.floor(d / SEASON_DAYS) + 1);
}

export function seasonEnds(season: number): Date {
  return new Date(SEASON_EPOCH + season * SEASON_DAYS * 86400000);
}

export function seasonProductId(season: number) {
  return `chronicle_s${String(season).padStart(2, '0')}`;
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
    if (t === 10) free.push({ tier: t, kind: 'cosmetic', cosmetic: cos[5].id });
    else if (t % 3 === 0) free.push({ tier: t, kind: 'medals', amount: 10 });
    else free.push({ tier: t, kind: 'gold', amount: 50 + t * 8 });
    const premCos: Record<number, number> = { 1: 1, 8: 0, 15: 2, 22: 3, 30: 4 };
    if (t in premCos) prem.push({ tier: t, kind: 'cosmetic', cosmetic: cos[premCos[t]].id });
    else if (t % 2 === 0) prem.push({ tier: t, kind: 'medals', amount: 25 });
    else prem.push({ tier: t, kind: 'gold', amount: 120 + t * 10 });
  }
  return { free, prem };
}

/** Reset the pass when the season rolled over. Guard against clock rollback. */
export function syncSeason(s: SaveData, now: Date) {
  const cur = seasonAt(now);
  if (cur > s.pass.season) {
    s.pass = { season: cur, xp: 0, claimedFree: [], claimedPrem: [] };
  }
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
