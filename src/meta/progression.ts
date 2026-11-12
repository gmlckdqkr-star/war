/**
 * Campaign economy and roster management. Pure functions over SaveData (unit-tested, no DOM).
 */
import { SQUAD_TYPES, type SquadTypeId } from '../sim/defs';
import { RNG } from '../sim/rng';
import { STAGES, type StageDef, type Supplies } from '../sim/stages';
import type { BattleConfig, BattleResult, SquadSetup } from '../sim/world';
import { cosmeticById } from './cosmetics';
import { newSquad, type RosterSquad, type SaveData } from './save';
import { addPassXp } from './season';

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  base: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'masonry', name: '석공술', desc: '성벽·성문·본성 내구도 +12%, 공병 작업 +10% (레벨당)', max: 5, base: 120 },
  { id: 'fletching', name: '화살 장인', desc: '궁수·석궁·노포 피해 +8% (레벨당)', max: 5, base: 120 },
  { id: 'smithing', name: '대장간', desc: '근접 공격 +6%, 방어 +3% (레벨당)', max: 5, base: 120 },
  { id: 'drill', name: '훈련 교범', desc: '모든 분대 기본 사기 +5 (레벨당)', max: 5, base: 100 },
  { id: 'logistics', name: '병참', desc: '전투 시작 보급 +15%, 화살 재보급 속도 +15% (레벨당)', max: 5, base: 100 },
  { id: 'medicine', name: '의술', desc: '쓰러진 병사 사망률 -5%p, 출혈 시간 +6초, 부상 회복 빨라짐 (레벨당)', max: 5, base: 110 },
  { id: 'ballistics', name: '노포 공학', desc: '석궁·노포 피해 +10% (레벨당)', max: 3, base: 160 },
  { id: 'command', name: '지휘술', desc: '지휘관 능력 재사용 대기 -8% (레벨당)', max: 3, base: 180 },
  { id: 'barracks', name: '병영 확장', desc: '출전 가능 분대 +1 (레벨당)', max: 2, base: 400 },
];

export function upgradeCost(u: UpgradeDef, level: number) {
  return Math.round(u.base * Math.pow(1.65, level));
}

export function buyUpgrade(s: SaveData, id: string): string | null {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return '알 수 없는 연구';
  const lv = s.upgrades[id] ?? 0;
  if (lv >= u.max) return '최대 레벨입니다.';
  const c = upgradeCost(u, lv);
  if (s.gold < c) return `금화가 부족합니다 (${c} 필요).`;
  s.gold -= c;
  s.upgrades[id] = lv + 1;
  return null;
}

// ---------------------------------------------------------------- roster

export const SQUAD_PRICE: Record<SquadTypeId, number> = {
  spear: 140,
  sword: 180,
  archer: 170,
  engineer: 170,
  xbow: 240,
  surgeon: 220,
  ballista: 320,
  knight: 420,
  militia: 0,
};

export const ROSTER_MAX = 14;

export function maxCleared(s: SaveData): number {
  let m = 0;
  for (const st of STAGES) if ((s.stars[st.id] ?? 0) > 0) m = Math.max(m, st.index);
  return m;
}

export function unlockedTypes(s: SaveData): SquadTypeId[] {
  const reach = maxCleared(s) + 1;
  return (Object.keys(SQUAD_TYPES) as SquadTypeId[]).filter((t) => t !== 'militia' && SQUAD_TYPES[t].unlock <= reach);
}

export function buySquad(s: SaveData, type: SquadTypeId): string | null {
  if (!unlockedTypes(s).includes(type)) return '아직 잠긴 병종입니다.';
  if (s.roster.length >= ROSTER_MAX) return `병영이 가득 찼습니다 (최대 ${ROSTER_MAX}개 분대).`;
  const p = SQUAD_PRICE[type];
  if (s.gold < p) return `금화가 부족합니다 (${p} 필요).`;
  s.gold -= p;
  s.roster.push(newSquad(s, type));
  return null;
}

export function readyCount(r: RosterSquad) {
  return r.soldiers.filter((x) => x.wounded === 0).length;
}

export function refillCost(r: RosterSquad) {
  return (SQUAD_TYPES[r.type].size - r.soldiers.length) * SQUAD_TYPES[r.type].recruit;
}

