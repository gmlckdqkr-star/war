import { BANDS, GH, GW, Tile, UNITS, type FactionId } from './defs';
import type { Grid } from './grid';
import { RNG, hashStr } from './rng';

export type Edge = 'W' | 'N' | 'S' | 'E';

export interface WaveGroup {
  band: string;
  edge: Edge;
  /** span along the edge, in tiles */
  span: [number, number];
  /** seconds after wave start */
  delay: number;
  /** copies of the band */
  n?: number;
}

export interface Wave {
  groups: WaveGroup[];
  /** if the wave is not cleared after this many seconds, the next one starts anyway */
  maxTime?: number;
  intermission?: number;
  /** extra strength (HP and attack) of this wave's enemies on top of the stage level (endless escalation) */
  mul?: number;
}

/** A plausible approach to the castle: the map edge and the stretch of it (in tiles) an army can come from. */
export interface Lane {
  edge: Edge;
  span: [number, number];
  /** relative chance of being picked when a group swings round to another approach */
  weight: number;
}

export interface Supplies {
  arrows: number;
  food: number;
  meds: number;
  mats: number;
}

export interface StageDef {
  id: string;
  index: number; // 1-based campaign order (0 for special modes)
  name: string;
  subtitle: string;
  story: string;
  factions: FactionId[];
  squadCap: number;
  level: number; // enemy stat scaling
  /** extra multiplier on enemy HP and attack alike (daily '정예군'); level alone scales attack by √level */
  enemyMul?: number;
  supplies: Supplies;
  reward: number; // gold for first clear (3 stars), scaled by stars
  keepHp: number;
  build: (g: Grid, rng: RNG) => void;
  waves: Wave[];
  /**
   * Other approaches open to the attackers (always reachable; tests check it). At battle start every
   * band of the scripted waves takes another lane with probability `flank`, chosen from the seed,
   * so the same castle is not always stormed from the same side. See planWaves.
   */
  lanes?: Lane[];
  flank?: number;
  /** stores a supply train brings before every later wave, up to the starting stores (endless: no fixed length) */
  resupply?: Partial<Supplies>;
  tips?: string[];
  unlockSquad?: string; // squad type granted on first clear of the previous stage
  abilities: string[];
}

const W = (band: string, edge: Edge, span: [number, number], delay = 0, n = 1): WaveGroup => ({ band, edge, span, delay, n });

const L = (edge: Edge, span: [number, number], weight = 2): Lane => ({ edge, span, weight });

const MIDW: [number, number] = [8, 26];
const NW: [number, number] = [3, 16];
const SW: [number, number] = [18, 31];
const NORTH: [number, number] = [6, 34];
const SOUTH: [number, number] = [6, 34];

function cliffsBand(g: Grid, rng: RNG, x0: number, top: number, bottom: number) {
  g.rect(x0, 0, GW - 1, top, Tile.CLIFF);
  g.rect(x0, bottom, GW - 1, GH - 1, Tile.CLIFF);
  // jagged edge
  for (let x = x0 - 3; x < GW; x++) {
    if (x < 0) continue;
    const a = rng.int(0, 2);
    const b = rng.int(0, 2);
    for (let k = 0; k < a; k++) if (x >= x0 - 2) g.set(x, top + 1 + k, g.get(x, top + 1 + k) === Tile.GRASS ? Tile.CLIFF : g.get(x, top + 1 + k));
    for (let k = 0; k < b; k++) if (x >= x0 - 2) g.set(x, bottom - 1 - k, g.get(x, bottom - 1 - k) === Tile.GRASS ? Tile.CLIFF : g.get(x, bottom - 1 - k));
  }
}

/**
 * Stores a castle starts with. The first two feed and arm a fresh army in full. From the third on the
 * granary holds about two thirds of a full army's rations (foodNeeded) and the quivers and medicine
 * chests run low in a long siege: supply packs, the 병참 research or the war council make up the rest.
 */
const supplies = (i: number): Supplies =>
  i <= 2
    ? { arrows: 1000 + 260 * i, food: 60 + 25 * i, meds: 6 + 2 * i, mats: 140 + 40 * i }
    : { arrows: 1100 + 210 * i, food: 40 + 11 * i, meds: 5 + 2 * i, mats: 140 + 40 * i };

