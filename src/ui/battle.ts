/**
 * Battle screen: owns the World, the renderer, touch input and the HUD.
 *
 * Mobile control model (designed for one thumb + occasional second finger):
 *  - Squads fight on their own (squad AI + war council). The player gives macro orders only.
 *  - Tap a banner or a squad card -> select. Tap ground -> move there. Tap an enemy -> focus it.
 *  - Drag a banner -> move along the drag. One-finger drag on empty ground -> pan. Pinch -> zoom.
 *  - Abilities: tap button, then tap the map. Presets: one tap for the whole army.
 *  - Pause is tactical: every order still works while paused.
 */
import { DT, SQUAD_TYPES } from '../sim/defs';
import { tileAt, tx, ty } from '../sim/grid';
import type { StageDef } from '../sim/stages';
import { ABILITY_INFO, ST, World, type AbilityId, type BattleConfig, type BattleResult, type GameEvent, type Squad, type Stance } from '../sim/world';
import { cosmeticById } from '../meta/cosmetics';
import { RANK_NAMES } from '../meta/progression';
import { hasFlag } from '../meta/shop';
import { Renderer, type Theme } from '../render/renderer';
import { audio, haptic } from './audio';
import { bar, clear, confirmBox, fmt, h, modal, stars, toast } from './dom';
import type { App } from './app';

export type BattleMode = 'campaign' | 'daily' | 'endless';

export interface BattleSetup {
  mode: BattleMode;
  stage: StageDef;
  cfg: BattleConfig;
  modName?: string;
}

const STANCE_NAMES: Record<Stance, string> = { hold: '고수', defend: '방어', aggressive: '추격' };

