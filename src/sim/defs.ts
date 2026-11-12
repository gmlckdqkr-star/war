/**
 * Static game data: tiles, unit stats, squad types, enemy factions and warband templates.
 * All names, factions and the world of "잿빛 성벽 (Ashen Ramparts)" are original.
 */

export const TILE = 16; // world px per tile
export const GW = 60; // grid width (tiles)
export const GH = 34; // grid height (tiles)
export const WORLD_W = GW * TILE;
export const WORLD_H = GH * TILE;
export const DT = 1 / 30; // fixed simulation step (s)

export const Tile = {
  GRASS: 0,
  ROUGH: 1,
  WATER: 2,
  ROAD: 3,
  WALL: 4,
  GATE: 5,
  TOWER: 6,
  RUBBLE: 7,
  KEEP: 8,
  FLOOR: 9,
  DEPOT: 10,
  INFIRM: 11,
  CLIFF: 12,
  BRIDGE: 13,
  GATE_BROKEN: 14,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

export interface TileInfo {
  name: string;
  /** enemy ground units can walk here */
  epass: boolean;
  /** defenders can walk here */
  dpass: boolean;
  /** movement cost for path fields */
  cost: number;
  /** speed multiplier */
  speed: number;
  /** intact structure with HP (blocks enemies until destroyed/climbed) */
  struct: boolean;
  /** standing here gives elevation (wall-walk) */
  elev: boolean;
  maxHp: number;
}

export const TILE_INFO: TileInfo[] = [];
TILE_INFO[Tile.GRASS] = { name: '초지', epass: true, dpass: true, cost: 1, speed: 1, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.ROUGH] = { name: '덤불', epass: true, dpass: true, cost: 2.2, speed: 0.6, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.WATER] = { name: '해자', epass: true, dpass: true, cost: 4, speed: 0.35, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.ROAD] = { name: '길', epass: true, dpass: true, cost: 0.8, speed: 1.15, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.WALL] = { name: '성벽', epass: false, dpass: true, cost: 1, speed: 0.9, struct: true, elev: true, maxHp: 900 };
TILE_INFO[Tile.GATE] = { name: '성문', epass: false, dpass: true, cost: 1, speed: 1, struct: true, elev: false, maxHp: 1100 };
TILE_INFO[Tile.TOWER] = { name: '탑', epass: false, dpass: true, cost: 1, speed: 0.9, struct: true, elev: true, maxHp: 1800 };
TILE_INFO[Tile.RUBBLE] = { name: '무너진 성벽', epass: true, dpass: true, cost: 1.6, speed: 0.65, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.KEEP] = { name: '본성', epass: false, dpass: false, cost: 1, speed: 0, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.FLOOR] = { name: '안뜰', epass: true, dpass: true, cost: 1, speed: 1.05, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.DEPOT] = { name: '보급고', epass: true, dpass: true, cost: 1, speed: 1, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.INFIRM] = { name: '치료소', epass: true, dpass: true, cost: 1, speed: 1, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.CLIFF] = { name: '절벽', epass: false, dpass: false, cost: 1, speed: 0, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.BRIDGE] = { name: '다리', epass: true, dpass: true, cost: 0.9, speed: 1.1, struct: false, elev: false, maxHp: 0 };
TILE_INFO[Tile.GATE_BROKEN] = { name: '부서진 성문', epass: true, dpass: true, cost: 1.1, speed: 1, struct: false, elev: false, maxHp: 0 };

export type Role =
  | 'melee'
  | 'ranged'
  | 'ladder'
  | 'ram'
  | 'tower'
  | 'treb'
  | 'sapper'
  | 'flyer'
  | 'dragon'
  | 'healer'
  | 'engineer'
  | 'surgeon'
  | 'giant';

export type FactionId = 'human' | 'dwarf' | 'elf' | 'orc' | 'wyrm' | 'realm';

export interface UnitDef {
  id: string;
  name: string;
  side: 0 | 1;
  faction: FactionId;
  hp: number;
  atk: number;
  armor: number; // 0..0.8 fraction of damage blocked
  ap?: number; // armor piercing 0..1
  reach: number; // extra melee reach in px
  range: number; // ranged range in tiles (0 = melee only)
  cd: number; // attack cooldown s
  speed: number; // tiles per second
  r: number; // body radius px
  role: Role;
  sdmg?: number; // structure damage multiplier
  rangedResist?: number; // multiplier on incoming ranged damage (lower = more resistant)
  cavalry?: boolean;
  antiCav?: number;
  fearless?: boolean;
  leader?: boolean;
  aura?: number; // morale aura for own band / squads
  terror?: number; // morale drain per second for defenders nearby
  regen?: number; // hp/s
  heal?: number; // hp/s healing others
  ammo?: number;
  flying?: boolean;
  fireWeak?: number;
  kite?: boolean;
  proj?: 'arrow' | 'bolt' | 'stone' | 'fire' | 'javelin';
  color: string;
  trim: string;
  gold: number; // bounty
  big?: boolean;
}

const D = (u: Omit<UnitDef, 'side' | 'faction' | 'gold'> & { gold?: number }): UnitDef => ({ side: 0, faction: 'realm', gold: 0, ...u });
const E = (faction: FactionId, u: Omit<UnitDef, 'side' | 'faction'>): UnitDef => ({ side: 1, faction, ...u });

export const UNITS: Record<string, UnitDef> = {};
const add = (u: UnitDef) => (UNITS[u.id] = u);

// ---------- Defenders (the Realm of Haldmere) ----------
add(D({ id: 'd_spear', name: '창병', hp: 100, atk: 9, armor: 0.22, reach: 7, range: 0, cd: 1.1, speed: 1.7, r: 3.2, role: 'melee', antiCav: 2, color: '#3a6fd8', trim: '#c9d6f2' }));
add(D({ id: 'd_sword', name: '방패검병', hp: 125, atk: 11, armor: 0.36, reach: 4, range: 0, cd: 1.0, speed: 1.6, r: 3.4, role: 'melee', rangedResist: 0.7, color: '#2f5fc4', trim: '#e0e6f5' }));
add(D({ id: 'd_archer', name: '궁수', hp: 75, atk: 10, armor: 0.1, reach: 3, range: 9, cd: 1.7, speed: 1.7, r: 3, role: 'ranged', ammo: 24, proj: 'arrow', color: '#4a86e8', trim: '#b8e0a0' }));
add(D({ id: 'd_xbow', name: '석궁병', hp: 85, atk: 23, ap: 0.6, armor: 0.25, reach: 3, range: 8, cd: 3.2, speed: 1.5, r: 3.2, role: 'ranged', ammo: 14, proj: 'bolt', color: '#3966b8', trim: '#f0d080' }));
add(D({ id: 'd_knight', name: '기사', hp: 190, atk: 17, armor: 0.45, reach: 5, range: 0, cd: 1.1, speed: 2.7, r: 4.3, role: 'melee', cavalry: true, color: '#2850a8', trim: '#f2f2f2' }));
add(D({ id: 'd_engineer', name: '공병', hp: 80, atk: 5, armor: 0.15, reach: 3, range: 0, cd: 1.2, speed: 1.8, r: 3, role: 'engineer', color: '#5a7fc0', trim: '#d9a066' }));
add(D({ id: 'd_surgeon', name: '군의관', hp: 65, atk: 3, armor: 0.1, reach: 3, range: 0, cd: 1.4, speed: 2.0, r: 3, role: 'surgeon', color: '#6f8fd0', trim: '#ffffff' }));
add(D({ id: 'd_ballista', name: '노포조', hp: 120, atk: 75, ap: 0.75, armor: 0.2, reach: 3, range: 13, cd: 4.6, speed: 1.0, r: 4.2, role: 'ranged', ammo: 10, proj: 'bolt', color: '#30509a', trim: '#c08850' }));
add(D({ id: 'd_militia', name: '민병', hp: 70, atk: 7, armor: 0.1, reach: 4, range: 0, cd: 1.2, speed: 1.7, r: 3, role: 'melee', color: '#6a88c8', trim: '#a0a0a0' }));

// ---------- 아우렐 협약군 (Aurel Concord) — human crusader league ----------
add(E('human', { id: 'h_levy', name: '징집병', hp: 70, atk: 7, armor: 0.12, reach: 6, range: 0, cd: 1.2, speed: 1.3, r: 3.2, role: 'melee', sdmg: 0.6, color: '#b8333a', trim: '#d8c8a8', gold: 2 }));
add(E('human', { id: 'h_maa', name: '중보병', hp: 115, atk: 11, armor: 0.36, reach: 4, range: 0, cd: 1.0, speed: 1.2, r: 3.5, role: 'melee', sdmg: 0.8, color: '#9e2a31', trim: '#c0c6cc', gold: 3 }));
add(E('human', { id: 'h_bow', name: '장궁병', hp: 65, atk: 8, armor: 0.1, reach: 3, range: 10, cd: 2.0, speed: 1.3, r: 3, role: 'ranged', proj: 'arrow', color: '#c04048', trim: '#8a6a3a', gold: 3 }));
add(E('human', { id: 'h_knight', name: '협약 기사', hp: 180, atk: 16, armor: 0.45, reach: 5, range: 0, cd: 1.1, speed: 2.4, r: 4.3, role: 'melee', cavalry: true, sdmg: 0.5, color: '#8e1f28', trim: '#e8e8e8', gold: 6 }));
add(E('human', { id: 'h_ladder', name: '사다리조', hp: 75, atk: 7, armor: 0.12, reach: 3, range: 0, cd: 1.2, speed: 1.25, r: 3.3, role: 'ladder', color: '#b8333a', trim: '#a07040', gold: 3 }));
add(E('human', { id: 'h_captain', name: '협약 대장', hp: 240, atk: 15, armor: 0.42, reach: 5, range: 0, cd: 1.0, speed: 1.3, r: 4.2, role: 'melee', leader: true, aura: 1.2, sdmg: 1, color: '#7a1820', trim: '#f0c040', gold: 15 }));
add(E('human', { id: 'h_tower', name: '공성탑', hp: 950, atk: 0, armor: 0.5, reach: 0, range: 0, cd: 2, speed: 0.42, r: 11, role: 'tower', rangedResist: 0.3, fireWeak: 2, color: '#6b4a2a', trim: '#3a2a1a', gold: 30, big: true }));
add(E('human', { id: 'h_treb', name: '투석기', hp: 320, atk: 0, armor: 0.3, reach: 0, range: 17, cd: 7.5, speed: 0.4, r: 9, role: 'treb', sdmg: 150, proj: 'stone', fireWeak: 1.6, color: '#7a5530', trim: '#3a2a1a', gold: 25, big: true }));

// ---------- 딥홀드 씨족 (Deephold Clans) — dwarves ----------
add(E('dwarf', { id: 'w_shield', name: '방패수호병', hp: 125, atk: 10, armor: 0.45, reach: 4, range: 0, cd: 1.1, speed: 1.0, r: 3.7, role: 'melee', rangedResist: 0.72, sdmg: 1, color: '#b07a2a', trim: '#6a6a72', gold: 4 }));
add(E('dwarf', { id: 'w_xbow', name: '천둥석궁병', hp: 90, atk: 16, ap: 0.5, armor: 0.35, reach: 3, range: 9, cd: 3.4, speed: 1.0, r: 3.5, role: 'ranged', proj: 'bolt', color: '#9a6a22', trim: '#4a4a52', gold: 5 }));
add(E('dwarf', { id: 'w_sapper', name: '갱도병', hp: 110, atk: 8, armor: 0.3, reach: 3, range: 0, cd: 1.2, speed: 1.1, r: 3.6, role: 'sapper', color: '#8a5a1a', trim: '#2a2a2a', gold: 6 }));
add(E('dwarf', { id: 'w_ram', name: '철갑 충차', hp: 1150, atk: 0, armor: 0.55, reach: 2, range: 0, cd: 2.6, speed: 0.5, r: 10, role: 'ram', sdmg: 95, rangedResist: 0.3, color: '#5a4a3a', trim: '#8a8a92', gold: 30, big: true }));
add(E('dwarf', { id: 'w_thane', name: '씨족장', hp: 320, atk: 19, armor: 0.55, reach: 4, range: 0, cd: 1.0, speed: 1.0, r: 4.4, role: 'melee', leader: true, aura: 1.5, sdmg: 1.2, color: '#c8901a', trim: '#e0e0e8', gold: 18 }));

// ---------- 실반 무리 (Sylvan Host) — elves ----------
add(E('elf', { id: 'e_skirm', name: '숲 척후궁수', hp: 60, atk: 8, armor: 0.1, reach: 3, range: 11, cd: 1.6, speed: 1.9, r: 2.9, role: 'ranged', kite: true, proj: 'arrow', color: '#2f9e74', trim: '#d8e8b0', gold: 3 }));
add(E('elf', { id: 'e_blade', name: '칼춤꾼', hp: 90, atk: 13, armor: 0.2, reach: 4, range: 0, cd: 0.75, speed: 2.3, r: 3.1, role: 'melee', sdmg: 0.5, color: '#248a62', trim: '#e0f0e0', gold: 4 }));
add(E('elf', { id: 'e_ladder', name: '덩굴 사다리조', hp: 70, atk: 8, armor: 0.12, reach: 3, range: 0, cd: 1.0, speed: 1.8, r: 3.1, role: 'ladder', color: '#2f9e74', trim: '#7a5a2a', gold: 3 }));
add(E('elf', { id: 'e_druid', name: '수액 치유사', hp: 120, atk: 4, armor: 0.15, reach: 3, range: 0, cd: 1.5, speed: 1.4, r: 3.3, role: 'healer', heal: 11, color: '#4ab884', trim: '#f0e070', gold: 8 }));
add(E('elf', { id: 'e_ancient', name: '고목 거수', hp: 1450, atk: 32, armor: 0.4, reach: 6, range: 0, cd: 2.2, speed: 0.55, r: 10, role: 'giant', sdmg: 3, fireWeak: 2.2, terror: 1.2, color: '#4a6a2a', trim: '#8a6a3a', gold: 35, big: true }));
add(E('elf', { id: 'e_warden', name: '숲의 감시자', hp: 220, atk: 14, armor: 0.2, reach: 3, range: 11, cd: 1.4, speed: 1.8, r: 3.8, role: 'ranged', leader: true, aura: 1.2, kite: true, proj: 'arrow', color: '#1a7a52', trim: '#f0d040', gold: 15 }));

// ---------- 애쉬터스크 군단 (Ashtusk Horde) — orcs & goblins ----------
add(E('orc', { id: 'o_grunt', name: '오크 전사', hp: 125, atk: 12, armor: 0.25, reach: 4, range: 0, cd: 1.0, speed: 1.4, r: 3.9, role: 'melee', sdmg: 1, color: '#5a7a2a', trim: '#5a3a2a', gold: 3 }));
add(E('orc', { id: 'o_goblin', name: '고블린', hp: 40, atk: 5, armor: 0, reach: 3, range: 0, cd: 0.9, speed: 1.9, r: 2.6, role: 'melee', sdmg: 0.4, color: '#8a9a3a', trim: '#6a4a2a', gold: 1 }));
add(E('orc', { id: 'o_gob_ladder', name: '고블린 사다리꾼', hp: 45, atk: 5, armor: 0, reach: 3, range: 0, cd: 0.9, speed: 1.8, r: 2.8, role: 'ladder', color: '#8a9a3a', trim: '#a07040', gold: 2 }));
add(E('orc', { id: 'o_berserk', name: '광전사', hp: 150, atk: 18, armor: 0.1, reach: 4, range: 0, cd: 0.8, speed: 1.8, r: 4, role: 'melee', fearless: true, sdmg: 1.2, color: '#6a5a1a', trim: '#c03020', gold: 5 }));
add(E('orc', { id: 'o_spear', name: '투창병', hp: 100, atk: 14, armor: 0.2, reach: 4, range: 6, cd: 2.4, speed: 1.4, r: 3.8, role: 'ranged', proj: 'javelin', color: '#4a6a2a', trim: '#8a6a3a', gold: 4 }));
add(E('orc', { id: 'o_troll', name: '바위 트롤', hp: 1050, atk: 36, armor: 0.3, reach: 7, range: 0, cd: 2.0, speed: 0.8, r: 9, role: 'giant', sdmg: 2.6, regen: 6, terror: 1.5, color: '#6a7a7a', trim: '#4a5a5a', gold: 30, big: true }));
add(E('orc', { id: 'o_warboss', name: '군단장', hp: 480, atk: 24, armor: 0.4, reach: 5, range: 0, cd: 1.0, speed: 1.4, r: 5, role: 'melee', leader: true, aura: 2, sdmg: 1.5, color: '#3a5a1a', trim: '#e0b030', gold: 22 }));
add(E('orc', { id: 'o_ram', name: '통나무 충차', hp: 750, atk: 0, armor: 0.35, reach: 2, range: 0, cd: 2.6, speed: 0.6, r: 9, role: 'ram', sdmg: 75, rangedResist: 0.4, fireWeak: 1.6, color: '#6a4a2a', trim: '#3a2a1a', gold: 20, big: true }));

// ---------- 잿불 용족 (Cinderbrood) — dragons and their retinue ----------
add(E('wyrm', { id: 'c_dragon', name: '잿불 고룡', hp: 3400, atk: 30, armor: 0.5, reach: 0, range: 5, cd: 0.2, speed: 2.4, r: 16, role: 'dragon', flying: true, terror: 4, leader: true, aura: 2, color: '#7a2018', trim: '#ff8a30', gold: 120, big: true }));
add(E('wyrm', { id: 'c_drake', name: '비룡 기수', hp: 280, atk: 16, armor: 0.3, reach: 6, range: 0, cd: 1.3, speed: 3.2, r: 6, role: 'flyer', flying: true, terror: 0.5, color: '#9a3a1a', trim: '#e0a040', gold: 12 }));
add(E('wyrm', { id: 'c_kobold', name: '코볼트', hp: 36, atk: 4, armor: 0.05, reach: 3, range: 0, cd: 0.9, speed: 2.0, r: 2.5, role: 'melee', sdmg: 0.4, color: '#c0702a', trim: '#5a2a1a', gold: 1 }));
add(E('wyrm', { id: 'c_kob_ladder', name: '코볼트 사다리꾼', hp: 40, atk: 4, armor: 0.05, reach: 3, range: 0, cd: 0.9, speed: 1.9, r: 2.7, role: 'ladder', color: '#c0702a', trim: '#a07040', gold: 2 }));
add(E('wyrm', { id: 'c_cultist', name: '잿불 광신도', hp: 80, atk: 10, armor: 0.1, reach: 3, range: 6, cd: 2.2, speed: 1.4, r: 3.2, role: 'ranged', proj: 'fire', color: '#a03a1a', trim: '#2a1a1a', gold: 4 }));

// ---------- Defender squad types ----------
export type SquadTypeId = 'spear' | 'sword' | 'archer' | 'xbow' | 'knight' | 'engineer' | 'surgeon' | 'ballista' | 'militia';

export interface SquadType {
  id: SquadTypeId;
  unit: string;
  size: number;
  name: string;
  short: string;
  recruit: number; // gold per soldier
  unlock: number; // campaign stage index (1-based) where it unlocks
  desc: string;
  ranged: boolean;
}

export const SQUAD_TYPES: Record<SquadTypeId, SquadType> = {
  spear: { id: 'spear', unit: 'd_spear', size: 12, name: '창병대', short: '창', recruit: 8, unlock: 1, ranged: false, desc: '저렴하고 기병에 강함. 성벽과 성문을 지키는 기본 병력.' },
  sword: { id: 'sword', unit: 'd_sword', size: 10, name: '방패검병대', short: '검', recruit: 11, unlock: 1, ranged: false, desc: '튼튼한 근접 병력. 화살에 강하고 돌파구를 막는 데 적합.' },
  archer: { id: 'archer', unit: 'd_archer', size: 10, name: '궁수대', short: '궁', recruit: 10, unlock: 1, ranged: true, desc: '성벽 위에서 사거리가 늘어남. 화살 보급 필요.' },
  engineer: { id: 'engineer', unit: 'd_engineer', size: 6, name: '공병대', short: '공', recruit: 12, unlock: 3, ranged: false, desc: '자재를 써서 성벽·성문 수리, 불 끄기, 무너진 곳 재건.' },
  xbow: { id: 'xbow', unit: 'd_xbow', size: 8, name: '석궁대', short: '노', recruit: 14, unlock: 4, ranged: true, desc: '느리지만 장갑을 관통. 드워프·기사·트롤에게 강함.' },
  surgeon: { id: 'surgeon', unit: 'd_surgeon', size: 4, name: '군의대', short: '의', recruit: 15, unlock: 4, ranged: false, desc: '쓰러진 병사를 치료소로 후송하고 부상자를 치료 (의약품 소모).' },
  ballista: { id: 'ballista', unit: 'd_ballista', size: 3, name: '노포대', short: '포', recruit: 24, unlock: 5, ranged: true, desc: '장거리 대형 화살. 공성 병기·거수·용에게 매우 강함.' },
  knight: { id: 'knight', unit: 'd_knight', size: 6, name: '기사대', short: '기', recruit: 30, unlock: 6, ranged: false, desc: '빠른 기동 예비대. 성문 밖 출격으로 투석기 파괴에 유용.' },
  militia: { id: 'militia', unit: 'd_militia', size: 10, name: '민병대', short: '민', recruit: 0, unlock: 99, ranged: false, desc: '지휘관 능력 "증원"으로 소집되는 임시 병력.' },
};

// ---------- Factions & warband templates ----------
export interface FactionInfo {
  id: FactionId;
  name: string;
  desc: string;
  color: string;
}

export const FACTIONS: Record<FactionId, FactionInfo> = {
  human: { id: 'human', name: '아우렐 협약군', desc: '인간 성전 연합. 사다리, 공성탑, 투석기를 고르게 운용.', color: '#b8333a' },
  dwarf: { id: 'dwarf', name: '딥홀드 씨족', desc: '드워프. 중장갑, 땅굴 공병, 철갑 충차. 사기가 잘 꺾이지 않음.', color: '#b07a2a' },
  elf: { id: 'elf', name: '실반 무리', desc: '엘프. 긴 사거리의 척후궁수와 빠른 칼춤꾼, 성벽을 부수는 고목 거수.', color: '#2f9e74' },
  orc: { id: 'orc', name: '애쉬터스크 군단', desc: '오크와 고블린 수행족. 압도적 물량과 트롤. 군단장이 쓰러지면 무너짐.', color: '#5a7a2a' },
  wyrm: { id: 'wyrm', name: '잿불 용족', desc: '고룡과 비룡 기수, 코볼트 수행족, 광신도. 불과 공포로 사기를 꺾음.', color: '#d0561c' },
  realm: { id: 'realm', name: '할드미어 변경군', desc: '플레이어 진영.', color: '#3a6fd8' },
};

export type FieldKind = 'breach' | 'escalade' | 'ram';

export interface BandTemplate {
  id: string;
  name: string;
  faction: FactionId;
  leader?: string;
  members: [string, number][];
  morale: number;
  field: FieldKind;
}

export const BANDS: Record<string, BandTemplate> = {};
const band = (b: BandTemplate) => (BANDS[b.id] = b);

band({ id: 'h_levies', name: '징집병 무리', faction: 'human', members: [['h_levy', 14]], morale: 55, field: 'breach' });
band({ id: 'h_company', name: '협약 중대', faction: 'human', leader: 'h_captain', members: [['h_maa', 10], ['h_levy', 8]], morale: 70, field: 'breach' });
band({ id: 'h_archers', name: '장궁대', faction: 'human', members: [['h_bow', 10]], morale: 55, field: 'breach' });
band({ id: 'h_escalade', name: '사다리 돌격대', faction: 'human', members: [['h_ladder', 5], ['h_maa', 6], ['h_levy', 6]], morale: 65, field: 'escalade' });
band({ id: 'h_knights', name: '협약 기사단', faction: 'human', members: [['h_knight', 7]], morale: 80, field: 'breach' });
band({ id: 'h_tower', name: '공성탑 행렬', faction: 'human', members: [['h_tower', 1], ['h_maa', 10]], morale: 75, field: 'escalade' });
band({ id: 'h_treb', name: '투석기 포대', faction: 'human', members: [['h_treb', 1], ['h_levy', 5]], morale: 60, field: 'breach' });

band({ id: 'w_wall', name: '방패벽', faction: 'dwarf', leader: 'w_thane', members: [['w_shield', 12]], morale: 85, field: 'breach' });
band({ id: 'w_bolts', name: '천둥석궁대', faction: 'dwarf', members: [['w_xbow', 8]], morale: 75, field: 'breach' });
band({ id: 'w_sappers', name: '갱도대', faction: 'dwarf', members: [['w_sapper', 4], ['w_shield', 5]], morale: 80, field: 'escalade' });
band({ id: 'w_ram', name: '충차대', faction: 'dwarf', members: [['w_ram', 1], ['w_shield', 8]], morale: 85, field: 'ram' });

band({ id: 'e_skirmish', name: '척후 궁수대', faction: 'elf', leader: 'e_warden', members: [['e_skirm', 10]], morale: 60, field: 'breach' });
band({ id: 'e_dancers', name: '칼춤꾼 무리', faction: 'elf', members: [['e_blade', 8], ['e_ladder', 4]], morale: 65, field: 'escalade' });
band({ id: 'e_grove', name: '거수와 치유사', faction: 'elf', members: [['e_ancient', 1], ['e_druid', 3], ['e_blade', 4]], morale: 75, field: 'breach' });

band({ id: 'o_warband', name: '오크 전투단', faction: 'orc', leader: 'o_warboss', members: [['o_grunt', 10], ['o_goblin', 12]], morale: 70, field: 'breach' });
band({ id: 'o_swarm', name: '고블린 떼', faction: 'orc', members: [['o_goblin', 18], ['o_gob_ladder', 5]], morale: 40, field: 'escalade' });
band({ id: 'o_berserkers', name: '광전사 무리', faction: 'orc', members: [['o_berserk', 8]], morale: 90, field: 'breach' });
band({ id: 'o_javelins', name: '투창 부대', faction: 'orc', members: [['o_spear', 8]], morale: 60, field: 'breach' });
band({ id: 'o_troll', name: '트롤과 몰이꾼', faction: 'orc', members: [['o_troll', 1], ['o_goblin', 10]], morale: 70, field: 'breach' });
band({ id: 'o_ram', name: '통나무 충차대', faction: 'orc', members: [['o_ram', 1], ['o_grunt', 6]], morale: 70, field: 'ram' });

band({ id: 'c_dragon', name: '고룡과 수행족', faction: 'wyrm', leader: 'c_dragon', members: [['c_kobold', 16], ['c_kob_ladder', 6]], morale: 80, field: 'escalade' });
band({ id: 'c_drakes', name: '비룡 편대', faction: 'wyrm', members: [['c_drake', 3]], morale: 75, field: 'breach' });
band({ id: 'c_cult', name: '잿불 광신도', faction: 'wyrm', members: [['c_cultist', 8], ['c_kobold', 10]], morale: 65, field: 'breach' });
band({ id: 'c_kobolds', name: '코볼트 떼', faction: 'wyrm', members: [['c_kobold', 16], ['c_kob_ladder', 5]], morale: 40, field: 'escalade' });
