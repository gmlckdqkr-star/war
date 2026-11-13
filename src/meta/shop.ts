/**
 * Store catalogue. Design rules (see docs/MONETIZATION.md):
 *  - Only NON-CONSUMABLE store products -> every purchase is restorable from the store itself,
 *    so a reinstall or new phone never produces a "lost purchase" support ticket.
 *  - Nothing sold changes battle power. Money buys looks, a seasonal cosmetic track, and convenience.
 *  - Medals (훈장) are earned by playing only and buy cosmetics in a weekly rotating stall.
 */
import { RNG } from '../sim/rng';
import { allBaseCosmetics, cosmeticById, isSeasonPremiumCosmetic, premiumSeasonCosmeticIds, seasonCosmetics, weeklyCosmetics, type Cosmetic } from './cosmetics';
import type { SaveData } from './save';
import { MAX_REGISTERED_SEASONS, premiumAvailable, seasonAt, seasonDaysLeft, seasonName, seasonOfProduct, seasonProductId } from './season';

export interface Product {
  id: string;
  name: string;
  desc: string;
  priceKrw: number;
  grants: string[]; // cosmetics granted
  flags?: string[]; // non-cosmetic convenience flags
  kind: 'pass' | 'bundle' | 'supporter' | 'convenience';
}

export const PRODUCTS: Product[] = [
  {
    id: 'supporter_small',
    name: '변경 후원 (소)',
    desc: '개발 후원. 후원자 깃발 + "후원자" 칭호. 전투 능력에는 영향 없음.',
    priceKrw: 2200,
    grants: ['ban_supporter', 'title_supporter'],
    kind: 'supporter',
  },
  {
    id: 'supporter_large',
    name: '변경 후원 (대)',
    desc: '황금 근위 갑주 + 금빛 성채 + 후견인의 금사자기 + "변경의 후견인" 칭호. 다른 상품과 겹치는 구성 없음.',
    priceKrw: 6600,
    grants: ['dye_gold', 'castle_gilded', 'ban_patron', 'title_patron'],
    kind: 'supporter',
  },
  {
    id: 'bundle_castles',
    name: '성채 외관 묶음',
    desc: '붉은 벽돌·서리 성채·백대리석 외관 3종.',
    priceKrw: 3300,
    grants: ['castle_brick', 'castle_frost', 'castle_marble'],
    kind: 'bundle',
  },
  {
    id: 'commander_kit',
    name: '지휘관의 편의 꾸러미',
    desc: '4배속 · 편성 저장 칸 +4 · 별 3개 성 "빠른 소탕"(하루 3회, 연대기 경험치와 훈장). 금화나 전투력은 주지 않습니다.',
    priceKrw: 5500,
    grants: [],
    flags: ['sweep', 'presets', 'speed4'],
    kind: 'convenience',
  },
];

export function seasonPassProductFor(season: number): Product {
  return {
    id: seasonProductId(season),
    name: `프리미엄 연대기 — ${seasonName(season)}`,
    desc: '시즌 한정 외관 5종(갑주·깃발 2종·성채·칭호)을 구매 즉시 영구 지급 + 이번 시즌 훈장 보너스 트랙. 금화·전투력 없음. 시즌이 끝나도 외관은 남고 "구매 복원"으로 되찾을 수 있습니다.',
    priceKrw: 5500,
    grants: premiumSeasonCosmeticIds(season),
    kind: 'pass',
  };
}

export function seasonPassProduct(now: Date): Product | null {
  const s = seasonAt(now);
  if (!premiumAvailable(s)) return null;
  return seasonPassProductFor(s);
}

/** Products shown for sale right now. */
export function allProducts(now: Date): Product[] {
  const p = seasonPassProduct(now);
  return p ? [p, ...PRODUCTS] : PRODUCTS;
}

/** Every product id that must be registered with the store so purchases can be bought or restored:
 *  the fixed products plus every season pass up to the current one (past passes stay restorable). */
export function storeProductIds(now: Date): string[] {
  const ids = PRODUCTS.map((p) => p.id);
  const last = Math.min(seasonAt(now), MAX_REGISTERED_SEASONS);
  for (let k = 1; k <= last; k++) ids.push(seasonProductId(k));
  return ids;
}