export function themeFromSave(app: App): Theme {
  const s = app.save;
  const castle = cosmeticById(s.equipped.castle)?.colors ?? ['#8c9099', '#5e626b'];
  const ban = cosmeticById(s.equipped.banner)?.colors ?? ['#2f5fc4', '#f2e6c8'];
  const dye = cosmeticById(s.equipped.dye)?.colors[0] ?? '#3a6fd8';
  return { stone: castle[0], stoneDark: castle[1], dye, bannerField: ban[0], bannerCharge: ban[1], bannerPattern: cosmeticById(s.equipped.banner)?.pattern ?? 'plain' };
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
  private els: Record<string, HTMLElement> = {};
  private cards: HTMLElement[] = [];
  private abilityBtns: Partial<Record<AbilityId, HTMLButtonElement>> = {};
  private ro: ResizeObserver | null = null;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private gesture: { kind: 'none' | 'pan' | 'squad' | 'pinch'; squad?: Squad; moved: boolean; pinchD?: number; pinchZ?: number; midX?: number; midY?: number } = { kind: 'none', moved: false };
  private lastTap = { t: 0, x: 0, y: 0 };
  private hintShown = new Set<string>();
  private playStart = performance.now();

  constructor(app: App, setup: BattleSetup) {
    this.app = app;
    this.setup = setup;
    this.world = new World(setup.cfg);
    this.root = h('div', { class: 'battle' + (app.save.settings.leftHanded ? ' lefty' : '') });
    this.canvas = h('canvas', { class: 'battle-canvas', 'aria-label': '전장' });
    this.root.append(this.canvas);
    this.renderer = new Renderer(this.canvas, themeFromSave(app));
    this.renderer.reduceMotion = app.save.settings.reduceMotion;
    this.renderer.setQuality(app.save.settings.quality === 'low');
    this.renderer.onSound = (k, x) => audio.play(k, x);
    this.buildHud();
    app.screenRoot.append(this.root);
    document.body.classList.add('in-battle');
    this.layout();
    this.renderer.attach(this.world);
    this.renderer.deployMode = true;
    const g = this.world.grid;
    this.renderer.cam.focusCastle(g.keepX, g.keepY);
    this.bindInput();
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.root);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.updateHud(true);
    setTimeout(() => this.introTips(), 250);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    document.body.classList.remove('in-battle');
    this.app.save.stats.playSeconds += (performance.now() - this.playStart) / 1000;
    this.root.remove();
  }

  // ================================================================== layout & HUD

  private layout() {
    const r = this.root.getBoundingClientRect();
    const top = (this.els.top?.offsetHeight ?? 44) + 4;
    const bottom = (this.els.bottom?.offsetHeight ?? 70) + (this.els.strip?.offsetHeight ?? 0) + 4;
    this.renderer.resize(Math.max(1, r.width), Math.max(1, r.height), top, bottom);
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
    const speeds = [1, 2, 3, ...(hasFlag(s, 'speed4') ? [4] : [])];
    E.pause = h('button', { class: 'hud-btn', 'aria-label': '일시정지', onclick: () => this.togglePause() }, '⏸');
    const speedBtns = speeds.map((sp) =>
      h('button', { class: 'hud-btn speed' + (sp === 1 ? ' on' : ''), 'data-speed': sp, onclick: () => this.setSpeed(sp) }, `${sp}×`),
    );
    E.top = h(
      'div',
      { class: 'hud-top' },
      E.menu,
      h('div', { class: 'hud-status' }, h('div', { class: 'row' }, E.wave, E.waveBar), h('div', { class: 'row' }, E.keep, E.keepBar)),
      E.sup,
      h('div', { class: 'speeds' }, E.pause, ...speedBtns),
    );
    // ---- banners (pause / targeting / intermission / deploy)
    E.banner = h('div', { class: 'hud-banner hidden' });
    // ---- left: presets
    const preset = (kind: 'allAuto' | 'manWalls' | 'fallback' | 'holdAll', icon: string, label: string) =>
      h(
        'button',
        {
          class: 'side-btn',
          onclick: () => {
            this.world.preset(kind);
            audio.play('order');
            haptic(s.settings.haptics);
            toast(label, 'info', undefined, 1400);
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
    // ---- selection strip
    E.strip = h('div', { class: 'sel-strip hidden' });
    // ---- bottom squad cards
    E.cards = h('div', { class: 'cards' });
    E.start = h('button', { class: 'btn primary start-btn', onclick: () => this.startBattle() }, '전투 시작');
    // ---- intermission (lives in the bottom bar so it never collides with alerts)
    E.inter = h('div', { class: 'inter hidden' });
    E.bottom = h('div', { class: 'hud-bottom' }, E.cards, E.inter, E.start);
    this.root.append(E.top, E.banner, E.left, E.right, E.strip, E.bottom, h('div', { class: 'rotate-hint' }, '📱↻ 가로로 돌리면 더 넓게 보입니다'));
    this.rebuildCards();
  }

  private rebuildCards() {
    const E = this.els;
    clear(E.cards);
    this.cards = this.world.squads.map((sq) => {
      const c = h(
        'button',
        { class: 'card', onclick: () => this.cardTap(sq) },
        h('span', { class: 'glyph' }, sq.type.short),
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
      audio.play('select');
      haptic(this.app.save.settings.haptics, 8);
      this.firstHint('select', '선택됨: 땅을 탭하면 이동, 적을 탭하면 집중 공격. 깃발을 끌어서 옮길 수도 있습니다.');
    }
    this.renderStrip();
    this.updateHud(true);
    this.layout();
  }

  private renderStrip() {
    const E = this.els;
    const sq = this.selected;
    clear(E.strip);
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
          onclick: () => {
            w.commandStance(sq, st);
            audio.play('click');
            this.renderStrip();
          },
        },
        STANCE_NAMES[st],
      );
    E.strip.append(
      h('span', { class: 'sel-name' }, `${sq.name} · ${RANK_NAMES[sq.rank] ?? ''}`),
      h(
        'button',
        {
          class: 'chip auto' + (sq.auto ? ' on' : ''),
          onclick: () => {
            w.commandAuto(sq, !sq.auto);
            audio.play('click');
            this.renderStrip();
          },
        },
        sq.auto ? '자동 ON' : '자동 OFF',
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
    this.speed = sp;
    this.paused = false;
    for (const b of this.root.querySelectorAll<HTMLElement>('.speed')) b.classList.toggle('on', Number(b.dataset.speed) === sp);
    this.updateHud(true);
  }

  togglePause(force?: boolean) {
    this.paused = force ?? !this.paused;
    this.els.pause.textContent = this.paused ? '▶' : '⏸';
    this.els.pause.setAttribute('aria-label', this.paused ? '계속' : '일시정지');
    this.updateHud(true);
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
        for (const u of sq.units) if (u.state === ST.ACTIVE) {
          a += u.ammo;
          m += u.maxAmmo;
        }
        (ammoEl.firstChild as HTMLElement).style.width = `${m ? (a / m) * 100 : 0}%`;
        ammoEl.style.display = '';
      } else ammoEl.style.display = 'none';
      (c.children[4] as HTMLElement).textContent = dead ? '✝' : sq.routing ? '도주' : sq.auto ? '' : '수동';
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
      text = '배치 단계 — 깃발을 끌어 분대를 옮기세요';
      cls = 'deploy';
    } else if (this.targeting) {
      text = `${ABILITY_INFO[this.targeting].name}: 지도에서 지점을 탭하세요 (다시 누르면 취소)`;
      cls = 'target';
    } else if (this.paused) {
      text = '일시정지 — 명령은 계속 내릴 수 있습니다';
      cls = 'paused';
    }
    E.banner.textContent = text;
    E.banner.className = 'hud-banner ' + cls + (text && !this.selected ? '' : ' hidden');
    // intermission
    if (w.state === 'intermission') {
      E.inter.classList.remove('hidden');
      if (!E.inter.firstChild) {
        E.inter.append(h('span', { class: 'inter-t' }), h('button', { class: 'btn small primary', onclick: () => this.world.skipIntermission() }, '바로 시작 +◉'));
      }
      (E.inter.firstChild as HTMLElement).textContent = `다음 물결 ${Math.ceil(w.interT)}초`;
    } else E.inter.classList.add('hidden');
    E.start.style.display = w.state === 'deploy' ? '' : 'none';
    if (this.selected && this.selected.alive === 0) this.select(null);
  }

  // ================================================================== loop

  private loop = (ts: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    const w = this.world;
    // any open dialog (menu, tips, purchase confirm) freezes the battle
    const blocked = !!document.querySelector('.modal-back');
    if (!this.crashed && !this.paused && !blocked && (w.state === 'battle' || w.state === 'intermission')) {
      this.acc += dt * this.speed;
      let n = 0;
      try {
        while (this.acc >= DT && n < 14) {
          w.step();
          this.acc -= DT;
          n++;
        }
      } catch (err) {
        this.onCrash(err);
      }
      if (n >= 14) this.acc = 0; // device too slow for this speed: slow down instead of spiralling
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

  private onCrash(err: unknown) {
    this.crashed = true;
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
    toast(e.text, e.level === 'good' ? 'good' : e.level, jump, e.level === 'danger' ? 3600 : 2600);
    if (e.type === 'breach') this.firstHint('breach', '돌파구가 생겼습니다! 근접 분대를 선택해 돌파 지점에 배치하거나 "본성 후퇴"로 전열을 좁히세요.');
    if (e.type === 'rout') this.firstHint('rout', '사기가 무너진 분대는 도주합니다. "함성"으로 붙잡거나 본성 근처에서 회복시키세요.');
  }

  private firstHint(key: string, text: string) {
    const s = this.app.save;
    if (!s.settings.showTips || this.hintShown.has(key) || s.seenTips.includes('hint_' + key)) return;
    this.hintShown.add(key);
    s.seenTips.push('hint_' + key);
    toast('💡 ' + text, 'info', undefined, 6000);
  }

  // ================================================================== actions

  private startBattle() {
    if (this.world.state !== 'deploy') return;
    this.world.start();
    this.renderer.deployMode = false;
    audio.play('horn');
    this.updateHud(true);
    this.layout();
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
    this.targeting = id;
    this.select(null);
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
        toast('성 안쪽(파란 칸)에만 배치할 수 있습니다.', 'warn', undefined, 1600);
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
      toast(`${sq.name}: 집중 공격`, 'info', undefined, 1200);
    } else if (e) {
      w.commandFocus(sq, e);
      w.commandMove(sq, e.x, e.y);
      sq.stance = 'aggressive';
      toast(`${sq.name}: 돌격`, 'info', undefined, 1200);
    } else {
      w.commandMove(sq, wx, wy);
      this.firstHint('manual', '직접 명령을 받은 분대는 "수동"이 됩니다. 자동으로 돌려놓으려면 "자동 ON"을 누르세요.');
    }
    this.renderer.ping(wx, wy, '#ffe08a');
    audio.play('order');
    haptic(this.app.save.settings.haptics, 10);
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
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      this.renderer.cam.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
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
      if (this.targeting) this.targeting = null;
      else this.select(null);
    }
  };

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    const sq = this.targeting ? null : this.renderer.squadAt(p.x, p.y, 30);
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
      this.selected = g.squad;
      this.renderer.selected = g.squad;
      this.orderTo(g.squad, p.x, p.y);
      this.renderStrip();
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
    if (!s.tutorialDone && this.setup.mode === 'campaign' && st.index === 1) {
      const pages = [
        ['분대는 스스로 싸웁니다', '모든 분대는 기본적으로 "자동"입니다. 성벽을 지키고, 돌파구로 달려가고, 화살을 보급받습니다. 당신은 큰 그림만 지휘하면 됩니다.'],
        ['한 손가락 지휘', '깃발이나 아래 분대 카드를 탭해 선택 → 땅을 탭하면 이동, 적을 탭하면 집중 공격. 깃발을 끌어서 옮길 수도 있습니다. 빈 곳을 끌면 화면 이동, 두 손가락으로 확대·축소.'],
        ['사기·부상·보급', '분대 카드의 색 막대는 사기입니다. 사기가 무너지면 도주합니다. 쓰러진 병사는 군의대가 살릴 수 있고, 화살과 식량은 한정되어 있습니다.'],
        ['일시정지는 작전 시간', '⏸ 를 누르면 시간이 멈추지만 명령은 계속 내릴 수 있습니다. 준비되면 "전투 시작"!'],
      ];
      for (let i = 0; i < pages.length; i++) {
        const v = await modal(pages[i][0], h('p', null, pages[i][1]), [
          ...(i === 0 ? [{ label: '건너뛰기', value: 'skip', kind: 'ghost' as const }] : []),
          { label: i === pages.length - 1 ? '시작하기' : '다음', value: 'next', kind: 'primary' },
        ]);
        if (v === 'skip' || this.destroyed) break;
      }
      s.tutorialDone = true;
      this.app.persist();
      return;
    }
    if (this.world.state !== 'deploy' || this.destroyed) return;
    const key = 'stage_' + st.id;
    if (s.settings.showTips && (st.tips ?? []).length && !s.seenTips.includes(key) && this.setup.mode === 'campaign') {
      s.seenTips.push(key);
      this.app.persist();
      await modal(`${st.name} — 정찰 보고`, [h('p', { class: 'story' }, st.story), h('ul', { class: 'tips' }, ...(st.tips ?? []).map((t) => h('li', null, t)))], [{ label: '배치하러 가기', value: 'ok', kind: 'primary' }]);
    }
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
      if (await confirmBox('다시 시작', '이번 전투를 기록 없이 처음부터 다시 시작합니다.', '다시 시작')) {
        this.app.exitBattle(this, null, true);
        return;
      }
    } else if (v === 'quit') {
      if (this.world.state === 'deploy') {
        this.app.exitBattle(this, null, false);
        return;
      }
      if (await confirmBox('후퇴', '지금까지 막아낸 물결만큼 위로금을 받고, 이번 전투의 사상자는 그대로 반영됩니다.', '후퇴', true)) {
        this.world.surrender();
        return;
      }
    }
    this.togglePause(wasPaused);
  }

  private showResult(res: BattleResult) {
    document.querySelector('.toasts')?.replaceChildren();
    const rw = this.app.recordBattle(this.setup, res);
    const won = res.won;
    const mins = Math.floor(res.time / 60);
    const secs = Math.round(res.time % 60);
    const statRow = (k: string, v: string | number) => h('div', { class: 'stat' }, h('span', null, k), h('b', null, String(v)));
    const squadRows = res.squads.map((q) => {
      const sq = this.world.squads.find((x) => x.rosterId === q.rosterId);
      return h('tr', null, h('td', null, sq?.name ?? ''), h('td', null, String(q.kills)), h('td', null, String(q.dead.length)), h('td', null, String(q.wounded.length)));
    });
    const panel = h(
      'div',
      { class: 'result ' + (won ? 'won' : 'lost') },
      h('h1', null, won ? '성을 지켜냈습니다' : this.setup.mode === 'endless' ? '마지막 물결' : '성이 함락되었습니다'),
      won && this.setup.mode === 'campaign' ? stars(res.stars) : null,
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
      h('div', { class: 'rewards' }, h('h3', null, `보상: 금화 ${fmt(rw.gold)}${rw.medals ? ` · 훈장 ${rw.medals}` : ''} · 연대기 ${rw.passXp}xp`), h('ul', null, ...rw.lines.map((l) => h('li', null, l)), ...rw.unlocked.map((l) => h('li', { class: 'good' }, '🔓 ' + l)), ...rw.promoted.map((l) => h('li', { class: 'good' }, '⬆ 진급 ' + l)), ...rw.achievements.map((l) => h('li', { class: 'good' }, '🏅 업적: ' + l)))),
      h('details', { class: 'squad-stats' }, h('summary', null, '분대별 전과'), h('table', null, h('tr', null, h('th', null, '분대'), h('th', null, '처치'), h('th', null, '전사'), h('th', null, '부상')), ...squadRows)),
      !won && this.setup.mode === 'campaign' ? h('p', { class: 'hint' }, this.defeatAdvice(res)) : null,
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
    if (w.supplies.arrows < 5 && w.squads.some((q) => q.type.ranged)) return '💡 화살이 바닥났습니다. 출정 전 보급에서 화살을 더 사거나 "병참" 연구를 올려 보세요.';
    if (res.wavesCleared === 0) return '💡 첫 물결도 막기 어려웠다면 설정에서 난이도를 "쉬움"으로 바꿀 수 있습니다 (보상 85%).';
    if (wounded > 6) return '💡 부상병이 많습니다. 병영에서 치료하거나 다음 전투 한 번을 쉬게 하면 회복됩니다.';
    if (Object.values(s.upgrades).reduce((a, b) => a + b, 0) < 4) return '💡 연구소에서 "석공술"·"대장간"을 올리면 성벽과 병사가 훨씬 단단해집니다.';
    return '💡 이전 성을 다시 지켜 금화를 모으고, 석궁대·공병대로 편성을 보강해 보세요. 돌파구가 생기면 "본성 후퇴"로 전열을 좁히는 것도 방법입니다.';
  }

  /** used by App when the tab is hidden */
  autoPause() {
    if (this.world.state === 'battle' || this.world.state === 'intermission') this.togglePause(true);
  }

  squadInfo(sq: Squad) {
    return `${sq.name} (${SQUAD_TYPES[sq.type.id].name}) ${sq.alive}/${sq.size} 사기 ${Math.round(sq.morale)} @${tx(sq.destTile)},${ty(sq.destTile)}`;
  }
}
