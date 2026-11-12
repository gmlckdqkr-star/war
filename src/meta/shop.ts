/**
 * Store catalogue. Design rules (see docs/MONETIZATION.md):
 *  - Only NON-CONSUMABLE store products -> every purchase is restorable from the store itself,
 *    so a reinstall or new phone never produces a "lost purchase" support ticket.
 *  - Nothing sold changes battle power. Money buys looks, a seasonal cosmetic track, and convenience.
 *  - Medals (훈장) are earned by playing only and buy cosmetics in a weekly rotating stall.
 */
import { RNG } from '../sim/rng';
import { allBaseCosmetics, cosmeticById, type Cosmetic } from './cosmetics';
import type { SaveData } from './save';
import { premiumAvailable, seasonAt, seasonProductId, seasonName } from './season';

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
    desc: '개발 후원. 후원자 깃발과 "후원자" 칭호. 전투 능력에는 영향 없음.',
    priceKrw: 2200,
    grants: ['ban_supporter', 'title_supporter'],
    kind: 'supporter',
  },
  {
    id: 'supporter_large',
    name: '변경 후원 (대)',
    desc: '후원 (소)의 모든 것 + 황금 근위 갑주 + 백대리석 성채.',
    priceKrw: 6600,
    grants: ['ban_supporter', 'title_supporter', 'dye_gold', 'castle_marble'],
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
    desc: '별 3개 성 "빠른 소탕"(하루 3회, 전투 없이 재도전 보상), 편성 저장 칸 +4, 4배속. 전투력 변화 없음.',
    priceKrw: 5500,
    grants: [],
    flags: ['sweep', 'presets', 'speed4'],
    kind: 'convenience',
  },
];

export function seasonPassProduct(now: Date): Product | null {
  const s = seasonAt(now);
  if (!premiumAvailable(s)) return null;
  return {
    id: seasonProductId(s),
    name: `프리미엄 연대기 — ${seasonName(s)}`,
    desc: '이번 시즌 프리미엄 보상 트랙: 시즌 한정 깃발·갑주·성채·칭호와 훈장. 이미 오른 단계 보상도 즉시 받을 수 있음.',
    priceKrw: 5500,
    grants: [],
    kind: 'pass',
  };
}

export function allProducts(now: Date): Product[] {
  const p = seasonPassProduct(now);
  return p ? [p, ...PRODUCTS] : PRODUCTS;
}

export function productById(id: string, now: Date): Product | undefined {
  if (/^chronicle_s\d+$/.test(id)) {
    return { id, name: '프리미엄 연대기', desc: '', priceKrw: 5500, grants: [], kind: 'pass' };
  }
  return allProducts(now).find((p) => p.id === id);
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

export function hasFlag(s: SaveData, flag: string) {
  return PRODUCTS.some((p) => p.flags?.includes(flag) && s.entitlements.includes(p.id));
}

// ---------------------------------------------------------------- medal stall (weekly rotation, offline)

export function weekKey(now: Date) {
  return Math.floor((now.getTime() - Date.UTC(2026, 0, 5)) / (7 * 86400000));
}

export function weeklyStall(now: Date): Cosmetic[] {
  const pool = allBaseCosmetics().filter((c) => c.source === 'shop' && c.medals > 0);
  const rng = new RNG(weekKey(now) * 104729 + 7);
  return rng.shuffle([...pool]).slice(0, 5);
}

export function buyWithMedals(s: SaveData, id: string, now: Date): string | null {
  const c = cosmeticById(id);
  if (!c || c.medals <= 0) return '판매하지 않는 품목입니다.';
  if (!weeklyStall(now).some((x) => x.id === id)) return '이번 주 진열 품목이 아닙니다.';
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
