import {
  BANDS,
  DT,
  GH,
  GW,
  SQUAD_TYPES,
  TILE,
  TILE_INFO,
  Tile,
  UNITS,
  WORLD_H,
  WORLD_W,
  type BandTemplate,
  type FieldKind,
  type SquadType,
  type SquadTypeId,
  type UnitDef,
} from './defs';
import { Grid, cx, cy, idx, inb, newField, tileAt, tx, ty, type Field, N8 } from './grid';
import { SpatialHash } from './hash';
import { josa } from './josa';
import { RNG } from './rng';
import { planWaves, type Edge, type StageDef, type Supplies, type WaveGroup } from './stages';
import { applyCouncil, closeCouncil, councilOptionList, openCouncil } from './warcouncil';
import { CouncilState, runCouncil, autoCommander } from './council';

export const ST = { ACTIVE: 0, DOWN: 1, DEAD: 2, CARRIED: 3, EVAC: 4, FLED: 5, CLIMB: 6 } as const;
export const ACT = { NONE: 0, PLANT: 1, DIG: 2, DOCKED: 3, SET: 4, PICKUP: 5, DONE_LADDER: 6 } as const;

export type Stance = 'hold' | 'defend' | 'aggressive';
export type AbilityId = 'rally' | 'volley' | 'oil' | 'reserve';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Unit {
  id: number;
  def: UnitDef;
  side: 0 | 1;
  x: number;
  y: number;
  px: number;
  py: number;
  fx: number;
  fy: number;
  hp: number;
  maxHp: number;
  state: number;
  squad: Squad | null;
  band: Band | null;
  cd: number;
  target: Unit | null;
  retarget: number;
  ammo: number;
  maxAmmo: number;
  elev: boolean;
  timer: number;
  act: number;
  actTile: number;
  downT: number;
  slotX: number;
  slotY: number;
  atkMul: number;
  rangedMul: number;
  armorAdd: number;
  soldierId: number;
  carry: Unit | null;
  carrier: Unit | null;
  claimedBy: Unit | null;
  hitFlash: number;
  fState: number;
  fT: number;
  ftx: number;
  fty: number;
  moveT: number;
  fleeing: boolean;
  spawnX: number;
  spawnY: number;
  kills: number;
  fireDeath: boolean;
  /** siege-engine crew morale 0..100 (engines only, 0 for everyone else); engines ignore band collapse */
  crew: number;
  /** escort slot index inside a convoy band (-1 = not an escort) */
  escortIdx: number;
  /** battle time the unit appeared */
  bornT: number;
  /** recent heavy hits (dragon: ballista bolts), decays over time */
  pain: number;
  /** a convoy core unit with escorts close around it: harder to pick out and hit with missiles */
  screened: boolean;
}

export interface Squad {
  id: number;
  type: SquadType;
  rosterId: string;
  name: string;
  color: string;
  units: Unit[];
  size: number;
  morale: number;
  baseMorale: number;
  routing: boolean;
  auto: boolean;
  stance: Stance;
  destTile: number;
  homeTile: number;
  slots: number[];
  field: Field;
  focus: Unit | null;
  rank: number;
  xp: number;
  kills: number;
  taskTile: number;
  taskKind: number;
  rebuild: number;
  cx: number;
  cy: number;
  alive: number;
  engaged: number;
  lastOrderT: number;
  rallyT: number;
  reserve: boolean;
  tfield: Field | null;
  tfieldTile: number;
}

export interface Band {
  id: number;
  tpl: BandTemplate;
  units: Unit[];
  leader: Unit | null;
  morale: number;
  startCount: number;
  broken: boolean;
  field: FieldKind;
  wave: number;
  /** units the band escorts: siege engines, or sappers screened by shields */
  core: Unit[];
  /** escorts keep formation around the core instead of running ahead */
  convoy: boolean;
  /** convoy anchor (core centroid) and its forward direction */
  ax: number;
  ay: number;
  fdx: number;
  fdy: number;
  /** convoy pace in px/s (slowest living member) */
  pace: number;
  /** most escorts are in their screen slots */
  formed: boolean;
  /** battle time the band broke (-1 while it holds) */
  brokenT: number;
  /** last time a member dealt damage, fought in melee, climbed, dug or rammed */
  contactT: number;
  /** stalled once: everyone advances, archers stop hanging back */
  assault: boolean;
}

export interface Ladder {
  tile: number;
  hp: number;
  maxHp: number;
  bx: number;
  by: number;
  tower: Unit | null;
  climbing: number;
}

export interface Projectile {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
  target: Unit | null;
  side: 0 | 1;
  dmg: number;
  ap: number;
  kind: 'arrow' | 'bolt' | 'stone' | 'fire' | 'javelin';
  structTile: number;
  area: boolean;
  src: Unit | null;
  keep: boolean;
  blocked?: boolean;
}

export interface Fx {
  k: string;
  x: number;
  y: number;
  a?: number;
  b?: number;
  c?: string;
}

export type Level = 'info' | 'warn' | 'danger' | 'good';
export interface GameEvent {
  type: string;
  text: string;
  level: Level;
  x?: number;
  y?: number;
  squad?: number;
}

export interface SquadSetup {
  rosterId: string;
  type: SquadTypeId;
  name: string;
  rank: number;
  xp: number;
  soldiers: number[];
  tile?: number;
  stance?: Stance;
  color?: string;
}

export interface BattleConfig {
  stage: StageDef;
  seed: number;
  squads: SquadSetup[];
  upgrades: Record<string, number>;
  difficulty: Difficulty;
  supplies: Supplies;
  mods?: string[];
  autoCommand?: boolean;
}

export interface SquadOutcome {
  rosterId: string;
  dead: number[];
  wounded: number[];
  survivors: number[];
  kills: number;
}

export interface BattleResult {
  won: boolean;
  stars: number;
  keepPct: number;
  wavesCleared: number;
  totalWaves: number;
  kills: number;
  routed: number;
  dead: number;
  wounded: number;
  evacuated: number;
  deployed: number;
  bounty: number;
  time: number;
  dragons: number;
  squads: SquadOutcome[];
}

export const ABILITY_INFO: Record<AbilityId, { name: string; cd: number; desc: string; needsTarget: boolean }> = {
  rally: { name: '함성', cd: 40, desc: '지점 주변 분대의 사기 +35, 도주 중인 분대를 붙잡음', needsTarget: true },
  volley: { name: '일제사격', cd: 28, desc: '사거리 안의 모든 궁수·석궁이 지정 지점에 화살비', needsTarget: true },
  oil: { name: '끓는 기름', cd: 46, desc: '성벽·성문 앞 적에게 큰 화염 피해, 사다리 파괴', needsTarget: true },
  reserve: { name: '증원', cd: 999, desc: '본성 앞에 민병대 10명 소집 (전투당 1회, 식량 10)', needsTarget: false },
};

const T = TILE;

/** the dragon withdraws below this HP fraction */
export const DRAGON_FLEE_HP = 0.35;
/**
 * ...or when harried past this much pain: each ballista bolt adds 1, any other wound adds 1 per
 * DRAGON_PAIN_DMG of its max HP, and pain wears off at 1 per DRAGON_PAIN_DECAY s. A steady storm of
 * arrows and bolts drives it off long before it is badly hurt; a few stray shots never will.
 */
export const DRAGON_PAIN_MAX = 8;
export const DRAGON_PAIN_DECAY = 6;
export const DRAGON_PAIN_DMG = 0.03;
/**
 * The dragon answers to nothing but its wounds: it stays, whatever becomes of its retinue, until it is
 * badly hurt (DRAGON_FLEE_HP) or harried by bolts and arrows (DRAGON_PAIN_MAX). Only a castle that can
 * barely hurt it sees it leave on its own, sated, after this long (s).
 */
export const DRAGON_MAX_STAY = 240;
/**
 * breath damage per 0.2 s tick, as a fraction of the dragon's attack. The dragon now stays until it is
 * hurt, harried or tired (several passes, not one or two), so each pass burns less than it used to.
 */
export const DRAGON_BREATH = 0.13;
/**
 * A fire pot that bursts on the stone of a wall walk or tower burns out after this long (s); on the
 * ground (grass, timber, a courtyard) it burns 2.5-3 s. Wall-top cover then means something against
 * cultists: a miss no longer leaves a fire burning under the merlons for as long as a hit does.
 */
export const POT_FIRE_STONE = 1.2;
/** the breath's cone: how far it reaches (px) and its half-angle (rad) */
export const BREATH_LEN = 5.5 * TILE;
export const BREATH_HALF = 0.5;
/** how long one breath lasts (s) */
export const BREATH_T = 2.6;
/**
 * Soldiers start out of a breath's cone only this long after it begins (s): the roar and the first gout
 * of flame catch them where they stand. They dodge the rest of it, not all of it.
 */
export const BREATH_REACT = 0.6;

/**
 * A sapper's mine takes this long to dig (s). He works at the wall foot under a timber mantlet that
 * catches some of the missiles (ranged damage x SAPPER_COVER), but a miner at work is still the first
 * mark of every archer in range, and the squads' council sends spearmen to the wall walk above him,
 * where stones dropped on the mantlet hit him hard (a blow from the wall walk x SAPPER_STONES instead of
 * the usual x0.6 against men below). Boiling oil does the rest. The gallery stays dug when he falls
 * (World.mineProg): the next miner at that stretch of wall carries on. One gallery is one tunnel: more
 * miners at the same wall tile do not dig it any faster. Between waves the garrison fills in what was
 * left half dug, so a mine has to be finished within one assault.
 */
export const SAPPER_DIG_T = 12;
export const SAPPER_COVER = 0.6;
export const SAPPER_STONES = 2.4;

/** a band that has neither dealt damage nor been in melee for this long assaults (or, if weak, withdraws) */
export const BAND_STALL_T = 75;
/** a docked siege tower with no one left in its band to climb it withdraws after this long without progress (s) */
export const TOWER_EMPTY_T = 12;
/** missiles an enemy archer / crossbowman / javelin thrower carries; stones a trebuchet brings */
export const ENEMY_QUIVER = 40;
export const TREB_STONES = 16;
/** a trebuchet stone is a wall-breaker: men within TREB_SPLASH_R px of the impact take TREB_SPLASH_DMG (x attack scale) */
export const TREB_SPLASH_DMG = 14;
export const TREB_SPLASH_R = 14;
/**
 * No battle runs longer than this (game seconds, endless mode excepted). Then the siege is decided as it
 * stands: if the attackers hold ground inside the walls or the keep is nearly down the castle is lost,
 * otherwise they lift the siege (see liftSiege).
 */
export const BATTLE_HARD_CAP = 900;
/** with no defender standing for this long while enemies remain in the field, the castle is lost (s) */
export const GARRISON_GRACE = 10;
/** at the cap: this many attackers inside the walls, or the keep below this share, and the castle is lost */
export const CAP_HOLD_N = 4;
export const CAP_KEEP_MIN = 0.25;
/**
 * Attackers who stay at the keep break in: every second of an unbroken keep assault adds 1/KEEP_PRESS_T to
 * the damage they do to it (up to KEEP_PRESS_MAX extra). It ebbs at half that rate once they are driven off.
 */
export const KEEP_PRESS_T = 45;
export const KEEP_PRESS_MAX = 3;
/** boiling oil: fire damage to every climber and wall-foot attacker in the splash (x fire weakness, x2.5 vs giants) */
export const OIL_DMG = 50;
/** morale the scalded bands lose */
export const OIL_MORALE = 6;
const SUPPLY_NAMES: Record<keyof Supplies, string> = { food: '식량', arrows: '화살', mats: '자재', meds: '의약품' };

/** extra reach (px) and damage multiplier for enemies inside the walls striking defenders on the wall top */
export const WALLTOP_REACH = 6;
export const WALLTOP_HIT_MUL = 0.7;

/** defenders may use a gate only while no enemy is within this many tiles of it */
export const GATE_SAFE_R = 3;

/** rams, siege towers and trebuchets: crewed machines with their own morale */
export function isEngine(u: Unit) {
  const r = u.def.role;
  return r === 'ram' || r === 'tower' || r === 'treb';
}

