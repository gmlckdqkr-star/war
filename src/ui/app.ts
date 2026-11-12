/**
 * App shell: save/load, screens, purchases, error recovery. Everything runs on the device.
 */
import { SQUAD_TYPES, FACTIONS, BANDS, UNITS, type SquadTypeId } from '../sim/defs';
import { STAGES, dailyChallenge, dailyKey, endlessStage, type StageDef, type Supplies } from '../sim/stages';
import { World, type BattleConfig, type BattleResult } from '../sim/world';
import { cosmeticById, seasonCosmetics, type Cosmetic } from '../meta/cosmetics';
import {
  ACHIEVEMENTS,
  RANK_NAMES,
  ROSTER_MAX,
  SQUAD_PRICE,
  SUPPLY_PRICE,
  UPGRADES,
  baseSupplies,
  battleConfig,
  buySquad,
  buyUpgrade,
  defaultLineup,
  dismissSquad,
  maxCleared,
  rankOf,
  readyCount,
  refillCost,
  refillSquad,
  squadCap,
  sweepStage,
  sweepsLeft,
  treatCost,
  treatSquad,
  unlockedTypes,
  upgradeCost,
  type Rewards,
} from '../meta/progression';
import { exportCodeShort, importCodeAny, loadSave, newSave, writeSave, type KV, type LoadResult, type SaveData } from '../meta/save';
import {
  PASS_TIERS,
  XP_PER_TIER,
  claimAll,
  claimReward,
  hasPremium,
  passRewards,
  passTier,
  seasonAt,
  seasonDaysLeft,
  seasonName,
  seasonProductId,
  seasonStarts,
  syncSeason,
  type SeasonChange,
} from '../meta/season';
import { allProducts, buyWithMedals, daysUntilNextWeek, equip, grantPurchase, hasFlag, isPaidCosmetic, krw, productById, seasonPassWarning, weeklyStall, type Product } from '../meta/shop';
import { CANCELLED, MockIAP, type IAPAdapter } from '../meta/iap';
import { REFUND_NOTICE, sellerLine } from '../meta/legal';
import { cosmeticCard, cosmeticPreview } from './preview';
import { audio } from './audio';
import { BattleView, nameJosa, squadNumbers, type BattleMode, type BattleSetup } from './battle';
import { MAX_PACKS, careAll, careCosts, fitPlan, foodForecast, lineupStrength, packsOf, planCost, readyLineup, setWantedSize, settleBattle, wantedSize } from './prebattle';
import { bar, clear, confirmBox, fmt, h, modal, stars, toast } from './dom';
import { RESUME_KEY, clearRecord, loadRecord, newBattleId, replay, resolveStage, stageRefFor, stageSig, type BattleRecord, type ReplayStats } from './resume';
import { RESUME_VER, VERSION } from './version';

export { VERSION };

type Screen = 'home' | 'campaign' | 'barracks' | 'research' | 'chronicle' | 'shop' | 'settings' | 'help' | 'prebattle';

interface PrebattleState {
  mode: BattleMode;
  stage: StageDef;
  lineup: string[];
  extra: Partial<Supplies>;
  seed: number;
  mods?: string[];
  modName?: string;
  /** daily challenge inputs (date key + progress), so the same stage can be rebuilt after a resume */
  daily?: { key: string; maxIdx: number };
}

export class App {
  save: SaveData;
  kv: KV;
  iap: IAPAdapter;
  root: HTMLElement;
  screenRoot: HTMLElement;
  battle: BattleView | null = null;
  screen: Screen = 'home';
  pre: PrebattleState | null = null;
  shopTab: 'stall' | 'store' | 'wardrobe' = 'stall';
  recovered = false;
  private saveTimer = 0;
  private saveFailToastT = 0;
  private storageBanner: HTMLElement | null = null;
  /** called after every successful save (native backup mirror) */
  afterPersist: (() => void) | null = null;
  /** a saved battle is being rebuilt (progress overlay up): screens and the back button wait */
  resuming = false;
  /** timings of the last battle replay (resume or abandon), for tests and the error log */
  lastReplay: ReplayStats | null = null;

  constructor(root: HTMLElement, kv: KV, iap: IAPAdapter) {
    this.root = root;
    this.kv = kv;
    this.iap = iap;
    const lr = loadSave(kv);
    this.save = lr.save;
    this.recovered = lr.recovered;
    const seasonChange = syncSeason(this.save, new Date());
    this.screenRoot = h('div', { class: 'screen-root' });
    root.append(this.screenRoot);
    this.applySettings();
    if (iap instanceof MockIAP) {
      iap.confirm = async (id) => {
        const p = productById(id, new Date());
        return confirmBox('테스트 결제', `웹 체험판의 테스트 결제입니다. 실제 돈은 나가지 않습니다.\n\n${p?.name ?? id} (${p ? krw(p.priceKrw) : ''})`, '테스트 구매');
      };
    }
    void iap
      .init((pid, tx) => {
        if (grantPurchase(this.save, pid, tx, new Date())) {
          this.persist();
          toast('구매가 적용되었습니다. 감사합니다!', 'good');
          if (this.screen === 'shop' || this.screen === 'chronicle') this.go(this.screen);
        }
      })
      .catch((e) => this.logError('iap-init', e));
    this.updateStorageBanner();
    this.persist();
    this.go('home');
    this.checkResume(lr);
    if (lr.source === 'backup' || lr.source === 'day') setTimeout(() => toast('저장 파일 손상을 감지해 백업에서 자동 복구했습니다.', 'warn', undefined, 5000), 600);
    if (lr.lost)
      setTimeout(
        () =>
          void modal(
            '저장 데이터를 읽지 못했습니다',
            h('p', null, '기기에 남아 있던 진행 상황이 손상되어 새로 시작합니다. 예전에 복사해 둔 저장 코드가 있다면 설정 → "저장 코드 불러오기"로 되돌릴 수 있고, 결제 상품은 "구매 복원"으로 되찾을 수 있습니다.'),
            [
              { label: '확인', value: '', kind: 'ghost' },
              { label: '설정 열기', value: 'settings', kind: 'primary' },
            ],
          ).then((v) => v === 'settings' && this.go('settings')),
        500,
      );
    this.notifySeason(seasonChange);
  }

  /** Tell the player what happened when a season rolled over (rewards are auto-claimed, never lost). */
  notifySeason(ch: SeasonChange | null) {
    if (!ch) return;
    const msg = ch.autoClaimed
      ? `${seasonName(ch.from)}이 끝나 받지 않은 보상 ${ch.autoClaimed}개를 자동으로 받았습니다. 새 시즌이 시작되었습니다!`
      : `새 시즌이 시작되었습니다: ${seasonName(ch.to)}`;
    setTimeout(() => toast(msg, 'good', () => this.go('chronicle'), 5000), 900);
  }

  private updateStorageBanner() {
    const mode = this.kv.mode ?? 'ok';
    if (mode === 'ok') {
      this.storageBanner?.remove();
      this.storageBanner = null;
      return;
    }
    if (this.storageBanner) return;
    const text =
      mode === 'memory'
        ? '이 브라우저 설정이 저장을 막고 있어 진행 상황이 저장되지 않습니다.'
        : '기기 저장 공간이 가득 차 진행 상황을 저장하지 못하고 있습니다. 공간을 비우면 자동으로 다시 저장됩니다.';
    this.storageBanner = h('div', { class: 'storage-banner', role: 'alert' }, '⚠ ', text);
    document.body.append(this.storageBanner);
  }

  // ================================================================== infra

  persist() {
    clearTimeout(this.saveTimer);
    let ok = this.kv.mode !== 'memory' && writeSave(this.kv, this.save);
    // the save matters more than a battle's resume point: free that space and try once more
    if (!ok && this.kv.mode !== 'memory' && this.kv.get(RESUME_KEY) !== null) {
      clearRecord(this.kv);
      ok = writeSave(this.kv, this.save);
    }
    if (ok) {
      if (this.kv.mode !== 'ok') this.kv.mode = 'ok';
      if (this.storageBanner) this.updateStorageBanner();
      try {
        this.afterPersist?.();
      } catch {
        /* optional */
      }
      return;
    }
    if (this.kv.mode === 'memory') {
      writeSave(this.kv, this.save);
      return;
    }
    this.kv.mode = 'full';
    this.updateStorageBanner();
    const now = Date.now();
    if (now - this.saveFailToastT > 60000) {
      this.saveFailToastT = now;
      toast('저장 공간이 부족해 저장하지 못했습니다. 기기 저장 공간을 확인해 주세요.', 'danger', undefined, 5000);
    }
  }

  /** Errors are kept on the device only (no telemetry). Players can copy them from Settings if they want. */
  logError(where: string, err: unknown) {
    try {
      const msg = err instanceof Error ? `${err.name}: ${err.message}\n${(err.stack ?? '').split('\n').slice(0, 4).join('\n')}` : String(err);
      const list = JSON.parse(this.kv.get('ashen.errors') ?? '[]') as string[];
      list.push(`${new Date().toISOString()} v${VERSION} [${where}] ${msg}`);
      this.kv.set('ashen.errors', JSON.stringify(list.slice(-20)));
    } catch {
      /* ignore */
    }
    console.error(where, err);
  }

  applySettings() {
    const st = this.save.settings;
    document.documentElement.classList.toggle('big-text', st.bigText);
    document.documentElement.classList.toggle('reduce-motion', st.reduceMotion);
    audio.sfxOn = st.sound;
    audio.setMusic(st.music);
  }

