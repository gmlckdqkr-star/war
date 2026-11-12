/**
 * Battle screen: owns the World, the renderer, touch input and the HUD.
 *
 * Mobile control model (designed for one thumb + occasional second finger):
 *  - Squads fight on their own (squad AI + war council). The player gives macro orders only.
 *  - Tap a banner or a squad card -> select. Tap ground -> move there. Tap an enemy -> focus it.
 *    While a squad is selected only a direct hit on another banner selects it; every other tap is an order.
 *  - Drag a banner -> move along the drag. One-finger drag on empty ground -> pan. Pinch -> zoom.
 *  - Abilities: tap button, then tap the map. Presets: one tap for the whole army.
 *  - Pause is tactical: every order still works while paused.
 *  - Until the first contact of a wave the battle runs fast-forward on its own (same sim steps, less waiting).
 */
import { DT, SQUAD_TYPES, TILE, Tile } from '../sim/defs';
import { tileAt, tx, ty } from '../sim/grid';
import { hasFinal, particle, type JosaPair } from '../sim/josa';
import type { StageDef, Supplies } from '../sim/stages';
import { ABILITY_INFO, ST, World, type AbilityId, type BattleConfig, type BattleResult, type GameEvent, type Squad, type Stance } from '../sim/world';
import { cosmeticById } from '../meta/cosmetics';
import { RANK_NAMES } from '../meta/progression';
import { hasFlag } from '../meta/shop';
import { Renderer, type Theme } from '../render/renderer';
import { audio, haptic } from './audio';
import { bar, clear, confirmBox, fmt, h, modal, stars, toast } from './dom';
import { Charges } from './orders';
import { BattleRecorder, clearRecord, newBattleId, saveRecord, stageSig, storableCfg, type BattleMode, type BattleRecord, type StageRef } from './resume';
import { RESUME_VER } from './version';
import type { App } from './app';

export type { BattleMode };

export interface BattleSetup {
  mode: BattleMode;
  stage: StageDef;
  cfg: BattleConfig;
  modName?: string;
  /** gold for the planned supply packs; charged only when the result is recorded */
  supplyCost?: number;
  /** how to rebuild the stage if the app is killed mid-battle; null = this battle can't be resumed */
  ref?: StageRef | null;
  /** planned supply packs and the chosen lineup (restored with the battle after a resume) */
  extra?: Partial<Supplies>;
  lineup?: string[];
  /** unique id of this battle: resume record and settlement guard */
  battleId?: string;
}

/** A battle rebuilt from its resume record: the world is already replayed up to the record. */
export interface ResumedBattle {
  world: World;
  record: BattleRecord;
}

/** real time between automatic resume saves while the battle runs */
const RESUME_SAVE_MS = 20000;

const STANCE_NAMES: Record<Stance, string> = { hold: '고수', defend: '방어', aggressive: '추격' };
const EDGE_NAMES: Record<string, string> = { W: '서쪽', N: '북쪽', S: '남쪽', E: '동쪽' };
/** speed used while nothing has met the enemy yet */
const APPROACH_SPEED = 3;
/** seconds of sim time without contact before fast-forward resumes */
const CONTACT_HOLD = 5;