export function refillSquad(s: SaveData, r: RosterSquad): string | null {
  const missing = SQUAD_TYPES[r.type].size - r.soldiers.length;
  if (missing <= 0) return '이미 정원이 찼습니다.';
  const c = refillCost(r);
  if (s.gold < c) return `금화가 부족합니다 (${c} 필요).`;
  s.gold -= c;
  // recruits dilute squad experience
  const before = r.soldiers.length;
  for (let i = 0; i < missing; i++) r.soldiers.push({ id: s.nextId++, xp: 0, wounded: 0 });
  r.xp = Math.floor((r.xp * before) / r.soldiers.length);
  return null;
}

/** Heal wounded soldiers immediately with gold (convenience, purely saves a battle of waiting). */
export function treatCost(r: RosterSquad) {
  return r.soldiers.filter((x) => x.wounded > 0).length * 6;
}
export function treatSquad(s: SaveData, r: RosterSquad): string | null {
  const c = treatCost(r);
  if (c === 0) return '부상병이 없습니다.';
  if (s.gold < c) return `금화가 부족합니다 (${c} 필요).`;
  s.gold -= c;
  for (const x of r.soldiers) x.wounded = 0;
  return null;
}

export function dismissSquad(s: SaveData, id: string): string | null {
  if (s.roster.length <= 2) return '최소 2개 분대는 유지해야 합니다.';
  const i = s.roster.findIndex((r) => r.id === id);
  if (i < 0) return '분대를 찾을 수 없습니다.';
  s.roster.splice(i, 1);
  return null;
}

export const RANK_XP = [0, 40, 110, 220, 380, 600];
export const RANK_NAMES = ['신병', '숙련', '노련', '정예', '역전', '전설'];

export function rankOf(r: RosterSquad) {
  let k = 0;
  for (let i = 0; i < RANK_XP.length; i++) if (r.xp >= RANK_XP[i]) k = i;
  return k;
}

export function squadCap(s: SaveData, st: StageDef) {
  return st.squadCap + (s.upgrades.barracks ?? 0);
}

// ---------------------------------------------------------------- supplies

export const SUPPLY_PRICE: Record<keyof Supplies, { per: number; pack: number; name: string }> = {
  arrows: { per: 100, pack: 30, name: '화살' },
  food: { per: 20, pack: 25, name: '식량' },
  meds: { per: 5, pack: 30, name: '의약품' },
  mats: { per: 40, pack: 30, name: '자재' },
};

export function baseSupplies(s: SaveData, st: StageDef): Supplies {
  const m = 1 + 0.15 * (s.upgrades.logistics ?? 0);
  return {
    arrows: Math.round(st.supplies.arrows * m),
    food: Math.round(st.supplies.food * m),
    meds: Math.round(st.supplies.meds * m),
    mats: Math.round(st.supplies.mats * m),
  };
}

/**
 * Food the whole battle will need for a lineup of `soldiers` fighters (shared by the sim rule and the
 * pre-battle forecast). The sim deducts ceil(alive / 2) at the start of every wave, so this is the
 * worst case where nobody falls. Keep this in sync with World.startWave.
 */
export function foodNeeded(st: StageDef, soldiers: number): number {
  return st.waves.length * Math.ceil(Math.max(0, soldiers) / 2);
}

/** Soldiers that would deploy for a lineup (ready = not wounded). */
export function lineupSoldiers(s: SaveData, squadIds: string[]): number {
  let n = 0;
  for (const id of squadIds) {
    const r = s.roster.find((x) => x.id === id);
    if (r) n += readyCount(r);
  }
  return n;
}

// ---------------------------------------------------------------- battle setup

export function battleConfig(
  s: SaveData,
  st: StageDef,
  squadIds: string[],
  extra: Partial<Supplies>,
  seed: number,
  opts: { mods?: string[]; placement?: Record<string, number> } = {},
): BattleConfig {
  const sup = baseSupplies(s, st);
  for (const k of Object.keys(extra) as (keyof Supplies)[]) sup[k] += extra[k] ?? 0;
  const dye = cosmeticById(s.equipped.dye)?.colors[0] ?? '#3a6fd8';
  const squads: SquadSetup[] = [];
  for (const id of squadIds) {
    const r = s.roster.find((x) => x.id === id);
    if (!r) continue;
    const ready = r.soldiers.filter((x) => x.wounded === 0).map((x) => x.id);
    if (ready.length === 0) continue;
    squads.push({ rosterId: r.id, type: r.type, name: r.name, rank: rankOf(r), xp: r.xp, soldiers: ready, color: dye, tile: opts.placement?.[r.id] });
  }
  return {
    stage: st,
    seed,
    squads,
    upgrades: { ...s.upgrades },
    difficulty: s.settings.difficulty,
    supplies: sup,
    mods: opts.mods,
    autoCommand: s.settings.autoCommand,
  };
}