  go(screen: Screen) {
    if (this.battle || this.resuming) return;
    this.screen = screen;
    clear(this.screenRoot);
    try {
      const el = this.render(screen);
      this.screenRoot.append(el);
      (el.querySelector('h1, h2') as HTMLElement | null)?.setAttribute('tabindex', '-1');
    } catch (err) {
      this.logError('screen-' + screen, err);
      clear(this.screenRoot);
      this.screen = 'home';
      if (screen !== 'home') {
        toast('화면을 여는 중 문제가 생겨 첫 화면으로 돌아왔습니다.', 'warn');
        this.screenRoot.append(this.render('home'));
      } else this.screenRoot.append(h('div', { class: 'page' }, h('p', null, '문제가 발생했습니다. 앱을 다시 열어 주세요.')));
    }
  }

  private render(screen: Screen): HTMLElement {
    switch (screen) {
      case 'home':
        return this.homeScreen();
      case 'campaign':
        return this.campaignScreen();
      case 'barracks':
        return this.barracksScreen();
      case 'research':
        return this.researchScreen();
      case 'chronicle':
        return this.chronicleScreen();
      case 'shop':
        return this.shopScreen();
      case 'settings':
        return this.settingsScreen();
      case 'help':
        return this.helpScreen();
      case 'prebattle':
        return this.prebattleScreen();
    }
  }

  private header(title: string, back: Screen | null = 'home') {
    const s = this.save;
    return h(
      'header',
      { class: 'topbar' },
      back ? h('button', { class: 'btn ghost back', 'aria-label': '뒤로', onclick: () => this.go(back) }, '‹ 뒤로') : h('span'),
      h('h1', null, title),
      h('div', { class: 'wallet' }, h('span', { class: 'gold', title: '금화' }, '◉ ', fmt(s.gold)), h('span', { class: 'medal', title: '훈장' }, '✪ ', fmt(s.medals))),
    );
  }

  // ================================================================== home

  private homeScreen() {
    const s = this.save;
    const next = STAGES.find((st) => !(s.stars[st.id] > 0)) ?? STAGES[STAGES.length - 1];
    const claimable = this.claimableCount();
    const daily = this.dailyAvailable();
    const tile = (label: string, sub: string, onclick: () => void, badge = 0, cls = '') =>
      h('button', { class: 'tile ' + cls, onclick }, h('b', null, label), h('small', null, sub), badge ? h('span', { class: 'badge' }, String(badge)) : null);
    return h(
      'div',
      { class: 'page home' },
      h(
        'div',
        { class: 'title-block' },
        h('div', { class: 'logo', 'aria-hidden': 'true' }, '⛫'),
        h('h1', { class: 'game-title' }, '잿빛 성벽'),
        h('p', { class: 'subtitle' }, '최후의 수비 — ' + (cosmeticById(s.equipped.title)?.name ?? '')),
      ),
      h(
        'div',
        { class: 'home-main' },
        h('button', { class: 'btn primary big', onclick: () => this.openStage(next) }, h('span', null, `출정: ${next.name}`), h('small', null, s.stars[next.id] ? '모든 성 수복 — 재도전' : next.subtitle)),
        h(
          'div',
          { class: 'tiles' },
          tile('전역 지도', `별 ${this.totalStars()}/${STAGES.length * 3}`, () => this.go('campaign')),
          tile('병영', `${s.roster.length}개 분대`, () => this.go('barracks'), this.woundedCount() ? 0 : 0),
          tile('연구', '성과 병사 강화', () => this.go('research')),
          tile('전쟁 연대기', `${passTier(s)}/${PASS_TIERS} 단계`, () => this.go('chronicle'), claimable),
          tile('상점·옷장', '외관·후원', () => this.go('shop')),
          tile('오늘의 공성', daily ? '보상 대기 중' : maxCleared(s) >= 2 ? '오늘 완료' : '2번째 성 후 개방', () => this.openDaily(), daily ? 1 : 0, maxCleared(s) >= 2 ? '' : 'locked'),
        ),
      ),
      h('nav', { class: 'home-foot' }, h('button', { class: 'btn ghost', onclick: () => this.go('settings') }, '⚙ 설정'), h('button', { class: 'btn ghost', onclick: () => this.go('help') }, '? 도움말')),
    );
  }

  totalStars() {
    return Object.values(this.save.stars).reduce((a, b) => a + b, 0);
  }
  woundedCount() {
    return this.save.roster.reduce((a, r) => a + r.soldiers.filter((x) => x.wounded > 0).length, 0);
  }
  claimableCount() {
    const s = this.save;
    const top = passTier(s);
    let n = 0;
    for (let t = 1; t <= top; t++) {
      if (!s.pass.claimedFree.includes(t)) n++;
      if (hasPremium(s) && !s.pass.claimedPrem.includes(t)) n++;
    }
    return n;
  }
  dailyAvailable() {
    return maxCleared(this.save) >= 2 && dailyKey(new Date()) > this.save.daily.lastKey;
  }

  // ================================================================== campaign

  private campaignScreen() {
    const s = this.save;
    const reach = maxCleared(s) + 1;
    const cards = STAGES.map((st) => {
      const locked = st.index > reach;
      const fac = st.factions.map((f) => FACTIONS[f].name).join(' · ');
      return h(
        'button',
        { class: 'stage-card' + (locked ? ' locked' : '') + (st.index === reach ? ' current' : ''), disabled: locked, onclick: () => this.openStage(st) },
        h('span', { class: 'num' }, String(st.index)),
        h('b', null, st.name),
        h('small', null, st.subtitle),
        h('small', { class: 'fac' }, locked ? '🔒 이전 성을 지켜야 열립니다' : fac),
        stars(s.stars[st.id] ?? 0),
      );
    });
    const modes = h(
      'div',
      { class: 'modes' },
      h('button', { class: 'mode-card' + (maxCleared(s) >= 2 ? '' : ' locked'), onclick: () => this.openDaily() }, h('b', null, '오늘의 공성'), h('small', null, maxCleared(s) >= 2 ? (this.dailyAvailable() ? '하루 한 번 금화 150 · 훈장 20' : '오늘 보상 완료 (연습 가능)') : '2번째 성 수복 후 개방')),
      h('button', { class: 'mode-card' + (maxCleared(s) >= 5 ? '' : ' locked'), onclick: () => this.openEndless() }, h('b', null, '끝없는 공성'), h('small', null, maxCleared(s) >= 5 ? `최고 기록 ${s.endlessBest} 물결` : '5번째 성 수복 후 개방')),
    );
    return h('div', { class: 'page' }, this.header('전역 지도'), h('div', { class: 'stage-list' }, ...cards), modes);
  }

  openStage(st: StageDef) {
    const s = this.save;
    if (st.index > maxCleared(s) + 1) {
      toast('이전 성을 먼저 지켜야 합니다.', 'warn');
      return;
    }
    this.pre = { mode: 'campaign', stage: st, lineup: defaultLineup(s, st), extra: {}, seed: (Math.random() * 1e9) | 0 };
    this.go('prebattle');
  }

  openDaily() {
    const s = this.save;
    if (maxCleared(s) < 2) {
      toast('2번째 성을 지킨 뒤 열립니다.', 'warn');
      return;
    }
    const daily = { key: dailyKey(new Date()), maxIdx: maxCleared(s) };
    const d = dailyChallenge(daily.key, daily.maxIdx);
    this.pre = { mode: 'daily', stage: d.stage, lineup: defaultLineup(s, d.stage), extra: {}, seed: d.seed, mods: [d.mod.id], modName: d.mod.name, daily };
    this.go('prebattle');
  }

  openEndless() {
    const s = this.save;
    if (maxCleared(s) < 5) {
      toast('5번째 성을 지킨 뒤 열립니다.', 'warn');
      return;
    }
    const seed = (Math.random() * 1e9) | 0;
    const st = endlessStage(seed);
    this.pre = { mode: 'endless', stage: st, lineup: defaultLineup(s, st), extra: {}, seed };
    this.go('prebattle');
  }

  // ================================================================== prebattle

