/** Purely cosmetic items. None of these change battle stats (no pay-to-win). */
import { RNG } from '../sim/rng';

export type CosmeticKind = 'dye' | 'banner' | 'castle' | 'title';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** dye: body colour; banner: [field, charge]; castle: [stone, roof] */
  colors: string[];
  pattern?: BannerPattern;
  /** medal price in the medal shop (0 = not sold for medals) */
  medals: number;
  source: 'default' | 'shop' | 'pass' | 'iap' | 'achievement';
}

export type BannerPattern = 'plain' | 'cross' | 'chevron' | 'quarter' | 'pale' | 'saltire' | 'star' | 'tower';
export const PATTERNS: BannerPattern[] = ['plain', 'cross', 'chevron', 'quarter', 'pale', 'saltire', 'star', 'tower'];

const C: Cosmetic[] = [
  // dyes
  { id: 'dye_azure', kind: 'dye', name: '변경 청색', colors: ['#3a6fd8'], medals: 0, source: 'default' },
  { id: 'dye_teal', kind: 'dye', name: '청록 망토', colors: ['#2a9d8f'], medals: 120, source: 'shop' },
  { id: 'dye_violet', kind: 'dye', name: '왕실 보라', colors: ['#6a4cc2'], medals: 160, source: 'shop' },
  { id: 'dye_ivory', kind: 'dye', name: '상아 갑주', colors: ['#cfc8b0'], medals: 160, source: 'shop' },
  { id: 'dye_night', kind: 'dye', name: '밤의 파수', colors: ['#2b3150'], medals: 200, source: 'shop' },
  { id: 'dye_sky', kind: 'dye', name: '하늘빛', colors: ['#5aa9e6'], medals: 120, source: 'shop' },
  { id: 'dye_gold', kind: 'dye', name: '황금 근위', colors: ['#c9a227'], medals: 0, source: 'iap' },
  // banners
  { id: 'ban_plain', kind: 'banner', name: '변경 깃발', colors: ['#2f5fc4', '#f2e6c8'], pattern: 'cross', medals: 0, source: 'default' },
  { id: 'ban_chevron', kind: 'banner', name: '산마루 문장', colors: ['#2a4f8a', '#e8c35a'], pattern: 'chevron', medals: 100, source: 'shop' },
  { id: 'ban_tower', kind: 'banner', name: '탑의 문장', colors: ['#4a4a5a', '#dcdcdc'], pattern: 'tower', medals: 140, source: 'shop' },
  { id: 'ban_star', kind: 'banner', name: '새벽별', colors: ['#1d2a5a', '#f5f0a0'], pattern: 'star', medals: 140, source: 'shop' },
  { id: 'ban_saltire', kind: 'banner', name: '교차 창', colors: ['#3a7a6a', '#f2f2f2'], pattern: 'saltire', medals: 100, source: 'shop' },
  { id: 'ban_supporter', kind: 'banner', name: '후원자의 깃발', colors: ['#7a1fa2', '#ffd54a'], pattern: 'star', medals: 0, source: 'iap' },
  { id: 'ban_dragonslayer', kind: 'banner', name: '용 사냥꾼', colors: ['#5a1a10', '#ff9a40'], pattern: 'saltire', medals: 0, source: 'achievement' },
  // castle themes
  { id: 'castle_grey', kind: 'castle', name: '회색 석재', colors: ['#8c9099', '#5e626b'], medals: 0, source: 'default' },
  { id: 'castle_sand', kind: 'castle', name: '사암', colors: ['#c4ab7c', '#8c7550'], medals: 260, source: 'shop' },
  { id: 'castle_basalt', kind: 'castle', name: '현무암', colors: ['#555560', '#33333c'], medals: 260, source: 'shop' },
  { id: 'castle_marble', kind: 'castle', name: '백대리석', colors: ['#dad8cf', '#a8a69c'], medals: 0, source: 'iap' },
  { id: 'castle_brick', kind: 'castle', name: '붉은 벽돌', colors: ['#9c5f4c', '#6a3e32'], medals: 0, source: 'iap' },
  { id: 'castle_frost', kind: 'castle', name: '서리 성채', colors: ['#a9c1d1', '#6f8a9c'], medals: 0, source: 'iap' },
  // titles
  { id: 'title_warden', kind: 'title', name: '변경 수호관', colors: [], medals: 0, source: 'default' },
  { id: 'title_shield', kind: 'title', name: '성벽의 방패', colors: [], medals: 80, source: 'shop' },
  { id: 'title_supporter', kind: 'title', name: '후원자', colors: [], medals: 0, source: 'iap' },
  { id: 'title_endless', kind: 'title', name: '끝없는 파수꾼', colors: [], medals: 0, source: 'achievement' },
];