/** Pick a sensible default lineup: best-ready squads, ensuring a mix (ranged + melee + support). */
export function defaultLineup(s: SaveData, st: StageDef): string[] {
  const cap = squadCap(s, st);
  const ready = s.roster.filter((r) => readyCount(r) > 0);
  const score = (r: RosterSquad) => readyCount(r) / SQUAD_TYPES[r.type].size + rankOf(r) * 0.15;
  const pick: RosterSquad[] = [];
  const want: SquadTypeId[][] = [['spear', 'sword'], ['archer'], ['archer', 'xbow'], ['spear', 'sword'], ['engineer'], ['xbow', 'archer'], ['surgeon'], ['ballista'], ['knight'], ['spear', 'sword', 'archer', 'xbow']];
  for (const group of want) {
    if (pick.length >= cap) break;
    const c = ready.filter((r) => !pick.includes(r) && group.includes(r.type)).sort((a, b) => score(b) - score(a))[0];
    if (c) pick.push(c);
  }
  for (const r of ready.sort((a, b) => score(b) - score(a))) {
    if (pick.length >= cap) break;
    if (!pick.includes(r)) pick.push(r);
  }
  return pick.map((r) => r.id);
}

// ---------------------------------------------------------------- results

export interface Rewards {
  gold: number;
  medals: number;
  passXp: number;
  firstClear: boolean;
  newStars: number;
  bonusFirstWin: boolean;
  unlocked: string[];
  promoted: string[];
  achievements: string[];
  lines: string[];
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Apply a finished battle to the save: casualties, wounds, xp, gold, stars, unlocks. A daily challenge is
 * credited to `dailyKey`, the day it was the challenge of (today unless given).
 */
export function applyBattle(
  s: SaveData,
  st: StageDef,
  res: BattleResult,
  mode: 'campaign' | 'daily' | 'endless',
  now = new Date(),
  dailyKey = todayKey(now),
): Rewards {
  const rw: Rewards = { gold: 0, medals: 0, passXp: 0, firstClear: false, newStars: 0, bonusFirstWin: false, unlocked: [], promoted: [], achievements: [], lines: [] };
  const medLv = s.upgrades.medicine ?? 0;
  const rng = new RNG(Math.floor(res.time * 1000) + res.kills);
  // wounds heal by one battle for everyone not deployed, too
  const deployedIds = new Set(res.squads.map((q) => q.rosterId));
  for (const r of s.roster) {
    if (!deployedIds.has(r.id)) for (const so of r.soldiers) if (so.wounded > 0) so.wounded--;
  }
  for (const out of res.squads) {
    const r = s.roster.find((x) => x.id === out.rosterId);
    if (!r) continue;
    const before = rankOf(r);
    const dead = new Set(out.dead);
    const wounded = new Set(out.wounded);
    r.soldiers = r.soldiers.filter((so) => !dead.has(so.id));
    for (const so of r.soldiers) {
      if (wounded.has(so.id)) so.wounded = rng.chance(0.15 * medLv) ? 0 : 1;
      else if (so.wounded > 0) so.wounded--;
      so.xp += 1;
    }
    r.kills += out.kills;
    r.battles++;
    r.xp += Math.round(out.kills * 1 + (res.won ? 12 : 4) + res.wavesCleared * 2);
    const after = rankOf(r);
    if (after > before) rw.promoted.push(`${r.name}: ${RANK_NAMES[after]}`);
  }
  s.stats.battles++;
  s.stats.kills += res.kills;
  s.stats.dead += res.dead;
  s.stats.dragons += res.dragons ?? 0;
  const diffMul = s.settings.difficulty === 'hard' ? 1.25 : s.settings.difficulty === 'easy' ? 0.85 : 1;
  rw.gold += Math.round(res.bounty * diffMul);
  rw.lines.push(`전리품 ${Math.round(res.bounty * diffMul)}`);
  if (mode === 'campaign') {
    const prev = s.stars[st.id] ?? 0;
    if (res.won) {
      s.stats.wins++;
      const first = prev === 0;
      rw.firstClear = first;
      const base = Math.round(st.reward * (first ? 1 : 0.35) * diffMul);
      rw.gold += base;
      rw.lines.push(first ? `첫 승리 보상 ${base}` : `재도전 보상 ${base}`);
      if (res.stars > prev) {
        const add = (res.stars - prev) * Math.round(st.reward * 0.15);
        rw.newStars = res.stars - prev;
        rw.gold += add;
        rw.medals += (res.stars - prev) * 5;
        rw.lines.push(`새 별 ${res.stars - prev}개: 금화 ${add}, 훈장 ${(res.stars - prev) * 5}`);
        s.stars[st.id] = res.stars;
      }
      s.cleared[st.id] = (s.cleared[st.id] ?? 0) + 1;
      // free squad when a new type unlocks
      if (first) {
        const nextStage = STAGES.find((x) => x.index === st.index + 1);
        if (nextStage?.unlockSquad) {
          const t = nextStage.unlockSquad as SquadTypeId;
          if (s.roster.length < 14) {
            s.roster.push(newSquad(s, t));
            rw.unlocked.push(`${SQUAD_TYPES[t].name} 합류 (무료)`);
          }
        }
        for (const t of Object.keys(SQUAD_TYPES) as SquadTypeId[]) {
          if (SQUAD_TYPES[t].unlock === st.index + 1 && t !== nextStage?.unlockSquad) rw.unlocked.push(`${SQUAD_TYPES[t].name} 모집 가능`);
        }
      }
      const tk = todayKey(now);
      // '>' (not '!=') so moving the device clock back never pays a daily bonus twice
      if (tk > s.firstWinKey) {
        s.firstWinKey = tk;
        rw.bonusFirstWin = true;
        const b = 60 + st.index * 10;
        rw.gold += b;
        rw.lines.push(`오늘의 첫 승리 ${b}`);
      }
    } else {
      const cons = Math.round(st.reward * 0.15 * (res.wavesCleared / Math.max(1, res.totalWaves)));
      rw.gold += cons;
      if (cons) rw.lines.push(`위로금 ${cons}`);
    }
    rw.passXp = 80 + 40 * res.wavesCleared + (res.won ? 60 * res.stars : 0) + (rw.firstClear ? 200 : 0);
  } else if (mode === 'daily') {
    const tk = dailyKey;
    if (res.won && tk > s.daily.lastKey) {
      rw.medals += 20;
      rw.gold += 150;
      rw.lines.push('오늘의 공성 완료: 금화 150, 훈장 20');
      s.daily.streak = isYesterday(s.daily.lastKey, tk) ? s.daily.streak + 1 : 1;
      s.daily.lastKey = tk;
      if (s.daily.streak % 7 === 0) {
        rw.medals += 40;
        rw.lines.push(`${s.daily.streak}일 연속 보너스: 훈장 40`);
      }
    }
    rw.passXp = res.won ? 400 : 120;
  } else {
    const waves = res.wavesCleared;
    if (waves > s.endlessBest) {
      rw.lines.push(`새 기록: ${waves} 물결 (이전 ${s.endlessBest})`);
      rw.medals += Math.max(0, Math.floor(waves / 5) - Math.floor(s.endlessBest / 5)) * 10;
      s.endlessBest = waves;
    }
    rw.gold += waves * 25;
    rw.lines.push(`버틴 물결 보상 ${waves * 25}`);
    rw.passXp = 60 + waves * 30;
  }
  s.gold += rw.gold;
  s.medals += rw.medals;
  addPassXp(s, rw.passXp, now);
  rw.achievements = checkAchievements(s, res, st, mode);
  return rw;
}

function isYesterday(prev: string, today: string) {
  if (!prev) return false;
  const a = new Date(prev + 'T12:00:00');
  const b = new Date(today + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000) === 1;
}

// ---------------------------------------------------------------- achievements

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  medals: number;
  cosmetic?: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: '첫 밤을 버티다', desc: '첫 전투에서 승리', medals: 10 },
  { id: 'stage5', name: '변경의 절반', desc: '5번째 성을 지켜냄', medals: 30 },
  { id: 'stage10', name: '최후의 성채', desc: '모든 성을 지켜냄', medals: 80, cosmetic: 'title_shield' },
  { id: 'stars10', name: '빛나는 방패', desc: '별 10개 모으기', medals: 20 },
  { id: 'stars30', name: '완벽한 수호', desc: '별 30개 모으기', medals: 60 },
  { id: 'kills1000', name: '천의 적', desc: '누적 처치 1,000', medals: 20 },
  { id: 'kills10000', name: '만의 적', desc: '누적 처치 10,000', medals: 60 },
  { id: 'dragon', name: '용 사냥꾼', desc: '잿불 고룡을 쓰러뜨리거나 쫓아냄', medals: 40, cosmetic: 'ban_dragonslayer' },
  { id: 'nodeaths', name: '단 한 명도', desc: '전사자 없이 승리 (3물결 이상)', medals: 25 },
  { id: 'endless10', name: '버티는 자', desc: '끝없는 공성 10물결', medals: 20 },
  { id: 'endless25', name: '끝없는 파수꾼', desc: '끝없는 공성 25물결', medals: 50, cosmetic: 'title_endless' },
  { id: 'daily7', name: '성실한 수호관', desc: '오늘의 공성 7일 연속', medals: 30 },
  { id: 'veteran', name: '전설의 분대', desc: '분대 하나를 전설 계급으로', medals: 40 },
  { id: 'hard', name: '혹독한 전장', desc: '어려움 난이도로 승리', medals: 20 },
];