  private prebattleScreen() {
    const s = this.save;
    const p = this.pre!;
    const st = p.stage;
    const cap = squadCap(s, st);
    // remember how many squads the player means to take, before squads with nobody ready drop out
    setWantedSize(p, wantedSize(p, p.lineup.length));
    p.lineup = p.lineup.filter((id) => s.roster.some((r) => r.id === id && readyCount(r) > 0));
    // re-render in place: keep the scroll position so taps low on a small screen don't jump to the top
    const refresh = () => {
      const top = this.screenRoot.querySelector('.page')?.scrollTop ?? 0;
      this.go('prebattle');
      const pg = this.screenRoot.querySelector('.page');
      if (pg) pg.scrollTop = top;
    };
    const jumpTo = (sel: string) => () => this.screenRoot.querySelector(sel)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // ---- lineup (with a clear warning and one-tap care after losses)
    const nums = squadNumbers(s.roster.map((r) => ({ r, type: r.type, name: r.name })));
    const numOf = new Map([...nums].map(([k, n]) => [k.r, n]));
    const rows = s.roster.map((r) => {
      const ready = readyCount(r);
      const on = p.lineup.includes(r.id);
      const wounded = r.soldiers.filter((x) => x.wounded > 0).length;
      const missing = SQUAD_TYPES[r.type].size - r.soldiers.length;
      const n = numOf.get(r);
      return h(
        'button',
        {
          class: 'lineup-row' + (on ? ' on' : '') + (ready === 0 ? ' disabled' : ''),
          'aria-pressed': on ? 'true' : 'false',
          onclick: () => {
            if (ready === 0) {
              toast('출전 가능한 병사가 없습니다. 위의 "모두 보충·치료"나 병영을 이용하세요.', 'warn');
              return;
            }
            if (on) p.lineup = p.lineup.filter((x) => x !== r.id);
            else if (p.lineup.length >= cap) {
              toast(`이 성에는 최대 ${cap}개 분대만 출전할 수 있습니다.`, 'warn');
              return;
            } else p.lineup.push(r.id);
            setWantedSize(p, p.lineup.length);
            refresh();
          },
        },
        h('span', { class: 'check' }, on ? '✔' : ''),
        h('span', { class: 'glyph' }, SQUAD_TYPES[r.type].short, n ? h('i', { class: 'num' }, String(n)) : null),
        h('span', { class: 'nm' }, h('b', null, r.name), h('small', null, RANK_NAMES[rankOf(r)])),
        h('span', { class: 'cnt' + (ready < SQUAD_TYPES[r.type].size ? ' short' : '') }, `${ready}/${SQUAD_TYPES[r.type].size}`, wounded ? h('small', { class: 'warn' }, ` 부상 ${wounded}`) : null, missing ? h('small', { class: 'muted' }, ` 결원 ${missing}`) : null),
      );
    });
    const str = lineupStrength(s, p.lineup);
    const care = careCosts(s);
    const idleBroken = s.roster.some((r) => !p.lineup.includes(r.id) && readyCount(r) < SQUAD_TYPES[r.type].size && (refillCost(r) > 0 || treatCost(r) > 0));
    const short = p.lineup.length > 0 && str.ready < str.full;
    const thin = p.lineup.length < cap && idleBroken;
    const weak = (p.lineup.length > 0 && str.ready < str.full * 0.85) || thin;
    const careBtn = (kind: 'fill' | 'heal', cost: number) =>
      h(
        'button',
        {
          class: 'btn small' + (s.gold >= cost ? ' primary' : ''),
          onclick: () => {
            const r = careAll(s, kind);
            if (r.err) toast(r.err, 'warn');
            if (r.done) {
              audio.play('coin');
              p.lineup = readyLineup(s, st, p.lineup, wantedSize(p, cap));
              toast(kind === 'fill' ? `${r.done}개 분대를 보충했습니다.` : `${r.done}개 분대를 치료했습니다.`, 'good', undefined, 1600);
            }
            this.persist();
            refresh();
          },
        },
        `${kind === 'fill' ? '모두 보충' : '모두 치료'} ◉${fmt(cost)}`,
      );
    const strengthBox =
      (short || thin) && (care.fill > 0 || care.heal > 0)
        ? h(
            'div',
            { class: 'pre-alert' + (weak ? ' severe' : '') },
            h('b', null, weak ? `⚠ 병력 부족 — 출전 ${str.ready}/${str.full}명` : `출전 ${str.ready}/${str.full}명`),
            h('small', null, [str.missing ? `결원 ${str.missing}` : '', str.wounded ? `부상 ${str.wounded}` : '', thin ? '쉬는 분대 있음' : ''].filter(Boolean).join(' · ')),
            h('div', { class: 'btn-row' }, care.fill > 0 ? careBtn('fill', care.fill) : null, care.heal > 0 ? careBtn('heal', care.heal) : null),
          )
        : null;
    // ---- supplies: packs are only planned here and paid when the battle result is recorded
    const base = baseSupplies(s, st);
    const cost = planCost(p.extra);
    const supRows = (Object.keys(SUPPLY_PRICE) as (keyof Supplies)[]).map((k) => {
      const pr = SUPPLY_PRICE[k];
      const extra = p.extra[k] ?? 0;
      const packs = packsOf(p.extra, k);
      const affordable = s.gold >= cost + pr.pack;
      return h(
        'div',
        { class: 'sup-row' },
        h('span', null, pr.name),
        h('b', null, fmt(base[k] + extra), extra ? h('small', { class: 'plan' }, ` +${extra}`) : null),
        h(
          'button',
          {
            class: 'btn small',
            disabled: packs >= MAX_PACKS,
            onclick: () => {
              if (!affordable) {
                toast(`금화가 부족합니다 (보급 계획 ◉${fmt(cost + pr.pack)} / 보유 ◉${fmt(s.gold)}).`, 'warn');
                return;
              }
              p.extra[k] = extra + pr.per;
              audio.play('click');
              refresh();
            },
          },
          `+${pr.per} (◉${pr.pack})`,
        ),
        packs > 0
          ? h(
              'button',
              {
                class: 'btn small ghost',
                'aria-label': `${pr.name} 계획 빼기`,
                onclick: () => {
                  p.extra[k] = Math.max(0, extra - pr.per);
                  refresh();
                },
              },
              '−',
            )
          : h('span'),
      );
    });
    const ff = foodForecast(s, st, p.lineup, p.extra, p.mode === 'endless');
    const foodCost = ff.packs * SUPPLY_PRICE.food.pack;
    const foodBox =
      p.mode === 'endless'
        ? h('div', { class: 'food-cast' }, `🍞 물결마다 식량 ${ff.perWave} · 보유 ${ff.have} (약 ${ff.perWave ? Math.floor(ff.have / ff.perWave) : '∞'}물결분)`)
        : h(
            'div',
            { class: 'food-cast' + (ff.short ? ' short' : '') },
            h('span', null, `🍞 식량 필요 ${ff.need} / 보유 ${ff.have}`, ff.short ? h('b', { class: 'warn' }, ` ⚠ ${ff.short} 부족`) : h('span', { class: 'good' }, ' ✓')),
            ff.short && ff.packs > 0
              ? h(
                  'button',
                  {
                    class: 'btn small' + (s.gold >= cost + foodCost ? ' primary' : ''),
                    disabled: s.gold < cost + foodCost,
                    onclick: () => {
                      p.extra.food = (p.extra.food ?? 0) + ff.packs * SUPPLY_PRICE.food.per;
                      audio.play('click');
                      refresh();
                    },
                  },
                  `식량 +${ff.packs * SUPPLY_PRICE.food.per} 담기 (◉${foodCost})`,
                )
              : null,
            ff.short && ff.stillShort
              ? h('small', { class: 'muted' }, `추가 보급 한도(${MAX_PACKS}묶음)로도 모자랍니다. 마지막 물결에 굶주릴 수 있으니 분대를 줄이거나 "병참" 연구를 올리세요.`)
              : ff.short && s.gold < cost + foodCost
                ? h('small', { class: 'muted' }, '금화가 모자랍니다. 다른 보급 계획을 줄이거나 분대를 줄이세요.')
                : null,
          );
    const planLine =
      cost > 0
        ? h(
            'div',
            { class: 'plan-line' + (cost > s.gold ? ' warn' : '') },
            h('span', null, `보급 계획 ◉${fmt(cost)} — 전투 결과가 나올 때 지불 (보유 ◉${fmt(s.gold)})`),
            // over budget (e.g. after a defeat): one tap cuts the plan down to the gold instead of many "−" taps
            cost > s.gold
              ? h(
                  'button',
                  {
                    class: 'btn small primary',
                    onclick: () => {
                      const fit = fitPlan(p.extra, s.gold);
                      p.extra = fit.extra;
                      audio.play('click');
                      toast(`보급 계획을 ${fit.dropped}묶음 줄였습니다 (◉${fmt(planCost(p.extra))}).`, 'info', undefined, 1800);
                      refresh();
                    },
                  },
                  '보유 금화에 맞추기',
                )
              : null,
          )
        : h('p', { class: 'muted small' }, '추가 보급은 계획만 해 두고, 전투 결과가 나올 때 금화를 냅니다.');
    // ---- lineup presets
    const slots = hasFlag(s, 'presets') ? 5 : 1;
    const presetBar = h(
      'div',
      { class: 'presets' },
      h('span', { class: 'muted' }, '편성 저장:'),
      ...Array.from({ length: slots }, (_, i) => {
        const saved = s.lineups[i];
        return h(
          'button',
          {
            class: 'btn small ghost',
            onclick: async () => {
              const v = await modal(`편성 ${i + 1}`, h('p', null, saved?.length ? `저장된 분대 ${saved.length}개` : '비어 있음'), [
                { label: '닫기', value: '', kind: 'ghost' },
                { label: '현재 편성 저장', value: 'save', kind: 'ghost' },
                ...(saved?.length ? [{ label: '불러오기', value: 'load', kind: 'primary' as const }] : []),
              ]);
              if (v === 'save') {
                s.lineups[i] = [...p.lineup];
                this.persist();
                toast('편성을 저장했습니다.', 'good');
              } else if (v === 'load') {
                p.lineup = saved.filter((id) => s.roster.some((r) => r.id === id && readyCount(r) > 0)).slice(0, cap);
                refresh();
              }
            },
          },
          `${i + 1}${saved?.length ? '●' : ''}`,
        );
      }),
    );
    // ---- enemy intel (the only copy of the scouting report: the battle does not repeat it)
    const bandIds = [...new Set(st.waves.slice(0, 12).flatMap((w) => w.groups.map((g) => g.band)))];
    const unitIds = [...new Set(bandIds.flatMap((b) => [...(BANDS[b]?.members.map((m) => m[0]) ?? []), ...(BANDS[b]?.leader ? [BANDS[b].leader!] : [])]))];
    const intel = h(
      'div',
      { class: 'intel' },
      h('p', { class: 'story' }, st.story),
      h('p', null, h('b', null, '적: '), st.factions.map((f) => FACTIONS[f].name).join(', '), p.mode === 'endless' ? '' : ` · 물결 ${st.waves.length}`),
      h('div', { class: 'unit-chips' }, ...unitIds.slice(0, 14).map((u) => h('span', { class: 'chip-s', style: { borderColor: UNITS[u]?.color } }, UNITS[u]?.name ?? u))),
      st.tips?.length ? h('ul', { class: 'tips' }, ...st.tips.map((t) => h('li', null, t))) : null,
      p.modName ? h('p', { class: 'mod' }, `오늘의 조건: ${p.modName}`) : null,
      h('p', { class: 'muted' }, `난이도: ${{ easy: '쉬움', normal: '보통', hard: '어려움' }[s.settings.difficulty]} (설정에서 변경)`),
    );
    const canSweep = p.mode === 'campaign' && (s.stars[st.id] ?? 0) >= 3;
    const back: Screen = 'campaign';
    // ---- sticky action bar: warnings stay visible next to the start button on any screen height
    const notes = [
      weak ? h('button', { class: 'pre-note warn', onclick: jumpTo('.pre-lineup') }, `⚠ 병력 ${str.ready}/${str.full}`) : null,
      ff.short ? h('button', { class: 'pre-note warn', onclick: jumpTo('.pre-supply') }, `⚠ 식량 ${ff.have}/${ff.need}`) : null,
      cost > 0 ? h('button', { class: 'pre-note' + (cost > s.gold ? ' warn' : ''), onclick: jumpTo('.pre-supply') }, `보급 ◉${fmt(cost)}`) : null,
    ].filter(Boolean);
    return h(
      'div',
      { class: 'page prebattle' },
      this.header(st.name, back),
      h(
        'div',
        { class: 'pre-grid' },
        h(
          'section',
          { class: 'pre-lineup' },
          h('h2', null, `출전 분대 ${p.lineup.length}/${cap}`),
          strengthBox,
          h('div', { class: 'lineup' }, ...rows),
          presetBar,
          h('button', { class: 'btn ghost small', onclick: () => this.go('barracks') }, '병영에서 보충·치료·모집 ›'),
        ),
        h('section', { class: 'pre-supply' }, h('h2', null, '보급 (출전 시 지급)'), foodBox, ...supRows, planLine, h('p', { class: 'muted small' }, '화살은 성 안 보급소 근처에서 자동 재보급됩니다. 식량은 물결마다 소모됩니다.')),
        h('section', { class: 'pre-intel' }, h('h2', null, '정찰 보고'), intel),
      ),
      h(
        'div',
        { class: 'pre-actions' },
        notes.length ? h('div', { class: 'pre-notes' }, ...notes) : null,
        canSweep
          ? h(
              'button',
              { class: 'btn ghost', onclick: () => this.sweep(st) },
              hasFlag(s, 'sweep') ? `빠른 소탕 (오늘 ${sweepsLeft(s)}회)` : '빠른 소탕 🔒',
            )
          : null,
        h('button', { class: 'btn primary big', disabled: p.lineup.length === 0, onclick: () => this.startBattle() }, '배치하러 가기 ›'),
      ),
    );
  }