export const STAGES: StageDef[] = [
  {
    id: 's1',
    index: 1,
    name: '개울목 초소',
    subtitle: '첫 번째 성벽',
    story: '할드미어 변경의 서쪽 끝. 아우렐 협약군의 선발대가 개울을 건너온다. 목책 하나로 첫 밤을 버텨라.',
    factions: ['human'],
    squadCap: 4,
    level: 0.85,
    supplies: supplies(1),
    reward: 160,
    keepHp: 3200,
    abilities: ['rally'],
    tips: [
      '분대 카드를 누르고 지도를 누르면 이동합니다. 끌어다 놓아도 됩니다.',
      '⏸ 일시정지 중에도 명령할 수 있습니다. 급할수록 멈추고 생각하세요.',
      '자동(A) 상태의 분대는 스스로 위협에 대응합니다. 명령을 내리면 수동이 됩니다.',
    ],
    lanes: [L('W', MIDW, 3), L('N', [21, 32]), L('S', [21, 32])],
    flank: 0.15,
    build(g, rng) {
      g.fill(Tile.GRASS);
      cliffsBand(g, rng, 34, 3, 30);
      g.patches(Tile.ROUGH, 7, 3, rng, 2, 5, 28, 28);
      g.line(0, 17, 37, 17, Tile.ROAD);
      g.rect(18, 4, 19, 29, Tile.WATER);
      g.rect(18, 16, 19, 18, Tile.BRIDGE);
      g.line(38, 4, 38, 29, Tile.WALL);
      g.set(38, 4, Tile.TOWER);
      g.set(38, 29, Tile.TOWER);
      g.set(38, 17, Tile.GATE);
      g.keep(51, 17);
      g.set(45, 12, Tile.DEPOT);
      g.set(45, 22, Tile.INFIRM);
    },
    waves: [
      { groups: [W('h_levies', 'W', MIDW, 0, 2)] },
      { groups: [W('h_levies', 'W', MIDW, 0, 2), W('h_archers', 'W', MIDW, 6)] },
      { groups: [W('h_company', 'W', MIDW, 0), W('h_levies', 'W', MIDW, 4), W('h_archers', 'W', MIDW, 8)] },
    ],
  },
  {
    id: 's2',
    index: 2,
    name: '갈대언덕 보루',
    subtitle: '사다리가 온다',
    story: '협약군은 성문만 두드리지 않는다. 사다리조가 성벽 어디든 오를 수 있다. 성벽 위 병사로 사다리를 밀어내라.',
    factions: ['human'],
    squadCap: 5,
    level: 0.88,
    supplies: supplies(2),
    reward: 200,
    keepHp: 3400,
    abilities: ['rally'],
    unlockSquad: 'archer',
    tips: ['사다리가 걸린 성벽(빨간 표시)에 근접 분대를 올리면 사다리를 밀어냅니다.', '사기가 무너진 분대는 본성으로 도망칩니다. "함성"으로 붙잡으세요.'],
    lanes: [L('W', MIDW, 3), L('N', [30, 44]), L('S', [30, 50])],
    flank: 0.2,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 10, 3, rng, 2, 1, 30, 32);
      g.line(0, 17, 35, 17, Tile.ROAD);
      g.line(46, 0, 46, 7, Tile.ROAD);
      g.wallRect(36, 8, 56, 26, { gates: [[36, 17], [46, 8]] });
      g.keep(49, 17);
      g.set(41, 12, Tile.DEPOT);
      g.set(41, 22, Tile.INFIRM);
    },
    waves: [
      { groups: [W('h_levies', 'W', MIDW, 0, 2), W('h_escalade', 'W', MIDW, 5)] },
      { groups: [W('h_company', 'W', MIDW), W('h_archers', 'W', MIDW, 4), W('h_escalade', 'N', [30, 44], 10)] },
      { groups: [W('h_escalade', 'W', NW, 0), W('h_escalade', 'W', SW, 3), W('h_levies', 'W', MIDW, 6, 2)] },
      { groups: [W('h_company', 'W', MIDW, 0, 2), W('h_archers', 'W', MIDW, 3, 2), W('h_escalade', 'N', [30, 44], 8)] },
    ],
  },
  {
    id: 's3',
    index: 3,
    name: '회색다리 요새',
    subtitle: '애쉬터스크의 물결',
    story: '용에게 쫓겨 남하한 오크 군단과 고블린 수행족. 수가 많다. 화살이 떨어지지 않도록 보급고를 지켜라.',
    factions: ['orc'],
    squadCap: 5,
    level: 0.85,
    supplies: supplies(3),
    reward: 240,
    keepHp: 3600,
    abilities: ['rally', 'volley'],
    unlockSquad: 'engineer',
    tips: ['궁수는 보급고 근처에서 빨리 화살을 채웁니다. 화살 재고를 확인하세요.', '공병대는 자재를 써서 성벽과 성문을 수리합니다.', '"일제사격": 적이 몰린 곳을 눌러 모든 궁수가 집중 사격합니다.'],
    lanes: [L('W', MIDW, 3), L('N', [32, 54]), L('S', [32, 54])],
    flank: 0.35,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 12, 3, rng, 2, 1, 26, 32);
      g.rect(28, 0, 30, GH - 1, Tile.WATER);
      g.rect(28, 16, 30, 18, Tile.BRIDGE);
      g.line(0, 17, 37, 17, Tile.ROAD);
      g.wallRect(38, 6, 57, 28, { gates: [[38, 17]] });
      g.set(38, 11, Tile.TOWER);
      g.set(38, 23, Tile.TOWER);
      g.keep(50, 17);
      g.set(43, 13, Tile.DEPOT);
      g.set(43, 21, Tile.INFIRM);
    },
    waves: [
      { groups: [W('o_swarm', 'W', MIDW, 0), W('o_warband', 'W', MIDW, 6), W('o_javelins', 'W', MIDW, 10)] },
      { groups: [W('o_warband', 'W', NW, 0), W('o_javelins', 'W', MIDW, 4), W('o_swarm', 'W', SW, 8), W('o_swarm', 'W', MIDW, 14)] },
      { groups: [W('o_ram', 'W', MIDW, 0), W('o_swarm', 'W', MIDW, 2, 2), W('o_berserkers', 'W', MIDW, 10)] },
      { groups: [W('o_warband', 'W', MIDW, 0, 2), W('o_javelins', 'W', MIDW, 5), W('o_swarm', 'W', MIDW, 10, 2), W('o_berserkers', 'W', MIDW, 16)] },
    ],
  },
  {
    id: 's4',
    index: 4,
    name: '늑대고개 관문',
    subtitle: '두 겹의 성벽',
    story: '산을 되찾겠다는 딥홀드 씨족. 그들의 방패벽은 화살을 튕겨내고, 갱도병은 성벽 밑을 판다. 외성이 무너지면 내성으로 물러나라.',
    factions: ['dwarf'],
    squadCap: 6,
    level: 0.85,
    supplies: supplies(4),
    reward: 280,
    keepHp: 3800,
    abilities: ['rally', 'volley', 'oil'],
    unlockSquad: 'xbow',
    tips: ['석궁은 드워프 갑옷을 관통합니다.', '갱도병(곡괭이)이 성벽 밑을 파면 잠시 뒤 성벽이 무너집니다. 궁수는 그를 먼저 쏘고, 바로 위 성벽에 오른 근접 분대는 돌을 떨어뜨립니다.', '"끓는 기름": 성문·성벽 앞 적에게 큰 피해를 줍니다.', '군의대는 쓰러진 병사를 치료소로 옮겨 목숨을 구합니다.'],
    build(g, rng) {
      g.fill(Tile.GRASS);
      // mountain pass
      g.rect(0, 0, GW - 1, 4, Tile.CLIFF);
      g.rect(0, 29, GW - 1, GH - 1, Tile.CLIFF);
      g.rect(24, 0, 34, 8, Tile.CLIFF);
      g.rect(24, 26, 34, GH - 1, Tile.CLIFF);
      g.patches(Tile.CLIFF, 10, 2, rng, 0, 5, 22, 7);
      g.patches(Tile.CLIFF, 10, 2, rng, 0, 26, 22, 28);
      g.patches(Tile.ROUGH, 8, 3, rng, 2, 8, 22, 25);
      g.line(0, 17, 41, 17, Tile.ROAD);
      g.line(30, 9, 30, 25, Tile.WALL);
      g.set(30, 9, Tile.TOWER);
      g.set(30, 25, Tile.TOWER);
      g.set(30, 17, Tile.GATE);
      g.line(42, 5, 42, 28, Tile.WALL);
      g.set(42, 5, Tile.TOWER);
      g.set(42, 28, Tile.TOWER);
      g.set(42, 12, Tile.TOWER);
      g.set(42, 22, Tile.TOWER);
      g.set(42, 17, Tile.GATE);
      g.keep(52, 17);
      g.set(47, 11, Tile.DEPOT);
      g.set(36, 14, Tile.DEPOT);
      g.set(47, 23, Tile.INFIRM);
    },
    waves: [
      { groups: [W('w_wall', 'W', MIDW, 0), W('w_bolts', 'W', MIDW, 5)] },
      { groups: [W('w_sappers', 'W', MIDW, 0), W('w_wall', 'W', MIDW, 4), W('w_bolts', 'W', MIDW, 8)] },
      { groups: [W('w_ram', 'W', MIDW, 0), W('w_wall', 'W', MIDW, 3), W('w_sappers', 'W', MIDW, 16)] },
      { groups: [W('w_wall', 'W', MIDW, 0), W('w_bolts', 'W', MIDW, 4), W('w_wall', 'W', MIDW, 14), W('w_ram', 'W', MIDW, 20)] },
      { groups: [W('w_sappers', 'W', MIDW, 0, 2), W('w_ram', 'W', MIDW, 5), W('w_wall', 'W', MIDW, 8, 2), W('w_bolts', 'W', MIDW, 10)] },
    ],
  },
  {
    id: 's5',
    index: 5,
    name: '은빛숲 성채',
    subtitle: '보이지 않는 궁수',
    story: '불탄 숲의 복수를 외치는 실반 무리. 숲에서 쏘는 척후궁수는 성벽 궁수보다 멀리 쏜다. 노포와 탑을 활용하라.',
    factions: ['elf'],
    squadCap: 6,
    level: 1.06,
    supplies: supplies(5),
    reward: 320,
    keepHp: 4000,
    abilities: ['rally', 'volley', 'oil'],
    unlockSquad: 'ballista',
    tips: ['노포대를 탑 위에 두면 거수와 공성 병기를 멀리서 잡습니다.', '엘프 척후궁수는 근접병이 다가오면 물러납니다. 기사나 일제사격으로 대응하세요.'],
    lanes: [L('W', MIDW, 3), L('N', [20, 40]), L('S', [20, 40])],
    flank: 0.4,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 26, 4, rng, 0, 0, 28, GH - 1);
      g.line(0, 12, 33, 12, Tile.ROAD);
      g.line(0, 22, 33, 22, Tile.ROAD);
      g.wallRect(34, 6, 57, 28, { gates: [[34, 12], [34, 22]] });
      g.set(34, 17, Tile.TOWER);
      g.set(45, 6, Tile.TOWER);
      g.set(45, 28, Tile.TOWER);
      g.keep(49, 17);
      g.set(40, 17, Tile.DEPOT);
      g.set(53, 10, Tile.INFIRM);
    },
    waves: [
      { groups: [W('e_skirmish', 'W', MIDW, 0), W('e_dancers', 'W', MIDW, 6), W('e_dancers', 'W', MIDW, 10)] },
      { groups: [W('e_skirmish', 'W', NW, 0), W('e_skirmish', 'W', SW, 2), W('e_dancers', 'W', MIDW, 8, 2)] },
      { groups: [W('e_grove', 'W', MIDW, 0), W('e_skirmish', 'W', MIDW, 3), W('e_dancers', 'N', [20, 40], 10), W('e_skirmish', 'W', MIDW, 12)] },
      { groups: [W('e_grove', 'W', MIDW, 0), W('e_skirmish', 'W', MIDW, 4, 2), W('e_dancers', 'S', [20, 40], 8, 2)] },
      { groups: [W('e_grove', 'W', NW, 0), W('e_grove', 'W', SW, 6), W('e_skirmish', 'W', MIDW, 3), W('e_dancers', 'S', [20, 40], 12, 2)] },
    ],
  },
  {
    id: 's6',
    index: 6,
    name: '쌍둥이탑 성',
    subtitle: '세 방향의 공세',
    story: '협약군과 오크 군단이 손을 잡았다. 서쪽, 북쪽, 남쪽 성문이 동시에 공격받는다. 예비대를 남겨두어라.',
    factions: ['human', 'orc'],
    squadCap: 7,
    level: 1.17,
    supplies: supplies(6),
    reward: 360,
    keepHp: 4200,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
    unlockSquad: 'knight',
    tips: ['기사대는 성문 밖으로 출격해 투석기를 부술 수 있습니다.', '"증원": 본성 앞에 민병대를 소집합니다 (전투당 1회).'],
    lanes: [L('W', MIDW, 3), L('N', [26, 50]), L('S', [26, 50])],
    flank: 0.35,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 14, 3, rng, 0, 0, 28, GH - 1);
      g.line(0, 17, 29, 17, Tile.ROAD);
      g.line(41, 0, 41, 5, Tile.ROAD);
      g.line(41, 29, 41, GH - 1, Tile.ROAD);
      g.wallRect(30, 6, 52, 28, { gates: [[30, 17], [41, 6], [41, 28]] });
      g.set(30, 11, Tile.TOWER);
      g.set(30, 23, Tile.TOWER);
      g.rect(53, 0, GW - 1, GH - 1, Tile.CLIFF);
      g.keep(44, 17);
      g.set(36, 12, Tile.DEPOT);
      g.set(48, 23, Tile.INFIRM);
    },
    waves: [
      { groups: [W('h_company', 'W', MIDW, 0), W('o_swarm', 'N', NORTH, 6), W('h_levies', 'S', SOUTH, 8)] },
      { groups: [W('o_warband', 'S', SOUTH, 0), W('h_escalade', 'W', MIDW, 4), W('h_archers', 'W', MIDW, 6), W('o_javelins', 'N', NORTH, 10)] },
      { groups: [W('h_treb', 'W', MIDW, 0), W('o_ram', 'N', NORTH, 4), W('o_swarm', 'S', SOUTH, 8), W('h_company', 'W', MIDW, 10)] },
      { groups: [W('h_knights', 'W', MIDW, 0), W('o_berserkers', 'N', NORTH, 3), W('o_warband', 'S', SOUTH, 6), W('h_escalade', 'W', MIDW, 12), W('o_swarm', 'N', NORTH, 14)] },
      { groups: [W('h_tower', 'W', MIDW, 0), W('o_troll', 'N', NORTH, 6), W('o_warband', 'S', SOUTH, 6), W('h_company', 'W', MIDW, 12, 2), W('h_archers', 'W', MIDW, 14)] },
    ],
  },
  {
    id: 's7',
    index: 7,
    name: '검은늪 수도원',
    subtitle: '트롤의 밤',
    story: '늪지에 세운 옛 수도원. 해자가 적의 발을 묶지만, 바위 트롤은 아랑곳하지 않는다. 군단장을 쓰러뜨리면 군단이 흔들린다.',
    factions: ['orc'],
    squadCap: 7,
    level: 1.24,
    supplies: supplies(7),
    reward: 400,
    keepHp: 4400,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
    lanes: [L('W', MIDW, 3), L('N', [32, 58]), L('S', [32, 58])],
    flank: 0.4,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.WATER, 16, 3, rng, 0, 0, 26, GH - 1);
      g.patches(Tile.ROUGH, 18, 3, rng, 0, 0, 30, GH - 1);
      g.rect(30, 3, 59, 4, Tile.WATER);
      g.rect(30, 29, 59, 30, Tile.WATER);
      g.rect(30, 3, 31, 30, Tile.WATER);
      g.rect(30, 16, 31, 18, Tile.BRIDGE);
      g.rect(44, 3, 46, 4, Tile.BRIDGE);
      g.line(0, 17, 33, 17, Tile.ROAD);
      g.wallRect(33, 6, 57, 27, { gates: [[33, 17], [45, 6]] });
      g.set(33, 11, Tile.TOWER);
      g.set(33, 22, Tile.TOWER);
      g.keep(49, 17);
      g.set(39, 12, Tile.DEPOT);
      g.set(39, 22, Tile.INFIRM);
    },
    waves: [
      { groups: [W('o_warband', 'W', MIDW, 0), W('o_javelins', 'W', MIDW, 5), W('o_swarm', 'N', [32, 58], 8), W('o_swarm', 'W', MIDW, 12)] },
      { groups: [W('o_troll', 'W', MIDW, 0), W('o_swarm', 'W', MIDW, 3, 2), W('o_berserkers', 'W', MIDW, 9), W('o_javelins', 'N', [32, 58], 12)] },
      { groups: [W('o_ram', 'W', MIDW, 0), W('o_warband', 'W', MIDW, 3, 2), W('o_swarm', 'N', [32, 58], 6, 2), W('o_berserkers', 'S', [32, 58], 12)] },
      { groups: [W('o_troll', 'W', NW, 0), W('o_troll', 'W', SW, 4), W('o_javelins', 'W', MIDW, 6, 2), W('o_berserkers', 'N', [32, 58], 10), W('o_warband', 'W', MIDW, 14)] },
      { groups: [W('o_warband', 'W', MIDW, 0, 2), W('o_ram', 'N', [32, 58], 5), W('o_troll', 'W', MIDW, 10), W('o_swarm', 'W', MIDW, 12, 2), W('o_javelins', 'S', [32, 58], 14), W('o_berserkers', 'N', [32, 58], 16)] },
    ],
  },
  {
    id: 's8',
    index: 8,
    name: '철모루 성',
    subtitle: '돌과 불의 비',
    story: '협약군과 딥홀드가 공성 병기를 끌고 왔다. 투석기가 성벽을 무너뜨리기 전에 출격하거나, 공병으로 버텨라.',
    factions: ['human', 'dwarf'],
    squadCap: 8,
    level: 1.34,
    supplies: supplies(8),
    reward: 460,
    keepHp: 4600,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
    lanes: [L('W', MIDW, 3), L('N', [20, 40]), L('S', [20, 40])],
    flank: 0.4,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 14, 3, rng, 0, 0, 22, GH - 1);
      g.line(0, 17, 25, 17, Tile.ROAD);
      g.wallRect(26, 4, 58, 30, { gates: [[26, 17], [40, 4], [40, 30]] });
      g.set(26, 10, Tile.TOWER);
      g.set(26, 24, Tile.TOWER);
      g.set(33, 4, Tile.TOWER);
      g.set(33, 30, Tile.TOWER);
      g.set(48, 4, Tile.TOWER);
      g.set(48, 30, Tile.TOWER);
      // inner bailey
      g.wallRect(43, 11, 56, 23, { gates: [[43, 17]], floor: false });
      g.keep(50, 17);
      g.set(31, 10, Tile.DEPOT);
      g.set(47, 20, Tile.DEPOT);
      g.set(53, 14, Tile.INFIRM);
    },
    waves: [
      { groups: [W('h_treb', 'W', MIDW, 0), W('w_wall', 'W', MIDW, 2), W('h_archers', 'W', MIDW, 5), W('h_levies', 'N', [20, 40], 8)] },
      { groups: [W('h_tower', 'W', MIDW, 0), W('w_sappers', 'N', [20, 40], 4), W('h_company', 'W', MIDW, 6), W('w_bolts', 'W', MIDW, 10)] },
      { groups: [W('w_ram', 'W', MIDW, 0), W('h_treb', 'W', NW, 3), W('h_treb', 'W', SW, 3), W('w_bolts', 'W', MIDW, 6, 2), W('w_wall', 'S', [20, 40], 10)] },
      { groups: [W('h_knights', 'W', MIDW, 0), W('w_wall', 'S', [20, 40], 3, 2), W('h_escalade', 'N', [20, 40], 6, 2), W('h_company', 'W', MIDW, 12)] },
      { groups: [W('h_tower', 'W', NW, 0), W('h_tower', 'W', SW, 2), W('w_ram', 'W', MIDW, 6), W('w_sappers', 'S', [20, 40], 8), W('h_company', 'W', MIDW, 10), W('w_wall', 'W', MIDW, 12)] },
    ],
  },
  {
    id: 's9',
    index: 9,
    name: '불탄왕관 성',
    subtitle: '하늘이 불탄다',
    story: '잿불 고룡이 깨어났다. 용의 포효는 병사의 심장을 얼리고, 숨결은 성벽 위를 태운다. 노포를 아끼지 마라.',
    factions: ['wyrm'],
    squadCap: 8,
    level: 1.57,
    supplies: supplies(9),
    reward: 540,
    keepHp: 4800,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
    tips: ['용은 공중에 있어 근접 공격이 닿지 않습니다. 노포·석궁·궁수로 쏘세요.', '병사들은 불붙은 자리와 숨결을 스스로 피하지만, 분대를 흩어 두면 한 번의 숨결에 덜 휩쓸립니다. 용이 물러나면 코볼트도 흩어집니다.'],
    lanes: [L('W', MIDW, 3), L('N', [30, 50]), L('S', [30, 50])],
    flank: 0.4,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 10, 3, rng, 0, 0, 28, GH - 1);
      g.patches(Tile.RUBBLE, 6, 2, rng, 0, 0, 26, GH - 1);
      g.line(0, 17, 31, 17, Tile.ROAD);
      g.wallRect(32, 5, 57, 29, { gates: [[32, 17], [44, 5], [44, 29]] });
      g.set(32, 11, Tile.TOWER);
      g.set(32, 23, Tile.TOWER);
      g.set(39, 5, Tile.TOWER);
      g.set(39, 29, Tile.TOWER);
      g.set(51, 5, Tile.TOWER);
      g.set(51, 29, Tile.TOWER);
      g.keep(48, 17);
      g.set(38, 14, Tile.DEPOT);
      g.set(53, 21, Tile.INFIRM);
    },
    waves: [
      { groups: [W('c_kobolds', 'W', MIDW, 0, 2), W('c_cult', 'W', MIDW, 5), W('c_drakes', 'N', [30, 50], 10)] },
      { groups: [W('c_drakes', 'W', MIDW, 0), W('c_cult', 'N', [30, 50], 3), W('c_kobolds', 'S', [30, 50], 6), W('c_drakes', 'S', [30, 50], 8), W('c_cult', 'W', MIDW, 10)] },
      { groups: [W('c_cult', 'W', MIDW, 0, 2), W('c_kobolds', 'W', MIDW, 4), W('c_drakes', 'W', MIDW, 6), W('c_drakes', 'N', [30, 50], 10), W('c_cult', 'S', [30, 50], 12)] },
      { groups: [W('c_dragon', 'W', MIDW, 0), W('c_kobolds', 'W', MIDW, 3), W('c_cult', 'S', [30, 50], 6)] },
      { groups: [W('c_drakes', 'W', MIDW, 0, 2), W('c_cult', 'W', MIDW, 4), W('c_cult', 'N', [30, 50], 8), W('c_kobolds', 'S', [30, 50], 10), W('c_kobolds', 'W', MIDW, 14)] },
    ],
  },
  {
    id: 's10',
    index: 10,
    name: '최후의 성채',
    subtitle: '모두가 온다',
    story: '할드미어의 마지막 성. 다섯 세력이 한꺼번에 몰려온다. 외성이 무너져도 내성이 남아 있다. 깃발이 서 있는 한 끝나지 않았다.',
    factions: ['human', 'dwarf', 'elf', 'orc', 'wyrm'],
    squadCap: 9,
    level: 1.4,
    supplies: supplies(10),
    reward: 700,
    keepHp: 5200,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
    lanes: [L('W', MIDW, 3), L('N', [26, 50]), L('S', [26, 50])],
    flank: 0.45,
    build(g, rng) {
      g.fill(Tile.GRASS);
      g.patches(Tile.ROUGH, 12, 3, rng, 0, 0, 22, GH - 1);
      g.line(0, 17, 24, 17, Tile.ROAD);
      g.wallRect(25, 3, 58, 31, { gates: [[25, 17], [38, 3], [38, 31]] });
      g.set(25, 10, Tile.TOWER);
      g.set(25, 24, Tile.TOWER);
      g.set(31, 3, Tile.TOWER);
      g.set(31, 31, Tile.TOWER);
      g.set(47, 3, Tile.TOWER);
      g.set(47, 31, Tile.TOWER);
      g.wallRect(40, 10, 56, 24, { gates: [[40, 17], [48, 10], [48, 24]], floor: false });
      g.keep(50, 17);
      g.set(32, 17, Tile.DEPOT);
      g.set(45, 13, Tile.DEPOT);
      g.set(53, 21, Tile.INFIRM);
    },
    waves: [
      { groups: [W('h_company', 'W', MIDW, 0), W('e_skirmish', 'W', MIDW, 3), W('w_wall', 'N', [26, 50], 6), W('h_levies', 'S', [26, 50], 9)] },
      { groups: [W('o_warband', 'W', MIDW, 0, 2), W('o_swarm', 'S', [26, 50], 4), W('h_treb', 'W', MIDW, 6), W('o_javelins', 'N', [26, 50], 10)] },
      { groups: [W('w_ram', 'W', MIDW, 0), W('e_grove', 'N', [26, 50], 3), W('h_tower', 'W', MIDW, 6), W('w_sappers', 'S', [26, 50], 9), W('w_bolts', 'W', MIDW, 12)] },
      { groups: [W('c_drakes', 'W', MIDW, 0), W('o_troll', 'W', MIDW, 3), W('e_dancers', 'S', [26, 50], 5, 2), W('h_knights', 'W', MIDW, 10), W('h_escalade', 'N', [26, 50], 12)] },
      { groups: [W('c_dragon', 'W', MIDW, 0), W('o_warband', 'W', MIDW, 4, 2), W('w_wall', 'N', [26, 50], 8), W('c_cult', 'S', [26, 50], 8), W('o_berserkers', 'W', MIDW, 14)] },
    ],
  },
];