export class World {
  cfg: BattleConfig;
  stage: StageDef;
  rng: RNG;
  grid = new Grid();
  t = 0;
  state: 'deploy' | 'battle' | 'intermission' | 'won' | 'lost' = 'deploy';
  units: Unit[] = [];
  defs: Unit[] = [];
  enemies: Unit[] = [];
  squads: Squad[] = [];
  bands: Band[] = [];
  ladders: Ladder[] = [];
  projectiles: Projectile[] = [];
  fire: Float32Array = new Float32Array(GW * GH);
  /** seconds of mining already dug under each wall tile: a gallery stays dug when its miner falls */
  mineProg: Float32Array = new Float32Array(GW * GH);
  /** sim time a gallery was last dug (one miner's work per tile per tick) */
  mineT: Float64Array = new Float64Array(GW * GH).fill(-1);
  fx: Fx[] = [];
  events: GameEvent[] = [];
  dirtyTiles: number[] = [];
  supplies: Supplies;
  startSupplies: Supplies;
  keepHp: number;
  keepMax: number;
  waveIdx = -1;
  waveT = 0;
  interT = 0;
  pending: WaveGroup[] = [];
  starving = false;
  abilities: Record<AbilityId, { cd: number; max: number; unlocked: boolean; used: number }>;
  autoCommand: boolean;
  fields: Record<FieldKind, Field> = { breach: newField(), escalade: newField(), ram: newField() };
  retreatField = newField();
  infirmField = newField();
  /** way off the map for fleeing ground enemies; rebuilt on first use after the walls change */
  exitField = newField();
  exitDirty = true;
  fieldsDirty = true;
  lastFieldT = -10;
  /** gate state changed: squads' approach fields need a refresh (throttled) */
  defFieldsDirty = false;
  lastDefFieldT = -10;
  /** number of intact gates currently barred to defenders */
  gatesShut = 0;
  councilT = 0;
  /** per-world council scratch state (keeps battles independent of each other) */
  council = new CouncilState();
  moraleT = 0;
  dHash = new SpatialHash<Unit>(32);
  eHash = new SpatialHash<Unit>(32);
  activeDefs: Unit[] = [];
  activeEnemies: Unit[] = [];
  downed: Unit[] = [];
  terrorUnits: Unit[] = [];
  /** dragons breathing fire this tick, once the soldiers have seen it coming (BREATH_REACT): they step out of the cone */
  breathing: Unit[] = [];
  hpScale: number;
  atkScale: number;
  up: Record<string, number>;
  stats = { kills: 0, routed: 0, dead: 0, downed: 0, evacuated: 0, bounty: 0, structLost: 0, deployed: 0, abilityUses: 0, orders: 0, dragons: 0 };
  waveCleared = 0;
  /** missiles shot this wave; a share is gathered back between assaults */
  shotsWave = 0;
  alertCd: Record<string, number> = {};
  mods: Set<string>;
  hasDragonEver = false;
  /** dragons already counted in stats.dragons (driven off or slain), by unit id */
  dragonsCounted = new Set<number>();
  lastKeepAlert = -10;
  /** how long no defender has been standing (see checkEnd) */
  wipedT = 0;
  /** keep HP at the last keep alert (alerts repeat per 10% lost, or after a lull) */
  keepAlertHp = Infinity;
  /** last time anyone struck the keep, and how long the current keep assault has been going on */
  lastKeepHit = -10;
  keepPress = 0;
  result: BattleResult | null = null;
  /** per-world id counter keeps battles reproducible for a given seed */
  uid = 1;
  /** wall HP multiplier of this battle (masonry research, daily mods) */
  structHpMul = 1;
  /** war council: ids offered this intermission, their amounts, and every pick applied so far */
  councilOffer: string[] = [];
  councilAmt: Record<string, number> = {};
  councilLog: string[] = [];
  /** gates the council has already strengthened (once each) */
  gateBoosted = new Set<number>();
  /** arrows that came into the stores this battle (start, recovered, council) */
  arrowsIn = 0;

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    // the approaches of this battle's waves are fixed now, from the seed (see planWaves)
    this.stage = { ...cfg.stage, waves: planWaves(cfg.stage, cfg.seed) };
    this.rng = new RNG(cfg.seed);
    this.up = cfg.upgrades;
    this.mods = new Set(cfg.mods ?? []);
    this.autoCommand = !!cfg.autoCommand;
    const lvl = cfg.stage.level;
    const diff = cfg.difficulty === 'easy' ? 0.72 : cfg.difficulty === 'hard' ? 1.18 : 1;
    const elite = cfg.stage.enemyMul ?? 1;
    this.hpScale = lvl * diff * elite;
    this.atkScale = Math.sqrt(lvl) * diff * elite;
    const stageRng = new RNG(cfg.seed ^ 0x5bd1e995);
    cfg.stage.build(this.grid, stageRng);
    let hpMul = 1 + 0.12 * (this.up.masonry ?? 0);
    if (this.mods.has('brittle')) hpMul *= 0.65;
    this.structHpMul = hpMul;
    this.grid.finalize(hpMul);
    this.keepMax = cfg.stage.keepHp * (1 + 0.06 * (this.up.masonry ?? 0));
    this.keepHp = this.keepMax;
    this.supplies = { ...cfg.supplies };
    this.startSupplies = { ...cfg.supplies };
    this.arrowsIn = cfg.supplies.arrows;
    const cdMul = 1 - 0.08 * (this.up.command ?? 0);
    const mk = (id: AbilityId) => ({ cd: 0, max: ABILITY_INFO[id].cd * cdMul, unlocked: cfg.stage.abilities.includes(id), used: 0 });
    this.abilities = { rally: mk('rally'), volley: mk('volley'), oil: mk('oil'), reserve: mk('reserve') };
    this.computeDefenderFields();
    for (const s of cfg.squads) this.addSquad(s, false);
    this.autoDeploy(false);
  }

  // ======================================================================
  // setup
  // ======================================================================

  addSquad(s: SquadSetup, reserve: boolean): Squad {
    const type = SQUAD_TYPES[s.type];
    const def = UNITS[type.unit];
    const drill = this.up.drill ?? 0;
    let base = 62 + drill * 5 + s.rank * 4;
    if (this.mods.has('iron')) base += 20;
    const sq: Squad = {
      id: this.squads.length,
      type,
      rosterId: s.rosterId,
      name: s.name,
      color: s.color ?? '#3a6fd8',
      units: [],
      size: s.soldiers.length,
      morale: Math.min(100, base + 8),
      baseMorale: base,
      routing: false,
      auto: true,
      stance: s.stance ?? (type.id === 'knight' ? 'aggressive' : 'defend'),
      destTile: -1,
      homeTile: s.tile ?? -1,
      slots: [],
      field: newField(),
      focus: null,
      rank: s.rank,
      xp: s.xp,
      kills: 0,
      taskTile: -1,
      taskKind: 0,
      rebuild: 0,
      cx: 0,
      cy: 0,
      alive: s.soldiers.length,
      engaged: 0,
      lastOrderT: -99,
      rallyT: 0,
      reserve,
      tfield: null,
      tfieldTile: -1,
    };
    const smith = this.up.smithing ?? 0;
    const fletch = this.up.fletching ?? 0;
    const ball = this.up.ballistics ?? 0;
    for (const sid of s.soldiers) {
      const u = this.makeUnit(def, 0, this.grid.keepX, this.grid.keepY);
      u.squad = sq;
      u.soldierId = sid;
      const rk = 1 + 0.05 * s.rank;
      u.atkMul = (1 + 0.06 * smith) * rk;
      u.rangedMul = (1 + 0.08 * fletch) * rk * (type.id === 'ballista' || type.id === 'xbow' ? 1 + 0.1 * ball : 1);
      u.armorAdd = 0.03 * smith;
      u.maxHp = def.hp * (1 + 0.04 * s.rank);
      u.hp = u.maxHp;
      sq.units.push(u);
      this.defs.push(u);
    }
    this.squads.push(sq);
    this.stats.deployed += s.soldiers.length;
    return sq;
  }

  makeUnit(def: UnitDef, side: 0 | 1, x: number, y: number): Unit {
    const u: Unit = {
      id: this.uid++,
      def,
      side,
      x,
      y,
      px: x,
      py: y,
      fx: side === 0 ? -1 : 1,
      fy: 0,
      hp: def.hp,
      maxHp: def.hp,
      state: ST.ACTIVE,
      squad: null,
      band: null,
      cd: this.rng.range(0, def.cd),
      target: null,
      retarget: this.rng.range(0, 0.3),
      ammo: def.ammo ?? 0,
      maxAmmo: def.ammo ?? 0,
      elev: false,
      timer: 0,
      act: ACT.NONE,
      actTile: -1,
      downT: 0,
      slotX: x,
      slotY: y,
      atkMul: 1,
      rangedMul: 1,
      armorAdd: 0,
      soldierId: 0,
      carry: null,
      carrier: null,
      claimedBy: null,
      hitFlash: 0,
      fState: 0,
      fT: 0,
      ftx: x,
      fty: y,
      moveT: 0,
      fleeing: false,
      spawnX: x,
      spawnY: y,
      kills: 0,
      fireDeath: false,
      crew: 0,
      escortIdx: -1,
      bornT: this.t,
      pain: 0,
      screened: false,
    };
    this.units.push(u);
    return u;
  }

  /** Default positions: archers on exposed walls/towers, melee behind gates, support near depot/infirmary. */
  autoDeploy(onlyUnplaced: boolean) {
    const g = this.grid;
    const gates: number[] = [];
    const elevs: number[] = [];
    for (let i = 0; i < g.n; i++) {
      if (g.tiles[i] === Tile.GATE) gates.push(i);
      if (g.isElev(i) && g.deployable(i)) elevs.push(i);
    }
    // exposure: how far west/north/south a tile faces (enemies mostly come from the west)
    const edges = new Set<Edge>();
    for (const w of this.stage.waves) for (const gr of w.groups) edges.add(gr.edge);
    const expo = (i: number) => {
      let s = 0;
      if (edges.has('W')) s += (GW - tx(i)) * 2;
      if (edges.has('N')) s += (GH - ty(i)) * 0.8;
      if (edges.has('S')) s += ty(i) * 0.8;
      if (edges.has('E')) s += tx(i) * 0.5;
      return s;
    };
    gates.sort((a, b) => expo(b) - expo(a));
    elevs.sort((a, b) => expo(b) - expo(a));
    const used: number[] = [];
    const far = (i: number, d: number) => used.every((u) => Math.max(Math.abs(tx(u) - tx(i)), Math.abs(ty(u) - ty(i))) >= d);
    const behindGate = (gi: number) => {
      const near = g.nearestTile(gi, (j) => g.inside[j] === 1 && !g.keepAdj[j], 4);
      if (near < 0) return near;
      // step 2 tiles further inward (out of easy bow range, still close enough to plug the gate)
      const dx = Math.sign(tx(near) - tx(gi));
      const dy = Math.sign(ty(near) - ty(gi));
      const x2 = tx(near) + dx * 2;
      const y2 = ty(near) + dy * 2;
      if (inb(x2, y2) && g.inside[idx(x2, y2)] && !g.keepAdj[idx(x2, y2)]) return idx(x2, y2);
      return near;
    };
    let gateK = 0;
    let wallK = 0;
    const take = (list: number[], d: number) => {
      for (const i of list)
        if (far(i, d)) {
          used.push(i);
          return i;
        }
      return list[0] ?? -1;
    };
    // ranged first on exposed walls near gates
    const nearGate = elevs.filter((i) => gates.some((gi) => Math.max(Math.abs(tx(gi) - tx(i)), Math.abs(ty(gi) - ty(i))) <= 7));
    for (const sq of this.squads) {
      if (onlyUnplaced && sq.homeTile >= 0) continue;
      let tile = -1;
      const id = sq.type.id;
      if (id === 'archer' || id === 'xbow') tile = take(nearGate.length ? nearGate : elevs, 5);
      else if (id === 'ballista') {
        const towers = elevs.filter((i) => g.tiles[i] === Tile.TOWER);
        tile = take(towers.length ? towers : elevs, 4);
      }
      if (tile >= 0) this.placeSquad(sq, tile);
    }
    for (const sq of this.squads) {
      if (onlyUnplaced && sq.homeTile >= 0) continue;
      if (sq.homeTile >= 0 && (sq.type.ranged || onlyUnplaced)) continue;
      const id = sq.type.id;
      let tile = -1;
      if (id === 'spear' || id === 'sword' || id === 'militia') {
        if (gateK < gates.length) {
          tile = behindGate(gates[gateK++]);
        } else {
          tile = take(nearGate.length ? nearGate : elevs, 4);
          wallK++;
        }
      } else if (id === 'knight') {
        tile = g.nearestTile(tileAt(g.keepX - 3 * T, g.keepY), (j) => g.inside[j] === 1 && !g.keepAdj[j], 8);
      } else if (id === 'engineer') {
        tile = g.depots.length ? g.depots[0] : behindGate(gates[0]);
      } else if (id === 'surgeon') {
        tile = g.infirmaries.length ? g.infirmaries[0] : tileAt(g.keepX, g.keepY + 2.5 * T);
      }
      if (tile < 0 || !g.deployable(tile)) tile = g.nearestTile(tileAt(g.keepX - 3 * T, g.keepY), (j) => g.inside[j] === 1, 12);
      this.placeSquad(sq, tile);
    }
  }

  /** Place a squad instantly (deployment phase). */
  placeSquad(sq: Squad, tile: number) {
    const g = this.grid;
    if (!g.deployable(tile)) tile = g.nearestTile(tile, (j) => g.deployable(j), 20);
    sq.homeTile = tile;
    this.orderMove(sq, tile, false);
    for (const u of sq.units) {
      u.x = u.px = u.slotX;
      u.y = u.py = u.slotY;
      u.elev = g.isElev(tileAt(u.x, u.y));
    }
    this.updateSquadCentroid(sq);
  }

  computeDefenderFields() {
    const g = this.grid;
    const near: number[] = [];
    for (let i = 0; i < g.n; i++) if (g.keepAdj[i] && g.inside[i]) near.push(i);
    g.defenderField(near.length ? near : [tileAt(g.keepX - 2 * T, g.keepY)], this.retreatField);
    g.defenderField(g.infirmaries.length ? g.infirmaries : near, this.infirmField);
  }

  // ======================================================================
  // orders (player + council)
  // ======================================================================

  perTile(sq: Squad) {
    if (sq.type.id === 'ballista') return 1;
    if (sq.type.id === 'knight') return 2;
    return 2;
  }

  orderMove(sq: Squad, tile: number, manual: boolean) {
    const g = this.grid;
    if (!g.deployable(tile)) {
      // allow sorties: outside ground is fine for an explicit order if reachable
      if (!(manual && TILE_INFO[g.tiles[tile]].dpass)) tile = g.nearestTile(tile, (j) => g.deployable(j), 20);
    }
    if (tile < 0) return;
    sq.destTile = tile;
    const alive = sq.units.filter((u) => u.state === ST.ACTIVE);
    const per = this.perTile(sq);
    sq.slots = g.slotTiles(tile, Math.max(1, Math.ceil(alive.length / per)));
    g.defenderField(sq.slots, sq.field);
    let k = 0;
    for (const u of alive) {
      const st = sq.slots[Math.floor(k / per) % sq.slots.length];
      const sub = k % per;
      const ox = per === 1 ? 0.5 : sub === 0 ? 0.3 : 0.7;
      const oy = per === 1 ? 0.5 : sub === 0 ? 0.35 : 0.65;
      u.slotX = (tx(st) + ox) * T + this.rng.range(-1.5, 1.5);
      u.slotY = (ty(st) + oy) * T + this.rng.range(-1.5, 1.5);
      k++;
    }
    if (manual) {
      sq.auto = false;
      sq.lastOrderT = this.t;
      sq.homeTile = tile;
      this.stats.orders++;
    }
  }

  /** Player command: move a squad (switches it to manual control). */
  commandMove(sq: Squad, wx: number, wy: number) {
    if (sq.alive === 0) return;
    this.orderMove(sq, tileAt(wx, wy), true);
    sq.focus = null;
  }

  commandStance(sq: Squad, st: Stance) {
    sq.stance = st;
    this.stats.orders++;
  }

  commandAuto(sq: Squad, on: boolean) {
    sq.auto = on;
    if (on) sq.lastOrderT = -99;
    this.stats.orders++;
  }

  commandRetreat(sq: Squad) {
    const g = this.grid;
    const t = g.nearestTile(tileAt(g.keepX - 2.5 * T, g.keepY), (j) => g.inside[j] === 1 && !g.keepAdj[j], 10);
    this.orderMove(sq, t, true);
    sq.stance = 'hold';
  }

  commandFocus(sq: Squad, target: Unit) {
    sq.focus = target;
    this.stats.orders++;
  }

  /** Global presets for one-tap mobile control. */
  preset(kind: 'allAuto' | 'manWalls' | 'fallback' | 'holdAll') {
    this.stats.orders++;
    if (kind === 'allAuto') for (const s of this.squads) this.commandAuto(s, true);
    if (kind === 'holdAll') for (const s of this.squads) s.stance = 'hold';
    if (kind === 'manWalls') {
      for (const s of this.squads) {
        s.auto = true;
        s.lastOrderT = -99;
        if (s.homeTile >= 0) this.orderMove(s, s.homeTile, false);
      }
    }
    if (kind === 'fallback') {
      // pull everyone back to the innermost ring around the keep
      const g = this.grid;
      const ring: number[] = [];
      for (let i = 0; i < g.n; i++) {
        if (!g.inside[i] || g.keepAdj[i]) continue;
        const d = Math.hypot(cx(i) - g.keepX, cy(i) - g.keepY);
        if (d < 6 * T) ring.push(i);
      }
      ring.sort((a, b) => cx(a) - cx(b));
      let k = 0;
      for (const s of this.squads) {
        if (s.alive === 0) continue;
        const t = ring[(k * 5) % Math.max(1, ring.length)] ?? tileAt(g.keepX - 2 * T, g.keepY);
        this.orderMove(s, t, true);
        s.stance = 'defend';
        k++;
      }
    }
  }

  // ======================================================================
  // main loop
  // ======================================================================

  start() {
    if (this.state !== 'deploy') return;
    for (const sq of this.squads) {
      if (sq.homeTile < 0) this.autoDeploy(true);
      sq.destTile = sq.homeTile;
    }
    this.startWave(0);
  }

  step() {
    if (this.state === 'deploy' || this.state === 'won' || this.state === 'lost') return;
    const dt = DT;
    this.t += dt;
    for (const u of this.units) {
      u.px = u.x;
      u.py = u.y;
      if (u.hitFlash > 0) u.hitFlash -= dt;
    }
    this.updateWaves(dt);
    this.activeDefs.length = 0;
    this.activeEnemies.length = 0;
    this.downed.length = 0;
    for (const u of this.defs) {
      if (u.state === ST.ACTIVE) this.activeDefs.push(u);
      else if (u.state === ST.DOWN) this.downed.push(u);
    }
    for (const u of this.enemies) if (u.state === ST.ACTIVE || u.state === ST.CLIMB) this.activeEnemies.push(u);
    this.breathing.length = 0;
    for (const e of this.activeEnemies) if (e.def.role === 'dragon' && e.fState === 1 && !e.fleeing && e.fT <= BREATH_T - BREATH_REACT) this.breathing.push(e);
    this.dHash.build(this.activeDefs);
    this.eHash.build(this.activeEnemies);
    if (this.fieldsDirty && this.t - this.lastFieldT > 0.35) this.recomputeFields();

    this.moraleT -= dt;
    if (this.moraleT <= 0) {
      this.moraleT = 0.25;
      this.terrorUnits = this.activeEnemies.filter((e) => e.def.terror);
      for (const sq of this.squads) this.updateSquadCentroid(sq);
      this.updateGates();
    }
    if (this.defFieldsDirty && this.t - this.lastDefFieldT >= 0.5) this.refreshSquadFields();
    this.councilT -= dt;
    if (this.councilT <= 0) {
      this.councilT = 0.5;
      runCouncil(this);
      if (this.autoCommand) autoCommander(this);
    }
    for (const sq of this.squads) this.updateSquadMorale(sq, dt);
    for (const b of this.bands) this.updateBandMorale(b, dt);
    for (let i = 0; i < this.defs.length; i++) this.updateDefender(this.defs[i], dt);
    for (let i = 0; i < this.enemies.length; i++) this.updateEnemy(this.enemies[i], dt);
    this.separate();
    this.updateProjectiles(dt);
    this.updateFire(dt);
    this.updateSupply(dt);
    for (const k of Object.keys(this.abilities) as AbilityId[]) {
      const a = this.abilities[k];
      if (a.cd > 0) a.cd = Math.max(0, a.cd - dt);
    }
    for (const k in this.alertCd) this.alertCd[k] -= dt;
    if (this.t - this.lastKeepHit < 1.5) this.keepPress = Math.min(KEEP_PRESS_MAX * KEEP_PRESS_T, this.keepPress + dt);
    else if (this.keepPress > 0) this.keepPress = Math.max(0, this.keepPress - dt * 0.5);
    this.cleanup();
    this.checkEnd();
    if (this.t >= BATTLE_HARD_CAP && this.stage.id !== 'endless' && (this.state === 'battle' || this.state === 'intermission')) this.liftSiege();
    if (this.fx.length > 3000) this.fx.splice(0, this.fx.length - 1500);
    if (this.events.length > 200) this.events.splice(0, this.events.length - 100);
  }

  /**
   * A gate opens for defenders only while no enemy is within GATE_SAFE_R tiles of it (a little more to
   * reopen, so it does not flicker). A barred gate blocks defenders like a wall; fields refresh on change.
   */
  updateGates() {
    const g = this.grid;
    let shut = 0;
    let changed = false;
    for (const i of g.structTiles) {
      if (g.tiles[i] !== Tile.GATE) continue;
      const r = (g.gateShut[i] ? GATE_SAFE_R + 0.5 : GATE_SAFE_R) * T;
      const x = cx(i);
      const y = cy(i);
      const danger = !!this.eHash.best(x, y, r, (e) => (e.fleeing || e.def.flying || e.state !== ST.ACTIVE ? Infinity : 0));
      if (danger !== !!g.gateShut[i]) {
        g.gateShut[i] = danger ? 1 : 0;
        changed = true;
      }
      if (danger) shut++;
    }
    // gates that were rebuilt from rubble or broken since: never left barred
    if (this.gatesShut > 0 || changed)
      for (let i = 0; i < g.n; i++)
        if (g.gateShut[i] && g.tiles[i] !== Tile.GATE) {
          g.gateShut[i] = 0;
          changed = true;
        }
    this.gatesShut = shut;
    if (changed) this.defFieldsDirty = true;
  }

  /** Is this gate tile open to defenders right now? */
  gateOpen(i: number) {
    return this.grid.tiles[i] === Tile.GATE && !this.grid.gateShut[i];
  }

  /**
   * A gate opened or shut: only paths between the field and the courtyard change, so only squads with
   * a post or a man outside the walls need new fields (and the retreat fields, if anyone is outside).
   */
  refreshSquadFields() {
    this.defFieldsDirty = false;
    this.lastDefFieldT = this.t;
    const g = this.grid;
    const out = (i: number) => g.inside[i] === 0 && !g.isBoundary(i);
    for (const sq of this.squads) {
      sq.tfieldTile = -1; // per-task approach fields are rebuilt on their next use
      if (sq.alive === 0 || !sq.slots.length) continue;
      let affected = sq.slots.some(out);
      if (!affected)
        for (const u of sq.units)
          if (u.state === ST.ACTIVE && out(tileAt(u.x, u.y))) {
            affected = true;
            break;
          }
      if (affected) g.defenderField(sq.slots, sq.field);
    }
    if (this.activeDefs.some((u) => out(tileAt(u.x, u.y)))) this.computeDefenderFields();
  }

  recomputeFields() {
    this.fieldsDirty = false;
    this.lastFieldT = this.t;
    this.grid.enemyField('breach', this.fields.breach);
    this.grid.enemyField('escalade', this.fields.escalade);
    this.grid.enemyField('ram', this.fields.ram);
    this.exitDirty = true;
    this.computeDefenderFields();
  }

  // ======================================================================
  // waves
  // ======================================================================

  startWave(w: number) {
    // an open war council is decided (auto-commander) or lapses before the rations are handed out
    if (this.state === 'intermission') closeCouncil(this);
    // galleries nobody is digging any more are filled in between the assaults
    if (w > 0) {
      let filled = 0;
      for (let i = 0; i < this.mineProg.length; i++) {
        if (this.mineProg[i] <= 0) continue;
        if (this.activeEnemies.some((e) => e.act === ACT.DIG && e.actTile === i && e.state === ST.ACTIVE)) continue;
        this.mineProg[i] = 0;
        filled++;
      }
      if (filled) this.event('minefilled', '수비대가 반쯤 파인 갱도를 메웠습니다.', 'good');
    }
    this.waveIdx = w;
    this.waveT = 0;
    this.pending = [...this.stage.waves[w].groups].sort((a, b) => a.delay - b.delay);
    this.state = 'battle';
    // a supply train (endless) reaches the castle before every later wave, cleared or not; the stores
    // hold no more than they did when the siege began
    const sup = this.stage.resupply;
    if (sup && w > 0) {
      const got: string[] = [];
      for (const k of ['food', 'arrows', 'mats', 'meds'] as const) {
        const n = Math.floor(Math.min(sup[k] ?? 0, this.startSupplies[k] - this.supplies[k]));
        if (n <= 0) continue;
        this.supplies[k] += n;
        if (k === 'arrows') this.arrowsIn += n;
        got.push(`${SUPPLY_NAMES[k]} +${n}`);
      }
      if (got.length) this.event('resupply', `보급 마차가 도착했습니다: ${got.join(', ')}`, 'info');
    }
    // food ration per wave
    const mouths = Math.ceil(this.defs.filter((u) => u.state === ST.ACTIVE).length / 2);
    if (this.supplies.food >= mouths) {
      this.supplies.food -= mouths;
      this.starving = false;
    } else {
      this.supplies.food = 0;
      this.starving = true;
      this.event('starving', '식량이 바닥났습니다! 병사들의 사기가 떨어집니다.', 'danger');
    }
    const names = [...new Set(this.pending.map((g) => BANDS[g.band]?.name))].slice(0, 3).join(', ');
    this.event('wave', `${w + 1}번째 물결: ${names}`, 'warn');
    this.fx.push({ k: 'horn', x: 0, y: 0 });
  }

  totalWaves() {
    return this.stage.waves.length;
  }

  updateWaves(dt: number) {
    if (this.state === 'intermission') {
      this.interT -= dt;
      if (this.interT <= 0) this.startWave(this.waveIdx + 1);
      return;
    }
    this.waveT += dt;
    while (this.pending.length && this.pending[0].delay <= this.waveT) {
      const g = this.pending.shift()!;
      for (let k = 0; k < (g.n ?? 1); k++) this.spawnBand(g, k);
    }
    const wave = this.stage.waves[this.waveIdx];
    const last = this.waveIdx >= this.totalWaves() - 1;
    if (!this.pending.length) {
      const alive = this.enemies.some((e) => (e.state === ST.ACTIVE || e.state === ST.CLIMB) && !e.fleeing);
      if (!alive) {
        this.waveCleared = Math.max(this.waveCleared, this.waveIdx + 1);
        if (last) {
          this.finish(true);
        } else {
          this.state = 'intermission';
          this.interT = wave.intermission ?? 14;
          const rec = Math.floor(this.shotsWave * 0.3);
          this.shotsWave = 0;
          if (rec > 0) {
            this.supplies.arrows += rec;
            this.arrowsIn += rec;
            this.event('arrows', `전장에서 화살 ${rec}개를 회수했습니다.`, 'info');
          }
          this.event('cleared', `물결을 막아냈습니다! 다음 공세까지 ${Math.round(this.interT)}초`, 'good');
          for (const sq of this.squads) sq.morale = Math.min(100, sq.morale + 10);
          openCouncil(this);
        }
      } else if (!last && this.waveT > (wave.maxTime ?? 105)) {
        this.startWave(this.waveIdx + 1);
      }
    }
  }

  // ---------------------------------------------------------------- war council (between waves)
  // Each intermission offers three options (src/sim/warcouncil.ts); one may be taken.

  /** id of the option picked during the current intermission, or null */
  councilPick: string | null = null;

  /** Options the player can pick right now (empty when not in an intermission or already picked). */
  councilOptions(): { id: string; name: string; desc: string }[] {
    if (this.state !== 'intermission' || this.councilPick) return [];
    return councilOptionList(this);
  }

  /** Apply one council option. Returns false if not allowed now. */
  chooseCouncil(id: string): boolean {
    if (this.state !== 'intermission' || this.councilPick || !this.councilOffer.includes(id)) return false;
    applyCouncil(this, id, false);
    return true;
  }

  /** a gate's full strength at the start of this battle (research and daily mods included) */
  gateBaseHp() {
    return TILE_INFO[Tile.GATE].maxHp * this.structHpMul;
  }

  /** Edges ('W' | 'N' | 'S' | 'E') the upcoming wave will come from: the first wave while deploying,
   *  the next wave during an intermission, the current wave during battle. Used for approach arrows. */
  nextWaveEdges(): string[] {
    const waves = this.stage.waves;
    if (!waves.length) return [];
    const idx = this.state === 'deploy' ? 0 : this.state === 'intermission' ? this.waveIdx + 1 : Math.max(0, this.waveIdx);
    const wv = waves[Math.min(idx, waves.length - 1)];
    return [...new Set(wv.groups.map((g) => g.edge as string))];
  }

  /** Player may call the next wave early during intermission (small gold bonus). */
  skipIntermission() {
    if (this.state !== 'intermission') return;
    this.stats.bounty += 10 + 5 * this.waveIdx;
    this.startWave(this.waveIdx + 1);
  }

  spawnBand(g: WaveGroup, k: number) {
    const tpl = BANDS[g.band];
    if (!tpl) return;
    const grid = this.grid;
    const r = this.rng;
    const along = r.range(g.span[0], g.span[1]);
    const ok = (i: number) => grid.openGround(i) && !grid.inside[i];
    const st = grid.spawnTile(g.edge, along);
    if (st < 0) return;
    const bx = cx(st);
    const by = cy(st);
    const band: Band = {
      id: this.bands.length,
      tpl,
      units: [],
      leader: null,
      morale: tpl.morale + (this.mods.has('iron') ? 20 : 0),
      startCount: 0,
      broken: false,
      field: tpl.field,
      wave: this.waveIdx,
      core: [],
      convoy: false,
      ax: bx,
      ay: by,
      fdx: 1,
      fdy: 0,
      pace: 0,
      formed: false,
      brokenT: -1,
      contactT: this.t,
      assault: false,
    };
    const list: string[] = [];
    if (tpl.leader) list.push(tpl.leader);
    for (const [id, n] of tpl.members) for (let i = 0; i < n; i++) list.push(id);
    const spread = 1.2 + Math.sqrt(list.length) * 0.55;
    // endless waves grow stronger one by one
    const waveMul = this.stage.waves[this.waveIdx]?.mul ?? 1;
    for (let i = 0; i < list.length; i++) {
      const def = UNITS[list[i]];
      let px = bx;
      let py = by;
      if (!def.flying) {
        for (let tries = 0; tries < 8; tries++) {
          const ang = r.range(0, Math.PI * 2);
          const rad = i === 0 ? 0 : r.range(0.3, spread) * T;
          // the band fans out along its edge and back from it, never forward toward the walls
          const qx = Math.max(2, Math.min(WORLD_W - 2, bx + Math.cos(ang) * rad - (g.edge === 'W' ? rad * 0.5 : g.edge === 'E' ? -rad * 0.5 : 0)));
          const qy = Math.max(2, Math.min(WORLD_H - 2, by + Math.sin(ang) * rad - (g.edge === 'N' ? rad * 0.5 : g.edge === 'S' ? -rad * 0.5 : 0)));
          if (ok(tileAt(qx, qy))) {
            px = qx;
            py = qy;
            break;
          }
        }
      } else {
        px = g.edge === 'W' ? 4 : g.edge === 'E' ? WORLD_W - 4 : bx;
        py = g.edge === 'N' ? 4 : g.edge === 'S' ? WORLD_H - 4 : by;
        if (def.role === 'dragon') this.hasDragonEver = true;
      }
      const u = this.makeUnit(def, 1, px, py);
      u.maxHp = u.hp = def.hp * this.hpScale * waveMul;
      u.atkMul = this.atkScale * waveMul;
      u.band = band;
      if (def.role === 'ranged') u.ammo = u.maxAmmo = ENEMY_QUIVER;
      else if (def.role === 'treb') u.ammo = u.maxAmmo = TREB_STONES;
      u.spawnX = g.edge === 'W' ? -20 : g.edge === 'E' ? WORLD_W + 20 : px;
      u.spawnY = g.edge === 'N' ? -20 : g.edge === 'S' ? WORLD_H + 20 : py;
      if (def.leader && !band.leader) band.leader = u;
      band.units.push(u);
      this.enemies.push(u);
    }
    band.startCount = band.units.length;
    // convoy: siege engines (and sappers) travel inside a screen of escorts at the slowest member's pace
    for (const u of band.units) {
      if (isEngine(u)) {
        u.crew = 100;
        band.core.push(u);
      } else if (u.def.role === 'sapper') band.core.push(u);
    }
    let escorts = 0;
    if (band.core.length) for (const u of band.units) if (!band.core.includes(u)) u.escortIdx = escorts++;
    band.convoy = band.core.length > 0 && escorts > 0;
    this.bands.push(band);
    if (tpl.faction === 'wyrm' && tpl.leader === 'c_dragon') this.event('dragon', '잿불 고룡이 나타났습니다!', 'danger', bx, by);
  }

  // ======================================================================
  // morale
  // ======================================================================

  updateSquadCentroid(sq: Squad) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const u of sq.units)
      if (u.state === ST.ACTIVE) {
        sx += u.x;
        sy += u.y;
        n++;
      }
    sq.alive = n;
    if (n) {
      sq.cx = sx / n;
      sq.cy = sy / n;
    }
  }

  moraleMul(sq: Squad | null) {
    if (!sq) return 1;
    if (sq.morale >= 75) return 1.08;
    if (sq.morale < 40) return 0.8;
    return 1;
  }

  updateSquadMorale(sq: Squad, dt: number) {
    if (sq.alive === 0) return;
    const g = this.grid;
    const resist = 1 - 0.06 * sq.rank;
    let base = sq.baseMorale - (this.starving ? 20 : 0);
    if (sq.rallyT > 0) {
      sq.rallyT -= dt;
      base += 15;
    }
    const dk = Math.hypot(sq.cx - g.keepX, sq.cy - g.keepY);
    sq.morale += (base - sq.morale) * 0.035 * dt;
    if (dk < 7 * T) sq.morale += (sq.routing ? 4.5 : 1) * dt;
    if (sq.routing) sq.morale += 1.2 * dt;
    // pressure: outnumbered in close combat
    const st = tileAt(sq.cx, sq.cy);
    const sqIn = g.inside[st] === 1 || g.isBoundary(st);
    const near = this.eHash.count(sq.cx, sq.cy, 3 * T, (e) => {
      if (e.fleeing || e.state !== ST.ACTIVE) return false;
      const et = tileAt(e.x, e.y);
      const eIn = e.elev || g.inside[et] === 1 || g.isBoundary(et);
      return eIn === sqIn;
    });
    sq.engaged = near;
    const ratio = near / sq.alive;
    if (ratio > 1.3) sq.morale -= Math.min(3.5, (ratio - 1.3) * 1.4) * dt * resist;
    for (const e of this.terrorUnits) {
      const d = Math.hypot(e.x - sq.cx, e.y - sq.cy);
      const R = 8 * T;
      if (d < R) sq.morale -= (e.def.terror ?? 0) * (1 - d / R) * dt * resist;
    }
    if (sq.morale > 100) sq.morale = 100;
    if (sq.morale < 0) sq.morale = 0;
    if (!sq.routing && sq.morale < 18) {
      sq.routing = true;
      this.event('rout', `${sq.name}의 사기가 무너져 도주합니다!`, 'danger', sq.cx, sq.cy, sq.id);
      for (const o of this.squads)
        if (o !== sq && o.alive && Math.hypot(o.cx - sq.cx, o.cy - sq.cy) < 8 * T) o.morale = Math.max(0, o.morale - 7 * (1 - 0.06 * o.rank));
    } else if (sq.routing && sq.morale >= 42) {
      sq.routing = false;
      this.event('rallied', `${sq.name} 재집결!`, 'good', sq.cx, sq.cy, sq.id);
      if (sq.destTile >= 0) this.orderMove(sq, sq.destTile, false);
    }
  }

  updateBandMorale(b: Band, dt: number) {
    if (b.convoy) this.updateConvoy(b);
    let alive = 0;
    let fighting = 0;
    let men = 0;
    for (const u of b.units)
      if (u.state === ST.ACTIVE || u.state === ST.CLIMB) {
        alive++;
        if (!u.fleeing) {
          fighting++;
          if (!isEngine(u)) men++;
        }
      }
    if (alive === 0) return;
    // a siege tower at the wall with nobody left to climb it is an empty box: its crew pulls it back
    if (men === 0 && this.t - b.contactT > TOWER_EMPTY_T)
      for (const u of b.units) if (u.state === ST.ACTIVE && u.act === ACT.DOCKED && !u.fleeing) this.engineRetreat(u);
    if (fighting > 0 && this.t - b.contactT > BAND_STALL_T) this.bandStalled(b, fighting);
    if (b.broken) return;
    if (b.leader && b.leader.state === ST.ACTIVE && b.morale < b.tpl.morale) b.morale = Math.min(b.tpl.morale, b.morale + (b.leader.def.aura ?? 0) * 0.6 * dt);
    if (b.morale < 15) this.breakBand(b);
  }

  /** No progress for a long while: a strong band storms the walls, a weak (or already stalled) one withdraws. */
  bandStalled(b: Band, fighting: number) {
    b.contactT = this.t;
    let x = 0;
    let y = 0;
    let n = 0;
    for (const u of b.units)
      if ((u.state === ST.ACTIVE || u.state === ST.CLIMB) && !u.fleeing) {
        x += u.x;
        y += u.y;
        n++;
      }
    if (n) {
      x /= n;
      y /= n;
    }
    if (!b.broken && !b.assault && fighting >= Math.max(3, b.startCount * 0.35)) {
      b.assault = true;
      this.endConvoy(b);
      this.event('assault', `${josa(b.tpl.name, '이/가')} 총공격에 나섭니다!`, 'warn', x, y);
      return;
    }
    // withdraw: everyone still standing leaves the field (the dragon keeps its own counsel)
    for (const u of b.units) {
      if (u.state !== ST.ACTIVE || u.fleeing || u.def.role === 'dragon') continue;
      if (isEngine(u)) this.engineRetreat(u);
      else u.fleeing = true;
    }
    if (!b.broken) {
      b.broken = true;
      b.brokenT = this.t;
    }
    this.endConvoy(b);
    this.event('withdraw', `${josa(b.tpl.name, '이/가')} 싸움을 포기하고 물러납니다.`, 'good', x, y);
  }

  /** Every man of the band still in the fight is a missile trooper with an empty quiver. */
  bandShotOut(b: Band) {
    let men = 0;
    for (const u of b.units) {
      if ((u.state !== ST.ACTIVE && u.state !== ST.CLIMB) || u.fleeing || isEngine(u)) continue;
      if (!(u.def.role === 'ranged' && u.ammo < 1)) return false;
      men++;
    }
    return men > 0;
  }

  /**
   * Missile troops who have shot their quivers empty come forward to fight hand to hand, but hacking at a
   * wall or gate with a bow or a crossbow butt would take them all day: a band with nothing left to shoot
   * and nobody to fight goes home.
   */
  bandSpent(b: Band) {
    let x = 0;
    let y = 0;
    let n = 0;
    for (const u of b.units) {
      if (u.state !== ST.ACTIVE || u.fleeing) continue;
      x += u.x;
      y += u.y;
      n++;
      if (isEngine(u)) this.engineRetreat(u);
      else u.fleeing = true;
    }
    b.broken = true;
    b.brokenT = this.t;
    this.endConvoy(b);
    if (n) this.event('withdraw', `${josa(b.tpl.name, '이/가')} 화살을 다 쏘고 물러납니다.`, 'good', x / n, y / n);
  }

  /** Convoy bookkeeping: anchor on the core, forward direction along its path, pace of the slowest member. */
  updateConvoy(b: Band) {
    if (b.broken) {
      this.endConvoy(b);
      return;
    }
    let lead: Unit | null = null;
    let ld = Infinity;
    for (const c of b.core) {
      if (c.state !== ST.ACTIVE || c.fleeing) continue;
      if (c.def.role === 'tower' && c.act === ACT.DOCKED) {
        this.endConvoy(b); // docked: the escort storms the tower
        return;
      }
      // anchor on the most advanced core unit so the screen walks in front of all of them
      const d = this.fieldFor(c).dist[tileAt(c.x, c.y)];
      if (!lead || d < ld) {
        lead = c;
        ld = d;
      }
    }
    let esc = 0;
    let pace = Infinity;
    for (const u of b.units) {
      if (u.escortIdx < 0 || u.state !== ST.ACTIVE || u.fleeing) continue;
      esc++;
      pace = Math.min(pace, u.def.speed);
    }
    if (!lead || !esc) {
      this.endConvoy(b);
      return;
    }
    b.ax = lead.x;
    b.ay = lead.y;
    b.pace = pace * T;
    let fx: number;
    let fy: number;
    if (lead.def.role === 'treb' && lead.act === ACT.SET && lead.actTile >= 0) {
      fx = cx(lead.actTile) - b.ax;
      fy = cy(lead.actTile) - b.ay;
    } else {
      const f = this.fieldFor(lead);
      let i = tileAt(b.ax, b.ay);
      for (let k = 0; k < 3; k++) {
        const nx = f.next[i];
        if (nx < 0) break;
        i = nx;
      }
      fx = cx(i) - b.ax;
      fy = cy(i) - b.ay;
    }
    const m = Math.hypot(fx, fy);
    if (m > 1) {
      const nx = b.fdx * 0.85 + (fx / m) * 0.15;
      const ny = b.fdy * 0.85 + (fy / m) * 0.15;
      const mm = Math.hypot(nx, ny) || 1;
      b.fdx = nx / mm;
      b.fdy = ny / mm;
    }
    // formed: most escorts hold their slots; screened: a core unit with two escorts right next to it
    let inSlot = 0;
    for (const u of b.units) {
      if (u.escortIdx < 0 || u.state !== ST.ACTIVE || u.fleeing) continue;
      const [sx, sy] = this.convoySlot(u, b);
      if (Math.hypot(u.x - sx, u.y - sy) < 1.5 * T) inSlot++;
    }
    b.formed = inSlot * 2 >= esc;
    const R2 = (2 * T) ** 2;
    for (const c of b.core) {
      let near = 0;
      if (c.state === ST.ACTIVE && !c.fleeing)
        for (const u of b.units)
          if (u.escortIdx >= 0 && u.state === ST.ACTIVE && !u.fleeing && (u.x - c.x) ** 2 + (u.y - c.y) ** 2 < R2 + c.def.r * c.def.r * 4) near++;
      // a miner at work sits at the wall foot, right under the archers: the shields cannot cover him there
      c.screened = near >= 2 && c.act !== ACT.DIG;
    }
  }

  endConvoy(b: Band) {
    b.convoy = false;
    for (const c of b.core) c.screened = false;
  }

  /** Where an escort stands: an arc screening the front and flanks of its core. */
  convoySlot(e: Unit, b: Band): [number, number] {
    const per = 5;
    const total = b.startCount - b.core.length;
    const k = e.escortIdx;
    const row = Math.floor(k / per);
    const inRow = Math.max(1, Math.min(per, total - row * per));
    const j = k % per;
    const A = 1.35;
    const ang = inRow > 1 ? -A + (2 * A * j) / (inRow - 1) : 0;
    let coreR = 0;
    for (const c of b.core) coreR = Math.max(coreR, c.def.r);
    const R = coreR + (0.9 + row * 0.85) * T;
    const lx = -b.fdy;
    const ly = b.fdx;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const g = this.grid;
    const at = tileAt(b.ax, b.ay);
    const ok = (px: number, py: number) => {
      if (px < 2 || py < 2 || px > WORLD_W - 2 || py > WORLD_H - 2) return false;
      const t = tileAt(px, py);
      return g.openGround(t) && g.inside[t] === g.inside[at];
    };
    let sx = b.ax + R * (ca * b.fdx + sa * lx);
    let sy = b.ay + R * (ca * b.fdy + sa * ly);
    if (ok(sx, sy)) return [sx, sy];
    // the front is blocked (wall, cliff): close in behind the core instead
    sx = b.ax + R * (-ca * b.fdx + sa * lx);
    sy = b.ay + R * (-ca * b.fdy + sa * ly);
    if (ok(sx, sy)) return [sx, sy];
    return [b.ax + ((e.id % 5) - 2) * 3, b.ay + ((e.id % 3) - 1) * 3];
  }

  /** A crewed engine gives up: too damaged or its crew lost heart. */
  engineRetreat(e: Unit) {
    if (e.fleeing) return;
    e.fleeing = true;
    e.act = ACT.NONE;
    if (e.def.role === 'tower') {
      const lad = this.ladders.find((l) => l.tower === e);
      if (lad) this.removeLadder(lad, false);
    }
    this.event('enginefled', `${josa(e.def.name, '이/가')} 물러납니다!`, 'good', e.x, e.y);
  }

  breakBand(b: Band) {
    if (b.broken) return;
    b.broken = true;
    b.brokenT = this.t;
    let x = 0;
    let y = 0;
    let n = 0;
    for (const u of b.units) {
      if (u.state !== ST.ACTIVE && u.state !== ST.CLIMB) continue;
      x += u.x;
      y += u.y;
      n++;
      if (isEngine(u)) {
        // the crew is shaken when its escort scatters, but keeps working the machine
        u.crew = Math.max(0, u.crew - 30);
        continue;
      }
      if (u.def.role === 'sapper' && u.act === ACT.DIG) continue; // committed to the mine
      if (u.def.role === 'dragon') continue; // a dragon does not care whether its kobolds run
      // men inside the walls run too, by the way they came in; only those with no way out fight on (fleeOff)
      if (!(u.def.fearless && u.hp > u.maxHp * 0.4)) u.fleeing = true;
    }
    if (n) {
      x /= n;
      y /= n;
      this.event('broken', `${josa(b.tpl.name, '이/가')} 무너져 달아납니다!`, 'good', x, y);
      for (const sq of this.squads) if (sq.alive && Math.hypot(sq.cx - x, sq.cy - y) < 10 * T) sq.morale = Math.min(100, sq.morale + 8);
    }
  }

  // ======================================================================
  // movement helpers
  // ======================================================================

  canMove(u: Unit, a: number, b: number) {
    if (u.def.flying) return true;
    if (u.side === 0) return this.grid.defCanMove(a, b);
    return this.grid.enemyCanMove(a, b, u.elev);
  }

  tryMove(u: Unit, nx: number, ny: number) {
    if (u.def.flying) {
      u.x = Math.max(-40, Math.min(WORLD_W + 40, nx));
      u.y = Math.max(-40, Math.min(WORLD_H + 40, ny));
      return;
    }
    nx = Math.max(1, Math.min(WORLD_W - 1, nx));
    ny = Math.max(1, Math.min(WORLD_H - 1, ny));
    const a = tileAt(u.x, u.y);
    const b = tileAt(nx, ny);
    if (a === b || this.canMove(u, a, b)) {
      u.x = nx;
      u.y = ny;
    } else {
      const bx = tileAt(nx, u.y);
      if (bx === a || this.canMove(u, a, bx)) u.x = nx;
      else {
        const by = tileAt(u.x, ny);
        if (by === a || this.canMove(u, a, by)) u.y = ny;
      }
    }
    u.elev = this.grid.isElev(tileAt(u.x, u.y));
  }

  speedOf(u: Unit) {
    let s = u.def.speed * T;
    if (!u.def.flying) s *= TILE_INFO[this.grid.tiles[tileAt(u.x, u.y)]].speed || 0.5;
    if (u.side === 0 && u.hp < u.maxHp * 0.35) s *= 0.7;
    if (u.fleeing || (u.squad && u.squad.routing)) s *= 1.1;
    return s;
  }

  moveToward(u: Unit, x: number, y: number, mul = 1): boolean {
    const dx = x - u.x;
    const dy = y - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.75) return true;
    const step = Math.min(d, this.speedOf(u) * DT * mul);
    u.fx = dx / d;
    u.fy = dy / d;
    this.tryMove(u, u.x + (dx / d) * step, u.y + (dy / d) * step);
    u.moveT += DT;
    return false;
  }

  /** Defender: walk along a defender field toward its goal region, then to (gx, gy). */
  walkField(u: Unit, f: Field, gx: number, gy: number, mul = 1) {
    const i = tileAt(u.x, u.y);
    const d = f.dist[i];
    if (!isFinite(d) && this.gatesShut > 0 && u.side === 0) {
      // cut off by a barred gate: wait at it until it opens (walking straight would just hug the wall)
      const gt = this.nearestShutGate(u);
      if (gt >= 0 && Math.hypot(cx(gt) - gx, cy(gt) - gy) > 1.5 * T) return this.moveToward(u, cx(gt), cy(gt), mul);
    }
    if (d <= 1.5 || !isFinite(d)) return this.moveToward(u, gx, gy, mul);
    const n = f.next[i];
    if (n < 0) return this.moveToward(u, gx, gy, mul);
    const j = ((u.id * 13) % 7) - 3;
    this.moveToward(u, cx(n) + j * 0.9, cy(n) + ((u.id * 7) % 5 - 2) * 0.9, mul);
    return false;
  }

  nearestShutGate(u: Unit): number {
    const g = this.grid;
    let best = -1;
    let bd = Infinity;
    for (const i of g.structTiles) {
      if (g.tiles[i] !== Tile.GATE || !g.gateShut[i]) continue;
      const d = Math.hypot(cx(i) - u.x, cy(i) - u.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  moveToSlot(u: Unit) {
    const sq = u.squad!;
    const d = Math.hypot(u.slotX - u.x, u.slotY - u.y);
    if (d < 1.2) {
      u.moveT = 0;
      return true;
    }
    // the post is burning (or in a dragon's breath): wait beside it instead of walking back into the flames
    if (d < 3 * T && this.tileDanger(tileAt(u.slotX, u.slotY)) > 0) {
      u.moveT = 0;
      return true;
    }
    return this.walkField(u, sq.field, u.slotX, u.slotY);
  }

  /**
   * How dangerous a tile is to stand on: 1 if it burns, plus 1 (more toward the axis) for every dragon
   * breathing a cone over it. 0 = safe.
   */
  tileDanger(i: number): number {
    let d = this.fire[i] > 0 ? 1 : 0;
    if (this.breathing.length) {
      const x = cx(i);
      const y = cy(i);
      for (const e of this.breathing) {
        const dx = x - e.x;
        const dy = y - e.y;
        // the dragon drifts forward as it breathes: a little margin on the reach and the angle
        if (dx * dx + dy * dy > (BREATH_LEN + T) ** 2) continue;
        let da = Math.abs(Math.atan2(dy, dx) - Math.atan2(e.fy, e.fx));
        if (da > Math.PI) da = Math.PI * 2 - da;
        const half = BREATH_HALF + 0.2;
        if (da < half) d += 1 + (half - da);
      }
    }
    return d;
  }

  /**
   * Fire and breath are the soldiers' own business (GAME_DESIGN §5: micro is the AI's): a defender on a
   * burning tile or in a dragon's breath steps to the safest neighbouring tile. He keeps to his level
   * (a single step stays inside even a holding squad's 1.3-tile leash); off the wall walk he goes only
   * down into the courtyard, and only when nothing on the wall is safer. No RNG. Returns true if he moves.
   */
  avoidDanger(u: Unit): boolean {
    const g = this.grid;
    const ti = tileAt(u.x, u.y);
    const here = this.tileDanger(ti);
    if (here <= 0) return false;
    const x = tx(ti);
    const y = ty(ti);
    const el = g.isElev(ti);
    let best = -1;
    let bs = Infinity;
    for (const [dx, dy] of N8) {
      const xx = x + dx;
      const yy = y + dy;
      if (!inb(xx, yy)) continue;
      const j = idx(xx, yy);
      if (!g.defCanMove(ti, j)) continue;
      const down = g.isElev(j) !== el;
      if (down && !(el && g.inside[j] === 1)) continue;
      const dj = this.tileDanger(j);
      if (dj >= here) continue;
      const s = dj * 600 + (down ? 300 : 0) + Math.hypot(cx(j) - u.slotX, cy(j) - u.slotY) + Math.hypot(dx, dy) * 4;
      if (s < bs) {
        bs = s;
        best = j;
      }
    }
    if (best < 0) return false;
    this.moveToward(u, cx(best), cy(best));
    return true;
  }

  /** Is there an intact structure (or keep/cliff) between two ground points? */
  blockedBetween(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.min(40, Math.max(2, Math.ceil(d / 6)));
    const a0 = tileAt(ax, ay);
    const b0 = tileAt(bx, by);
    for (let k = 1; k < n; k++) {
      const f = k / n;
      const i = tileAt(ax + (bx - ax) * f, ay + (by - ay) * f);
      if (i === a0 || i === b0) continue;
      const t = this.grid.tiles[i];
      if (TILE_INFO[t].struct || t === Tile.KEEP || t === Tile.CLIFF) return true;
    }
    return false;
  }

  separate() {
    const push = (u: Unit) => {
      if (u.def.flying || u.state !== ST.ACTIVE) return;
      let mx = 0;
      let my = 0;
      const rr = u.def.r;
      const visit = (o: Unit) => {
        if (o === u || o.def.flying || o.elev !== u.elev) return;
        const dx = u.x - o.x;
        const dy = u.y - o.y;
        const min = (rr + o.def.r) * 0.92;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 0.01;
        const overlap = min - d;
        const w = o.def.r / (rr + o.def.r);
        const nx = d2 === 0 ? ((u.id % 3) - 1) : dx / d;
        const ny = d2 === 0 ? ((u.id % 5) - 2) * 0.5 : dy / d;
        mx += nx * overlap * w * 0.5;
        my += ny * overlap * w * 0.5;
      };
      const R = rr + 12;
      this.dHash.each(u.x, u.y, R, visit);
      this.eHash.each(u.x, u.y, R, visit);
      if (mx !== 0 || my !== 0) {
        const m = Math.hypot(mx, my);
        const cap = 1.6;
        if (m > cap) {
          mx = (mx / m) * cap;
          my = (my / m) * cap;
        }
        this.tryMove(u, u.x + mx, u.y + my);
      }
    };
    for (const u of this.activeDefs) push(u);
    for (const u of this.activeEnemies) if (u.state === ST.ACTIVE && !u.def.big) push(u);
  }

  // ======================================================================
  // defenders
  // ======================================================================

  updateDefender(u: Unit, dt: number) {
    if (u.state === ST.DOWN) {
      u.downT -= dt;
      if (u.downT <= 0) this.killDef(u);
      else if (this.rng.chance(0.15 * dt)) {
        const foe = this.eHash.best(u.x, u.y, 9, (e) => (e.elev === u.elev && !e.fleeing ? 0 : Infinity));
        if (foe) this.killDef(u);
      }
      return;
    }
    if (u.state === ST.CARRIED) {
      const c = u.carrier;
      if (!c || c.state !== ST.ACTIVE) {
        u.state = ST.DOWN;
        u.carrier = null;
        if (c) c.carry = null;
      } else {
        u.x = c.x + 2;
        u.y = c.y + 1;
      }
      return;
    }
    if (u.state !== ST.ACTIVE) return;
    u.cd -= dt;
    u.retarget -= dt;
    const sq = u.squad!;
    if (sq.routing) {
      const g = this.grid;
      this.walkField(u, this.retreatField, g.keepX - 2.4 * T + ((u.id % 7) - 3) * 3, g.keepY + ((u.id % 9) - 4) * 3, 1);
      return;
    }
    const role = u.def.role;
    // an engineer at work stays at it (putting out a burning wall is his job); everyone else steps clear
    if (!(role === 'engineer' && sq.taskTile >= 0) && this.avoidDanger(u)) return;
    if (role === 'engineer' && this.engineerAI(u, sq)) return;
    if (role === 'surgeon' && this.surgeonAI(u)) return;
    this.combatAI(u, sq);
  }

  leash(sq: Squad) {
    if (sq.stance === 'hold') return 1.3 * T;
    if (sq.stance === 'aggressive') return 8 * T;
    return 3.6 * T;
  }

  validTarget(u: Unit, e: Unit | null): e is Unit {
    return !!e && (e.state === ST.ACTIVE || e.state === ST.CLIMB) && !(e.def.role === 'dragon' && u.def.range === 0);
  }

  canDefMelee(u: Unit, e: Unit): boolean {
    if (e.state === ST.CLIMB) return u.elev && Math.hypot(cx(e.actTile) - u.x, cy(e.actTile) - u.y) < 1.8 * T;
    if (e.state !== ST.ACTIVE) return false;
    if (e.def.role === 'dragon') return false;
    if (e.def.flying) return true;
    const g = this.grid;
    if (u.elev && e.elev) return true;
    if (!u.elev && e.elev) return g.inside[tileAt(u.x, u.y)] === 1 || g.isBoundary(tileAt(u.x, u.y));
    if (u.elev && !e.elev) {
      const et = tileAt(e.x, e.y);
      if (g.inside[et] || g.isBoundary(et)) return true;
      return Math.hypot(e.x - u.x, e.y - u.y) <= u.def.r + e.def.r + u.def.reach + 9;
    }
    return !this.blockedBetween(u.x, u.y, e.x, e.y);
  }

  pickMeleeTarget(u: Unit, sq: Squad): Unit | null {
    const L = sq.auto && sq.type.id === 'knight' ? 6 * T : this.leash(sq);
    const ax = sq.stance === 'aggressive' ? u.x : u.slotX;
    const ay = sq.stance === 'aggressive' ? u.y : u.slotY;
    if (sq.focus && this.validTarget(u, sq.focus) && this.canDefMelee(u, sq.focus)) {
      if (Math.hypot(sq.focus.x - u.x, sq.focus.y - u.y) < 12 * T) return sq.focus;
    }
    return this.eHash.best(ax, ay, L + T * 0.5, (e, d2) => {
      if (e.fleeing && d2 > 4 * T * T) return Infinity;
      if (!this.canDefMelee(u, e)) return Infinity;
      const du = (e.x - u.x) ** 2 + (e.y - u.y) ** 2;
      let s = du;
      if (e.state === ST.CLIMB || (e.elev && u.elev)) s *= 0.4;
      if (e.def.role === 'ladder' || e.def.role === 'sapper') s *= 0.7;
      return s;
    });
  }

  pickRangedTarget(u: Unit, sq: Squad): Unit | null {
    const range = this.rangeOf(u);
    if (sq.focus && this.validTarget(u, sq.focus) && Math.hypot(sq.focus.x - u.x, sq.focus.y - u.y) <= range) return sq.focus;
    const ballista = u.def.id === 'd_ballista';
    const g = this.grid;
    return this.eHash.best(u.x, u.y, range, (e, d2) => {
      if (e.state === ST.CLIMB && !u.elev) return Infinity;
      let s = Math.sqrt(d2);
      if (ballista) {
        if (e.def.big || e.def.flying) s *= 0.25;
        else s += 60;
      } else {
        // prefer targets our missiles actually hurt (saves arrows against armour, rams and towers)
        const eff = (1 - Math.min(0.85, e.def.armor) * (1 - (u.def.ap ?? 0))) * (e.def.rangedResist ?? 1);
        if (eff < 0.2 && e !== sq.focus && e.state !== ST.CLIMB) return Infinity;
        s /= Math.max(0.25, eff);
        if (e.state === ST.CLIMB || (e.elev && g.inside[tileAt(u.x, u.y)] !== 1)) s *= 0.55;
        if (e.elev) s *= 0.6;
        const r = e.def.role;
        if ((r === 'ladder' || r === 'sapper') && !e.screened && e.act !== ACT.DIG) s *= 0.6;
        // a miner at work under the wall is the first mark: every second he digs brings the wall down
        if (r === 'sapper' && e.act === ACT.DIG) s *= 0.45;
        if (e.def.leader) s *= 0.8;
        // the dragon is the one target worth an armoured hide's worth of arrows: every wound harries it
        if (e.def.role === 'dragon') s *= 0.4;
        if (e.def.role === 'healer') s *= 0.75;
        if (e.fleeing) s *= 1.8;
        if (e.screened && e !== sq.focus) s *= 2.5; // hidden behind the escort's shields
      }
      return s;
    });
  }

  rangeOf(u: Unit) {
    let r = u.def.range * T;
    if (u.elev) r *= 1.25;
    if (u.def.id === 'd_ballista' && this.grid.tiles[tileAt(u.x, u.y)] === Tile.TOWER) r *= 1.1;
    return r;
  }

  combatAI(u: Unit, sq: Squad) {
    const ranged = u.def.range > 0 && u.ammo > 0;
    if (u.retarget <= 0 || !this.validTarget(u, u.target)) {
      u.target = ranged ? this.pickRangedTarget(u, sq) : this.pickMeleeTarget(u, sq);
      u.retarget = 0.25 + this.rng.next() * 0.2;
      if (u.target && !ranged && !this.canDefMelee(u, u.target)) u.target = null;
    }
    const t = u.target;
    if (ranged) {
      if (t && this.validTarget(u, t)) {
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        if (d <= this.rangeOf(u) * 1.05) {
          u.fx = (t.x - u.x) / (d || 1);
          u.fy = (t.y - u.y) / (d || 1);
          if (u.cd <= 0) this.shoot(u, t);
          if (Math.hypot(u.slotX - u.x, u.slotY - u.y) > 4) this.moveToSlot(u);
          return;
        }
      }
      // melee fallback when enemies are right on top of an archer
      const close = this.eHash.best(u.x, u.y, u.def.r + 10, (e) => (this.canDefMelee(u, e) ? 0 : Infinity));
      if (close) {
        this.meleeHit(u, close, 0.5);
        return;
      }
      this.moveToSlot(u);
      return;
    }
    if (t && this.validTarget(u, t)) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      const reach = u.def.r + t.def.r + u.def.reach + 1;
      const tooFar = Math.hypot(t.x - u.slotX, t.y - u.slotY) > this.leash(sq) + 2.5 * T && t !== sq.focus && sq.stance !== 'aggressive';
      if (d <= reach || (t.state === ST.CLIMB && d <= reach + 8)) {
        u.fx = (t.x - u.x) / (d || 1);
        u.fy = (t.y - u.y) / (d || 1);
        this.meleeHit(u, t, u.def.range > 0 ? 0.5 : 1);
        u.moveT = 0;
        return;
      }
      if (!tooFar) {
        if (t.state === ST.CLIMB) this.moveToward(u, cx(t.actTile), cy(t.actTile));
        else this.moveToward(u, t.x, t.y);
        return;
      }
      u.target = null;
    }
    // push ladders off the wall
    if (u.elev) {
      let best: Ladder | null = null;
      let bd = 1.7 * T;
      for (const l of this.ladders) {
        if (l.tower) continue;
        const d = Math.hypot(cx(l.tile) - u.x, cy(l.tile) - u.y);
        if (d < bd) {
          bd = d;
          best = l;
        }
      }
      if (best) {
        if (bd > 0.55 * T) this.moveToward(u, cx(best.tile), cy(best.tile));
        else if (u.cd <= 0) {
          u.cd = u.def.cd;
          best.hp -= u.def.atk * u.atkMul * 1.4;
          if (best.hp <= 0) this.removeLadder(best, true);
        }
        return;
      }
    }
    this.moveToSlot(u);
  }

  meleeHit(u: Unit, t: Unit, mul: number) {
    if (u.cd > 0) return;
    u.cd = u.def.cd * this.rng.range(0.9, 1.1);
    let dmg = u.def.atk * u.atkMul * mul * this.moraleMul(u.squad);
    if (u.hp < u.maxHp * 0.35) dmg *= 0.75;
    if (t.state === ST.CLIMB) dmg *= 1.6;
    // striking down from the wall walk is awkward, except stones dropped on a miner's mantlet at the wall foot
    if (u.elev && !t.elev && !t.def.flying) dmg *= t.act === ACT.DIG ? SAPPER_STONES : 0.6;
    if (t.def.cavalry && u.def.antiCav) dmg *= u.def.antiCav;
    if (u.def.cavalry && u.moveT > 0.8) {
      dmg *= 1.9;
      this.fx.push({ k: 'charge', x: t.x, y: t.y });
    }
    u.moveT = 0;
    this.damage(t, dmg, u.def.ap ?? 0, u, false);
    if (this.rng.chance(0.3)) this.fx.push({ k: 'clash', x: (u.x + t.x) / 2, y: (u.y + t.y) / 2 });
  }

  shoot(u: Unit, t: Unit) {
    const sq = u.squad;
    u.ammo -= 1;
    this.shotsWave += u.def.id === 'd_ballista' ? 4 : 1;
    u.cd = u.def.cd * this.rng.range(0.9, 1.15) * (sq && sq.morale < 40 ? 1.2 : 1);
    const d = Math.hypot(t.x - u.x, t.y - u.y);
    const range = this.rangeOf(u);
    let acc = u.def.id === 'd_ballista' ? (t.def.big ? 0.92 : 0.45) : u.def.id === 'd_xbow' ? 0.82 : 0.76;
    acc *= 1 - 0.3 * (d / range);
    if (sq && sq.morale < 40) acc *= 0.8;
    if (t.def.big) acc = Math.min(0.97, acc * 1.3);
    if (t.state === ST.CLIMB) acc *= 1.1;
    if (t.screened && !t.def.big) acc *= 0.55;
    const hit = this.rng.chance(acc);
    const dmg = u.def.atk * u.rangedMul * this.moraleMul(sq);
    this.launch(u, t, hit, dmg, u.def.ap ?? 0, u.def.proj ?? 'arrow');
  }

  launch(src: Unit, t: Unit, hit: boolean, dmg: number, ap: number, kind: Projectile['kind']) {
    const speed = kind === 'bolt' ? 420 : kind === 'javelin' ? 260 : kind === 'fire' ? 220 : 320;
    const lead = 0.25;
    let txp = t.x + (t.x - t.px) * 30 * lead;
    let typ = t.y + (t.y - t.py) * 30 * lead;
    if (!hit) {
      txp += this.rng.range(-10, 10);
      typ += this.rng.range(-10, 10);
    }
    const d = Math.hypot(txp - src.x, typ - src.y);
    this.projectiles.push({
      x: src.x,
      y: src.y,
      sx: src.x,
      sy: src.y,
      tx: txp,
      ty: typ,
      t: 0,
      dur: Math.max(0.08, d / speed),
      target: hit ? t : null,
      side: src.side,
      dmg,
      ap,
      kind,
      structTile: -1,
      area: false,
      src,
      keep: false,
    });
    this.fx.push({ k: 'shot', x: src.x, y: src.y, c: kind });
  }

  engineerAI(u: Unit, sq: Squad): boolean {
    const g = this.grid;
    const close = this.eHash.best(u.x, u.y, 1.4 * T, (e) => (this.canDefMelee(u, e) && !e.fleeing ? 0 : Infinity));
    if (close) return false; // fight back
    const tt = sq.taskTile;
    if (tt < 0) return false;
    const wx = cx(tt) + ((u.id % 5) - 2) * 2.5;
    const wy = cy(tt) + ((u.id % 3) - 1) * 3;
    const d = Math.hypot(wx - u.x, wy - u.y);
    // a barred gate is mended from behind it (the crew cannot stand in the gateway)
    const barred = g.tiles[tt] === Tile.GATE && g.gateShut[tt] === 1;
    if (d > (barred ? 1.6 : 0.9) * T) {
      if (this.walkTo(u, tt, wx, wy)) return true;
      return true;
    }
    const kind = sq.taskKind;
    const work = 1 + 0.1 * (this.up.masonry ?? 0);
    if (kind === 4) {
      this.fire[tt] = Math.max(0, this.fire[tt] - 2.2 * DT * work);
      if (this.rng.chance(0.05)) this.fx.push({ k: 'steam', x: cx(tt), y: cy(tt) });
    } else if (kind === 1) {
      if (this.supplies.mats <= 0) {
        this.alert('nomats', '자재가 부족해 수리할 수 없습니다.', 'warn');
        return false;
      }
      const amt = 9 * DT * work;
      g.hp[tt] = Math.min(g.maxHp[tt], g.hp[tt] + amt);
      this.supplies.mats = Math.max(0, this.supplies.mats - amt / 22);
      if (this.rng.chance(0.04)) this.fx.push({ k: 'repair', x: cx(tt), y: cy(tt) });
    } else if (kind === 2 || kind === 3) {
      if (!g.wallLine[tt]) {
        // only the castle's own wall line can be rebuilt (never decorative field rubble)
        sq.taskTile = -1;
        return false;
      }
      const need = kind === 2 ? 40 : 60;
      if (this.supplies.mats < need) {
        this.alert('nomats', '자재가 부족해 재건할 수 없습니다.', 'warn');
        return false;
      }
      sq.rebuild += DT * work;
      if (this.rng.chance(0.05)) this.fx.push({ k: 'repair', x: cx(tt), y: cy(tt) });
      const workNeeded = kind === 2 ? 30 : 45; // engineer-seconds
      if (sq.rebuild >= workNeeded) {
        const blocked = this.activeEnemies.some((e) => tileAt(e.x, e.y) === tt);
        if (!blocked) {
          this.supplies.mats -= need;
          g.tiles[tt] = kind === 2 ? Tile.GATE : Tile.WALL;
          // the same strength as the castle's own walls this battle (research and daily mods alike)
          g.maxHp[tt] = TILE_INFO[g.tiles[tt]].maxHp * this.structHpMul;
          if (kind === 2) this.gateBoosted.delete(tt); // a new gate: the council may strengthen it again
          g.hp[tt] = g.maxHp[tt] * 0.35;
          g.refreshStructs();
          this.fieldsDirty = true;
          this.dirtyTiles.push(tt);
          this.event('rebuilt', kind === 2 ? '공병대가 성문을 다시 세웠습니다.' : '공병대가 무너진 성벽을 메웠습니다.', 'good', cx(tt), cy(tt));
          for (const d2 of this.activeDefs) if (tileAt(d2.x, d2.y) === tt) d2.elev = g.isElev(tt);
        }
        sq.rebuild = 0;
        sq.taskTile = -1;
      }
    }
    return true;
  }

  /** Defender walk to a tile using a cached per-unit approach (squad field if same, else direct). */
  walkTo(u: Unit, tile: number, gx: number, gy: number): boolean {
    const sq = u.squad!;
    const g = this.grid;
    if (!sq.tfield) sq.tfield = newField();
    if (sq.tfieldTile !== tile || this.fieldsDirty) {
      sq.tfieldTile = tile;
      const goals = [tile];
      if (g.tiles[tile] === Tile.GATE && g.gateShut[tile])
        for (let k = 0; k < 4; k++) {
          const x = tx(tile) + N8[k][0];
          const y = ty(tile) + N8[k][1];
          if (inb(x, y) && g.inside[idx(x, y)]) goals.push(idx(x, y));
        }
      g.defenderField(goals, sq.tfield);
    }
    return this.walkField(u, sq.tfield, gx, gy);
  }

  surgeonAI(u: Unit): boolean {
    const g = this.grid;
    if (u.carry) {
      const p = u.carry;
      const target = g.infirmaries.length ? g.infirmaries[0] : tileAt(g.keepX - 2 * T, g.keepY);
      const gx = cx(target);
      const gy = cy(target);
      if (Math.hypot(gx - u.x, gy - u.y) < 7) {
        u.carry = null;
        p.carrier = null;
        p.claimedBy = null;
        if (this.supplies.meds >= 1) {
          this.supplies.meds -= 1;
          p.state = ST.EVAC;
          this.stats.evacuated++;
          this.fx.push({ k: 'heal', x: gx, y: gy });
        } else if (this.rng.chance(0.5)) {
          p.state = ST.EVAC;
          this.stats.evacuated++;
          this.alert('nomeds', '의약품이 없어 치료가 어렵습니다.', 'warn');
        } else {
          this.killDef(p);
          this.alert('nomeds', '의약품이 없어 치료가 어렵습니다.', 'warn');
        }
        return true;
      }
      this.walkField(u, this.infirmField, gx, gy, 0.85);
      return true;
    }
    const danger = this.eHash.best(u.x, u.y, 2 * T, (e) => (!e.fleeing && this.canDefMelee(u, e) ? 0 : Infinity));
    if (danger) {
      const t2 = g.infirmaries.length ? g.infirmaries[0] : tileAt(g.keepX - 2 * T, g.keepY);
      this.walkField(u, this.infirmField, cx(t2), cy(t2));
      return true;
    }
    // claimed patient?
    let p: Unit | null = null;
    for (const d of this.downed) if (d.claimedBy === u) p = d;
    if (!p) {
      let bd = 22 * T;
      for (const d of this.downed) {
        if (d.claimedBy && d.claimedBy.state === ST.ACTIVE) continue;
        const dt = tileAt(d.x, d.y);
        if (!g.inside[dt] && !g.isBoundary(dt)) continue;
        const dd = Math.hypot(d.x - u.x, d.y - u.y);
        if (dd >= bd) continue;
        if (this.eHash.best(d.x, d.y, 1.6 * T, (e) => (!e.fleeing ? 0 : Infinity))) continue;
        bd = dd;
        p = d;
      }
      if (p) p.claimedBy = u;
    }
    if (p) {
      const d = Math.hypot(p.x - u.x, p.y - u.y);
      if (d < 5) {
        u.timer += DT;
        if (u.timer > 0.7) {
          u.timer = 0;
          p.state = ST.CARRIED;
          p.carrier = u;
          u.carry = p;
        }
      } else {
        u.timer = 0;
        this.moveToward(u, p.x, p.y);
      }
      return true;
    }
    // heal the wounded in the field
    if (this.supplies.meds > 0.2) {
      const w = this.dHash.best(u.x, u.y, 8 * T, (o, d2) => (o !== u && o.hp < o.maxHp * 0.55 ? d2 : Infinity));
      if (w) {
        const d = Math.hypot(w.x - u.x, w.y - u.y);
        if (d < u.def.r + w.def.r + 4) {
          const amt = 14 * DT;
          w.hp = Math.min(w.maxHp, w.hp + amt);
          this.supplies.meds -= amt / 90;
          if (this.rng.chance(0.05)) this.fx.push({ k: 'heal', x: w.x, y: w.y });
        } else this.moveToward(u, w.x, w.y);
        return true;
      }
    }
    this.moveToSlot(u);
    return true;
  }

  killDef(u: Unit) {
    if (u.state === ST.DEAD) return;
    if (u.carrier) {
      u.carrier.carry = null;
      u.carrier = null;
    }
    if (u.carry) {
      u.carry.state = ST.DOWN;
      u.carry.carrier = null;
      u.carry = null;
    }
    u.state = ST.DEAD;
    this.stats.dead++;
    this.fx.push({ k: 'corpse', x: u.x, y: u.y, c: u.def.color, a: u.fireDeath ? 1 : 0 });
  }

  downDef(u: Unit, heavy: boolean) {
    const sq = u.squad!;
    const med = this.up.medicine ?? 0;
    let p = (heavy ? 0.5 : 0.28) - med * 0.05;
    if (u.fireDeath) p += 0.15;
    if (u.elev) p += 0.05;
    p = Math.max(0.05, Math.min(0.9, p));
    this.stats.downed++;
    if (u.carry) {
      u.carry.state = ST.DOWN;
      u.carry.carrier = null;
      u.carry = null;
    }
    const resist = 1 - 0.06 * sq.rank;
    sq.morale = Math.max(0, sq.morale - (52 / Math.max(4, sq.size)) * resist);
    for (const o of this.squads)
      if (o !== sq && o.alive && Math.hypot(o.cx - u.x, o.cy - u.y) < 5 * T) o.morale = Math.max(0, o.morale - 1.2 * (1 - 0.06 * o.rank));
    if (this.rng.chance(p)) {
      this.killDef(u);
    } else {
      u.state = ST.DOWN;
      u.hp = 0;
      u.downT = 30 + med * 6;
      u.target = null;
      this.fx.push({ k: 'down', x: u.x, y: u.y });
    }
  }

  // ======================================================================
  // enemies
  // ======================================================================

  fieldFor(e: Unit): Field {
    const r = e.def.role;
    if (r === 'ram') {
      const i = tileAt(e.x, e.y);
      if (isFinite(this.fields.ram.dist[i])) return this.fields.ram;
      return this.fields.breach;
    }
    if (r === 'ladder' && e.act !== ACT.DONE_LADDER) return this.fields.escalade;
    if (r === 'tower' || r === 'sapper') return this.fields.escalade;
    return this.fields[e.band!.field];
  }

  updateEnemy(e: Unit, dt: number) {
    if (e.state === ST.CLIMB) {
      this.updateClimb(e, dt);
      return;
    }
    if (e.state !== ST.ACTIVE) return;
    e.cd -= dt;
    e.retarget -= dt;
    if (e.def.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * dt);
    const role = e.def.role;
    if (e.crew > 0 && !e.fleeing) {
      // engines answer to their own crew, not to the escort band: they leave only when wrecked or shattered
      e.crew = Math.min(100, e.crew + 0.6 * dt);
      if (e.hp < e.maxHp * 0.25 || e.crew < 20) this.engineRetreat(e);
    }
    if (role === 'dragon' || role === 'flyer') {
      this.flyerAI(e, dt);
      return;
    }
    if (e.fleeing) {
      this.fleeOff(e);
      return;
    }
    if (e.act === ACT.PLANT || e.act === ACT.DIG || e.act === ACT.DOCKED) {
      this.enemyAction(e, dt);
      return;
    }
    if (role === 'treb') {
      this.trebAI(e);
      return;
    }
    if (role === 'healer') {
      const w = this.eHash.best(e.x, e.y, 3 * T, (o, d2) => (o !== e && o.hp < o.maxHp * 0.9 && !o.def.big ? d2 + o.hp : Infinity));
      if (w) {
        w.hp = Math.min(w.maxHp, w.hp + (e.def.heal ?? 0) * dt);
        if (this.rng.chance(0.03)) this.fx.push({ k: 'eheal', x: w.x, y: w.y });
      }
    }
    const ranged = e.def.range > 0 && e.ammo >= 1;
    const noFight = role === 'ram' || role === 'tower';
    const assault = !!e.band && e.band.assault;
    const convoy = e.escortIdx >= 0 && e.band && e.band.convoy ? e.band : null;
    if (!noFight && (e.retarget <= 0 || (e.target && e.target.state !== ST.ACTIVE))) {
      e.retarget = 0.35 + this.rng.next() * 0.25;
      e.target = ranged ? this.enemyRangedTarget(e) : this.enemyMeleeTarget(e);
    }
    const t = e.target;
    if (t && t.state === ST.ACTIVE && !noFight) {
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (ranged) {
        if (e.def.kite && !assault) {
          const threat = this.dHash.best(e.x, e.y, 2.6 * T, (o) => (o.def.range === 0 && o.elev === e.elev ? 0 : Infinity));
          if (threat) {
            const ax = e.x - threat.x;
            const ay = e.y - threat.y;
            const m = Math.hypot(ax, ay) || 1;
            this.moveToward(e, e.x + (ax / m) * 20, e.y + (ay / m) * 20, 1);
            return;
          }
        }
        if (d <= e.def.range * T) {
          e.fx = (t.x - e.x) / (d || 1);
          e.fy = (t.y - e.y) / (d || 1);
          if (e.cd <= 0) this.enemyShoot(e, t);
          if (!assault) return; // storming: shoot on the move
        }
      } else {
        const up = t.elev && !e.elev && e.def.role !== 'giant';
        if (up && !this.reachesWallTop(e, t)) {
          // a wall-top defender is only reachable from right beside the wall, inside the castle
          e.target = null;
        }
        const reach = e.def.r + t.def.r + e.def.reach + (up ? WALLTOP_REACH : 1);
        if (e.target && d <= reach) {
          e.fx = (t.x - e.x) / (d || 1);
          e.fy = (t.y - e.y) / (d || 1);
          if (e.cd <= 0) {
            e.cd = e.def.cd * this.rng.range(0.9, 1.1);
            let dmg = e.def.atk * e.atkMul;
            if (e.elev && !t.elev) dmg *= 0.8;
            if (up) dmg *= WALLTOP_HIT_MUL; // striking up at the wall walk
            if (e.def.cavalry && e.moveT > 0.8) dmg *= 1.8;
            if (t.def.cavalry && e.def.antiCav) dmg *= e.def.antiCav;
            if (e.band && e.band.broken) dmg *= 0.8;
            e.moveT = 0;
            this.damage(t, dmg, e.def.ap ?? 0, e, false);
            if (this.rng.chance(0.3)) this.fx.push({ k: 'clash', x: (e.x + t.x) / 2, y: (e.y + t.y) / 2 });
            if (e.def.role === 'giant') this.fx.push({ k: 'thud', x: t.x, y: t.y });
          }
          return;
        }
        if (e.target && d < 3.5 * T && !(convoy && Math.hypot(t.x - convoy.ax, t.y - convoy.ay) > 5 * T)) {
          this.moveToward(e, t.x, t.y);
          return;
        }
      }
    }
    if (convoy) {
      // escort: keep the screen around the engine / sappers, at their pace
      const [sx, sy] = this.convoySlot(e, convoy);
      this.moveToward(e, sx, sy);
      return;
    }
    // advance along the path field
    const f = this.fieldFor(e);
    const i = tileAt(e.x, e.y);
    if (this.grid.keepAdj[i]) {
      this.attackKeep(e);
      return;
    }
    const n = f.next[i];
    if (n < 0) {
      this.moveToward(e, this.grid.keepX, this.grid.keepY);
      return;
    }
    if (role === 'tower' && this.grid.wallLine[n] && !this.grid.isStruct(n) && this.towerBesideBreach(e, n)) return;
    const inf = TILE_INFO[this.grid.tiles[n]];
    if (inf.struct && !(e.elev && inf.elev)) {
      const d = Math.hypot(cx(n) - e.x, cy(n) - e.y);
      if (d > T * 0.5 + e.def.r + 2.5 + (e.def.big ? 2 : 0)) {
        this.moveToward(e, cx(n), cy(n));
        if (Math.hypot(e.x - e.px, e.y - e.py) < 0.05) this.handleObstacle(e, n); // blocked against it
        return;
      }
      this.handleObstacle(e, n);
      return;
    }
    const j = ((e.id * 7919) % 9) - 4;
    const k = ((e.id * 104729) % 9) - 4;
    // screened sappers walk a little slower than their shield escort so the screen stays in front
    const b = e.band;
    const mul = role === 'sapper' && b && b.convoy ? Math.min(1, ((b.formed ? 0.85 : 0.35) * b.pace) / (e.def.speed * T)) : 1;
    this.moveToward(e, cx(n) + j * 1.1, cy(n) + k * 1.1, mul);
  }

  /**
   * A fleeing ground enemy leaves the map by the way out (exit field): out of the courtyard through the
   * breach or gate it came in by, round the walls, off the nearest edge. From a wall top it drops down.
   */
  fleeOff(e: Unit) {
    const i = tileAt(e.x, e.y);
    let gx = e.spawnX;
    let gy = e.spawnY;
    if (this.exitDirty) {
      this.exitDirty = false;
      this.grid.exitField(this.exitField);
    }
    const f = this.exitField;
    if (e.elev) {
      // on the wall walk: climb down on whichever side has the shorter way out
      let best = -1;
      let bd = Infinity;
      for (const [dx, dy] of N8) {
        const x = tx(i) + dx;
        const y = ty(i) + dy;
        if (!inb(x, y)) continue;
        const j = idx(x, y);
        if (f.dist[j] < bd) {
          bd = f.dist[j];
          best = j;
        }
      }
      if (best >= 0) {
        gx = cx(best);
        gy = cy(best);
      }
    } else {
      const n = f.next[i];
      if (!isFinite(f.dist[i])) {
        // trapped inside with no way out on foot (gates shut, no breach): a cornered man fights on,
        // an abandoned engine just stands there
        if (!isEngine(e)) e.fleeing = false;
        return;
      }
      if (n >= 0) {
        gx = cx(n) + (((e.id * 7919) % 5) - 2) * 1.5;
        gy = cy(n) + (((e.id * 104729) % 5) - 2) * 1.5;
      } else if (f.dist[i] === 0) {
        // on the border: straight off the nearest edge
        const x = tx(i);
        const y = ty(i);
        const d = [x, GW - 1 - x, y, GH - 1 - y];
        const k = d.indexOf(Math.min(...d));
        gx = k === 0 ? -20 : k === 1 ? WORLD_W + 20 : e.x;
        gy = k === 2 ? -20 : k === 3 ? WORLD_H + 20 : e.y;
      }
    }
    this.moveToward(e, gx, gy, 1.05);
    if (e.x < 3 || e.y < 3 || e.y > WORLD_H - 3 || e.x > WORLD_W - 3) {
      e.state = ST.FLED;
      this.stats.routed++;
    }
  }

  /** A siege tower reaching a breach docks against the intact wall beside it rather than rolling inside. */
  towerBesideBreach(e: Unit, n: number): boolean {
    const g = this.grid;
    let best = -1;
    let bd = Infinity;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = tx(n) + dx;
        const y = ty(n) + dy;
        if (!inb(x, y)) continue;
        const j = idx(x, y);
        if (g.tiles[j] !== Tile.WALL || this.ladders.some((l) => l.tile === j && l.tower)) continue;
        const d = Math.hypot(cx(j) - e.x, cy(j) - e.y);
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
    if (best < 0) return false;
    if (bd > T * 0.5 + e.def.r + 4.5) {
      this.moveToward(e, cx(best), cy(best));
      if (Math.hypot(e.x - e.px, e.y - e.py) < 0.05) this.handleObstacle(e, best);
    } else this.handleObstacle(e, best);
    return true;
  }

  /** An enemy on the ground inside the walls (courtyard or breach) can reach defenders on the wall top beside it. */
  reachesWallTop(e: Unit, d: Unit): boolean {
    if (e.elev || !d.elev) return false;
    const g = this.grid;
    const et = tileAt(e.x, e.y);
    if (g.inside[et] !== 1 && !g.isBoundary(et)) return false;
    return Math.hypot(d.x - e.x, d.y - e.y) <= e.def.r + d.def.r + e.def.reach + WALLTOP_REACH;
  }

  enemyMeleeTarget(e: Unit): Unit | null {
    const R = e.def.role === 'ladder' || e.def.role === 'sapper' ? 1.1 * T : e.def.role === 'giant' ? 2 * T : 2.6 * T;
    const giant = e.def.role === 'giant';
    return this.dHash.best(e.x, e.y, R, (d, d2) => {
      if (d.elev && !e.elev && !giant) return this.reachesWallTop(e, d) ? d2 * 1.6 : Infinity;
      if (!d.elev && !e.elev && this.blockedBetween(e.x, e.y, d.x, d.y)) return Infinity;
      return d2;
    });
  }

  enemyRangedTarget(e: Unit): Unit | null {
    const R = e.def.range * T;
    return this.dHash.best(e.x, e.y, R, (d, d2) => d2 * (d.elev ? 1.15 : 1) * (d.def.range > 0 ? 0.8 : 1) * (!d.elev && !e.elev && this.blockedBetween(e.x, e.y, d.x, d.y) ? 4 : 1));
  }

  enemyShoot(e: Unit, t: Unit) {
    e.cd = e.def.cd * this.rng.range(0.9, 1.2);
    e.ammo -= 1;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    let acc = e.def.proj === 'bolt' ? 0.78 : 0.7;
    acc *= 1 - 0.3 * (d / (e.def.range * T));
    const blocked = !t.elev && !e.elev && this.blockedBetween(e.x, e.y, t.x, t.y);
    if (t.elev && !e.elev) acc *= 0.45; // merlons
    else if (blocked) acc *= 0.12; // plunging fire over the wall, mostly wasted
    if (t.def.rangedResist && t.def.rangedResist < 1) acc *= 0.9;
    const hit = this.rng.chance(acc);
    this.launch(e, t, hit, e.def.atk * e.atkMul * (t.elev && !e.elev ? 0.8 : 1), e.def.ap ?? 0, e.def.proj ?? 'arrow');
    if (blocked) this.projectiles[this.projectiles.length - 1].blocked = true;
  }

  structDamageOf(e: Unit) {
    if (e.def.role === 'ram') return (e.def.sdmg ?? 60) * e.atkMul;
    return e.def.atk * e.atkMul * (e.def.sdmg ?? 0.4);
  }

  handleObstacle(e: Unit, n: number) {
    const g = this.grid;
    const t = g.tiles[n];
    const role = e.def.role;
    if (role === 'ladder' && e.act !== ACT.DONE_LADDER && t === Tile.WALL && !this.ladderAt(n)) {
      e.act = ACT.PLANT;
      e.timer = 2.0;
      e.actTile = n;
      return;
    }
    if (role === 'sapper' && (t === Tile.WALL || t === Tile.TOWER)) {
      e.act = ACT.DIG;
      e.timer = Math.max(0.5, SAPPER_DIG_T - this.mineProg[n]);
      e.actTile = n;
      this.alert('sapper' + n, '갱도병이 성벽 밑을 파고 있습니다!', 'danger', cx(n), cy(n));
      return;
    }
    if (role === 'tower') {
      if (t === Tile.WALL && !this.ladders.some((l) => l.tile === n && l.tower)) {
        e.act = ACT.DOCKED;
        e.actTile = n;
        this.addLadder(n, e.x, e.y, e);
        this.alert('tower' + n, '공성탑이 성벽에 붙었습니다!', 'danger', cx(n), cy(n));
      }
      return;
    }
    const lad = this.ladderAt(n);
    if (lad && role !== 'giant' && role !== 'ram' && (t === Tile.WALL || t === Tile.TOWER)) {
      const cap = lad.tower ? 4 : 2;
      if (lad.climbing < cap) {
        lad.climbing++;
        e.state = ST.CLIMB;
        e.timer = lad.tower ? 0.6 : 1.6;
        e.actTile = n;
        e.target = null;
      }
      return;
    }
    if (role === 'ram' && e.band) this.endConvoy(e.band); // at the gate: escorts join the assault
    if (role === 'ranged' && e.ammo < 1 && e.band && !e.band.broken && this.bandShotOut(e.band)) {
      this.bandSpent(e.band);
      return;
    }
    if (e.band) e.band.contactT = this.t;
    if (e.cd <= 0) {
      e.cd = e.def.cd * this.rng.range(0.9, 1.1);
      let dmg = this.structDamageOf(e);
      if (role === 'ram' && t !== Tile.GATE) dmg *= 0.55;
      this.damageStruct(n, dmg);
      if (role === 'ram' || role === 'giant') this.fx.push({ k: 'thud', x: cx(n), y: cy(n) });
      else if (this.rng.chance(0.25)) this.fx.push({ k: 'chip', x: cx(n), y: cy(n) });
    }
  }

  enemyAction(e: Unit, dt: number) {
    const g = this.grid;
    const n = e.actTile;
    // planting a ladder or digging a mine is progress; a docked tower is only progress while men climb it
    // (updateClimb), so a tower left alone at the wall cannot hold its band in the fight for ever
    if (e.band && e.act !== ACT.DOCKED) e.band.contactT = this.t;
    if (e.act === ACT.PLANT) {
      if (g.tiles[n] !== Tile.WALL || this.ladderAt(n)) {
        e.act = ACT.DONE_LADDER;
        return;
      }
      e.timer -= dt;
      if (e.timer <= 0) {
        this.addLadder(n, e.x, e.y, null);
        e.act = ACT.DONE_LADDER;
        this.alert('ladder' + n, '적이 성벽에 사다리를 걸었습니다!', 'warn', cx(n), cy(n));
      }
      return;
    }
    if (e.act === ACT.DIG) {
      if (!(g.tiles[n] === Tile.WALL || g.tiles[n] === Tile.TOWER)) {
        e.act = ACT.NONE;
        return;
      }
      // one tunnel per wall tile: a second miner at the same spot is a relief, not twice the speed
      if (this.mineT[n] !== this.t) {
        this.mineT[n] = this.t;
        this.mineProg[n] += dt;
      }
      e.timer = Math.max(0, SAPPER_DIG_T - this.mineProg[n]);
      if (this.rng.chance(0.08)) this.fx.push({ k: 'dust', x: e.x, y: e.y });
      if (e.timer <= 0) {
        e.act = ACT.NONE;
        if (e.band) this.endConvoy(e.band); // breach blown: everyone rushes it
        this.destroyStruct(n, 'sapped');
        // collapse an adjacent wall tile too
        for (let d = 0; d < 4; d++) {
          const x = tx(n) + N8[d][0];
          const y = ty(n) + N8[d][1];
          if (inb(x, y) && g.tiles[idx(x, y)] === Tile.WALL) {
            this.destroyStruct(idx(x, y), 'sapped');
            break;
          }
        }
        this.damage(e, 60, 1, null, false);
      }
      return;
    }
    if (e.act === ACT.DOCKED) {
      if (!this.ladderAt(n)) e.act = ACT.NONE;
    }
  }

  updateClimb(e: Unit, dt: number) {
    if (e.band) e.band.contactT = this.t;
    const lad = this.ladderAt(e.actTile);
    if (!lad) {
      // ladder pushed or tower destroyed: he falls to the foot of the wall, on the outside
      e.state = ST.ACTIVE;
      e.elev = false;
      const g = this.grid;
      const here = tileAt(e.x, e.y);
      const foot = g.nearestTile(here, (k) => g.openGround(k) && !g.inside[k], 3);
      if (foot >= 0 && foot !== here) {
        e.x = cx(foot);
        e.y = cy(foot);
      }
      this.damage(e, 25, 1, null, false);
      return;
    }
    e.timer -= dt;
    const tgtx = cx(e.actTile);
    const tgty = cy(e.actTile);
    e.x += (tgtx - e.x) * Math.min(1, dt * 1.2);
    e.y += (tgty - e.y) * Math.min(1, dt * 1.2);
    if (e.timer <= 0) {
      lad.climbing = Math.max(0, lad.climbing - 1);
      e.state = ST.ACTIVE;
      e.x = tgtx + this.rng.range(-3, 3);
      e.y = tgty + this.rng.range(-3, 3);
      e.elev = true;
    }
  }

  attackKeep(e: Unit) {
    if (e.band) e.band.contactT = this.t;
    if (e.cd > 0) return;
    e.cd = e.def.cd * this.rng.range(0.9, 1.1);
    const dmg = e.def.role === 'ram' ? (e.def.sdmg ?? 60) * 0.6 * e.atkMul : e.def.atk * e.atkMul * Math.max(0.5, e.def.sdmg ?? 0.5) * 0.6;
    const fresh = this.t - this.lastKeepHit > 20;
    this.lastKeepHit = this.t;
    this.keepHp -= dmg * this.keepPressMul();
    if (this.rng.chance(0.2)) this.fx.push({ k: 'chip', x: e.x, y: e.y });
    this.keepAlert(fresh);
    if (this.keepHp <= 0) {
      this.keepHp = 0;
      this.finish(false);
    }
  }

  /** damage multiplier of a keep assault that has gone on for a while (they are breaking in) */
  keepPressMul() {
    return 1 + Math.min(KEEP_PRESS_MAX, this.keepPress / KEEP_PRESS_T);
  }

  /**
   * '본성이 공격받고 있습니다!' when an assault on the keep starts (`fresh`: first blow after a lull), then
   * once per further 10% of the keep lost while it goes on.
   */
  keepAlert(fresh: boolean) {
    const lost = this.keepAlertHp - this.keepHp >= this.keepMax * 0.1;
    if (!(fresh || lost) || this.t - this.lastKeepAlert < 6) return;
    this.lastKeepAlert = this.t;
    this.keepAlertHp = this.keepHp;
    const pct = Math.round((100 * this.keepHp) / this.keepMax);
    this.event('keep', fresh ? '본성이 공격받고 있습니다!' : `본성이 공격받고 있습니다! (남은 내구도 ${pct}%)`, 'danger', this.grid.keepX, this.grid.keepY);
  }

  trebAI(e: Unit) {
    const g = this.grid;
    const R = e.def.range * T;
    if (e.act !== ACT.SET) {
      if (e.retarget <= 0) {
        e.retarget = 1;
        let found = -1;
        let bd = R;
        for (const s of g.structTiles) {
          const d = Math.hypot(cx(s) - e.x, cy(s) - e.y);
          if (d < bd) {
            bd = d;
            found = s;
          }
        }
        if (found >= 0) {
          e.act = ACT.SET;
          e.actTile = found;
          return;
        }
      }
      const f = this.fields.breach;
      const n = f.next[tileAt(e.x, e.y)];
      if (n >= 0 && !TILE_INFO[g.tiles[n]].struct) this.moveToward(e, cx(n), cy(n));
      return;
    }
    if (e.cd > 0) return;
    if (e.ammo < 1) {
      this.engineRetreat(e); // out of stones: nothing left to do here
      return;
    }
    e.cd = e.def.cd * this.rng.range(0.9, 1.1);
    // choose a structure in range, prefer gates and damaged walls near the current aim
    let best = -1;
    let bs = Infinity;
    for (const s of g.structTiles) {
      const d = Math.hypot(cx(s) - e.x, cy(s) - e.y);
      if (d > R) continue;
      let sc = d + this.rng.range(0, 3 * T);
      if (g.tiles[s] === Tile.GATE) sc -= 3 * T;
      if (g.tiles[s] === Tile.TOWER) sc += 4 * T;
      sc -= (1 - g.hp[s] / g.maxHp[s]) * 4 * T;
      if (sc < bs) {
        bs = sc;
        best = s;
      }
    }
    let keep = false;
    if (best < 0) {
      if (Math.hypot(g.keepX - e.x, g.keepY - e.y) < R) keep = true;
      else {
        e.act = ACT.NONE;
        return;
      }
    }
    const txp = keep ? g.keepX : cx(best) + this.rng.range(-5, 5);
    const typ = keep ? g.keepY : cy(best) + this.rng.range(-5, 5);
    e.ammo -= 1;
    if (e.band) e.band.contactT = this.t; // a working battery is pressing the siege
    this.projectiles.push({
      x: e.x,
      y: e.y,
      sx: e.x,
      sy: e.y,
      tx: txp,
      ty: typ,
      t: 0,
      dur: 2.3,
      target: null,
      side: 1,
      dmg: TREB_SPLASH_DMG * e.atkMul,
      ap: 0.5,
      kind: 'stone',
      structTile: keep ? -1 : best,
      area: true,
      src: e,
      keep,
    });
    this.fx.push({ k: 'treb', x: e.x, y: e.y });
  }

  flyerAI(e: Unit, dt: number) {
    const g = this.grid;
    const dragon = e.def.role === 'dragon';
    if (dragon && !e.fleeing) {
      e.pain = Math.max(0, e.pain - dt / DRAGON_PAIN_DECAY);
      const hurt = e.hp < e.maxHp * DRAGON_FLEE_HP;
      const harried = e.pain >= DRAGON_PAIN_MAX;
      // its retinue does not matter; only a very long stay with no real wound sends it home sated
      const b = e.band;
      const tired = this.t - e.bornT > DRAGON_MAX_STAY;
      if (hurt || harried || tired) {
        e.fleeing = true;
        const driven = hurt || harried || e.hp <= e.maxHp * 0.8;
        if (driven) {
          this.countDragon(e);
          this.stats.bounty += Math.round(e.def.gold * 0.6);
          this.event('dragonflee', harried && !hurt ? '노포 세례에 고룡이 물러갑니다!' : '고룡이 상처를 입고 물러갑니다!', 'good', e.x, e.y);
        } else this.event('dragonleave', '고룡이 하늘 높이 날아갑니다.', 'warn', e.x, e.y);
        for (const o of this.bands) if (o.tpl.faction === 'wyrm' && o !== b) o.morale -= 45;
        if (b) b.morale -= 60;
      }
    }
    if (e.fleeing) {
      this.moveToward(e, -60, e.y, 1.2);
      if (e.x < -30) {
        e.state = ST.FLED;
        this.stats.routed++;
      }
      return;
    }
    e.fT -= dt;
    if (!dragon) {
      // drake: dive at a defender, strike, pull away
      if (e.fState === 0) {
        if (!e.target || e.target.state !== ST.ACTIVE || e.retarget <= 0) {
          e.retarget = 2;
          e.target = this.dHash.best(e.x, e.y, 40 * T, (d, d2) => d2 * (d.def.range > 0 ? 0.5 : 1));
          if (!e.target) {
            if (this.moveToward(e, g.keepX, g.keepY) || Math.hypot(g.keepX - e.x, g.keepY - e.y) < 2 * T) {
              if (e.cd <= 0) {
                e.cd = e.def.cd;
                if (e.band) e.band.contactT = this.t;
                this.keepHp -= e.def.atk * e.atkMul * 0.6;
                if (this.keepHp <= 0) {
                  this.keepHp = 0;
                  this.finish(false);
                }
              }
            }
            return;
          }
        }
        const t = e.target;
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d <= e.def.r + t.def.r + e.def.reach) {
          if (e.cd <= 0) {
            e.cd = e.def.cd;
            this.damage(t, e.def.atk * e.atkMul, 0.2, e, false);
            e.fState = 1;
            e.fT = 1.6;
            const a = this.rng.range(0, Math.PI * 2);
            e.ftx = Math.max(10, Math.min(WORLD_W - 10, e.x + Math.cos(a) * 6 * T));
            e.fty = Math.max(10, Math.min(WORLD_H - 10, e.y + Math.sin(a) * 6 * T));
          }
        } else this.moveToward(e, t.x, t.y);
      } else {
        this.moveToward(e, e.ftx, e.fty);
        if (e.fT <= 0) e.fState = 0;
      }
      return;
    }
    // dragon: approach -> breathe -> wheel away
    if (e.fState === 0) {
      if (e.retarget <= 0 || e.fT < -6) {
        e.retarget = 2;
        let best: Squad | null = null;
        let bs = -1;
        for (const sq of this.squads) {
          if (sq.alive === 0) continue;
          const sc = sq.alive * (sq.type.ranged ? 1.4 : 1) - Math.hypot(sq.cx - e.x, sq.cy - e.y) / (20 * T);
          if (sc > bs) {
            bs = sc;
            best = sq;
          }
        }
        e.ftx = best ? best.cx : g.keepX;
        e.fty = best ? best.cy : g.keepY;
      }
      const d = Math.hypot(e.ftx - e.x, e.fty - e.y);
      if (d < 4.2 * T) {
        e.fState = 1;
        e.fT = BREATH_T;
        e.fx = (e.ftx - e.x) / (d || 1);
        e.fy = (e.fty - e.y) / (d || 1);
        this.fx.push({ k: 'roar', x: e.x, y: e.y });
      } else this.moveToward(e, e.ftx, e.fty);
    } else if (e.fState === 1) {
      // breathe fire in a cone
      const ang = Math.atan2(e.fy, e.fx);
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = 0.2;
        const L = BREATH_LEN;
        const dmgTick = e.def.atk * e.atkMul * DRAGON_BREATH;
        this.dHash.each(e.x, e.y, L, (d) => {
          const a = Math.atan2(d.y - e.y, d.x - e.x);
          let da = Math.abs(a - ang);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (da < BREATH_HALF) {
            d.fireDeath = true;
            this.damage(d, dmgTick, 0.6, e, false);
            d.fireDeath = false;
          }
        });
        for (let s = 1; s <= 5; s++) {
          const px = e.x + Math.cos(ang + this.rng.range(-0.35, 0.35)) * s * T;
          const py = e.y + Math.sin(ang + this.rng.range(-0.35, 0.35)) * s * T;
          if (px < 0 || py < 0 || px >= WORLD_W || py >= WORLD_H) continue;
          const i = tileAt(px, py);
          this.fire[i] = Math.max(this.fire[i], 4.5);
        }
        this.fx.push({ k: 'breath', x: e.x, y: e.y, a: ang });
        if (Math.hypot(g.keepX - e.x, g.keepY - e.y) < 5 * T) {
          if (e.band) e.band.contactT = this.t;
          this.keepHp -= dmgTick * 1.5;
          if (this.keepHp <= 0) {
            this.keepHp = 0;
            this.finish(false);
          }
        }
      }
      e.x += e.fx * 6 * dt;
      e.y += e.fy * 6 * dt;
      if (e.fT <= 0) {
        e.fState = 2;
        e.fT = 4.5;
        const a = this.rng.range(0, Math.PI * 2);
        e.ftx = Math.max(3 * T, Math.min(WORLD_W - 3 * T, e.x + Math.cos(a) * 10 * T));
        e.fty = Math.max(3 * T, Math.min(WORLD_H - 3 * T, e.y + Math.sin(a) * 10 * T));
      }
    } else {
      this.moveToward(e, e.ftx, e.fty);
      if (e.fT <= 0) {
        e.fState = 0;
        e.fT = 0;
        e.retarget = 0;
      }
    }
  }

  // ======================================================================
  // damage
  // ======================================================================

  damage(t: Unit, dmg: number, ap: number, src: Unit | null, ranged: boolean) {
    if (t.state !== ST.ACTIVE && t.state !== ST.CLIMB) return;
    const armor = Math.min(0.85, t.def.armor + t.armorAdd);
    let eff = dmg * (1 - armor * (1 - ap));
    if (ranged && t.def.rangedResist) eff *= t.def.rangedResist;
    if (ranged && t.screened) eff *= 0.5; // the escort's shields catch half of it
    else if (ranged && t.act === ACT.DIG) eff *= SAPPER_COVER; // a miner at work is under his mantlet
    if (src && src.side === 1 && src.band) src.band.contactT = this.t; // the attackers are making headway
    else if (src && src.side === 0 && !ranged && t.band) t.band.contactT = this.t; // locked in melee
    if (t.side === 0 && t.squad && t.squad.routing) eff *= 1.25;
    if (t.fleeing) eff *= 1.2;
    t.hp -= eff;
    if (t.crew > 0) t.crew = Math.max(0, t.crew - (eff / t.maxHp) * 60);
    if (t.def.role === 'dragon') t.pain += src && src.def.id === 'd_ballista' ? 1 : eff / (t.maxHp * DRAGON_PAIN_DMG);
    t.hitFlash = 0.12;
    if (this.rng.chance(0.25)) this.fx.push({ k: 'blood', x: t.x, y: t.y, a: t.side });
    if (t.hp <= 0) {
      if (t.side === 0) this.downDef(t, eff > t.maxHp * 0.4);
      else this.killEnemy(t, src);
    }
  }

  killEnemy(e: Unit, src: Unit | null) {
    if (e.state === ST.CLIMB) {
      const lad = this.ladderAt(e.actTile);
      if (lad) lad.climbing = Math.max(0, lad.climbing - 1);
    }
    e.state = ST.DEAD;
    this.stats.kills++;
    this.stats.bounty += e.def.gold;
    this.fx.push({ k: 'corpse', x: e.x, y: e.y, c: e.def.color, a: e.def.big ? 2 : 0, b: e.def.r });
    if (src && src.side === 0) {
      src.kills++;
      if (src.squad) {
        src.squad.kills++;
        src.squad.xp += 1 + (e.def.big ? 6 : 0) + (e.def.leader ? 8 : 0);
      }
    }
    const b = e.band;
    if (b) {
      if (!e.def.fearless) b.morale -= 90 / Math.max(6, b.startCount);
      if (e.def.leader) {
        b.morale -= 30;
        this.event('leader', `적 지휘관 ${e.def.name} 격파!`, 'good', e.x, e.y);
        for (const sq of this.squads) if (sq.alive && Math.hypot(sq.cx - e.x, sq.cy - e.y) < 10 * T) sq.morale = Math.min(100, sq.morale + 12);
        for (const o of this.bands) if (o !== b && o.tpl.faction === b.tpl.faction && !o.broken) o.morale -= 8;
      }
    }
    if (e.def.role === 'dragon') {
      this.event('dragonslain', '잿불 고룡을 쓰러뜨렸습니다!', 'good', e.x, e.y);
      this.countDragon(e);
      for (const o of this.bands) if (o.tpl.faction === 'wyrm') o.morale -= 50;
    }
    if (e.def.role === 'tower') {
      const lad = this.ladders.find((l) => l.tower === e);
      if (lad) this.removeLadder(lad, false);
    }
  }

  /** stats.dragons counts each dragon once, whether driven off or slain */
  countDragon(e: Unit) {
    if (this.dragonsCounted.has(e.id)) return;
    this.dragonsCounted.add(e.id);
    this.stats.dragons++;
  }

  damageStruct(i: number, dmg: number) {
    const g = this.grid;
    if (!g.isStruct(i)) return;
    g.hp[i] -= dmg;
    if (g.hp[i] <= 0) this.destroyStruct(i, 'broken');
    else if (g.tiles[i] === Tile.GATE && g.hp[i] < g.maxHp[i] * 0.3) this.alert('gate' + i, '성문이 곧 부서집니다!', 'danger', cx(i), cy(i));
  }

  destroyStruct(i: number, why: string) {
    const g = this.grid;
    const t = g.tiles[i];
    if (!TILE_INFO[t].struct) return;
    g.tiles[i] = t === Tile.GATE ? Tile.GATE_BROKEN : Tile.RUBBLE;
    g.hp[i] = 0;
    this.mineProg[i] = 0;
    g.refreshStructs();
    this.fieldsDirty = true;
    this.dirtyTiles.push(i);
    this.stats.structLost++;
    for (const l of [...this.ladders]) if (l.tile === i) this.removeLadder(l, false);
    for (const u of this.units) {
      if (u.state === ST.ACTIVE && !u.def.flying && tileAt(u.x, u.y) === i) {
        if (u.elev) this.damage(u, 30, 1, null, false);
        u.elev = false;
      }
    }
    this.fx.push({ k: 'collapse', x: cx(i), y: cy(i) });
    const text = t === Tile.GATE ? '성문이 부서졌습니다!' : why === 'sapped' ? '갱도 폭파로 성벽이 무너졌습니다!' : '성벽이 무너졌습니다!';
    this.event('breach', text, 'danger', cx(i), cy(i));
    for (const sq of this.squads) sq.morale = Math.max(0, sq.morale - 5 * (1 - 0.06 * sq.rank));
    for (const b of this.bands) if (!b.broken) b.morale = Math.min(b.tpl.morale + 15, b.morale + 10);
  }

  ladderAt(tile: number): Ladder | null {
    if (!this.grid.ladders[tile]) return null;
    for (const l of this.ladders) if (l.tile === tile) return l;
    return null;
  }

  addLadder(tile: number, bx: number, by: number, tower: Unit | null) {
    this.ladders.push({ tile, hp: tower ? 1e9 : 70, maxHp: 70, bx, by, tower, climbing: 0 });
    this.grid.ladders[tile]++;
    this.fieldsDirty = true;
  }

  removeLadder(l: Ladder, pushed: boolean) {
    const k = this.ladders.indexOf(l);
    if (k < 0) return;
    this.ladders.splice(k, 1);
    this.grid.ladders[l.tile] = Math.max(0, this.grid.ladders[l.tile] - 1);
    this.fieldsDirty = true;
    this.fx.push({ k: 'ladderfall', x: l.bx, y: l.by, a: cx(l.tile), b: cy(l.tile) });
    if (pushed) {
      for (const sq of this.squads) if (sq.alive && Math.hypot(sq.cx - cx(l.tile), sq.cy - cy(l.tile)) < 4 * T) sq.morale = Math.min(100, sq.morale + 3);
    }
  }

  // ======================================================================
  // projectiles, fire, supply
  // ======================================================================

  updateProjectiles(dt: number) {
    const ps = this.projectiles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k;
      if (k < 1) {
        ps[w++] = p;
        continue;
      }
      this.land(p);
    }
    ps.length = w;
  }

  land(p: Projectile) {
    const ranged = true;
    if (p.kind === 'stone') {
      if (p.keep) {
        this.keepHp -= 120;
        if (this.keepHp <= 0) {
          this.keepHp = 0;
          this.finish(false);
        }
      } else if (p.structTile >= 0) this.damageStruct(p.structTile, (p.src?.def.sdmg ?? 120) * (p.src?.atkMul ?? 1));
      this.fx.push({ k: 'boom', x: p.tx, y: p.ty });
      const hit = (u: Unit) => {
        if (Math.hypot(u.x - p.tx, u.y - p.ty) < TREB_SPLASH_R) this.damage(u, p.dmg, 0.5, p.src, false);
      };
      this.dHash.each(p.tx, p.ty, TREB_SPLASH_R, hit);
      return;
    }
    if (p.area) {
      // volley arrow: hits whoever is under it
      const v = this.eHash.best(p.tx, p.ty, 7, (e, d2) => (e.state === ST.ACTIVE || e.state === ST.CLIMB ? d2 : Infinity));
      if (v) this.damage(v, p.dmg, p.ap, p.src, ranged);
      return;
    }
    const t = p.target;
    if (t && (t.state === ST.ACTIVE || t.state === ST.CLIMB)) {
      if (Math.hypot(t.x - p.tx, t.y - p.ty) < 10 + t.def.r) {
        this.damage(t, p.dmg, p.ap, p.src, ranged);
        if (p.kind === 'fire') {
          const i = tileAt(t.x, t.y);
          this.fire[i] = Math.max(this.fire[i], this.grid.isElev(i) ? POT_FIRE_STONE : 3);
        }
        return;
      }
    }
    if (p.blocked) return; // the wall took it
    // stray shot in a dense crowd may still hit someone
    const hash = p.side === 0 ? this.eHash : this.dHash;
    const stray = hash.best(p.tx, p.ty, 5, (u, d2) => (u.state === ST.ACTIVE ? d2 : Infinity));
    if (stray && this.rng.chance(0.5)) this.damage(stray, p.dmg * 0.7, p.ap, p.src, ranged);
    if (p.kind === 'fire') {
      const i = tileAt(p.tx, p.ty);
      this.fire[i] = Math.max(this.fire[i], this.grid.isElev(i) ? POT_FIRE_STONE * 0.8 : 2.5);
    }
  }

  updateFire(dt: number) {
    const g = this.grid;
    let any = false;
    for (let i = 0; i < g.n; i++) {
      if (this.fire[i] <= 0) continue;
      any = true;
      this.fire[i] -= dt;
      if (g.isStruct(i)) this.damageStruct(i, (g.tiles[i] === Tile.GATE ? 9 : 2.5) * dt);
      if (this.rng.chance(0.06)) this.fx.push({ k: 'flame', x: cx(i) + this.rng.range(-6, 6), y: cy(i) + this.rng.range(-6, 6) });
    }
    if (!any) return;
    const burn = (u: Unit) => {
      if (u.def.flying) return;
      const i = tileAt(u.x, u.y);
      if (this.fire[i] > 0) {
        u.fireDeath = true;
        this.damage(u, 9 * DT * (u.def.fireWeak ?? 1), 0.7, null, false);
        u.fireDeath = false;
      }
    };
    for (const u of this.activeDefs) burn(u);
    for (const u of this.activeEnemies) burn(u);
  }

  updateSupply(dt: number) {
    const g = this.grid;
    const logi = 1 + 0.15 * (this.up.logistics ?? 0);
    for (const sq of this.squads) {
      if (!sq.type.ranged || sq.alive === 0) continue;
      for (const u of sq.units) {
        if (u.state !== ST.ACTIVE || u.ammo >= u.maxAmmo) continue;
        const t = tileAt(u.x, u.y);
        let rate = 0;
        if (g.inside[t] || g.isBoundary(t)) {
          rate = 0.9;
          for (const d of g.depots) if (Math.hypot(cx(d) - u.x, cy(d) - u.y) < 7 * T) rate = 3;
        }
        rate *= logi;
        if (rate <= 0) continue;
        const cost = u.def.id === 'd_ballista' ? 4 : 1;
        const want = Math.min(u.maxAmmo - u.ammo, rate * dt);
        const pay = want * cost;
        if (this.supplies.arrows >= pay) {
          this.supplies.arrows -= pay;
          u.ammo += want;
        } else if (this.supplies.arrows <= 0.5) {
          this.alert('noarrows', '화살이 바닥났습니다! 궁수들이 근접전으로 전환합니다.', 'danger');
        }
      }
    }
    if (this.supplies.arrows < this.startSupplies.arrows * 0.15 && this.supplies.arrows > 0.5) this.alert('lowarrows', '화살 재고가 15% 미만입니다.', 'warn');
  }

  // ======================================================================
  // abilities
  // ======================================================================

  canUse(id: AbilityId): string | null {
    const a = this.abilities[id];
    if (!a.unlocked) return '아직 사용할 수 없는 능력입니다.';
    if (this.state !== 'battle' && this.state !== 'intermission') return '전투 중에만 사용할 수 있습니다.';
    if (a.cd > 0) return `재사용 대기 ${Math.ceil(a.cd)}초`;
    if (id === 'reserve' && a.used > 0) return '증원은 전투당 한 번입니다.';
    if (id === 'reserve' && this.supplies.food < 10) return '식량이 부족합니다 (10 필요).';
    return null;
  }

  useAbility(id: AbilityId, x: number, y: number): string | null {
    const err = this.canUse(id);
    if (err) return err;
    const a = this.abilities[id];
    const g = this.grid;
    if (id === 'rally') {
      let n = 0;
      for (const sq of this.squads) {
        if (sq.alive === 0) continue;
        if (Math.hypot(sq.cx - x, sq.cy - y) < 11 * T) {
          sq.morale = Math.min(100, sq.morale + 35);
          sq.rallyT = 12;
          n++;
          if (sq.routing && sq.morale >= 42) {
            sq.routing = false;
            if (sq.destTile >= 0) this.orderMove(sq, sq.destTile, false);
          }
        }
      }
      if (n === 0) return '범위 안에 아군 분대가 없습니다.';
      this.fx.push({ k: 'rally', x, y });
    } else if (id === 'volley') {
      let shots = 0;
      for (const sq of this.squads) {
        if (!sq.type.ranged || sq.type.id === 'ballista' || sq.routing) continue;
        for (const u of sq.units) {
          if (u.state !== ST.ACTIVE || u.ammo < 1) continue;
          if (Math.hypot(u.x - x, u.y - y) > this.rangeOf(u) * 1.35) continue;
          for (let k = 0; k < 3 && u.ammo >= 1; k++) {
            u.ammo -= 1;
            const ang = this.rng.range(0, Math.PI * 2);
            const rad = Math.sqrt(this.rng.next()) * 2.3 * T;
            const txp = x + Math.cos(ang) * rad;
            const typ = y + Math.sin(ang) * rad;
            const d = Math.hypot(txp - u.x, typ - u.y);
            this.projectiles.push({
              x: u.x,
              y: u.y,
              sx: u.x,
              sy: u.y,
              tx: txp,
              ty: typ,
              t: -k * 0.12 - this.rng.range(0, 0.15),
              dur: Math.max(0.2, d / 300) + 0.15,
              target: null,
              side: 0,
              dmg: u.def.atk * u.rangedMul * 1.1,
              ap: u.def.ap ?? 0,
              kind: u.def.proj ?? 'arrow',
              structTile: -1,
              area: true,
              src: u,
              keep: false,
            });
            shots++;
          }
        }
      }
      if (shots === 0) return '사거리 안에 화살이 있는 궁수가 없습니다.';
      this.fx.push({ k: 'volley', x, y });
    } else if (id === 'oil') {
      const ti = g.nearestTile(tileAt(x, y), (j) => g.isStruct(j) || g.tiles[j] === Tile.GATE_BROKEN || g.tiles[j] === Tile.RUBBLE, 3);
      if (ti < 0) return '성벽이나 성문 근처를 지정하세요.';
      const ox = cx(ti);
      const oy = cy(ti);
      const R = 2.6 * T;
      const hitBands = new Set<Band>();
      for (const e of this.activeEnemies) {
        if (e.def.flying) continue;
        if (e.elev && e.state !== ST.CLIMB) continue;
        if (Math.hypot(e.x - ox, e.y - oy) > R) continue;
        e.fireDeath = true;
        this.damage(e, OIL_DMG * (e.def.fireWeak ?? 1) * (e.def.big ? 2.5 : 1), 0.8, null, false);
        e.fireDeath = false;
        if (e.band) hitBands.add(e.band);
      }
      for (const b of hitBands) b.morale -= OIL_MORALE;
      for (const l of [...this.ladders]) if (Math.hypot(cx(l.tile) - ox, cy(l.tile) - oy) < R && !l.tower) this.removeLadder(l, true);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = tx(ti) + dx;
          const yy = ty(ti) + dy;
          if (!inb(xx, yy)) continue;
          const j = idx(xx, yy);
          if (!g.isStruct(j) && !g.inside[j] && Math.hypot(dx, dy) <= 2.2) this.fire[j] = Math.max(this.fire[j], 5);
        }
      this.fx.push({ k: 'oil', x: ox, y: oy });
    } else if (id === 'reserve') {
      this.supplies.food -= 10;
      const ids = Array.from({ length: 10 }, (_, k) => -1000 - k);
      const sq = this.addSquad({ rosterId: 'reserve', type: 'militia', name: '소집 민병대', rank: 0, xp: 0, soldiers: ids }, true);
      this.stats.deployed -= ids.length;
      const tile = g.nearestTile(tileAt(g.keepX - 2.5 * T, g.keepY), (j) => g.inside[j] === 1 && !g.keepAdj[j], 8);
      this.placeSquad(sq, tile);
      sq.auto = true;
      this.fx.push({ k: 'rally', x: sq.cx, y: sq.cy });
      this.event('reserve', '민병대가 소집되었습니다.', 'good', sq.cx, sq.cy);
    }
    a.cd = a.max;
    a.used++;
    this.stats.abilityUses++;
    return null;
  }

  // ======================================================================
  // bookkeeping
  // ======================================================================

  event(type: string, text: string, level: Level, x?: number, y?: number, squad?: number) {
    this.events.push({ type, text, level, x, y, squad });
  }

  alert(key: string, text: string, level: Level, x?: number, y?: number) {
    if ((this.alertCd[key] ?? 0) > 0) return;
    this.alertCd[key] = key.startsWith('no') || key.startsWith('low') ? 30 : 12;
    this.event(key, text, level, x, y);
  }

  cleanup() {
    if (this.t % 2 < DT) {
      this.enemies = this.enemies.filter((e) => e.state === ST.ACTIVE || e.state === ST.CLIMB);
      this.units = this.units.filter((u) => u.side === 0 || u.state === ST.ACTIVE || u.state === ST.CLIMB);
    }
  }

  checkEnd() {
    if (this.state === 'won' || this.state === 'lost') return;
    if (this.keepHp <= 0) this.finish(false);
    // nobody left standing to hold the walls while the enemy is still in the field: the castle falls
    // (a few seconds' grace: the reserve may still be called up)
    if (this.state === 'battle' && this.activeDefs.length === 0 && this.enemiesRemaining() > 0) {
      this.wipedT += DT;
      if (this.wipedT >= GARRISON_GRACE) {
        this.event('wiped', '수비군이 모두 쓰러졌습니다. 성을 지킬 병사가 없습니다…', 'danger');
        this.finish(false);
      }
    } else this.wipedT = 0;
  }

  /** Attackers standing inside the walls (courtyard, wall walk, ladders) and not running. */
  enemiesHoldingWalls() {
    const g = this.grid;
    let n = 0;
    for (const e of this.enemies) {
      if (e.fleeing || e.def.flying) continue;
      if (e.state === ST.CLIMB) n++;
      else if (e.state === ST.ACTIVE) {
        const i = tileAt(e.x, e.y);
        if (e.elev || g.inside[i] === 1 || g.keepAdj[i] === 1) n++;
      }
    }
    return n;
  }

  /**
   * Hard time cap: the siege is decided as it stands. Attackers holding ground inside the walls, or a keep
   * all but battered down, and the castle is lost; otherwise the attackers give up and march away.
   */
  liftSiege() {
    const held = this.enemiesHoldingWalls();
    const lost = held >= CAP_HOLD_N || this.keepHp < this.keepMax * CAP_KEEP_MIN;
    if (lost) {
      this.event('siegeend', held >= CAP_HOLD_N ? '긴 공방 끝에 적이 성안을 장악했습니다…' : '긴 공방 끝에 본성이 더는 버티지 못합니다…', 'danger');
      this.finish(false);
      return;
    }
    for (const e of this.enemies) if (e.state === ST.ACTIVE || e.state === ST.CLIMB) e.fleeing = true;
    this.event('siegeend', '긴 공방 끝에 적이 공성을 포기하고 물러갑니다!', 'good');
    this.finish(true);
  }

  finish(won: boolean) {
    if (this.state === 'won' || this.state === 'lost') return;
    this.state = won ? 'won' : 'lost';
    if (won) this.waveCleared = this.totalWaves();
    this.result = this.computeResult(won);
    this.event(won ? 'victory' : 'defeat', won ? '승리! 성을 지켜냈습니다.' : '본성이 함락되었습니다…', won ? 'good' : 'danger');
  }

  computeResult(won: boolean, retreat = false): BattleResult {
    const squads: SquadOutcome[] = [];
    let dead = 0;
    let wounded = 0;
    for (const sq of this.squads) {
      if (sq.reserve) continue;
      const o: SquadOutcome = { rosterId: sq.rosterId, dead: [], wounded: [], survivors: [], kills: sq.kills };
      for (const u of sq.units) {
        if (u.state === ST.DEAD) o.dead.push(u.soldierId);
        else if (u.state === ST.EVAC) o.wounded.push(u.soldierId);
        else if (u.state === ST.DOWN || u.state === ST.CARRIED) {
          if (won || retreat || this.rng.chance(0.5)) o.wounded.push(u.soldierId);
          else o.dead.push(u.soldierId);
        } else if (u.hp < u.maxHp * 0.3) o.wounded.push(u.soldierId);
        else o.survivors.push(u.soldierId);
      }
      dead += o.dead.length;
      wounded += o.wounded.length;
      squads.push(o);
    }
    const keepPct = this.keepHp / this.keepMax;
    const deployed = Math.max(1, this.stats.deployed);
    let stars = 0;
    if (won) {
      // 3 stars ask for a well-held keep and few graves: a clean defence, often on a replay
      stars = 1;
      if (keepPct >= 0.5 && dead / deployed <= 0.35) stars = 2;
      if (keepPct >= 0.8 && dead / deployed <= 0.15) stars = 3;
    }
    return {
      won,
      stars,
      keepPct,
      wavesCleared: this.waveCleared,
      totalWaves: this.totalWaves(),
      kills: this.stats.kills,
      routed: this.stats.routed,
      dead,
      wounded,
      evacuated: this.stats.evacuated,
      deployed,
      bounty: this.stats.bounty,
      time: this.t,
      dragons: this.stats.dragons,
      squads,
    };
  }

  /** Abandon the battle (player retreat). Treated as a loss without extra casualties. */
  surrender() {
    if (this.state === 'won' || this.state === 'lost') return;
    this.state = 'lost';
    // an orderly retreat carries the downed away: they come home wounded instead of dying
    this.result = this.computeResult(false, true);
    this.event('defeat', '후퇴했습니다.', 'warn');
  }

  /** Progress 0..1 through the battle for UI. */
  progress() {
    return Math.min(1, (this.waveIdx + (this.state === 'intermission' ? 1 : 0.5)) / this.totalWaves());
  }

  enemiesRemaining() {
    let n = 0;
    for (const e of this.activeEnemies) if (!e.fleeing) n++;
    return n;
  }
}