  private async sweep(st: StageDef) {
    const s = this.save;
    if (!hasFlag(s, 'sweep')) {
      const v = await modal('빠른 소탕', h('p', null, '별 3개를 받은 성을 전투 없이 소탕해 연대기 경험치와 훈장을 받습니다 (하루 3회). "지휘관의 편의 꾸러미"에 포함된 편의 기능이며 금화와 전투력은 주지 않습니다.'), [
        { label: '닫기', value: '', kind: 'ghost' },
        { label: '상점 보기', value: 'shop', kind: 'primary' },
      ]);
      if (v === 'shop') {
        this.shopTab = 'store';
        this.go('shop');
      }
      return;
    }
    const r = sweepStage(s, st);
    if (typeof r === 'string') {
      toast(r, 'warn');
      return;
    }
    this.persist();
    audio.play('coin');
    toast(`소탕 완료: 연대기 ${r.passXp}xp, 훈장 ${r.medals}`, 'good');
    this.go('prebattle');
  }

  private startBattle() {
    const p = this.pre!;
    if (!p.lineup.length) return;
    // planned packs are paid when the result is recorded, so the plan has to be affordable now
    const supplyCost = planCost(p.extra);
    if (supplyCost > this.save.gold) {
      toast(`금화가 부족합니다: 보급 계획 ◉${fmt(supplyCost)} / 보유 ◉${fmt(this.save.gold)}. 보급을 줄여 주세요.`, 'warn', undefined, 3200);
      this.screenRoot.querySelector('.pre-supply')?.scrollIntoView({ block: 'start' });
      return;
    }
    audio.unlock();
    // a new battle replaces whatever resume point was left
    clearRecord(this.kv);
    const cfg = battleConfig(this.save, p.stage, p.lineup, p.extra, p.seed, { mods: p.mods });
    if (p.mode === 'endless') cfg.autoCommand = this.save.settings.autoCommand;
    const setup: BattleSetup = {
      mode: p.mode,
      stage: p.stage,
      cfg,
      modName: p.modName,
      supplyCost,
      ref: stageRefFor(p.mode, p.stage, p.seed, p.daily),
      extra: { ...p.extra },
      lineup: [...p.lineup],
      battleId: newBattleId(),
    };
    clear(this.screenRoot);
    try {
      this.battle = new BattleView(this, setup);
    } catch (err) {
      this.logError('battle-start', err);
      this.battle = null;
      toast('전투를 시작하지 못했습니다. 다시 시도해 주세요.', 'danger');
      this.go('prebattle');
    }
  }

  /**
   * Called when the result screen appears (or when a resumed battle is abandoned). The planned supplies
   * are paid here, never before. The save remembers the battle id together with the result, so a resume
   * record that survived a kill right after this point is recognised as already paid.
   */
  recordBattle(setup: BattleSetup, res: BattleResult): Rewards {
    const rw = settleBattle(this.save, setup, res);
    this.persist();
    clearRecord(this.kv);
    return rw;
  }

  exitBattle(view: BattleView, res: BattleResult | null, retry: boolean, to: Screen | 'next' = 'campaign') {
    // leaving by any path (result, retry, exit, crash) ends the battle: no resume point may stay behind
    clearRecord(this.kv);
    view.destroy();
    this.battle = null;
    if (retry && this.pre) {
      if (this.pre.mode !== 'daily') this.pre.seed = (Math.random() * 1e9) | 0;
      if (this.pre.mode === 'endless') this.pre.stage = endlessStage(this.pre.seed);
      // after losses go out with squads that can fight: drop empty ones and swap broken ones, but keep the
      // number of squads the player chose (a deliberately small lineup stays small)
      const want = this.pre.lineup.length;
      setWantedSize(this.pre, want);
      this.pre.lineup = res ? readyLineup(this.save, this.pre.stage, this.pre.lineup, want) : this.pre.lineup.filter((id) => this.save.roster.some((r) => r.id === id && readyCount(r) > 0));
      // a defeat can leave too little gold for the same supply plan: cut it to fit rather than refuse the start
      const fit = fitPlan(this.pre.extra, this.save.gold);
      if (fit.dropped) {
        this.pre.extra = fit.extra;
        toast(`금화가 모자라 보급 계획을 ${fit.dropped}묶음 줄였습니다.`, 'warn', undefined, 3000);
      }
      this.go('prebattle');
      return;
    }
    if (to === 'next' && this.pre) {
      const nextSt = STAGES.find((x) => x.index === this.pre!.stage.index + 1);
      if (nextSt) {
        this.openStage(nextSt);
        return;
      }
      to = 'campaign';
    }
    this.go(to === 'next' ? 'campaign' : to);
  }

  // ================================================================== barracks