export function themeFromSave(app: App): Theme {
  const s = app.save;
  const castle = cosmeticById(s.equipped.castle)?.colors ?? ['#8c9099', '#5e626b'];
  const ban = cosmeticById(s.equipped.banner)?.colors ?? ['#2f5fc4', '#f2e6c8'];
  const dye = cosmeticById(s.equipped.dye)?.colors[0] ?? '#3a6fd8';
  return { stone: castle[0], stoneDark: castle[1], dye, bannerField: ban[0], bannerCharge: ban[1], bannerPattern: cosmeticById(s.equipped.banner)?.pattern ?? 'plain' };
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

/** Squad name + particle; a roman suffix is read as a Korean number (궁수대 I → 궁수대 일 → "이"). */
export function nameJosa(name: string, pair: JosaPair): string {
  const spoken = name.replace(/\s([IVX]+)$/, (m, r: string) => (ROMAN[r] ? ' ' + ROMAN[r] : m));
  return name + particle(spoken, pair);
}

/** "무리이(가)" style particle placeholders in event texts, with the particle pair each stands for. */
const PLACEHOLDER: Record<string, JosaPair | 'wa'> = { '이(가)': '이/가', '을(를)': '을/를', '은(는)': '은/는', '(으)로': '으로/로', '으로(로)': '으로/로', '와(과)': 'wa', '과(와)': 'wa' };

/** Replace particle placeholders after a word with the particle that word takes ("징집병 무리이(가)" → "징집병 무리가"). */
export function fixParticles(text: string): string {
  if (!text.includes('(')) return text;
  return text.replace(/(\S+?)(이\(가\)|을\(를\)|은\(는\)|\(으\)로|으로\(로\)|와\(과\)|과\(와\))/g, (_m, word: string, ph: string) => {
    const pair = PLACEHOLDER[ph];
    const spoken = word.replace(/^([IVX]+)$/, (r: string) => (ROMAN[r] ? String(ROMAN[r]) : r));
    if (pair === 'wa') return word + (hasFinal(spoken) ? '과' : '와');
    return word + particle(spoken, pair);
  });
}

/**
 * Number that tells same-type squads apart (궁1, 궁2 ...): the roman suffix of the squad name when the
 * names are unique, otherwise the order. Squads whose type appears once get no number.
 */
export function squadNumbers<T extends { type: string; name: string }>(list: T[]): Map<T, number> {
  const out = new Map<T, number>();
  const byType = new Map<string, T[]>();
  for (const q of list) byType.set(q.type, [...(byType.get(q.type) ?? []), q]);
  for (const group of byType.values()) {
    if (group.length < 2) continue;
    const nums = group.map((q) => ROMAN[/\s([IVX]+)$/.exec(q.name.trim())?.[1] ?? ''] ?? 0);
    const ok = nums.every((n) => n > 0) && new Set(nums).size === nums.length;
    group.forEach((q, i) => out.set(q, ok ? nums[i] : i + 1));
  }
  return out;
}

export class BattleView {
  app: App;
  setup: BattleSetup;
  world: World;
  renderer: Renderer;
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  speed = 1;
  paused = false;
  acc = 0;
  last = 0;
  raf = 0;
  destroyed = false;
  resultShown = false;
  endT = 0;
  hudT = 0;
  targeting: AbilityId | null = null;
  selected: Squad | null = null;
  crashed = false;
  /** auto fast-forward is running (no contact yet in this wave) */
  approaching = false;
  /** sim time of the last contact */
  private contactT = -99;
  /** melee charges ordered by tapping an enemy: the stance to restore once the target is gone */
  private charges = new Charges();
  /** records every order so the battle can be resumed after the app is killed */
  readonly recorder: BattleRecorder;
  /** the resume record is closed (result recorded, battle left or crashed): never write it again */
  private recordClosed = false;
  private lastResumeSave = performance.now();
  private resumeSaved = { steps: -1, cmds: -1 };
  private lastState = '';
  private els: Record<string, HTMLElement> = {};
  private cards: HTMLElement[] = [];
  private abilityBtns: Partial<Record<AbilityId, HTMLButtonElement>> = {};
  private ro: ResizeObserver | null = null;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private gesture: { kind: 'none' | 'pan' | 'squad' | 'pinch'; squad?: Squad; moved: boolean; pinchD?: number; pinchZ?: number; midX?: number; midY?: number } = { kind: 'none', moved: false };
  private lastTap = { t: 0, x: 0, y: 0 };
  private hintShown = new Set<string>();
  private playStart = performance.now();
  private interKey = '';
  private councilNames = new Map<string, string>();
  private laidOut = false;
  /** where the alert column sits: top-left or top-right, and how far below the top bar */
  private toastPos = { left: false, dy: 0 };
  /** the castle's wall ring in world px (opening view, alert placement) */
  private castle: { x0: number; y0: number; x1: number; y1: number } | undefined;

  constructor(app: App, setup: BattleSetup, resumed?: ResumedBattle) {
    this.app = app;
    this.setup = setup;
    // the stored config is taken before the world exists, so nothing the world does can change it
    const cfg = resumed ? resumed.record.cfg : storableCfg(setup.cfg);
    this.world = resumed ? resumed.world : new World(setup.cfg);
    this.recorder = new BattleRecorder(
      this.world,
      {
        ver: RESUME_VER,
        id: resumed?.record.id ?? setup.battleId ?? newBattleId(),
        mode: setup.mode,
        ref: setup.ref ?? { kind: 'campaign', id: '' },
        cfg,
        modName: setup.modName,
        extra: { ...(setup.extra ?? {}) },
        lineup: [...(setup.lineup ?? setup.cfg.squads.map((q) => q.rosterId))],
        sig: resumed?.record.sig ?? stageSig(this.world),
        name: setup.stage.name,
      },
      resumed ? { steps: resumed.record.steps, cmds: resumed.record.cmds } : undefined,
    );
    // the result is settled under the same id the record carries
    setup.battleId = this.recorder.base.id;
    if (!setup.ref) this.recordClosed = true;
    if (resumed) {
      // the replay's alerts and effects are history: start from a quiet screen
      this.world.events.length = 0;
      this.world.fx.length = 0;
      this.world.dirtyTiles.length = 0;
      this.charges.load(this.world, resumed.record.charges);
    }
    this.lastState = this.world.state;
    const s = app.save;
    const allowed = this.speeds();
    this.speed = allowed.includes(s.settings.speed) ? s.settings.speed : Math.min(Math.max(1, Math.round(s.settings.speed || 1)), allowed[allowed.length - 1]);
    this.root = h('div', { class: 'battle' + (s.settings.leftHanded ? ' lefty' : '') });
    this.canvas = h('canvas', { class: 'battle-canvas', 'aria-label': '전장' });
    this.root.append(this.canvas);
    this.renderer = new Renderer(this.canvas, themeFromSave(app));
    this.renderer.reduceMotion = s.settings.reduceMotion;
    this.renderer.setQuality(s.settings.quality === 'low');
    this.renderer.onSound = (k, x) => audio.play(k, x);
    this.buildHud();
    app.screenRoot.append(this.root);
    document.body.classList.add('in-battle');
    this.layout();
    this.renderer.attach(this.world);
    this.renderer.deployMode = this.world.state === 'deploy';
    const g = this.world.grid;
    this.castle = this.castleBox();
    this.renderer.cam.focusCastle(g.keepX, g.keepY, this.castle);
    this.laidOut = true;
    this.bindInput();
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.root);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.updateHud(true);
    if (resumed && (this.world.state === 'won' || this.world.state === 'lost')) {
      // it had already ended: the result screen comes up by itself
    } else if (resumed && this.world.state !== 'deploy') {
      // back where it stopped, paused, so the player can look around before it runs on
      this.togglePause(true);
      setTimeout(() => !this.destroyed && toast('전투를 이어갑니다 · ▶를 누르면 계속', 'good', undefined, 4000), 150);
    } else {
      if (resumed) setTimeout(() => !this.destroyed && toast('중단된 배치를 이어갑니다.', 'good', undefined, 3000), 150);
      setTimeout(() => this.introTips(), 250);
    }
  }

  /**
   * Write the resume record (on hide, page unload, wave breaks and every ~20 s while the battle runs).
   * Never throws into the game: if storage is full the battle just goes on without a resume point.
   */
  saveResume(): boolean {
    if (this.recordClosed || this.crashed || this.destroyed) return false;
    const r = this.recorder;
    if (r.steps === this.resumeSaved.steps && r.cmds.length === this.resumeSaved.cmds) return true;
    try {
      const w = this.world;
      const ok = saveRecord(this.app.kv, r.record({ t: w.t, wave: w.waveIdx, waves: w.totalWaves(), state: w.state, charges: this.charges.save() }));
      if (ok) this.resumeSaved = { steps: r.steps, cmds: r.cmds.length };
      return ok;
    } catch {
      return false;
    }
  }

  destroy() {
    this.recordClosed = true;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    document.body.classList.remove('in-battle', 'toasts-left');
    document.body.style.removeProperty('--battle-top');
    document.body.style.removeProperty('--toast-dy');
    this.app.save.stats.playSeconds += (performance.now() - this.playStart) / 1000;
    this.root.remove();
  }

  // ================================================================== layout & HUD

  private speeds() {
    return [1, 2, 3, ...(hasFlag(this.app.save, 'speed4') ? [4] : [])];
  }

  /** World-px box around the castle's wall ring and keep (field rubble left out), for the opening view. */
  private castleBox() {
    const g = this.world.grid;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < g.n; i++) {
      const t = g.tiles[i];
      if (t !== Tile.WALL && t !== Tile.TOWER && t !== Tile.GATE && t !== Tile.GATE_BROKEN && t !== Tile.KEEP) continue;
      const x = tx(i);
      const y = ty(i);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? undefined : { x0: x0 * TILE, y0: y0 * TILE, x1: (x1 + 1) * TILE, y1: (y1 + 1) * TILE };
  }

  /** Fit the canvas between the HUD bars. The map never jumps: the world point under the screen centre stays put. */
  private layout() {
    const r = this.root.getBoundingClientRect();
    const bottomBar = this.els.bottom?.offsetHeight ?? 70;
    const top = (this.els.top?.offsetHeight ?? 44) + 4;
    const bottom = bottomBar + 4;
    this.root.style.setProperty('--hud-bottom', `${bottomBar}px`);
    this.root.style.setProperty('--hud-top', `${top - 4}px`);
    // alerts (outside this root) sit just under the top bar, whatever its height
    document.body.style.setProperty('--battle-top', `${top - 4}px`);
    const cam = this.renderer.cam;
    const w = Math.max(1, r.width);
    const hh = Math.max(1, r.height);
    if (this.laidOut && cam.w === w && cam.h === hh && cam.insetTop === top && cam.insetBottom === bottom) return;
    const wx = cam.toWorldX(cam.w / 2);
    const wy = cam.toWorldY(cam.h / 2);
    this.renderer.resize(w, hh, top, bottom);
    if (this.laidOut) {
      cam.x = wx;
      cam.y = wy + cam.centerOffsetY() / cam.zoom;
      cam.clamp();
    }
  }

  private buildHud() {
    const w = this.world;
    const s = this.app.save;
    const E = this.els;
    // ---- top bar
    E.menu = h('button', { class: 'hud-btn', 'aria-label': '메뉴', onclick: () => this.openMenu() }, '☰');
    E.wave = h('div', { class: 'wave-label' });
    E.waveBar = bar(0, 'wave');
    E.keep = h('div', { class: 'keep-label' });
    E.keepBar = bar(1, 'keep');
    E.sup = h('div', { class: 'supplies' });
    E.pause = h('button', { class: 'hud-btn', 'aria-label': '일시정지', onclick: () => this.togglePause() }, '⏸');
    const speedBtns = this.speeds().map((sp) =>
      h('button', { class: 'hud-btn speed' + (sp === this.speed ? ' on' : ''), 'data-speed': sp, 'aria-label': `${sp}배속`, onclick: () => this.setSpeed(sp) }, `${sp}×`),
    );
    E.top = h(
      'div',
      { class: 'hud-top' },
      E.menu,
      h('div', { class: 'hud-status' }, h('div', { class: 'row' }, E.wave, E.waveBar), h('div', { class: 'row' }, E.keep, E.keepBar)),
      E.sup,
      h('div', { class: 'speeds' }, E.pause, ...speedBtns),
    );
    // ---- banners (pause / targeting / approach / deploy)
    E.banner = h('div', { class: 'hud-banner hidden' });
    // ---- left: presets
    const preset = (kind: 'allAuto' | 'manWalls' | 'fallback' | 'holdAll', icon: string, label: string) =>
      h(
        'button',
        {
          class: 'side-btn',
          onclick: () => {
            this.world.preset(kind);
            if (kind !== 'holdAll') this.charges.clear();
            audio.play('order');
            haptic(s.settings.haptics);
            toast(label, 'info', undefined, 1400);
            this.renderStrip();
            this.updateHud(true);
          },
        },
        h('span', { class: 'ico' }, icon),
        h('span', { class: 'lbl' }, label),
      );
    E.left = h('div', { class: 'hud-left' }, preset('allAuto', '⚙', '전원 자동'), preset('manWalls', '⛨', '원위치'), preset('holdAll', '✋', '위치 고수'), preset('fallback', '⇲', '본성 후퇴'));
    // ---- right: abilities
    const abil = h('div', { class: 'hud-right' });
    for (const id of ['volley', 'oil', 'rally', 'reserve'] as AbilityId[]) {
      if (!w.abilities[id].unlocked) continue;
      const info = ABILITY_INFO[id];
      const b = h(
        'button',
        { class: 'ability', 'aria-label': info.name, title: info.desc, onclick: () => this.pressAbility(id) },
        h('span', { class: 'ico' }, { volley: '➶', oil: '♨', rally: '⚑', reserve: '✚' }[id]),
        h('span', { class: 'lbl' }, info.name),
        h('span', { class: 'cd' }),
      );
      this.abilityBtns[id] = b;
      abil.append(b);
    }
    E.right = abil;
    // ---- selection strip: docked in the bottom bar next to the cards, so it never covers the map
    E.strip = h('div', { class: 'sel-strip hidden' });
    // ---- bottom squad cards
    E.cards = h('div', { class: 'cards' });
    E.start = h('button', { class: 'btn primary start-btn', onclick: () => this.startBattle() }, '전투 시작');
    // ---- intermission panel (countdown, next approach, war council) floats just above the bottom bar
    E.inter = h('div', { class: 'inter hidden' });
    E.bottom = h('div', { class: 'hud-bottom' }, E.cards, E.strip, E.start);
    this.root.append(E.top, E.banner, E.left, E.right, E.inter, E.bottom, h('div', { class: 'rotate-hint' }, '📱↻ 가로로 돌리면 더 넓게 보입니다'));
    this.rebuildCards();
  }

  private rebuildCards() {
    const E = this.els;
    clear(E.cards);
    const nums = squadNumbers(this.world.squads.map((sq) => ({ sq, type: sq.type.id, name: sq.name })));
    const label = new Map<Squad, number>();
    for (const [k, n] of nums) label.set(k.sq, n);
    this.renderer.labels.clear();
    this.cards = this.world.squads.map((sq) => {
      const n = label.get(sq);
      this.renderer.labels.set(sq.id, sq.type.short + (n ?? ''));
      const c = h(
        'button',
        { class: 'card', onclick: () => this.cardTap(sq) },
        h('span', { class: 'glyph' }, sq.type.short, n ? h('i', { class: 'num' }, String(n)) : null),
        h('span', { class: 'cnt' }),
        h('span', { class: 'mor' }, h('i')),
        h('span', { class: 'ammo' }, h('i')),
        h('span', { class: 'flag' }),
      );
      E.cards.append(c);
      return c;
    });
  }

  private cardTap(sq: Squad) {
    if (sq.alive === 0) return;
    if (this.selected === sq) {
      // second tap: centre camera on the squad
      const cam = this.renderer.cam;
      cam.x = sq.cx;
      cam.y = sq.cy;
      cam.clamp();
      return;
    }
    this.select(sq);
  }

  private select(sq: Squad | null) {
    this.selected = sq;
    this.renderer.selected = sq;
    if (sq) {
      // choosing a squad always ends ability aiming, so the next tap is a move order, not a volley
      this.targeting = null;
      audio.play('select');
      haptic(this.app.save.settings.haptics, 8);
      // while deploying the banner says how to place; enemy focus only makes sense once the battle runs
      if (this.world.state !== 'deploy') this.firstHint('select', '땅 탭: 이동 · 적 탭: 집중 공격');
    }
    this.renderStrip();
    this.updateHud(true);
    this.layout();
    // keep the selected card in view when the strip narrows the card row (scroll the row only, never the page)
    const card = sq ? this.cards[this.world.squads.indexOf(sq)] : null;
    const row = this.els.cards;
    if (card) {
      const cr = card.getBoundingClientRect();
      const rr = row.getBoundingClientRect();
      if (cr.left < rr.left) row.scrollLeft -= rr.left - cr.left + 4;
      else if (cr.right > rr.right) row.scrollLeft += cr.right - rr.right + 4;
    }
  }

  private renderStrip() {
    const E = this.els;
    const sq = this.selected;
    clear(E.strip);
    E.bottom.classList.toggle('has-sel', !!sq);
    if (!sq) {
      E.strip.classList.add('hidden');
      return;
    }
    E.strip.classList.remove('hidden');
    const w = this.world;
    const stanceBtn = (st: Stance) =>
      h(
        'button',
        {
          class: 'chip' + (sq.stance === st ? ' on' : ''),
          'aria-pressed': sq.stance === st ? 'true' : 'false',
          onclick: () => {
            w.commandStance(sq, st);
            this.charges.delete(sq);
            audio.play('click');
            this.renderStrip();
          },
        },
        STANCE_NAMES[st],
      );
    E.strip.append(
      h('span', { class: 'sel-name' }, sq.name, h('small', null, RANK_NAMES[sq.rank] ?? '')),
      h(
        'button',
        {
          class: 'chip auto' + (sq.auto ? ' on' : ''),
          'aria-pressed': sq.auto ? 'true' : 'false',
          onclick: () => {
            w.commandAuto(sq, !sq.auto);
            audio.play('click');
            this.renderStrip();
          },
        },
        sq.auto ? '자동' : '수동',
      ),
      stanceBtn('hold'),
      stanceBtn('defend'),
      stanceBtn('aggressive'),
      h(
        'button',
        {
          class: 'chip',
          onclick: () => {
            w.commandRetreat(sq);
            this.charges.delete(sq);
            audio.play('order');
            this.renderStrip();
          },
        },
        '후퇴',
      ),
      h('button', { class: 'chip close', 'aria-label': '선택 해제', onclick: () => this.select(null) }, '✕'),
    );
  }

  private setSpeed(sp: number) {
    if (!this.speeds().includes(sp)) return;
    this.speed = sp;
    this.paused = false;
    this.els.pause.textContent = '⏸';
    for (const b of this.root.querySelectorAll<HTMLElement>('.speed')) b.classList.toggle('on', Number(b.dataset.speed) === sp);
    const st = this.app.save.settings;
    if (st.speed !== sp) {
      st.speed = sp;
      this.app.persist();
    }
    this.updateHud(true);
  }

  togglePause(force?: boolean) {
    this.paused = force ?? !this.paused;
    this.els.pause.textContent = this.paused ? '▶' : '⏸';
    this.els.pause.setAttribute('aria-label', this.paused ? '계속' : '일시정지');
    this.updateHud(true);
  }

  private edgeText(edges: string[]) {
    return edges.map((e) => EDGE_NAMES[e] ?? e).join('·');
  }

  private updateHud(force = false) {
    const w = this.world;
    const E = this.els;
    const now = performance.now();
    if (!force && now - this.hudT < 120) return;
    this.hudT = now;
    const total = w.totalWaves();
    const wi = Math.max(0, w.waveIdx);
    E.wave.textContent = this.setup.mode === 'endless' ? `물결 ${wi + 1}` : `물결 ${Math.min(total, wi + 1)}/${total}`;
    const prog = w.state === 'deploy' ? 0 : w.progress();
    (E.waveBar.firstChild as HTMLElement).style.width = `${(prog * 100).toFixed(1)}%`;
    const kp = Math.max(0, w.keepHp / w.keepMax);
    E.keep.textContent = `본성 ${Math.round(kp * 100)}%`;
    const kf = E.keepBar.firstChild as HTMLElement;
    kf.style.width = `${(kp * 100).toFixed(1)}%`;
    E.keepBar.classList.toggle('danger', kp < 0.35);
    const sp = w.supplies;
    const low = (k: 'arrows' | 'food' | 'meds' | 'mats') => (sp[k] < w.startSupplies[k] * 0.15 ? ' low' : '');
    E.sup.innerHTML = '';
    E.sup.append(
      h('span', { class: 'sup' + low('arrows'), title: '화살' }, '➶ ', fmt(sp.arrows)),
      h('span', { class: 'sup' + low('food') + (w.starving ? ' low' : ''), title: '식량' }, '🍞 ', fmt(sp.food)),
      h('span', { class: 'sup' + low('meds'), title: '의약품' }, '✚ ', fmt(sp.meds)),
      h('span', { class: 'sup' + low('mats'), title: '자재' }, '⚒ ', fmt(sp.mats)),
    );
    // cards
    if (this.cards.length !== w.squads.length) this.rebuildCards();
    w.squads.forEach((sq, i) => {
      const c = this.cards[i];
      const dead = sq.alive === 0;
      c.classList.toggle('dead', dead);
      c.classList.toggle('sel', sq === this.selected);
      c.classList.toggle('routing', sq.routing);
      c.classList.toggle('manual', !sq.auto);
      c.classList.toggle('engaged', sq.engaged > 0);
      (c.children[1] as HTMLElement).textContent = `${sq.alive}/${sq.size}`;
      const mor = c.children[2].firstChild as HTMLElement;
      mor.style.width = `${sq.morale}%`;
      mor.className = sq.morale >= 75 ? 'hi' : sq.morale >= 40 ? 'mid' : 'lo';
      const ammoEl = c.children[3] as HTMLElement;
      if (sq.type.ranged) {
        let a = 0;
        let m = 0;
        for (const u of sq.units)
          if (u.state === ST.ACTIVE) {
            a += u.ammo;
            m += u.maxAmmo;
          }
        (ammoEl.firstChild as HTMLElement).style.width = `${m ? (a / m) * 100 : 0}%`;
        ammoEl.style.display = '';
      } else ammoEl.style.display = 'none';
      (c.children[4] as HTMLElement).textContent = dead ? '✝' : sq.routing ? '도주' : this.charges.has(sq) ? '돌격' : sq.auto ? '' : '수동';
      c.setAttribute('aria-label', `${sq.name} ${sq.alive}명 사기 ${Math.round(sq.morale)}`);
    });
    // abilities
    for (const id of Object.keys(this.abilityBtns) as AbilityId[]) {
      const b = this.abilityBtns[id]!;
      const a = w.abilities[id];
      const why = w.state === 'deploy' ? '전투 중에만' : w.canUse(id);
      const frac = a.max > 0 && a.cd > 0 ? a.cd / a.max : 0;
      (b.querySelector('.cd') as HTMLElement).style.background = frac > 0 ? `conic-gradient(rgba(0,0,0,0.65) ${frac * 360}deg, transparent 0)` : 'none';
      b.classList.toggle('ready', !why);
      b.classList.toggle('armed', this.targeting === id);
      b.disabled = false;
      b.setAttribute('aria-disabled', why ? 'true' : 'false');
      if (id === 'reserve' && a.used > 0) b.classList.add('spent');
    }
    // banner
    let text = '';
    let cls = '';
    if (w.state === 'deploy') {
      const first = this.edgeText(w.nextWaveEdges());
      const how = this.selected ? `${this.selected.name}: 파란 칸을 탭해 배치` : '배치 — 깃발을 끌어 파란 칸에 두세요';
      text = `${how}${first ? ` · 첫 공세: ${first}` : ''}`;
      cls = 'deploy';
    } else if (this.targeting) {
      text = `${ABILITY_INFO[this.targeting].name}: 지도에서 지점을 탭하세요 (다시 누르면 취소)`;
      cls = 'target';
    } else if (this.paused && w.state !== 'intermission') {
      // in an intermission the panel shows the pause itself, so no second banner over the castle
      text = '일시정지 — 명령은 계속 내릴 수 있습니다';
      cls = 'paused';
    } else if (this.approaching) {
      text = '⏩ 적 접근 중';
      cls = 'ff';
    }
    if (E.banner.textContent !== text) E.banner.textContent = text;
    E.banner.className = 'hud-banner ' + cls + (text ? '' : ' hidden');
    this.updateInter();
    E.start.style.display = w.state === 'deploy' ? '' : 'none';
    if (this.selected && this.selected.alive === 0) this.select(null);
    this.updateOccluders();
    this.placeToasts();
  }

  /** HUD panels over the map, so the renderer keeps approach arrows out from under them. */
  private updateOccluders() {
    const E = this.els;
    const cr = this.canvas.getBoundingClientRect();
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    // each side column as one block (the buttons and the gaps between them)
    const block = (els: Element[]) => {
      const rs = els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
      if (!rs.length) return;
      out.push({
        x0: Math.min(...rs.map((r) => r.left)) - cr.left,
        y0: Math.min(...rs.map((r) => r.top)) - cr.top,
        x1: Math.max(...rs.map((r) => r.right)) - cr.left,
        y1: Math.max(...rs.map((r) => r.bottom)) - cr.top,
      });
    };
    block([...E.left.children]);
    block([...E.right.children]);
    if (!E.inter.classList.contains('hidden')) block([E.inter]);
    if (!E.banner.classList.contains('hidden')) block([E.banner]);
    this.renderer.occluders = out;
  }

  /**
   * Put the alert column (top-left or top-right, right under the top bar or one arrow lower) where it hides
   * the least: never on an approach arrow if any spot is free, then away from off-screen alerts, the keep,
   * banners and enemies. While alerts are showing they only move for a clearly better spot.
   */
  private placeToasts() {
    const root = document.querySelector<HTMLElement>('.toasts');
    const showing = !!root && root.childElementCount > 0;
    const r = this.renderer;
    const cam = r.cam;
    const colW = root?.offsetWidth || Math.min(250, window.innerWidth * 0.38);
    const side = 72;
    const stackH = showing ? Math.max(28, root!.offsetHeight) : 58;
    const pts: { x: number; y: number; wt: number }[] = [];
    for (const p of r.approachPts) pts.push({ x: p.x, y: p.y, wt: 100 });
    for (const p of r.edgePts) pts.push({ x: p.x, y: p.y, wt: 30 });
    const g = this.world.grid;
    pts.push({ x: cam.toScreenX(g.keepX), y: cam.toScreenY(g.keepY), wt: 5 });
    // the castle itself is where squads fight: prefer covering open field (cost by the share of the column over it)
    const cb = this.castle;
    const cs = cb ? { x0: cam.toScreenX(cb.x0), y0: cam.toScreenY(cb.y0), x1: cam.toScreenX(cb.x1), y1: cam.toScreenY(cb.y1) } : null;
    for (const sq of this.world.squads) if (sq.alive > 0) pts.push({ ...r.bannerScreen(sq), wt: 3 });
    for (const e of this.world.activeEnemies) pts.push({ x: cam.toScreenX(e.x), y: cam.toScreenY(e.y), wt: 1 });
    const cands = [
      { left: false, dy: 0, pen: 0 },
      { left: true, dy: 0, pen: 1 },
      { left: false, dy: 44, pen: 4 },
      { left: true, dy: 44, pen: 5 },
    ];
    const cost = (c: (typeof cands)[number]) => {
      const x0 = c.left ? side : cam.w - side - colW;
      const x1 = x0 + colW;
      const y0 = cam.insetTop + c.dy;
      const y1 = y0 + stackH;
      let sum = c.pen;
      for (const p of pts) if (p.x > x0 - 12 && p.x < x1 + 12 && p.y > y0 - 12 && p.y < y1 + 12) sum += p.wt;
      if (cs) sum += (12 * Math.max(0, Math.min(x1, cs.x1) - Math.max(x0, cs.x0)) * Math.max(0, Math.min(y1, cs.y1) - Math.max(y0, cs.y0))) / ((x1 - x0) * (y1 - y0));
      return sum;
    };
    const cur = cands.find((c) => c.left === this.toastPos.left && c.dy === this.toastPos.dy) ?? cands[0];
    const cc = cost(cur);
    let best = cur;
    let bc = cc;
    for (const c of cands) {
      const k = cost(c);
      if (k < bc) {
        bc = k;
        best = c;
      }
    }
    if (best === cur || (showing && cc - bc < 10)) return;
    this.toastPos = { left: best.left, dy: best.dy };
    document.body.classList.toggle('toasts-left', best.left);
    document.body.style.setProperty('--toast-dy', `${best.dy}px`);
  }

  /** Intermission panel: countdown, where the next wave comes from, and the war council choice. */
  private updateInter() {
    const w = this.world;
    const E = this.els;
    if (w.state !== 'intermission') {
      if (!E.inter.classList.contains('hidden')) {
        E.inter.classList.add('hidden');
        this.root.classList.remove('inter-on');
        this.interKey = '';
      }
      return;
    }
    let opts: { id: string; name: string; desc: string }[] = [];
    try {
      opts = w.councilOptions() ?? [];
    } catch (err) {
      this.app.logError('council', err);
    }
    for (const o of opts) this.councilNames.set(o.id, o.name);
    const pick = w.councilPick;
    const showOpts = !pick && opts.length > 0;
    const key = `${w.waveIdx}|${pick ?? ''}|${showOpts ? opts.map((o) => o.id).join(',') : ''}`;
    if (key !== this.interKey) {
      this.interKey = key;
      clear(E.inter);
      const go = h('button', { class: 'btn small primary inter-go', onclick: () => this.world.skipIntermission() }, h('span', null, '바로 시작'), h('small', null, ' +◉'));
      const head = h(
        'div',
        { class: 'inter-head' },
        showOpts ? h('span', { class: 'council-title' }, '작전 회의') : null,
        h('span', { class: 'inter-t' }),
        h('span', { class: 'inter-dir' }),
        pick ? h('span', { class: 'inter-pick' }, `✔ ${this.councilNames.get(pick) ?? pick}`) : null,
        // with council options the button joins their row as a full-height target, so the panel stays low
        showOpts ? null : go,
      );
      E.inter.append(head);
      if (showOpts) {
        E.inter.append(
          h(
            'div',
            { class: 'council' },
            ...opts.slice(0, 3).map((o) =>
              h(
                'button',
                { class: 'council-opt', 'data-id': o.id, onclick: () => this.pickCouncil(o.id, o.name) },
                h('b', null, o.name),
                h('small', null, o.desc),
              ),
            ),
            go,
          ),
        );
      }
      E.inter.classList.toggle('with-council', showOpts);
      E.inter.classList.remove('hidden');
      this.root.classList.add('inter-on');
      this.root.style.setProperty('--inter-h', `${E.inter.offsetHeight}px`);
    }
    E.inter.classList.toggle('paused', this.paused);
    (E.inter.querySelector('.inter-t') as HTMLElement).textContent = `${this.paused ? '⏸ ' : ''}다음 물결 ${Math.max(0, Math.ceil(w.interT))}초`;
    const dir = this.edgeText(w.nextWaveEdges());
    (E.inter.querySelector('.inter-dir') as HTMLElement).textContent = dir ? `다음 공세: ${dir}` : '';
  }

  private pickCouncil(id: string, name: string) {
    let ok = false;
    try {
      ok = this.world.chooseCouncil(id);
    } catch (err) {
      this.app.logError('council', err);
    }
    if (ok) {
      audio.play('order');
      haptic(this.app.save.settings.haptics, 15);
      toast(`작전 회의: ${name}`, 'good', undefined, 1800);
    } else {
      audio.play('deny');
      toast('지금은 고를 수 없습니다.', 'warn', undefined, 1500);
    }
    this.interKey = '';
    this.updateHud(true);
  }

  // ================================================================== loop

  /**
   * True while nobody has met the enemy yet: no missiles in the air, no squad engaged, no attacker inside
   * the walls or within a few tiles of a defender. Reads the world only.
   */
  private noContact(): boolean {
    const w = this.world;
    // an intermission is not contact: the next wave's walk-in can be fast-forwarded from its first step
    if (w.state === 'intermission') return true;
    if (w.state !== 'battle') return false;
    if (w.projectiles.length) return false;
    const g = w.grid;
    const near = 5 * TILE;
    let hit = false;
    for (const e of w.activeEnemies) {
      if (e.fleeing) continue;
      const t = tileAt(e.x, e.y);
      if (t >= 0 && t < g.n && g.inside[t]) return false;
      w.dHash.each(e.x, e.y, near, () => {
        hit = true;
        return true;
      });
      if (hit) return false;
    }
    for (const sq of w.squads) if (sq.engaged > 0) return false;
    return true;
  }

  private loop = (ts: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    const w = this.world;
    // any open dialog (menu, tips, purchase confirm) freezes the battle
    const blocked = !!document.querySelector('.modal-back');
    if (!this.crashed && !this.paused && !blocked && (w.state === 'battle' || w.state === 'intermission')) {
      // fast-forward the walk-in: only how many fixed steps run per frame changes, never the steps themselves
      if (!this.noContact()) this.contactT = w.t;
      const ff = w.state === 'battle' && w.t - this.contactT >= CONTACT_HOLD && this.speed < APPROACH_SPEED;
      if (ff !== this.approaching) {
        this.approaching = ff;
        this.updateHud(true);
      }
      this.acc += dt * (ff ? APPROACH_SPEED : this.speed);
      let n = 0;
      try {
        while (this.acc >= DT && n < 14) {
          w.step();
          this.acc -= DT;
          n++;
          if (ff && !this.noContact()) {
            // contact: drop back to the chosen speed right away
            this.contactT = w.t;
            this.acc = Math.min(this.acc, DT);
            break;
          }
        }
      } catch (err) {
        this.onCrash(err);
      }
      if (n >= 14) this.acc = 0; // device too slow for this speed: slow down instead of spiralling
    } else if (this.approaching) {
      this.approaching = false;
      this.updateHud(true);
    }
    this.checkCharges();
    // resume point: at the start of every wave break (and the end) and every ~20 s of real time, never per frame
    if (w.state !== this.lastState) {
      this.lastState = w.state;
      if (w.state === 'intermission' || w.state === 'won' || w.state === 'lost') {
        this.saveResume();
        this.lastResumeSave = ts;
      }
    }
    if (ts - this.lastResumeSave >= RESUME_SAVE_MS) {
      this.lastResumeSave = ts;
      this.saveResume();
    }
    const alpha = Math.max(0, Math.min(1, this.acc / DT));
    try {
      this.renderer.render(this.paused ? 1 : alpha, dt);
    } catch (err) {
      this.app.logError('render', err);
    }
    audio.setListener(this.renderer.cam.x, 600 / this.renderer.cam.zoom);
    this.drainEvents();
    this.updateHud();
    if ((w.state === 'won' || w.state === 'lost') && !this.resultShown) {
      if (!this.endT) {
        this.endT = ts;
        audio.play(w.state === 'won' ? 'victory' : 'defeat');
      }
      if (ts - this.endT > 1400) {
        this.resultShown = true;
        this.showResult(w.result!);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** A charge (melee squad sent at a tapped enemy) ends when the target falls, flees or is no longer the focus. */
  private checkCharges() {
    if (!this.charges.size) return;
    let ended: Squad[] = [];
    try {
      ended = this.charges.check(this.world);
    } catch (err) {
      this.app.logError('charges', err);
      this.charges.clear();
    }
    if (this.selected && ended.includes(this.selected)) this.renderStrip();
  }

  private onCrash(err: unknown) {
    this.crashed = true;
    // "this battle is not recorded": a crash leaves no resume point behind either
    this.recordClosed = true;
    clearRecord(this.app.kv);
    this.app.logError('battle', err);
    void modal(
      '전투를 이어갈 수 없습니다',
      h('p', null, '예상하지 못한 문제가 생겼습니다. 이번 전투는 기록되지 않으며 병력 손실도 없습니다. 같은 전투를 다시 시작할 수 있습니다.'),
      [
        { label: '나가기', value: 'exit', kind: 'ghost' },
        { label: '다시 시작', value: 'retry', kind: 'primary' },
      ],
      { dismissable: false },
    ).then((v) => this.app.exitBattle(this, null, v === 'retry'));
  }

  private drainEvents() {
    const w = this.world;
    if (!w.events.length) return;
    const evs = w.events.splice(0, w.events.length);
    this.placeToasts();
    for (const e of evs) this.onEvent(e);
  }

  private onEvent(e: GameEvent) {
    const s = this.app.save.settings;
    const jump =
      e.x !== undefined && e.y !== undefined
        ? () => {
            const cam = this.renderer.cam;
            cam.x = e.x!;
            cam.y = e.y!;
            cam.clamp();
            this.renderer.ping(e.x!, e.y!, '#ffd54a');
          }
        : undefined;
    if (e.x !== undefined && e.y !== undefined && (e.level === 'danger' || e.level === 'warn')) this.renderer.ping(e.x, e.y, e.level === 'danger' ? '#ff5040' : '#ffb040');
    if (e.level === 'danger') {
      audio.play('alarm');
      haptic(s.haptics, 30);
    }
    if (e.type === 'cleared') audio.play('coin');
    // short-lived: the map matters more than the log
    toast(fixParticles(e.text), e.level === 'good' ? 'good' : e.level, jump, e.level === 'danger' ? 3000 : 2000);
    if (e.type === 'breach') this.firstHint('breach', '돌파구! 근접 분대를 보내거나 "본성 후퇴"를 누르세요.');
    if (e.type === 'rout') this.firstHint('rout', '사기가 무너진 분대는 도주합니다. "함성"으로 붙잡으세요.');
  }

  private firstHint(key: string, text: string) {
    const s = this.app.save;
    if (!s.settings.showTips || this.hintShown.has(key) || s.seenTips.includes('hint_' + key)) return;
    this.hintShown.add(key);
    s.seenTips.push('hint_' + key);
    toast('💡 ' + text, 'info', undefined, 4500, 'hint');
  }

  // ================================================================== actions

  private startBattle() {
    if (this.world.state !== 'deploy') return;
    this.world.start();
    this.renderer.deployMode = false;
    audio.play('horn');
    this.updateHud(true);
    this.layout();
    this.saveResume();
    this.lastResumeSave = performance.now();
  }

  private pressAbility(id: AbilityId) {
    const w = this.world;
    if (this.targeting === id) {
      this.targeting = null;
      this.updateHud(true);
      return;
    }
    const why = w.state === 'deploy' ? '전투가 시작된 뒤에 쓸 수 있습니다.' : w.canUse(id);
    if (why) {
      audio.play('deny');
      toast(why, 'warn', undefined, 1600);
      return;
    }
    if (!ABILITY_INFO[id].needsTarget) {
      const err = w.useAbility(id, 0, 0);
      if (err) toast(err, 'warn');
      else {
        audio.play('horn');
        haptic(this.app.save.settings.haptics, 25);
      }
      this.updateHud(true);
      return;
    }
    this.select(null);
    this.targeting = id;
    this.updateHud(true);
  }

  private useTargeted(wx: number, wy: number) {
    const id = this.targeting!;
    const err = this.world.useAbility(id, wx, wy);
    if (err) {
      audio.play('deny');
      toast(err, 'warn', undefined, 1800);
      return;
    }
    haptic(this.app.save.settings.haptics, 25);
    this.targeting = null;
    this.updateHud(true);
  }

  private orderTo(sq: Squad, sx: number, sy: number) {
    const w = this.world;
    const cam = this.renderer.cam;
    const wx = cam.toWorldX(sx);
    const wy = cam.toWorldY(sy);
    if (wx < 0 || wy < 0 || wx >= 960 || wy >= 544) return;
    if (w.state === 'deploy') {
      const t = tileAt(wx, wy);
      if (!w.grid.deployable(t)) {
        toast('성 안쪽 파란 칸에만 배치할 수 있습니다.', 'warn', undefined, 1600);
        audio.play('deny');
        return;
      }
      w.placeSquad(sq, t);
      audio.play('order');
      return;
    }
    const e = this.renderer.enemyAt(sx, sy);
    if (e && sq.type.ranged) {
      w.commandFocus(sq, e);
      this.renderer.ping(e.x, e.y, '#ff7060');
      toast(`${sq.name}: 집중 사격`, 'info', undefined, 1200);
    } else if (e) {
      // charge: pursue this target, then fall back to the stance the squad had before
      this.charges.start(w, sq, e);
      this.renderer.ping(e.x, e.y, '#ff7060');
      toast(`${nameJosa(sq.name, '이/가')} 돌격합니다`, 'info', undefined, 1200);
    } else {
      w.commandMove(sq, wx, wy);
      this.renderer.ping(wx, wy, '#ffe08a');
      this.firstHint('manual', '명령한 분대는 "수동"이 됩니다. 다시 누르면 자동.');
    }
    audio.play('order');
    haptic(this.app.save.settings.haptics, 10);
    this.checkCharges();
    this.renderStrip();
    this.updateHud(true);
  }

  // ================================================================== input

  private bindInput() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.onCancel(e);
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        this.renderer.cam.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      },
      { passive: false },
    );
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.addEventListener('keydown', this.onKey);
    this.root.tabIndex = -1;
    this.root.focus({ preventScroll: true });
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      this.togglePause();
    } else if (e.key >= '1' && e.key <= '4') this.setSpeed(Number(e.key));
    else if (e.key === 'Escape') {
      if (this.targeting) {
        this.targeting = null;
        this.updateHud(true);
      } else this.select(null);
    }
  };

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /**
   * Squad a touch starts on. Nothing selected: generous (banner within 30 px or one of its soldiers).
   * A squad selected: only a direct hit on a banner (14 px; 20 px for the selected one so it can be dragged),
   * so taps next to a banner stay move or focus orders.
   */
  private pickSquad(x: number, y: number): Squad | null {
    if (this.targeting) return null;
    const r = this.renderer;
    const sel = this.selected;
    if (!sel) return r.squadAt(x, y, 30, true);
    return r.squadAt(x, y, 14, false, (sq) => (sq === sel ? 20 : 14));
  }

  private onDown = (e: PointerEvent) => {
    audio.unlock();
    const p = this.local(e);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now() });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: 'pinch', moved: true, pinchD: Math.hypot(a.x - b.x, a.y - b.y), pinchZ: this.renderer.cam.zoom, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2 };
      this.renderer.dragLine = null;
      return;
    }
    if (this.pointers.size > 2) return;
    const sq = this.pickSquad(p.x, p.y);
    this.gesture = sq ? { kind: 'squad', squad: sq, moved: false } : { kind: 'pan', moved: false };
  };

  private onMove = (e: PointerEvent) => {
    const pt = this.pointers.get(e.pointerId);
    if (!pt) return;
    const p = this.local(e);
    const dx = p.x - pt.x;
    const dy = p.y - pt.y;
    pt.x = p.x;
    pt.y = p.y;
    const g = this.gesture;
    const cam = this.renderer.cam;
    if (g.kind === 'pinch' && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      cam.pan(mx - g.midX!, my - g.midY!);
      g.midX = mx;
      g.midY = my;
      const target = (g.pinchZ! * d) / Math.max(10, g.pinchD!);
      cam.zoomAt(mx, my, target / cam.zoom);
      return;
    }
    if (!g.moved && Math.hypot(p.x - pt.sx, p.y - pt.sy) > 9) g.moved = true;
    if (!g.moved) return;
    if (g.kind === 'pan') cam.pan(dx, dy);
    else if (g.kind === 'squad' && g.squad) {
      this.renderer.dragLine = { x0: g.squad.cx, y0: g.squad.cy, x1: cam.toWorldX(p.x), y1: cam.toWorldY(p.y) };
    }
  };

  private onUp = (e: PointerEvent) => {
    const pt = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!pt) return;
    const g = this.gesture;
    if (g.kind === 'pinch') {
      if (this.pointers.size === 0) this.gesture = { kind: 'none', moved: false };
      return;
    }
    this.renderer.dragLine = null;
    const p = { x: pt.x, y: pt.y };
    if (g.kind === 'squad' && g.squad && g.moved) {
      if (this.selected !== g.squad) {
        this.selected = g.squad;
        this.renderer.selected = g.squad;
        this.targeting = null;
      }
      this.orderTo(g.squad, p.x, p.y);
      this.renderStrip();
      this.updateHud(true);
      this.gesture = { kind: 'none', moved: false };
      return;
    }
    this.gesture = { kind: 'none', moved: false };
    if (g.moved) return;
    if (performance.now() - pt.t > 600) return; // long press without movement: ignore
    this.tap(p.x, p.y, g.kind === 'squad' ? g.squad ?? null : null);
  };

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.gesture = { kind: 'none', moved: false };
      this.renderer.dragLine = null;
    }
  };

  private tap(x: number, y: number, squad: Squad | null) {
    const cam = this.renderer.cam;
    const now = performance.now();
    const dbl = now - this.lastTap.t < 320 && Math.hypot(x - this.lastTap.x, y - this.lastTap.y) < 30;
    this.lastTap = { t: now, x, y };
    if (this.targeting) {
      this.useTargeted(cam.toWorldX(x), cam.toWorldY(y));
      return;
    }
    if (squad) {
      this.select(this.selected === squad && !dbl ? null : squad);
      return;
    }
    if (this.selected) {
      this.orderTo(this.selected, x, y);
      return;
    }
    if (dbl) {
      if (cam.zoom > cam.fitZoom() * 1.6) cam.fit();
      else cam.zoomAt(x, y, 1.8);
    }
  }

  // ================================================================== menus & results

  private async introTips() {
    const s = this.app.save;
    const st = this.setup.stage;
    // the scouting report (story + tips) is on the pre-battle screen, so no second copy here
    if (st.tips?.length && !s.seenTips.includes('stage_' + st.id)) s.seenTips.push('stage_' + st.id);
    if (!s.tutorialDone && this.setup.mode === 'campaign' && st.index === 1) {
      const pages = [
        ['분대는 스스로 싸웁니다', '분대는 알아서 성벽을 지킵니다. 당신은 큰 그림만 지휘하세요. ⏸ 일시정지 중에도 명령할 수 있습니다.'],
        ['한 손가락 지휘', '깃발이나 아래 카드를 탭해 선택 → 땅을 탭하면 이동, 적을 탭하면 집중 공격. 빈 곳을 끌면 화면 이동, 두 손가락으로 확대.'],
      ];
      for (let i = 0; i < pages.length; i++) {
        const v = await modal(pages[i][0], h('p', null, pages[i][1]), [
          ...(i === 0 ? [{ label: '건너뛰기', value: 'skip', kind: 'ghost' as const }] : []),
          { label: i === pages.length - 1 ? '배치하기' : '다음', value: 'next', kind: 'primary' },
        ]);
        if (v === 'skip' || this.destroyed) break;
      }
      s.tutorialDone = true;
    }
    this.app.persist();
  }

  async openMenu() {
    const wasPaused = this.paused;
    this.togglePause(true);
    const v = await modal(
      '작전 중지',
      h('p', null, `${this.setup.stage.name}${this.setup.modName ? ' · ' + this.setup.modName : ''} — 물결 ${Math.max(1, this.world.waveIdx + 1)}`),
      [
        { label: '계속', value: 'resume', kind: 'primary' },
        { label: '처음부터 다시', value: 'restart', kind: 'ghost' },
        { label: this.world.state === 'deploy' ? '나가기' : '후퇴 (결과 반영)', value: 'quit', kind: 'danger' },
      ],
    );
    if (v === 'restart') {
      if (await confirmBox('다시 시작', '이번 전투를 기록 없이 처음부터 다시 시작합니다. 보급 비용도 나가지 않습니다.', '다시 시작')) {
        this.app.exitBattle(this, null, true);
        return;
      }
    } else if (v === 'quit') {
      if (this.world.state === 'deploy') {
        this.app.exitBattle(this, null, false);
        return;
      }
      if (await confirmBox('후퇴', '지금까지 막아낸 물결만큼 위로금을 받고, 이번 전투의 사상자와 보급 비용은 그대로 반영됩니다.', '후퇴', true)) {
        this.world.surrender();
        return;
      }
    }
    this.togglePause(wasPaused);
  }

  private showResult(res: BattleResult) {
    document.querySelector('.toasts')?.replaceChildren();
    // the result is paid out now: from here on there is nothing left to resume
    this.recordClosed = true;
    const rw = this.app.recordBattle(this.setup, res);
    const won = res.won;
    const mins = Math.floor(res.time / 60);
    const secs = Math.round(res.time % 60);
    const statRow = (k: string, v: string | number) => h('div', { class: 'stat' }, h('span', null, k), h('b', null, String(v)));
    const squadRows = res.squads.map((q) => {
      const sq = this.world.squads.find((x) => x.rosterId === q.rosterId);
      return h('tr', null, h('td', null, sq?.name ?? ''), h('td', null, String(q.kills)), h('td', null, String(q.dead.length)), h('td', null, String(q.wounded.length)));
    });
    // on a defeat the advice comes first, so it is never hidden behind the buttons
    const advice = !won && this.setup.mode === 'campaign' ? h('p', { class: 'hint' }, this.defeatAdvice(res)) : null;
    const panel = h(
      'div',
      { class: 'result ' + (won ? 'won' : 'lost') },
      h('h1', null, won ? '성을 지켜냈습니다' : this.setup.mode === 'endless' ? '마지막 물결' : '성이 함락되었습니다'),
      won && this.setup.mode === 'campaign' ? stars(res.stars) : null,
      advice,
      h(
        'div',
        { class: 'stats' },
        statRow(this.setup.mode === 'endless' ? '버틴 물결' : '막아낸 물결', `${res.wavesCleared}${this.setup.mode === 'endless' ? '' : '/' + res.totalWaves}`),
        statRow('처치', fmt(res.kills)),
        statRow('적 도주', fmt(res.routed)),
        statRow('전사', res.dead),
        statRow('부상', res.wounded),
        statRow('후송 생존', res.evacuated),
        statRow('본성 내구', `${Math.round(res.keepPct * 100)}%`),
        statRow('시간', `${mins}:${String(secs).padStart(2, '0')}`),
      ),
      h(
        'div',
        { class: 'rewards' },
        h('h3', null, `보상: 금화 ${fmt(rw.gold)}${rw.medals ? ` · 훈장 ${rw.medals}` : ''} · 연대기 ${rw.passXp}xp`),
        h(
          'ul',
          null,
          ...rw.lines.map((l) => h('li', null, l)),
          ...rw.unlocked.map((l) => h('li', { class: 'good' }, '🔓 ' + l)),
          ...rw.promoted.map((l) => h('li', { class: 'good' }, '⬆ 진급 ' + l)),
          ...rw.achievements.map((l) => h('li', { class: 'good' }, '🏅 업적: ' + l)),
        ),
      ),
      h('details', { class: 'squad-stats' }, h('summary', null, '분대별 전과'), h('table', null, h('tr', null, h('th', null, '분대'), h('th', null, '처치'), h('th', null, '전사'), h('th', null, '부상')), ...squadRows)),
      h(
        'div',
        { class: 'result-buttons' },
        h('button', { class: 'btn ghost', onclick: () => this.app.exitBattle(this, res, true) }, '다시 도전'),
        h('button', { class: 'btn ghost', onclick: () => this.app.exitBattle(this, res, false, 'barracks') }, '병영'),
        won && this.setup.mode === 'campaign' && this.setup.stage.index < 10
          ? h('button', { class: 'btn primary', onclick: () => this.app.exitBattle(this, res, false, 'next') }, '다음 성 ›')
          : h('button', { class: 'btn primary', onclick: () => this.app.exitBattle(this, res, false) }, '계속'),
      ),
    );
    this.root.append(h('div', { class: 'result-back' }, panel));
  }

  private defeatAdvice(res: BattleResult): string {
    const w = this.world;
    const s = this.app.save;
    const wounded = s.roster.reduce((a, r) => a + r.soldiers.filter((x) => x.wounded > 0).length, 0);
    if (w.supplies.arrows < 5 && w.squads.some((q) => q.type.ranged)) return '💡 화살이 바닥났습니다. 출정 전 보급에서 화살을 더 챙기거나 "병참" 연구를 올려 보세요.';
    if (w.starving) return '💡 식량이 떨어졌습니다. 출정 화면의 "식량 필요 / 보유"를 보고 식량을 더 챙기세요.';
    if (res.wavesCleared === 0) return '💡 첫 물결도 막기 어려웠다면 설정에서 난이도를 "쉬움"으로 바꿀 수 있습니다 (보상 85%).';
    if (wounded > 6) return '💡 부상병이 많습니다. 출정 화면의 "모두 치료"를 누르거나 한 전투를 쉬게 하면 회복됩니다.';
    if (Object.values(s.upgrades).reduce((a, b) => a + b, 0) < 4) return '💡 연구소에서 "석공술"·"대장간"을 올리면 성벽과 병사가 훨씬 단단해집니다.';
    return '💡 이전 성을 다시 지켜 금화를 모으고, 석궁대·공병대로 편성을 보강해 보세요. 돌파구가 생기면 "본성 후퇴"로 전열을 좁히는 것도 방법입니다.';
  }

  /** used by App when the tab is hidden (the app may be killed in the background: save a resume point) */
  autoPause() {
    if (this.world.state === 'battle' || this.world.state === 'intermission') this.togglePause(true);
    this.saveResume();
  }

  squadInfo(sq: Squad) {
    return `${sq.name} (${SQUAD_TYPES[sq.type.id].name}) ${sq.alive}/${sq.size} 사기 ${Math.round(sq.morale)} @${tx(sq.destTile)},${ty(sq.destTile)}`;
  }
}
