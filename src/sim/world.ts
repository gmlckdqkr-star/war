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
import { RNG } from './rng';
import type { Edge, StageDef, Supplies, WaveGroup } from './stages';
import { runCouncil, autoCommander } from './council';

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
  oil: { name: '끓는 기름', cd: 38, desc: '성벽·성문 앞 적에게 큰 화염 피해, 사다리 파괴', needsTarget: true },
  reserve: { name: '증원', cd: 999, desc: '본성 앞에 민병대 10명 소집 (전투당 1회, 식량 10)', needsTarget: false },
};

const T = TILE;

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
  fieldsDirty = true;
  lastFieldT = -10;
  councilT = 0;
  moraleT = 0;
  dHash = new SpatialHash<Unit>(32);
  eHash = new SpatialHash<Unit>(32);
  activeDefs: Unit[] = [];
  activeEnemies: Unit[] = [];
  downed: Unit[] = [];
  terrorUnits: Unit[] = [];
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
  lastKeepAlert = -10;
  result: BattleResult | null = null;
  /** per-world id counter keeps battles reproducible for a given seed */
  uid = 1;

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    this.stage = cfg.stage;
    this.rng = new RNG(cfg.seed);
    this.up = cfg.upgrades;
    this.mods = new Set(cfg.mods ?? []);
    this.autoCommand = !!cfg.autoCommand;
    const lvl = cfg.stage.level;
    const diff = cfg.difficulty === 'easy' ? 0.72 : cfg.difficulty === 'hard' ? 1.22 : 1;
    this.hpScale = lvl * diff;
    this.atkScale = Math.sqrt(lvl) * diff;
    const stageRng = new RNG(cfg.seed ^ 0x5bd1e995);
    cfg.stage.build(this.grid, stageRng);
    let hpMul = 1 + 0.12 * (this.up.masonry ?? 0);
    if (this.mods.has('brittle')) hpMul *= 0.65;
    this.grid.finalize(hpMul);
    this.keepMax = cfg.stage.keepHp * (1 + 0.06 * (this.up.masonry ?? 0));
    this.keepHp = this.keepMax;
    this.supplies = { ...cfg.supplies };
    this.startSupplies = { ...cfg.supplies };
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
    this.dHash.build(this.activeDefs);
    this.eHash.build(this.activeEnemies);
    if (this.fieldsDirty && this.t - this.lastFieldT > 0.35) this.recomputeFields();

    this.moraleT -= dt;
    if (this.moraleT <= 0) {
      this.moraleT = 0.25;
      this.terrorUnits = this.activeEnemies.filter((e) => e.def.terror);
      for (const sq of this.squads) this.updateSquadCentroid(sq);
    }
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
    this.cleanup();
    this.checkEnd();
    if (this.fx.length > 3000) this.fx.splice(0, this.fx.length - 1500);
    if (this.events.length > 200) this.events.splice(0, this.events.length - 100);
  }

  recomputeFields() {
    this.fieldsDirty = false;
    this.lastFieldT = this.t;
    this.grid.enemyField('breach', this.fields.breach);
    this.grid.enemyField('escalade', this.fields.escalade);
    this.grid.enemyField('ram', this.fields.ram);
    this.computeDefenderFields();
  }

  // ======================================================================
  // waves
  // ======================================================================

  startWave(w: number) {
    this.waveIdx = w;
    this.waveT = 0;
    this.pending = [...this.stage.waves[w].groups].sort((a, b) => a.delay - b.delay);
    this.state = 'battle';
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
            this.event('arrows', `전장에서 화살 ${rec}개를 회수했습니다.`, 'info');
          }
          this.event('cleared', `물결을 막아냈습니다! 다음 공세까지 ${Math.round(this.interT)}초`, 'good');
          for (const sq of this.squads) sq.morale = Math.min(100, sq.morale + 10);
        }
      } else if (!last && this.waveT > (wave.maxTime ?? 105)) {
        this.startWave(this.waveIdx + 1);
      }
    }
  }

  // ---------------------------------------------------------------- war council (between waves)
  // Shared interface for the UI. Stub for now: the balance pass fills in the options and effects.

  /** id of the option picked during the current intermission, or null */
  councilPick: string | null = null;

  /** Options the player can pick right now (empty when not in an intermission or already picked). */
  councilOptions(): { id: string; name: string; desc: string }[] {
    return [];
  }

  /** Apply one council option. Returns false if not allowed now. */
  chooseCouncil(_id: string): boolean {
    return false;
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
    let ex = 0;
    let ey = 0;
    const along = r.range(g.span[0], g.span[1]);
    if (g.edge === 'W') {
      ex = 0;
      ey = along;
    } else if (g.edge === 'N') {
      ex = along;
      ey = 0;
    } else if (g.edge === 'S') {
      ex = along;
      ey = GH - 1;
    } else {
      ex = GW - 1;
      ey = along;
    }
    const ok = (i: number) => grid.openGround(i) && !grid.inside[i];
    let st = grid.nearestTile(idx(Math.round(Math.min(GW - 1, ex)), Math.round(Math.min(GH - 1, ey))), ok, 30);
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
    };
    const list: string[] = [];
    if (tpl.leader) list.push(tpl.leader);
    for (const [id, n] of tpl.members) for (let i = 0; i < n; i++) list.push(id);
    const spread = 1.2 + Math.sqrt(list.length) * 0.55;
    for (let i = 0; i < list.length; i++) {
      const def = UNITS[list[i]];
      let px = bx;
      let py = by;
      if (!def.flying) {
        for (let tries = 0; tries < 8; tries++) {
          const ang = r.range(0, Math.PI * 2);
          const rad = i === 0 ? 0 : r.range(0.3, spread) * T;
          const qx = Math.max(2, Math.min(WORLD_W - 2, bx + Math.cos(ang) * rad - (g.edge === 'W' ? rad * 0.5 : 0)));
          const qy = Math.max(2, Math.min(WORLD_H - 2, by + Math.sin(ang) * rad));
          if (ok(tileAt(qx, qy))) {
            px = qx;
            py = qy;
            break;
          }
        }
      } else {
        px = g.edge === 'W' ? 4 : bx;
        py = g.edge === 'N' ? 4 : g.edge === 'S' ? WORLD_H - 4 : by;
        if (def.role === 'dragon') this.hasDragonEver = true;
      }
      const u = this.makeUnit(def, 1, px, py);
      u.maxHp = u.hp = def.hp * this.hpScale;
      u.atkMul = this.atkScale;
      u.band = band;
      u.spawnX = g.edge === 'W' ? -20 : px;
      u.spawnY = g.edge === 'N' ? -20 : g.edge === 'S' ? WORLD_H + 20 : py;
      if (def.leader && !band.leader) band.leader = u;
      band.units.push(u);
      this.enemies.push(u);
    }
    band.startCount = band.units.length;
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
    if (b.broken) return;
    let alive = 0;
    for (const u of b.units) if (u.state === ST.ACTIVE || u.state === ST.CLIMB) alive++;
    if (alive === 0) return;
    if (b.leader && b.leader.state === ST.ACTIVE && b.morale < b.tpl.morale) b.morale = Math.min(b.tpl.morale, b.morale + (b.leader.def.aura ?? 0) * 0.6 * dt);
    if (b.morale < 15) this.breakBand(b);
  }

  breakBand(b: Band) {
    if (b.broken) return;
    b.broken = true;
    let x = 0;
    let y = 0;
    let n = 0;
    for (const u of b.units) {
      if (u.state !== ST.ACTIVE && u.state !== ST.CLIMB) continue;
      x += u.x;
      y += u.y;
      n++;
      const cornered = u.elev || this.grid.inside[tileAt(u.x, u.y)] === 1;
      if (!(u.def.fearless && u.hp > u.maxHp * 0.4) && !cornered) u.fleeing = true;
    }
    if (n) {
      x /= n;
      y /= n;
      this.event('broken', `${b.tpl.name}이(가) 무너져 달아납니다!`, 'good', x, y);
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
    if (d <= 1.5 || !isFinite(d)) return this.moveToward(u, gx, gy, mul);
    const n = f.next[i];
    if (n < 0) return this.moveToward(u, gx, gy, mul);
    const j = ((u.id * 13) % 7) - 3;
    this.moveToward(u, cx(n) + j * 0.9, cy(n) + ((u.id * 7) % 5 - 2) * 0.9, mul);
    return false;
  }

  moveToSlot(u: Unit) {
    const sq = u.squad!;
    const d = Math.hypot(u.slotX - u.x, u.slotY - u.y);
    if (d < 1.2) {
      u.moveT = 0;
      return true;
    }
    return this.walkField(u, sq.field, u.slotX, u.slotY);
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
        if (r === 'ladder' || r === 'sapper') s *= 0.6;
        if (e.def.leader) s *= 0.8;
        if (e.def.role === 'healer') s *= 0.75;
        if (e.fleeing) s *= 1.8;
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
    if (u.elev && !t.elev && !t.def.flying) dmg *= 0.6;
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
    if (d > 0.9 * T) {
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
          g.maxHp[tt] = TILE_INFO[g.tiles[tt]].maxHp * (1 + 0.12 * (this.up.masonry ?? 0));
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
    if (!sq.tfield) sq.tfield = newField();
    if (sq.tfieldTile !== tile || this.fieldsDirty) {
      sq.tfieldTile = tile;
      this.grid.defenderField([tile], sq.tfield);
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
    if (role === 'dragon' || role === 'flyer') {
      this.flyerAI(e, dt);
      return;
    }
    if (e.fleeing) {
      const sx = e.spawnX;
      const sy = e.spawnY;
      this.moveToward(e, sx, sy, 1.05);
      if (e.x < 3 || e.y < 3 || e.y > WORLD_H - 3 || e.x > WORLD_W - 3) {
        e.state = ST.FLED;
        this.stats.routed++;
      }
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
    const ranged = e.def.range > 0;
    const noFight = role === 'ram' || role === 'tower';
    if (!noFight && (e.retarget <= 0 || (e.target && e.target.state !== ST.ACTIVE))) {
      e.retarget = 0.35 + this.rng.next() * 0.25;
      e.target = ranged ? this.enemyRangedTarget(e) : this.enemyMeleeTarget(e);
    }
    const t = e.target;
    if (t && t.state === ST.ACTIVE && !noFight) {
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (ranged) {
        if (e.def.kite) {
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
          return;
        }
      } else {
        const reach = e.def.r + t.def.r + e.def.reach + 1;
        if (d <= reach) {
          e.fx = (t.x - e.x) / (d || 1);
          e.fy = (t.y - e.y) / (d || 1);
          if (e.cd <= 0) {
            e.cd = e.def.cd * this.rng.range(0.9, 1.1);
            let dmg = e.def.atk * e.atkMul;
            if (e.elev && !t.elev) dmg *= 0.8;
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
        if (d < 3.5 * T) {
          this.moveToward(e, t.x, t.y);
          return;
        }
      }
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
    this.moveToward(e, cx(n) + j * 1.1, cy(n) + k * 1.1);
  }

  enemyMeleeTarget(e: Unit): Unit | null {
    const R = e.def.role === 'ladder' || e.def.role === 'sapper' ? 1.1 * T : e.def.role === 'giant' ? 2 * T : 2.6 * T;
    const giant = e.def.role === 'giant';
    return this.dHash.best(e.x, e.y, R, (d, d2) => {
      if (d.elev && !e.elev && !giant) return Infinity;
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
      e.timer = 12;
      e.actTile = n;
      this.alert('sapper' + n, '갱도병이 성벽 밑을 파고 있습니다!', 'danger', cx(n), cy(n));
      return;
    }
    if (role === 'tower') {
      if (t === Tile.WALL && !this.ladderAt(n)) {
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
      e.timer -= dt;
      if (this.rng.chance(0.08)) this.fx.push({ k: 'dust', x: e.x, y: e.y });
      if (e.timer <= 0) {
        e.act = ACT.NONE;
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
    const lad = this.ladderAt(e.actTile);
    if (!lad) {
      // ladder pushed or tower destroyed: fall
      e.state = ST.ACTIVE;
      e.elev = false;
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
    if (e.cd > 0) return;
    e.cd = e.def.cd * this.rng.range(0.9, 1.1);
    const dmg = e.def.role === 'ram' ? (e.def.sdmg ?? 60) * 0.6 * e.atkMul : e.def.atk * e.atkMul * Math.max(0.5, e.def.sdmg ?? 0.5) * 0.6;
    this.keepHp -= dmg;
    if (this.rng.chance(0.2)) this.fx.push({ k: 'chip', x: e.x, y: e.y });
    if (this.t - this.lastKeepAlert > 6) {
      this.lastKeepAlert = this.t;
      this.event('keep', '본성이 공격받고 있습니다!', 'danger', this.grid.keepX, this.grid.keepY);
    }
    if (this.keepHp <= 0) {
      this.keepHp = 0;
      this.finish(false);
    }
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
      dmg: 30 * e.atkMul,
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
    if (e.fleeing || (dragon && e.hp < e.maxHp * 0.18)) {
      if (!e.fleeing) {
        e.fleeing = true;
        this.event('dragonflee', '고룡이 상처를 입고 물러갑니다!', 'good', e.x, e.y);
        if (dragon) {
          this.stats.dragons++;
          this.stats.bounty += Math.round(e.def.gold * 0.6);
        }
        for (const b of this.bands) if (b.tpl.faction === 'wyrm' && b !== e.band) b.morale -= 45;
        if (e.band) e.band.morale -= 60;
      }
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
        e.fT = 2.6;
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
        const L = 5.5 * T;
        const dmgTick = e.def.atk * e.atkMul * 0.2;
        this.dHash.each(e.x, e.y, L, (d) => {
          const a = Math.atan2(d.y - e.y, d.x - e.x);
          let da = Math.abs(a - ang);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (da < 0.5) {
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
    if (t.side === 0 && t.squad && t.squad.routing) eff *= 1.25;
    if (t.fleeing) eff *= 1.2;
    t.hp -= eff;
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
      this.stats.dragons++;
      for (const o of this.bands) if (o.tpl.faction === 'wyrm') o.morale -= 50;
    }
    if (e.def.role === 'tower') {
      const lad = this.ladders.find((l) => l.tower === e);
      if (lad) this.removeLadder(lad, false);
    }
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
        if (Math.hypot(u.x - p.tx, u.y - p.ty) < 22) this.damage(u, p.dmg, 0.5, p.src, false);
      };
      this.dHash.each(p.tx, p.ty, 22, hit);
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
          this.fire[i] = Math.max(this.fire[i], 3);
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
      this.fire[i] = Math.max(this.fire[i], 2.5);
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
        this.damage(e, 75 * (e.def.fireWeak ?? 1) * (e.def.big ? 2.5 : 1), 0.8, null, false);
        e.fireDeath = false;
        if (e.band) hitBands.add(e.band);
      }
      for (const b of hitBands) b.morale -= 12;
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
      stars = 1;
      if (keepPct >= 0.5 && dead / deployed <= 0.4) stars = 2;
      if (keepPct >= 0.8 && dead / deployed <= 0.2) stars = 3;
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