  private barracksScreen() {
    const s = this.save;
    const rows = s.roster.map((r) => {
      const st = SQUAD_TYPES[r.type];
      const ready = readyCount(r);
      const wounded = r.soldiers.filter((x) => x.wounded > 0).length;
      const missing = st.size - r.soldiers.length;
      const rk = rankOf(r);
      const act = (label: string, cost: number, fn: () => string | null, enabled: boolean) =>
        h(
          'button',
          {
            class: 'btn small',
            disabled: !enabled,
            onclick: () => {
              const err = fn();
              if (err) toast(err, 'warn');
              else {
                audio.play('coin');
                this.persist();
                this.go('barracks');
              }
            },
          },
          `${label} ◉${cost}`,
        );
      return h(
        'div',
        { class: 'roster-row' },
        h('span', { class: 'glyph' }, st.short),
        h('div', { class: 'info' }, h('b', null, r.name), h('small', null, `${st.name} · ${RANK_NAMES[rk]} · 처치 ${fmt(r.kills)} · 출전 ${r.battles}`), bar(ready / st.size)),
        h('div', { class: 'nums' }, h('b', null, `${ready}/${st.size}`), wounded ? h('small', { class: 'warn' }, `부상 ${wounded}`) : null, missing ? h('small', { class: 'muted' }, `결원 ${missing}`) : null),
        h(
          'div',
          { class: 'acts' },
          missing > 0 ? act('보충', refillCost(r), () => refillSquad(s, r), true) : null,
          wounded > 0 ? act('치료', treatCost(r), () => treatSquad(s, r), true) : null,
          h(
            'button',
            {
              class: 'btn small ghost',
              'aria-label': '분대 해산',
              onclick: async () => {
                if (await confirmBox('분대 해산', `${nameJosa(r.name, '을/를')} 해산합니다. 되돌릴 수 없습니다.`, '해산', true)) {
                  const err = dismissSquad(s, r.id);
                  if (err) toast(err, 'warn');
                  this.persist();
                  this.go('barracks');
                }
              },
            },
            '해산',
          ),
        ),
      );
    });
    const types = unlockedTypes(s);
    const recruit = (Object.keys(SQUAD_TYPES) as SquadTypeId[])
      .filter((t) => t !== 'militia')
      .map((t) => {
        const st = SQUAD_TYPES[t];
        const ok = types.includes(t);
        return h(
          'button',
          {
            class: 'recruit-card' + (ok ? '' : ' locked'),
            onclick: async () => {
              if (!ok) {
                toast(`${st.unlock - 1}번째 성을 지키면 모집할 수 있습니다.`, 'warn');
                return;
              }
              if (!(await confirmBox(st.name + ' 모집', `${st.desc}\n\n${st.size}명 · 금화 ${SQUAD_PRICE[t]}`, '모집'))) return;
              const err = buySquad(s, t);
              if (err) toast(err, 'warn');
              else {
                audio.play('coin');
                this.persist();
                this.go('barracks');
              }
            },
          },
          h('span', { class: 'glyph' }, st.short),
          h('b', null, st.name),
          h('small', null, ok ? `◉${SQUAD_PRICE[t]} · ${st.size}명` : `🔒 ${st.unlock - 1}번째 성 이후`),
        );
      });
    const totalHeal = s.roster.reduce((a, r) => a + treatCost(r), 0);
    const totalFill = s.roster.reduce((a, r) => a + refillCost(r), 0);
    return h(
      'div',
      { class: 'page' },
      this.header('병영'),
      h(
        'div',
        { class: 'bulk' },
        h('span', { class: 'muted' }, `분대 ${s.roster.length}/${ROSTER_MAX} · 부상병은 전투 1회 휴식으로 회복`),
        totalFill > 0
          ? h('button', { class: 'btn small', onclick: () => this.bulk('fill') }, `모두 보충 ◉${totalFill}`)
          : null,
        totalHeal > 0 ? h('button', { class: 'btn small', onclick: () => this.bulk('heal') }, `모두 치료 ◉${totalHeal}`) : null,
      ),
      h('div', { class: 'roster' }, ...rows),
      h('h2', null, '모집'),
      h('div', { class: 'recruit' }, ...recruit),
    );
  }

  private bulk(kind: 'fill' | 'heal') {
    const s = this.save;
    let n = 0;
    for (const r of s.roster) {
      const err = kind === 'fill' ? (refillCost(r) > 0 ? refillSquad(s, r) : 'skip') : treatCost(r) > 0 ? treatSquad(s, r) : 'skip';
      if (!err) n++;
      else if (err !== 'skip') {
        toast(err, 'warn');
        break;
      }
    }
    if (n) audio.play('coin');
    this.persist();
    this.go('barracks');
  }

  // ================================================================== research

  private researchScreen() {
    const s = this.save;
    const cards = UPGRADES.map((u) => {
      const lv = s.upgrades[u.id] ?? 0;
      const maxed = lv >= u.max;
      const cost = upgradeCost(u, lv);
      return h(
        'div',
        { class: 'up-card' },
        h('b', null, u.name),
        h('div', { class: 'pips' }, ...Array.from({ length: u.max }, (_, i) => h('i', { class: i < lv ? 'on' : '' }))),
        h('small', null, u.desc),
        h(
          'button',
          {
            class: 'btn small' + (s.gold >= cost && !maxed ? ' primary' : ''),
            disabled: maxed,
            onclick: () => {
              const err = buyUpgrade(s, u.id);
              if (err) toast(err, 'warn');
              else {
                audio.play('coin');
                this.persist();
                this.go('research');
              }
            },
          },
          maxed ? '완료' : `연구 ◉${fmt(cost)}`,
        ),
      );
    });
    return h('div', { class: 'page' }, this.header('연구'), h('p', { class: 'muted' }, '연구는 영구적입니다. 금화는 전투에서만 얻으며, 결제로 살 수 없습니다.'), h('div', { class: 'ups' }, ...cards));
  }

  // ================================================================== chronicle (season pass)

  private chronicleScreen() {
    const s = this.save;
    const now = new Date();
    this.notifySeason(syncSeason(s, now));
    const season = s.pass.season;
    const tier = passTier(s);
    const prem = hasPremium(s);
    const rewards = passRewards(season);
    const days = seasonDaysLeft(season, now);
    const cos = seasonCosmetics(season);
    const label = (r: { kind: string; amount?: number; cosmetic?: string }) =>
      r.kind === 'gold' ? `◉${r.amount}` : r.kind === 'medals' ? `✪${r.amount}` : cosmeticById(r.cosmetic!)?.name ?? '외관';
    const cols = Array.from({ length: PASS_TIERS }, (_, i) => {
      const t = i + 1;
      const fr = rewards.free.find((x) => x.tier === t)!;
      const pr = rewards.prem.find((x) => x.tier === t)!;
      const fDone = s.pass.claimedFree.includes(t);
      const pDone = s.pass.claimedPrem.includes(t);
      const reached = t <= tier;
      const cell = (r: typeof fr, done: boolean, track: 'free' | 'prem') => {
        const c = r.kind === 'cosmetic' && r.cosmetic ? cosmeticById(r.cosmetic) : undefined;
        return h(
          'button',
          {
            class: `cell ${track} ${r.kind}` + (done ? ' done' : reached && (track === 'free' || prem) ? ' ready' : '') + (track === 'prem' && !prem ? ' lockedp' : ''),
            'aria-label': `${t}단계 ${track === 'free' ? '무료' : '프리미엄'} 보상: ${label(r)}${done ? ' (받음)' : ''}`,
            onclick: () => {
              const err = claimReward(s, t, track);
              if (err) toast(err, 'warn', undefined, 1500);
              else {
                audio.play('coin');
                this.persist();
                this.go('chronicle');
              }
            },
          },
          c ? cosmeticPreview(c) : null,
          h('span', { class: 'cl' }, label(r)),
        );
      };
      return h('div', { class: 'tier' + (reached ? ' reached' : '') }, h('span', { class: 'tn' }, String(t)), cell(fr, fDone, 'free'), cell(pr, pDone, 'prem'));
    });
    const prod = allProducts(now).find((p) => p.id === seasonProductId(season));
    const nextSeason = seasonAt(now) + 1;
    const nextCos = seasonCosmetics(nextSeason);
    const nextStart = seasonStarts(nextSeason);
    const showcase = h(
      'section',
      { class: 'season-showcase' },
      h('h2', null, prem ? '✔ 보유 중인 시즌 외관' : `프리미엄 연대기: 구매 즉시 받는 외관 5종`),
      h('div', { class: 'pv-cards' }, ...cos.slice(0, 5).map((c) => cosmeticCard(c))),
      h(
        'p',
        { class: 'muted small' },
        '외관은 시즌이 끝나도 영구 보유되며 "구매 복원"으로 되찾을 수 있습니다. 프리미엄 트랙은 단계마다 훈장을 더 줍니다. 금화·전투력은 주지 않습니다.',
      ),
      h(
        'div',
        { class: 'pre-actions' },
        prem
          ? h('span', { class: 'good' }, '✔ 프리미엄 연대기 보유')
          : prod
            ? h('button', { class: 'btn primary', onclick: () => this.buy(prod) }, `프리미엄 열기 ${this.priceOf(prod)}`)
            : h('span', { class: 'muted' }, '이번 시즌은 프리미엄 트랙이 없습니다.'),
      ),
      prod && !prem ? h('p', { class: 'muted tiny' }, REFUND_NOTICE) : null,
    );
    return h(
      'div',
      { class: 'page chronicle' },
      this.header('전쟁 연대기'),
      h(
        'div',
        { class: 'season-head' },
        h('div', null, h('b', null, seasonName(season)), h('small', null, ` · ${days}일 남음 · 단계 ${tier}/${PASS_TIERS}`)),
        bar((s.pass.xp % XP_PER_TIER) / XP_PER_TIER, 'pass'),
        h(
          'small',
          { class: 'muted' },
          tier >= PASS_TIERS ? '모든 단계를 달성했습니다!' : `전투·오늘의 공성으로 경험치를 얻습니다. 다음 단계까지 ${XP_PER_TIER - (s.pass.xp % XP_PER_TIER)}xp`,
        ),
        h('small', { class: 'muted' }, '시즌이 끝날 때 받지 않은 보상은 자동으로 지급됩니다.'),
      ),
      h('div', { class: 'track-labels' }, h('span', null, '무료'), h('span', null, '프리미엄')),
      h('div', { class: 'tiers' }, ...cols),
      this.claimableCount()
        ? h(
            'div',
            { class: 'pre-actions' },
            h(
              'button',
              {
                class: 'btn',
                onclick: () => {
                  const n = claimAll(s);
                  this.persist();
                  audio.play('coin');
                  toast(`보상 ${n}개를 받았습니다.`, 'good');
                  this.go('chronicle');
                },
              },
              `모두 받기 (${this.claimableCount()})`,
            ),
          )
        : null,
      showcase,
      h(
        'section',
        { class: 'season-next' },
        h('h2', null, `다음 시즌 미리보기: ${seasonName(nextSeason)}`),
        h('p', { class: 'muted small' }, `${nextStart.getMonth() + 1}월 ${nextStart.getDate()}일 시작`),
        h('div', { class: 'pv-row' }, ...nextCos.slice(0, 5).map((c) => cosmeticPreview(c))),
      ),
    );
  }