export function stageById(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}

// ---------------- approach plan ----------------

function pickLane(lanes: Lane[], rng: RNG): Lane {
  let r = rng.next() * lanes.reduce((s, l) => s + l.weight, 0);
  for (const l of lanes) {
    r -= l.weight;
    if (r <= 0) return l;
  }
  return lanes[lanes.length - 1];
}

/**
 * The approaches this battle's waves will actually take, fixed at battle start from the seed (the World
 * keeps the result as its own stage, so World.nextWaveEdges and the approach arrows tell the truth).
 * Each band of a scripted group (every copy of it, so a double group can split up and come at two
 * sides) keeps its scripted approach or, with probability `flank`, swings round to another lane of the
 * stage. The first wave of the first castle always comes the scripted way.
 */
export function planWaves(st: StageDef, seed: number): Wave[] {
  const lanes = st.lanes ?? [];
  const p = st.flank ?? 0;
  if (lanes.length < 2 || p <= 0) return st.waves;
  const rng = new RNG((seed ^ 0x2545f491) >>> 0);
  return st.waves.map((wv, wi) => {
    const groups: WaveGroup[] = [];
    wv.groups.forEach((g, gi) => {
      const byLane = new Map<string, WaveGroup>();
      for (let k = 0; k < (g.n ?? 1); k++) {
        let edge = g.edge;
        let span = g.span;
        const pk = st.index === 1 && wi === 0 ? 0 : p;
        if (rng.chance(pk)) {
          const alt = lanes.filter((l) => l.edge !== g.edge);
          if (alt.length) {
            const l = pickLane(alt, rng);
            edge = l.edge;
            span = l.span;
          }
        }
        const key = `${gi}|${edge}|${span[0]},${span[1]}`;
        const same = byLane.get(key);
        if (same) same.n = (same.n ?? 1) + 1;
        else {
          const ng: WaveGroup = { ...g, edge, span, n: 1 };
          byLane.set(key, ng);
          groups.push(ng);
        }
      }
    });
    return { ...wv, groups };
  });
}