const BASE = new Map(C.map((c) => [c.id, c]));

const SEASON_THEMES = [
  { name: '잿빛 겨울', hues: ['#9fb4c7', '#3b4d63', '#e6eef5'] },
  { name: '붉은 수확', hues: ['#b5523b', '#f0c070', '#4a2a1a'] },
  { name: '서리불꽃', hues: ['#5ac8e0', '#ff8a3d', '#22303a'] },
  { name: '금빛 맹세', hues: ['#d4a72c', '#2b2b2b', '#f5eed6'] },
  { name: '깊은 숲', hues: ['#3f7d4f', '#c8d6a0', '#1f2a1a'] },
  { name: '폭풍 해안', hues: ['#3d6e9e', '#d9e4ea', '#1a2633'] },
  { name: '자수정 밤', hues: ['#7b4fb0', '#e0c8ff', '#241838'] },
  { name: '철과 재', hues: ['#6d6d74', '#c45a2a', '#1c1c20'] },
];

export function seasonTheme(season: number) {
  return SEASON_THEMES[(season - 1) % SEASON_THEMES.length];
}

/** Season-exclusive cosmetics are generated from the season number: no content updates needed. */
export function seasonCosmetics(season: number): Cosmetic[] {
  const th = seasonTheme(season);
  const rng = new RNG(season * 7919 + 17);
  const p1 = PATTERNS[rng.int(1, PATTERNS.length - 1)];
  const p2 = PATTERNS[rng.int(1, PATTERNS.length - 1)];
  const tag = `S${season}`;
  return [
    { id: `s${season}_dye`, kind: 'dye', name: `${th.name} 갑주`, colors: [th.hues[0]], medals: 0, source: 'pass' },
    { id: `s${season}_ban1`, kind: 'banner', name: `${th.name} 깃발`, colors: [th.hues[2], th.hues[0]], pattern: p1, medals: 0, source: 'pass' },
    { id: `s${season}_ban2`, kind: 'banner', name: `${th.name} 전투기`, colors: [th.hues[1], th.hues[2]], pattern: p2, medals: 0, source: 'pass' },
    { id: `s${season}_castle`, kind: 'castle', name: `${th.name} 성채`, colors: [th.hues[0], th.hues[1]], medals: 0, source: 'pass' },
    { id: `s${season}_title`, kind: 'title', name: `${th.name}의 영웅 (${tag})`, colors: [], medals: 0, source: 'pass' },
    { id: `s${season}_ban3`, kind: 'banner', name: `${th.name} 소기`, colors: [th.hues[0], th.hues[1]], pattern: 'plain', medals: 0, source: 'pass' },
  ];
}

export function cosmeticById(id: string): Cosmetic | undefined {
  const b = BASE.get(id);
  if (b) return b;
  const m = /^s(\d+)_/.exec(id);
  if (m) return seasonCosmetics(Number(m[1])).find((c) => c.id === id);
  return undefined;
}

export function allBaseCosmetics(): Cosmetic[] {
  return C;
}

export const DEFAULT_COSMETICS = { dye: 'dye_azure', banner: 'ban_plain', castle: 'castle_grey', title: 'title_warden' };