  // ================================================================== shop

  private priceOf(p: Product) {
    return this.iap.price(p.id) ?? krw(p.priceKrw);
  }

  private async buy(p: Product) {
    audio.unlock();
    const why = this.iap.unavailable();
    if (why) {
      toast(why, 'warn', undefined, 4000);
      return;
    }
    const warn = seasonPassWarning(p.id, new Date());
    if (warn && !(await confirmBox('구매 전 확인', warn, '계속'))) return;
    try {
      const r = await this.iap.purchase(p.id);
      if (!r.ok) {
        if (r.error && r.error !== CANCELLED) toast(r.error, 'warn', undefined, 5000);
        return;
      }
      // MockIAP grants through the onOwned callback; native grants when the store finishes the transaction.
      this.persist();
      if (this.screen === 'shop' || this.screen === 'chronicle') this.go(this.screen);
    } catch (err) {
      this.logError('purchase', err);
      toast('결제를 완료하지 못했습니다. 돈이 빠져나갔다면 "구매 복원"을 눌러 주세요.', 'danger', undefined, 5000);
    }
  }

  async restorePurchases(quiet = false) {
    try {
      const r = await this.iap.restore();
      let n = 0;
      for (const id of r.ids) if (grantPurchase(this.save, id, `restore-${id}`, new Date())) n++;
      // restoring must also re-grant cosmetics of products already in entitlements
      for (const id of this.save.entitlements) if (grantPurchase(this.save, id, '', new Date())) n++;
      this.persist();
      if (this.screen === 'shop' || this.screen === 'chronicle') this.go(this.screen);
      if (r.error) {
        if (!quiet) toast(r.error, 'warn', undefined, 4500);
        return;
      }
      if (!quiet || n) toast(n ? `구매 ${n}건을 복원했습니다.` : r.ids.length ? '이미 모든 구매가 적용되어 있습니다.' : '이 스토어 계정에 복원할 구매가 없습니다.', n ? 'good' : 'info');
    } catch (err) {
      this.logError('restore', err);
      if (!quiet) toast('스토어에 연결하지 못했습니다. 인터넷 연결 후 다시 시도해 주세요.', 'warn');
    }
  }

  private legalBlock() {
    const seller = sellerLine();
    return h('div', { class: 'legal' }, h('p', { class: 'muted tiny' }, REFUND_NOTICE), seller ? h('p', { class: 'muted tiny' }, seller) : null);
  }

