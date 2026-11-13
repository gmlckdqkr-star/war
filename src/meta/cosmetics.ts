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
  { id: 'ban_patron', kind: 'banner', name: '후견인의 금사자기', colors: ['#1c1c22', '#e2b13c'], pattern: 'quarter', medals: 0, source: 'iap' },
  { id: 'ban_dragonslayer', kind: 'banner', name: '용 사냥꾼', colors: ['#5a1a10', '#ff9a40'], pattern: 'saltire', medals: 0, source: 'achievement' },
  // castle themes
  { id: 'castle_grey', kind: 'castle', name: '회색 석재', colors: ['#8c9099', '#5e626b'], medals: 0, source: 'default' },
  { id: 'castle_sand', kind: 'castle', name: '사암', colors: ['#c4ab7c', '#8c7550'], medals: 260, source: 'shop' },
  { id: 'castle_basalt', kind: 'castle', name: '현무암', colors: ['#555560', '#33333c'], medals: 260, source: 'shop' },
  { id: 'castle_marble', kind: 'castle', name: '백대리석', colors: ['#dad8cf', '#a8a69c'], medals: 0, source: 'iap' },
  { id: 'castle_brick', kind: 'castle', name: '붉은 벽돌', colors: ['#9c5f4c', '#6a3e32'], medals: 0, source: 'iap' },
  { id: 'castle_frost', kind: 'castle', name: '서리 성채', colors: ['#a9c1d1', '#6f8a9c'], medals: 0, source: 'iap' },
  { id: 'castle_gilded', kind: 'castle', name: '금빛 성채', colors: ['#d8c27a', '#7d6428'], medals: 0, source: 'iap' },
  // titles
  { id: 'title_warden', kind: 'title', name: '변경 수호관', colors: [], medals: 0, source: 'default' },
  { id: 'title_shield', kind: 'title', name: '성벽의 방패', colors: [], medals: 80, source: 'shop' },
  { id: 'title_supporter', kind: 'title', name: '후원자', colors: [], medals: 0, source: 'iap' },
  { id: 'title_patron', kind: 'title', name: '변경의 후견인', colors: [], medals: 0, source: 'iap' },
  { id: 'title_endless', kind: 'title', name: '끝없는 파수꾼', colors: [], medals: 0, source: 'achievement' },
];

const BASE = new Map(C.map((c) => [c.id, c]));

// Seasons 1-8 use hand-picked palettes; later seasons get a generated palette so no season ever
// re-sells the same colours. Names pair two word lists (8 x 8 = 64 unique names, ~7 years of seasons).
const NAME_A = ['잿빛', '붉은', '서리', '금빛', '깊은', '폭풍', '자수정', '강철'];
const NAME_B = ['겨울', '수확', '불꽃', '맹세', '숲', '해안', '밤', '성채'];
const HAND_HUES = [
  ['#9fb4c7', '#3b4d63', '#e6eef5'],
  ['#b5523b', '#f0c070', '#4a2a1a'],
  ['#5ac8e0', '#ff8a3d', '#22303a'],
  ['#d4a72c', '#2b2b2b', '#f5eed6'],
  ['#3f7d4f', '#c8d6a0', '#1f2a1a'],
  ['#3d6e9e', '#d9e4ea', '#1a2633'],
  ['#7b4fb0', '#e0c8ff', '#241838'],
  ['#6d6d74', '#c45a2a', '#1c1c20'],
];

/** HSL (degrees, %, %) to #rrggbb */
export function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + x(f(0)) + x(f(8)) + x(f(4));
}

export function seasonTheme(season: number): { name: string; hues: string[] } {
  const n = Math.max(1, Math.floor(season));
  const i = (n - 1) % 8;
  const k = Math.floor((n - 1) / 8) % 8;
  const name = `${NAME_A[i]} ${NAME_B[(i + k) % 8]}`;
  if (n <= 8) return { name, hues: HAND_HUES[i] };
  const rng = new RNG(n * 104729 + 3);
  const h = ((n - 1) * 137.508) % 360; // golden angle: successive seasons never look alike
  return {
    name,
    hues: [hsl(h, 42 + rng.int(0, 22), 50 + rng.int(0, 12)), hsl(h + 140 + rng.int(0, 80), 58, 64), hsl(h, 30, 15 + rng.int(0, 6))],
  };
}

/** Season-exclusive cosmetics are generated from the season number: no content updates needed.
 *  Index 0-4 belong to the premium chronicle (granted on purchase), index 5 is the free-track reward. */
export function seasonCosmetics(season: number): Cosmetic[] {
  const th = seasonTheme(season);
  const rng = new RNG(season * 7919 + 17);
  const p1 = PATTERNS[rng.int(1, PATTERNS.length - 1)];
  let p2 = PATTERNS[rng.int(1, PATTERNS.length - 1)];
  if (p2 === p1) p2 = PATTERNS[(PATTERNS.indexOf(p1) % (PATTERNS.length - 1)) + 1];
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

/** Premium chronicle cosmetics of a season (granted permanently when the season pass is bought). */
export function premiumSeasonCosmeticIds(season: number): string[] {
  return seasonCosmetics(season)
    .slice(0, 5)
    .map((c) => c.id);
}

export function isSeasonPremiumCosmetic(id: string): boolean {
  return /^s\d+_(dye|ban1|ban2|castle|title)$/.test(id);
}

// Weekly workshop: two medal-only items generated from the week number, so the medal stall never runs dry.
const WEEK_ADJ = ['새벽', '황혼', '은빛', '들불', '안개', '청동', '바람', '달빛', '이끼', '호박', '흑요', '눈꽃'];
const WEEK_NOUN = ['파수', '방벽', '창끝', '봉화', '망루', '참호', '군기', '성문', '해자', '총안'];

export function weeklyCosmetics(week: number): Cosmetic[] {
  const w = Math.max(0, Math.floor(week));
  const rng = new RNG(w * 7907 + 11);
  const h = (w * 97.31) % 360;
  const adj = WEEK_ADJ[w % WEEK_ADJ.length];
  const noun = WEEK_NOUN[Math.floor(w / WEEK_ADJ.length) % WEEK_NOUN.length];
  return [
    {
      id: `w${w}_ban`,
      kind: 'banner',
      name: `${adj} ${noun} 문장`,
      colors: [hsl(h, 38 + rng.int(0, 25), 28 + rng.int(0, 18)), hsl(h + 180 + rng.int(-40, 40), 55, 76)],
      pattern: PATTERNS[rng.int(1, PATTERNS.length - 1)],
      medals: 150,
      source: 'shop',
    },
    { id: `w${w}_dye`, kind: 'dye', name: `${adj} ${noun} 갑주`, colors: [hsl(h + 60 + rng.int(0, 120), 42 + rng.int(0, 25), 44 + rng.int(0, 14))], medals: 120, source: 'shop' },
  ];
}

export function cosmeticById(id: string): Cosmetic | undefined {
  const b = BASE.get(id);
  if (b) return b;
  const m = /^s(\d+)_/.exec(id);
  if (m) return seasonCosmetics(Number(m[1])).find((c) => c.id === id);
  const w = /^w(\d+)_/.exec(id);
  if (w) return weeklyCosmetics(Number(w[1])).find((c) => c.id === id);
  return undefined;
}

export function allBaseCosmetics(): Cosmetic[] {
  return C;
}

export const DEFAULT_COSMETICS = { dye: 'dye_azure', banner: 'ban_plain', castle: 'castle_grey', title: 'title_warden' };