// ---------------- special modes (generated, no server or content updates needed) ----------------

const ENDLESS_POOL: { band: string; from: number; weight: number }[] = [
  { band: 'h_levies', from: 0, weight: 3 },
  { band: 'h_company', from: 0, weight: 3 },
  { band: 'h_archers', from: 1, weight: 2 },
  { band: 'h_escalade', from: 1, weight: 2 },
  { band: 'o_swarm', from: 0, weight: 3 },
  { band: 'o_warband', from: 2, weight: 3 },
  { band: 'o_javelins', from: 2, weight: 2 },
  { band: 'w_wall', from: 3, weight: 2 },
  { band: 'w_sappers', from: 4, weight: 1 },
  { band: 'e_skirmish', from: 3, weight: 2 },
  { band: 'e_dancers', from: 3, weight: 2 },
  { band: 'o_ram', from: 4, weight: 1 },
  { band: 'w_ram', from: 6, weight: 1 },
  { band: 'o_berserkers', from: 5, weight: 1 },
  { band: 'h_treb', from: 6, weight: 1 },
  { band: 'h_tower', from: 7, weight: 1 },
  { band: 'o_troll', from: 7, weight: 1 },
  { band: 'e_grove', from: 8, weight: 1 },
  { band: 'c_drakes', from: 8, weight: 1 },
  { band: 'c_cult', from: 6, weight: 1 },
  { band: 'h_knights', from: 5, weight: 1 },
  { band: 'w_bolts', from: 10, weight: 1 },
  { band: 'w_sappers', from: 14, weight: 1 },
  { band: 'o_troll', from: 16, weight: 1 },
  { band: 'e_grove', from: 18, weight: 1 },
];