  private shopScreen() {
    const s = this.save;
    const now = new Date();
    const tabs = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      ...(
        [
          ['stall', '훈장 상점'],
          ['store', '후원·외관'],
          ['wardrobe', '옷장'],
        ] as const
      ).map(([id, label]) =>
        h('button', { class: 'tab' + (this.shopTab === id ? ' on' : ''), role: 'tab', 'aria-selected': this.shopTab === id ? 'true' : 'false', onclick: () => { this.shopTab = id; this.go('shop'); } }, label),
      ),
    );
    let body: HTMLElement;
    if (this.shopTab === 'stall') {
      const items = weeklyStall(now).map((c) => {
        const own = s.owned.includes(c.id);
        const tag = /^w\d+_/.test(c.id) ? '이번 주 공방' : /^s\d+_/.test(c.id) ? '지난 시즌' : kindName(c.kind);
        return h(
          'div',
          { class: 'item' },
          cosmeticPreview(c, 'lg'),
          h('b', null, c.name),
          h('small', null, tag),
          h(
            'button',
            {
              class: 'btn small' + (own ? '' : ' primary'),
              disabled: own,
              onclick: () => {
                const err = buyWithMedals(s, c.id, now);
                if (err) toast(err, 'warn');
                else {
                  audio.play('coin');
                  this.persist();
                  toast(`${c.name} 획득! 옷장에서 장착하세요.`, 'good');
                  this.go('shop');
                }
              },
            },
            own ? '보유 중' : `✪${c.medals}`,
          ),
        );
      });
      body = h(
        'div',
        null,
        h('p', { class: 'muted' }, `훈장은 별·업적·오늘의 공성·연대기로 얻습니다. 진열은 매주 바뀌고, 공방 품목은 그 주에만 나옵니다 (${daysUntilNextWeek(now)}일 후 교체).`),
        h('div', { class: 'items' }, ...items),
      );
    } else if (this.shopTab === 'store') {
      const why = this.iap.unavailable();
      const items = allProducts(now).map((p) => {
        const own = s.entitlements.includes(p.id);
        const grants = p.grants.map((g) => cosmeticById(g)).filter((c): c is Cosmetic => !!c);
        return h(
          'div',
          { class: 'product' },
          h('b', null, p.name),
          h('p', { class: 'small' }, p.desc),
          grants.length ? h('div', { class: 'pv-cards' }, ...grants.map((c) => cosmeticCard(c))) : null,
          h(
            'button',
            { class: 'btn' + (own ? '' : ' primary'), disabled: own, onclick: () => (p.kind === 'pass' ? this.go('chronicle') : this.buy(p)) },
            own ? '보유 중' : p.kind === 'pass' ? '연대기에서 보기' : this.priceOf(p),
          ),
        );
      });
      body = h(
        'div',
        null,
        h('p', { class: 'muted' }, '모든 상품은 1회 구매(비소모성)이며 상품끼리 구성이 겹치지 않고, 전투력·금화를 주지 않습니다. 기기를 바꾸거나 다시 설치해도 "구매 복원"으로 되찾을 수 있습니다.'),
        this.iap.kind === 'mock' ? h('p', { class: 'warn small' }, '웹 체험판: 결제는 테스트로만 동작합니다 (실제 결제 없음).') : null,
        why ? h('p', { class: 'warn small' }, why) : null,
        h('div', { class: 'products' }, ...items),
        h('button', { class: 'btn ghost', onclick: () => this.restorePurchases() }, '구매 복원'),
        this.legalBlock(),
      );
    } else {
      const kinds: Cosmetic['kind'][] = ['castle', 'banner', 'dye', 'title'];
      body = h(
        'div',
        null,
        ...kinds.map((k) => {
          const owned = s.owned.map((id) => cosmeticById(id)).filter((c): c is Cosmetic => !!c && c.kind === k);
          return h(
            'section',
            null,
            h('h2', null, kindName(k)),
            h(
              'div',
              { class: 'items' },
              ...owned.map((c) =>
                h(
                  'button',
                  {
                    class: 'item' + (s.equipped[k] === c.id ? ' equipped' : ''),
                    onclick: () => {
                      equip(s, c.id);
                      this.persist();
                      audio.play('click');
                      this.go('shop');
                    },
                  },
                  cosmeticPreview(c, 'lg'),
                  h('b', null, c.name),
                  h('small', null, s.equipped[k] === c.id ? '장착 중' : '장착'),
                ),
              ),
            ),
          );
        }),
        h('p', { class: 'muted small' }, `수집: ${s.owned.length}종 · 매주 공방 품목과 시즌 한정 외관이 새로 나옵니다.`),
      );
    }
    return h('div', { class: 'page shop' }, this.header('상점·옷장'), tabs, body);
  }

  // ================================================================== settings & help

  private settingsScreen() {
    const s = this.save;
    const st = s.settings;
    const toggle = (key: keyof typeof st, label: string, desc = '') =>
      h(
        'label',
        { class: 'set-row' },
        h('span', null, label, desc ? h('small', null, desc) : null),
        h('input', {
          type: 'checkbox',
          checked: !!st[key],
          onchange: (e: Event) => {
            (st as any)[key] = (e.target as HTMLInputElement).checked;
            this.applySettings();
            this.persist();
          },
        }),
      );
    const choice = <K extends 'difficulty' | 'quality'>(key: K, label: string, opts: [string, string][], desc = '') =>
      h(
        'div',
        { class: 'set-row' },
        h('span', null, label, desc ? h('small', null, desc) : null),
        h(
          'div',
          { class: 'seg' },
          ...opts.map(([v, l]) =>
            h('button', { class: 'chip' + (st[key] === v ? ' on' : ''), onclick: () => { (st as any)[key] = v; this.persist(); this.go('settings'); } }, l),
          ),
        ),
      );
    const errors = (() => {
      try {
        return (JSON.parse(this.kv.get('ashen.errors') ?? '[]') as string[]).length;
      } catch {
        return 0;
      }
    })();
    return h(
      'div',
      { class: 'page settings' },
      this.header('설정'),
      h(
        'section',
        null,
        h('h2', null, '게임'),
        choice('difficulty', '난이도', [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']], '쉬움: 보상 85% · 어려움: 보상 125%'),
        toggle('autoCommand', '자동 지휘관', '능력(함성·일제사격·기름·증원)을 알아서 사용'),
        toggle('showTips', '도움말 표시'),
      ),
      h(
        'section',
        null,
        h('h2', null, '조작·화면'),
        toggle('leftHanded', '왼손 배치', '능력 버튼을 왼쪽으로'),
        toggle('bigText', '큰 글씨'),
        toggle('reduceMotion', '화면 흔들림 줄이기'),
        choice('quality', '그래픽', [['high', '고화질'], ['low', '저사양']], '저사양: 배터리 절약·구형 기기용'),
      ),
      h('section', null, h('h2', null, '소리'), toggle('sound', '효과음'), toggle('music', '배경음'), toggle('haptics', '진동')),
      h(
        'section',
        null,
        h('h2', null, '저장 데이터'),
        h('p', { class: 'muted small' }, '진행 상황은 이 기기에만 저장되며 자동 백업 2개(직전·하루 전)가 함께 보관됩니다. 기기를 바꿀 때는 아래 코드로 옮기고, 결제 상품은 "구매 복원"으로 되찾으세요.'),
        this.kv.mode && this.kv.mode !== 'ok' ? h('p', { class: 'warn small' }, this.kv.mode === 'memory' ? '⚠ 이 브라우저는 저장을 막고 있습니다.' : '⚠ 저장 공간이 부족해 저장되지 않고 있습니다.') : null,
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn', onclick: () => this.exportSave() }, '저장 코드 복사'),
          h('button', { class: 'btn', onclick: () => this.importSave() }, '저장 코드 불러오기'),
          h('button', { class: 'btn', onclick: () => this.restorePurchases() }, '구매 복원'),
        ),
        h('button', { class: 'btn danger small', onclick: () => this.resetSave() }, '처음부터 다시 하기'),
      ),
      h(
        'section',
        null,
        h('h2', null, '정보'),
        h('p', { class: 'small' }, `잿빛 성벽 v${VERSION} · 오프라인 게임 · 광고 없음`),
        h('p', { class: 'small' }, '개인정보: 이 게임은 어떤 개인정보도 수집·전송하지 않습니다. 분석 도구·광고 SDK·계정이 없습니다. 결제는 앱 스토어가 처리합니다.'),
        sellerLine() ? h('p', { class: 'small muted' }, sellerLine()) : null,
        errors ? h('button', { class: 'btn ghost small', onclick: () => this.copyErrors() }, `오류 기록 복사 (${errors}건, 문의 시 첨부용)`) : null,
      ),
    );
  }

  private async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  private async exportSave() {
    this.persist();
    const code = await exportCodeShort(this.save);
    const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';
    const ok = await this.copy(code);
    const v = await modal(
      '저장 코드',
      [
        h('p', null, ok ? '클립보드에 복사했습니다. 메모·메신저(나에게 보내기) 등에 보관하세요.' : '아래 코드를 길게 눌러 복사하세요.'),
        h('textarea', { class: 'code', readonly: 'true', rows: 4 }, code),
        h('p', { class: 'muted small' }, `${code.length}자 · 결제 상품은 코드에 들어가지 않으며 새 기기에서 "구매 복원"으로 되찾습니다.`),
      ],
      [...(canShare ? [{ label: '공유하기', value: 'share', kind: 'ghost' as const }] : []), { label: '닫기', value: 'ok', kind: 'primary' }],
    );
    if (v === 'share') {
      try {
        await (navigator as any).share({ title: '잿빛 성벽 저장 코드', text: code });
      } catch {
        /* cancelled */
      }
    }
  }

  private async importSave() {
    const ta = h('textarea', { class: 'code', rows: 5, placeholder: 'AR2. 또는 AR1.로 시작하는 코드를 붙여넣으세요' });
    const v = await modal('저장 코드 불러오기', [h('p', null, '현재 진행 상황이 코드의 내용으로 바뀝니다. 결제 상품은 코드에 포함되지 않으며 "구매 복원"으로 다시 적용됩니다.'), ta], [
      { label: '취소', value: '', kind: 'ghost' },
      { label: '불러오기', value: 'ok', kind: 'primary' },
    ]);
    if (v !== 'ok') return;
    const s = await importCodeAny(ta.value, isPaidCosmetic);
    if (!s) {
      toast('코드가 올바르지 않습니다. 전체를 빠짐없이 붙여넣었는지 확인하세요.', 'danger', undefined, 4000);
      return;
    }
    // purchases belong to the store account, not to the code: keep this device's ones
    const ent = [...this.save.entitlements];
    this.save = s;
    for (const id of ent) grantPurchase(this.save, id, '', new Date());
    syncSeason(this.save, new Date());
    this.persist();
    this.applySettings();
    toast('불러왔습니다.', 'good');
    void this.restorePurchases(true);
    this.go('home');
  }

  private async resetSave() {
    if (!(await confirmBox('처음부터 다시 하기', '모든 진행 상황(분대·연구·별·훈장)이 지워집니다. 결제 상품은 "구매 복원"으로 되찾을 수 있습니다.', '다음', true))) return;
    if (!(await confirmBox('정말 지울까요?', '되돌릴 수 없습니다. 먼저 저장 코드를 복사해 두는 것을 권장합니다.', '모두 지우기', true))) return;
    const ent = this.save.entitlements;
    this.save = newSave();
    this.save.entitlements = [...ent];
    for (const id of ent) grantPurchase(this.save, id, '', new Date());
    syncSeason(this.save, new Date());
    this.persist();
    this.go('home');
  }

  private async copyErrors() {
    const t = this.kv.get('ashen.errors') ?? '[]';
    const ok = await this.copy(t);
    toast(ok ? '오류 기록을 복사했습니다.' : '복사하지 못했습니다.', ok ? 'good' : 'warn');
  }

  private helpScreen() {
    const sec = (t: string, ...items: string[]) => h('section', null, h('h2', null, t), h('ul', null, ...items.map((i) => h('li', null, i))));
    return h(
      'div',
      { class: 'page help' },
      this.header('도움말'),
      sec(
        '조작',
        '분대는 기본적으로 자동으로 싸웁니다. 큰 흐름만 지휘하세요.',
        '깃발 또는 아래 분대 카드를 탭 → 선택. 선택 후 땅을 탭하면 이동, 적을 탭하면 집중 공격(근접 분대는 돌격).',
        '깃발을 끌어서 바로 이동시킬 수 있습니다. 빈 곳을 끌면 화면 이동, 두 손가락으로 확대·축소, 두 번 탭하면 확대.',
        '직접 명령한 분대는 "수동"이 됩니다. 선택 후 "자동 ON"으로 되돌립니다.',
        '왼쪽 버튼은 전군 명령(전원 자동·원위치·위치 고수·본성 후퇴), 오른쪽은 지휘관 능력입니다.',
        '⏸ 일시정지 중에도 명령을 내릴 수 있습니다. 알림을 탭하면 그 위치로 화면이 이동합니다.',
      ),
      sec(
        '전쟁의 규칙',
        '사기: 아군이 쓰러지고, 포위되고, 공포를 주는 적(트롤·용)을 보면 떨어집니다. 무너지면 도주합니다. 본성 근처·함성·승리로 회복됩니다.',
        '부상: 쓰러진 병사는 잠시 살아 있습니다. 군의대가 치료소로 옮기면 살아남아 다음 전투 후 복귀합니다.',
        '보급: 화살은 보급소 근처에서 자동 재보급됩니다. 식량은 물결마다 소모되며 바닥나면 사기가 떨어집니다. 공병대는 자재로 성벽을 고칩니다.',
        '성벽 위 궁수는 사거리가 길고 엄폐를 받습니다. 성문은 충차, 성벽은 사다리·공성탑·갱도병이 노립니다.',
        '적 무리는 지휘관이 쓰러지거나 피해가 쌓이면 무너져 달아납니다.',
      ),
      sec(
        '자주 묻는 질문',
        '진행 상황은 어디에 저장되나요? 이 기기에만 저장되며 자동 백업 사본도 함께 보관됩니다. 기기를 옮길 때는 설정 → 저장 코드를 사용하세요.',
        '결제한 상품이 사라졌어요. 설정 또는 상점의 "구매 복원"을 누르면 스토어 계정 기준으로 되찾습니다.',
        '결제하면 강해지나요? 아니요. 판매 상품은 외관·연대기 외관·편의 기능(4배속·편성 저장·빠른 소탕)뿐이고 금화·병력·연구는 전투로만 얻습니다.',
        '시즌이 끝나면 연대기 보상은요? 받지 않은 보상은 자동으로 지급되고, 산 시즌 외관은 영구히 남습니다.',
        '인터넷이 필요한가요? 아니요. 결제·구매 복원 때만 스토어 연결이 필요합니다.',
        '너무 어려워요. 설정에서 난이도를 "쉬움"으로 바꾸거나, 이전 성을 다시 지켜 금화를 모아 연구하세요.',
      ),
      sec('업적', ...ACHIEVEMENTS.map((a) => `${this.save.achievements.includes(a.id) ? '✔' : '·'} ${a.name} — ${a.desc} (훈장 ${a.medals})`)),
    );
  }

  // ================================================================== battle resume

  /** At boot: offer the battle the app was killed in, or silently drop a record that can't be resumed. */
  private checkResume(lr: LoadResult) {
    let rec: BattleRecord | null = null;
    try {
      rec = loadRecord(this.kv, RESUME_VER);
    } catch {
      rec = null;
    }
    // unreadable / other version / expired / already paid out / the save it belongs to is gone
    if (!rec || rec.id === this.save.battleDone || lr.source === 'new') {
      clearRecord(this.kv);
      return;
    }
    void this.offerResume(rec);
  }

  private async offerResume(rec: BattleRecord) {
    const st = resolveStage(rec.ref);
    const name = (st?.name ?? rec.name) || '전투';
    const started = rec.cmds.some((c) => c.m === 'start');
    const ended = rec.state === 'won' || rec.state === 'lost';
    const t = Math.max(0, Math.floor(rec.t ?? 0));
    const clock = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const wave = Math.max(1, (rec.wave ?? 0) + 1);
    const where = !started
      ? '배치 중 (전투 시작 전)'
      : rec.state === 'won' || rec.state === 'lost'
        ? `전투 종료 직전 · 전투 시간 ${clock}`
        : `물결 ${rec.mode === 'endless' || !rec.waves ? wave : `${Math.min(wave, rec.waves)}/${rec.waves}`} · 전투 시간 ${clock}`;
    for (;;) {
      const v = await modal(
        '중단된 전투가 있습니다',
        [
          h('p', null, h('b', null, name), rec.modName && rec.mode !== 'daily' ? ` · ${rec.modName}` : rec.modName ? ` (${rec.modName})` : ''),
          h('p', null, where),
          h(
            'p',
            { class: 'muted small' },
            ended
              ? '전투는 이미 끝났습니다. 어느 쪽을 골라도 그 결과(사상자·보상·보급 비용)가 한 번 반영됩니다.'
              : started
                ? '이어하기: 멈춘 곳부터 그대로 계속합니다.\n포기: "후퇴"로 처리되어 지금까지 막아낸 물결만큼 위로금을 받고, 사상자와 보급 비용이 반영됩니다.'
                : '이어하기: 배치 화면으로 돌아갑니다.\n포기: 기록 없이 나갑니다 (비용 없음).',
          ),
        ],
        [
          { label: '포기', value: 'abandon', kind: 'ghost' },
          { label: '이어하기', value: 'resume', kind: 'primary' },
        ],
        { dismissable: false },
      );
      if (v === 'resume') {
        await this.resumeBattle(rec);
        return;
      }
      if (v !== 'abandon') continue;
      if (!started) {
        clearRecord(this.kv);
        toast('중단된 전투를 정리했습니다.', 'info');
        return;
      }
      if (ended || (await confirmBox('전투 포기', '후퇴로 처리합니다. 지금까지 막아낸 물결만큼 위로금을 받고, 이번 전투의 사상자와 보급 비용이 반영됩니다.', '후퇴', true))) {
        await this.abandonBattle(rec);
        return;
      }
    }
  }

  /** Full-screen progress while a battle is replayed; the UI keeps painting between replay chunks. */
  private replayOverlay(label: string) {
    const pct = h('b', { class: 'pct' }, '0%');
    const b = bar(0, 'replay');
    const el = h('div', { class: 'resume-overlay', role: 'status', 'aria-live': 'polite' }, h('div', { class: 'resume-box' }, h('p', null, `${label} `, pct), b));
    document.body.append(el);
    let last = -1;
    return {
      set: (f: number) => {
        const p = Math.max(0, Math.min(100, Math.floor(f * 100)));
        if (p === last) return;
        last = p;
        pct.textContent = `${p}%`;
        (b.firstChild as HTMLElement).style.width = `${p}%`;
      },
      remove: () => el.remove(),
    };
  }

  /**
   * Rebuild a recorded battle up to its last saved step: same stage, same config, same commands.
   * Throws if the stage can't be rebuilt identically or the replay fails.
   */
  private async rebuildBattle(rec: BattleRecord, label: string): Promise<World> {
    const ov = this.replayOverlay(label);
    try {
      // let the overlay show before the first chunk of work
      await nextPaint();
      const stage = resolveStage(rec.ref);
      if (!stage) throw new Error('resume: unknown stage ' + JSON.stringify(rec.ref));
      const cfg = { ...JSON.parse(JSON.stringify(rec.cfg)), stage } as BattleConfig;
      const world = new World(cfg);
      if (stageSig(world) !== rec.sig) throw new Error('resume: rebuilt stage differs from the recorded one');
      this.lastReplay = await replay(world, rec, ov.set, 30, 45);
      return world;
    } finally {
      ov.remove();
    }
  }

  /** The setup a recorded battle was started with (same rewards, supply charge, retry and exit paths). */
  private setupFromRecord(rec: BattleRecord, world: World): BattleSetup {
    const extra = { ...(rec.extra ?? {}) };
    return { mode: rec.mode, stage: world.stage, cfg: world.cfg, modName: rec.modName, supplyCost: planCost(extra), ref: rec.ref, extra, lineup: [...rec.lineup], battleId: rec.id };
  }

  private restorePre(rec: BattleRecord, world: World) {
    this.pre = {
      mode: rec.mode,
      stage: world.stage,
      lineup: [...rec.lineup],
      extra: { ...(rec.extra ?? {}) },
      seed: world.cfg.seed,
      mods: world.cfg.mods ? [...world.cfg.mods] : undefined,
      modName: rec.modName,
      daily: rec.ref.kind === 'daily' ? { key: rec.ref.key, maxIdx: rec.ref.maxIdx } : undefined,
    };
    setWantedSize(this.pre, this.pre.lineup.length);
  }

  /** Something went wrong while restoring: drop the record (nothing charged) and land on the home screen. */
  private resumeFailed(err: unknown) {
    this.logError('resume', err);
    clearRecord(this.kv);
    this.resuming = false;
    document.querySelector('.resume-overlay')?.remove();
    document.body.classList.remove('in-battle', 'toasts-left');
    if (this.battle) {
      try {
        this.battle.destroy();
      } catch {
        /* already half gone */
      }
      this.battle = null;
    }
    toast('중단된 전투를 복원하지 못해 기록을 정리했습니다. 병력 손실과 비용은 없습니다.', 'warn', undefined, 5000);
    this.go('home');
  }

  async resumeBattle(rec: BattleRecord) {
    if (this.battle || this.resuming) return;
    this.resuming = true;
    try {
      audio.unlock();
      const world = await this.rebuildBattle(rec, '전투 복원 중…');
      this.restorePre(rec, world);
      const setup = this.setupFromRecord(rec, world);
      this.resuming = false;
      clear(this.screenRoot);
      this.battle = new BattleView(this, setup, { world, record: rec });
    } catch (err) {
      this.resumeFailed(err);
    }
  }

  /** "포기": exactly what the in-battle "후퇴" does, at the point the battle was saved. */
  async abandonBattle(rec: BattleRecord) {
    if (this.battle || this.resuming) return;
    this.resuming = true;
    let rw: Rewards;
    let res: BattleResult;
    let retreated = false;
    try {
      const world = await this.rebuildBattle(rec, '전투 정리 중…');
      // a battle that had already ended keeps its own result; otherwise the army retreats now
      if (!world.result) {
        world.surrender();
        retreated = true;
      }
      if (!world.result) throw new Error('resume: no result after retreat');
      res = world.result;
      this.restorePre(rec, world);
      rw = this.recordBattle(this.setupFromRecord(rec, world), res);
      this.resuming = false;
    } catch (err) {
      this.resumeFailed(err);
      return;
    }
    this.go('home');
    await modal(
      retreated ? '후퇴했습니다' : '전투 결과를 반영했습니다',
      [
        h('p', null, `막아낸 물결 ${res.wavesCleared}${rec.mode === 'endless' ? '' : '/' + res.totalWaves} · 전사 ${res.dead} · 부상 ${res.wounded}`),
        h('p', null, `보상: 금화 ${fmt(rw.gold)}${rw.medals ? ` · 훈장 ${rw.medals}` : ''} · 연대기 ${rw.passXp}xp`),
        rw.lines.length ? h('ul', { class: 'small' }, ...rw.lines.map((l) => h('li', null, l))) : null,
      ],
      [{ label: '확인', value: 'ok', kind: 'primary' }],
    );
    if (!this.battle) this.go('home');
  }

  // ================================================================== lifecycle

  onHidden() {
    this.battle?.autoPause();
    this.persist();
    audio.suspend();
  }
  /** The page is being unloaded (reload, close, WebView killed politely): keep a resume point. */
  onPageHide() {
    this.battle?.saveResume();
    this.persist();
  }
  onVisible() {
    audio.resume();
    const ch = syncSeason(this.save, new Date());
    if (ch) {
      this.persist();
      this.notifySeason(ch);
    }
  }

  /** for tests / debugging in the browser console */
  debugState() {
    return {
      screen: this.screen,
      gold: this.save.gold,
      battle: !!this.battle,
      state: this.battle?.world.state,
      wave: this.battle?.world.waveIdx,
      t: this.battle?.world.t,
      steps: this.battle?.recorder.steps,
      resuming: this.resuming,
      replay: this.lastReplay,
    };
  }
}

/** Wait for the browser to paint (e.g. an overlay just added); never stalls in a hidden tab. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      requestAnimationFrame(() => setTimeout(go, 0));
    } catch {
      /* no animation frames here */
    }
    setTimeout(go, 100);
  });
}

function kindName(k: Cosmetic['kind']) {
  return { dye: '갑주 색', banner: '깃발', castle: '성채 외관', title: '칭호' }[k];
}