export function productById(id: string, now: Date): Product | undefined {
  const season = seasonOfProduct(id);
  if (season !== null) return premiumAvailable(season) ? seasonPassProductFor(season) : undefined;
  return allProducts(now).find((p) => p.id === id);
}

/** Warning to show before buying a season pass close to the end of its season (null = none). */
export function seasonPassWarning(id: string, now: Date): string | null {
  const season = seasonOfProduct(id);
  if (season === null) return null;
  const left = seasonDaysLeft(season, now);
  return left <= 7 ? `이번 시즌은 ${left}일 남았습니다. 외관 5종은 영구 보유되지만 훈장 보너스 트랙은 시즌이 끝나면 더 오르지 않습니다.` : null;
}

/**
 * Grant a store purchase. Idempotent: the same transaction (or a restore of an already-owned
 * product) never grants twice and never throws.
 */
export function grantPurchase(s: SaveData, productId: string, txId: string, now: Date): boolean {
  const p = productById(productId, now);
  if (!p) return false;
  if (txId && s.processedTx.includes(txId)) return false;
  if (txId) {
    s.processedTx.push(txId);
    if (s.processedTx.length > 500) s.processedTx.splice(0, s.processedTx.length - 500);
  }
  let changed = false;
  if (!s.entitlements.includes(p.id)) {
    s.entitlements.push(p.id);
    changed = true;
  }
  for (const c of p.grants)
    if (!s.owned.includes(c)) {
      s.owned.push(c);
      changed = true;
    }
  return changed;
}

/** Cosmetics that are only obtainable with money (stripped from imported save codes). */
export function paidCosmeticIds(): string[] {
  const ids = new Set<string>();
  for (const p of PRODUCTS) for (const c of p.grants) ids.add(c);
  return [...ids];
}

const PAID = new Set(paidCosmeticIds());
export function isPaidCosmetic(id: string): boolean {
  return PAID.has(id) || isSeasonPremiumCosmetic(id);
}

export function hasFlag(s: SaveData, flag: string) {
  return PRODUCTS.some((p) => p.flags?.includes(flag) && s.entitlements.includes(p.id));
}

// ---------------------------------------------------------------- medal stall (weekly rotation, offline)

export function weekKey(now: Date) {
  return Math.max(0, Math.floor((now.getTime() - Date.UTC(2026, 0, 5)) / (7 * 86400000)));
}

export function daysUntilNextWeek(now: Date) {
  return 7 - (((Math.floor((now.getTime() - Date.UTC(2026, 0, 5)) / 86400000) % 7) + 7) % 7);
}

/**
 * This week's medal stall (identical on every device, no server):
 *  3 rotating base items + 2 generated "workshop" items of the week + 1 free-track cosmetic of a past season.
 */
export function weeklyStall(now: Date): Cosmetic[] {
  const wk = weekKey(now);
  const pool = allBaseCosmetics().filter((c) => c.source === 'shop' && c.medals > 0);
  const rng = new RNG(wk * 104729 + 7);
  const items: Cosmetic[] = [...rng.shuffle([...pool]).slice(0, 3), ...weeklyCosmetics(wk)];
  const past = seasonAt(now) - 1;
  if (past >= 1) {
    const ps = 1 + (wk % past);
    items.push({ ...seasonCosmetics(ps)[5], medals: 220, source: 'shop' });
  }
  return items;
}

export function buyWithMedals(s: SaveData, id: string, now: Date): string | null {
  const c = weeklyStall(now).find((x) => x.id === id);
  if (!c) return cosmeticById(id) ? '이번 주 진열 품목이 아닙니다.' : '판매하지 않는 품목입니다.';
  if (c.medals <= 0) return '판매하지 않는 품목입니다.';
  if (s.owned.includes(id)) return '이미 가지고 있습니다.';
  if (s.medals < c.medals) return `훈장이 부족합니다 (${c.medals} 필요).`;
  s.medals -= c.medals;
  s.owned.push(id);
  return null;
}

export function equip(s: SaveData, id: string): string | null {
  const c = cosmeticById(id);
  if (!c) return '알 수 없는 꾸미기';
  if (!s.owned.includes(id)) return '보유하지 않은 꾸미기입니다.';
  s.equipped[c.kind] = id;
  return null;
}

export const krw = (n: number) => '₩' + n.toLocaleString('ko-KR');