/** castles the endless siege rotates through (by seed) */
export const ENDLESS_CASTLES = ['s3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
/** bands per endless wave, and the extra enemy strength each wave adds */
export const ENDLESS_BANDS = (w: number) => 2 + Math.floor(w * ENDLESS_BAND_GROWTH);
export const ENDLESS_BAND_GROWTH = 0.21;
export const ENDLESS_MUL_GROWTH = 0.018;

/** Generate wave `w` (0-based) of the endless siege deterministically from a seed. */
export function endlessWave(w: number, seed: number, lanes: Lane[] = [L('W', MIDW, 3), L('N', [20, 36]), L('S', [20, 36])]): Wave {
  const rng = new RNG(seed ^ Math.imul(w + 1, 0x9e3779b1));
  const budget = ENDLESS_BANDS(w);
  const pool = ENDLESS_POOL.filter((p) => p.from <= w);
  const groups: WaveGroup[] = [];
  const total = pool.reduce((s, p) => s + p.weight, 0);
  const west = lanes.find((l) => l.edge === 'W') ?? lanes[0];
  const others = lanes.filter((l) => l !== west);
  for (let k = 0; k < budget; k++) {
    let r = rng.next() * total;
    let pick = pool[0];
    for (const p of pool) {
      r -= p.weight;
      if (r <= 0) {
        pick = p;
        break;
      }
    }
    // from the third wave on, a third of the bands come round another side of the castle
    const lane = w >= 2 && others.length && rng.chance(0.35) ? pickLane(others, rng) : west;
    groups.push(W(pick.band, lane.edge, lane.span, k * 3));
  }
  if (w > 0 && w % 10 === 9) groups.push(W('c_dragon', 'W', MIDW, 6));
  return { groups, maxTime: 110, intermission: 12, mul: 1 + ENDLESS_MUL_GROWTH * w };
}

/**
 * What a supply train can carry to the endless castle before each later wave. It refills the stores
 * at most to what they held when the siege began (World.startWave), and it carries less than a full
 * army eats and shoots in a hard wave: the stores run down as the waves grow (the war council's
 * forage / resupply picks, or fewer mouths, make up the rest).
 */
export const ENDLESS_RESUPPLY: Partial<Supplies> = { food: 25, arrows: 200, mats: 40, meds: 2 };

export function endlessStage(seed: number): StageDef {
  const base = stageById(ENDLESS_CASTLES[(seed >>> 0) % ENDLESS_CASTLES.length]) ?? STAGES[5];
  const lanes = base.lanes ?? [L('W', MIDW, 3)];
  return {
    ...base,
    id: 'endless',
    index: 0,
    name: '끝없는 공성',
    subtitle: `${base.name} · 몇 번째 물결까지 버틸 수 있는가`,
    story: `${base.name}에 끝없이 몰려오는 적을 막아라. 물결마다 적이 늘고 강해진다. 기록은 이 기기에 저장된다.`,
    factions: ['human', 'orc', 'dwarf', 'elf', 'wyrm'],
    level: 1.0,
    squadCap: 8,
    reward: 0,
    // the generator already spreads the bands over the castle's approaches
    flank: 0,
    // some rations, arrows, timber and medicine reach the castle between waves (never above the starting stores)
    resupply: ENDLESS_RESUPPLY,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
    waves: Array.from({ length: 60 }, (_, w) => endlessWave(w, seed, lanes)),
  };
}

export interface DailyMod {
  id: string;
  name: string;
  desc: string;
}

export const DAILY_MODS: DailyMod[] = [
  { id: 'elite', name: '정예군', desc: '적 체력·공격력 +30%' },
  { id: 'scarce', name: '보급 부족', desc: '시작 보급 절반' },
  { id: 'swarm', name: '대군', desc: '모든 적 무리 수 1.5배' },
  { id: 'brittle', name: '낡은 성벽', desc: '성벽·성문 내구도 -35%' },
  { id: 'wings', name: '날개 달린 위협', desc: '매 웨이브 비룡 편대 추가' },
  { id: 'iron', name: '강철 의지', desc: '아군 사기 +20, 적 사기 +20' },
];

/**
 * '대군': every wave brings 1.5x as many bands (rounded), as the modifier says. Extra copies go to the
 * wave's groups in turn, foot bands first (one more siege engine or dragon per group at most).
 */
export function swarmWave(w: Wave): Wave {
  const groups = w.groups.map((g) => ({ ...g, n: g.n ?? 1 }));
  const total = groups.reduce((s, g) => s + g.n, 0);
  let extra = Math.round(total * 1.5) - total;
  const heavy = (g: WaveGroup) => BANDS[g.band]?.members.some(([id]) => UNITS[id]?.big) || BANDS[g.band]?.leader === 'c_dragon';
  const order = [...groups.filter((g) => !heavy(g)), ...groups.filter(heavy)];
  for (let round = 0; extra > 0 && round < 4; round++)
    for (const g of order) {
      if (extra <= 0) break;
      if (heavy(g) && round > 0 && order.some((x) => !heavy(x))) continue;
      g.n++;
      extra--;
    }
  return { ...w, groups };
}

export function dailyKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Daily challenge: picks a cleared stage + modifier from the local date. Fully offline. */
export function dailyChallenge(dateKey: string, maxClearedIndex: number): { stage: StageDef; mod: DailyMod; seed: number } {
  const seed = hashStr('daily:' + dateKey);
  const rng = new RNG(seed);
  const cap = Math.max(1, Math.min(STAGES.length, maxClearedIndex));
  const base = STAGES[rng.int(0, cap - 1)];
  const mod = rng.pick(DAILY_MODS);
  let waves = base.waves;
  if (mod.id === 'swarm') waves = waves.map(swarmWave);
  if (mod.id === 'wings') waves = waves.map((w) => ({ ...w, groups: [...w.groups, W('c_drakes', 'W', MIDW, 8)] }));
  const sup = { ...base.supplies };
  if (mod.id === 'scarce') {
    sup.arrows = Math.round(sup.arrows / 2);
    sup.food = Math.round(sup.food / 2);
    sup.meds = Math.round(sup.meds / 2);
    sup.mats = Math.round(sup.mats / 2);
  }
  const stage: StageDef = {
    ...base,
    id: 'daily',
    index: 0,
    name: `오늘의 공성: ${base.name}`,
    subtitle: mod.name,
    story: `${mod.name} — ${mod.desc}. 하루 한 번 보상을 받을 수 있습니다.`,
    level: base.level,
    enemyMul: mod.id === 'elite' ? 1.3 : undefined,
    supplies: sup,
    waves,
    abilities: ['rally', 'volley', 'oil', 'reserve'],
  };
  return { stage, mod, seed };
}