export function checkAchievements(s: SaveData, res: BattleResult, st: StageDef, mode: string): string[] {
  const got: string[] = [];
  const give = (id: string) => {
    if (s.achievements.includes(id)) return;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return;
    s.achievements.push(id);
    s.medals += a.medals;
    if (a.cosmetic && !s.owned.includes(a.cosmetic)) s.owned.push(a.cosmetic);
    got.push(a.name);
  };
  const totalStars = Object.values(s.stars).reduce((x, y) => x + y, 0);
  if (res.won) give('first_win');
  if (mode === 'campaign' && res.won && st.index >= 5) give('stage5');
  if (mode === 'campaign' && res.won && st.index >= 10) give('stage10');
  if (totalStars >= 10) give('stars10');
  if (totalStars >= 30) give('stars30');
  if (s.stats.kills >= 1000) give('kills1000');
  if (s.stats.kills >= 10000) give('kills10000');
  if (s.stats.dragons > 0) give('dragon');
  if (res.won && res.dead === 0 && res.totalWaves >= 3) give('nodeaths');
  if (s.endlessBest >= 10) give('endless10');
  if (s.endlessBest >= 25) give('endless25');
  if (s.daily.streak >= 7) give('daily7');
  if (s.roster.some((r) => rankOf(r) >= 5)) give('veteran');
  if (res.won && s.settings.difficulty === 'hard') give('hard');
  return got;
}

// ---------------------------------------------------------------- quick sweep (commander kit)

export const SWEEPS_PER_DAY = 3;

export function sweepsLeft(s: SaveData, now = new Date()) {
  // a date earlier than the last sweep (clock moved back) counts as the same day
  return todayKey(now) > s.sweep.key ? SWEEPS_PER_DAY : Math.max(0, SWEEPS_PER_DAY - s.sweep.n);
}

export const SWEEP_PASS_XP = 150;
export const SWEEP_MEDALS = 2;

/**
 * Collect a replay of a 3-star stage without fighting (commander kit convenience; the caller checks the
 * entitlement). Deliberately gives NO gold: gold only comes from battles, so nothing bought with money
 * turns into battle power. Rewards: chronicle xp + a couple of medals.
 */
export function sweepStage(s: SaveData, st: StageDef, now = new Date()): { medals: number; passXp: number } | string {
  if ((s.stars[st.id] ?? 0) < 3) return '별 3개를 받은 성만 소탕할 수 있습니다.';
  if (sweepsLeft(s, now) <= 0) return '오늘의 소탕 횟수를 모두 썼습니다.';
  const tk = todayKey(now);
  if (tk > s.sweep.key) s.sweep = { key: tk, n: 0 };
  s.sweep.n++;
  s.medals += SWEEP_MEDALS;
  s.cleared[st.id] = (s.cleared[st.id] ?? 0) + 1;
  addPassXp(s, SWEEP_PASS_XP, now);
  return { medals: SWEEP_MEDALS, passXp: SWEEP_PASS_XP };
}
