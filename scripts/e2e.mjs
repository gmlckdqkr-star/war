// End-to-end test on a phone-sized touch viewport (headless Chromium).
// Usage: npm run build && npm run e2e   (starts `vite preview` itself)
// Exits non-zero on any failed check or any console error.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = process.env.E2E_OUT || 'artifacts/e2e';
mkdirSync(OUT, { recursive: true });
const PORT = Number(process.env.E2E_PORT ?? 4179);
const URL = `http://localhost:${PORT}/`;

// own process group, so stopping it also stops the vite process npx starts (not just the npx wrapper)
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: process.platform !== 'win32' });
const stopServer = () => {
  try {
    if (process.platform !== 'win32' && server.pid) process.kill(-server.pid, 'SIGTERM');
    else server.kill();
  } catch {
    /* already gone */
  }
};
process.on('SIGINT', () => {
  stopServer();
  process.exit(130);
});
const results = [];
let failed = 0;
/** the page, for a screenshot when the run stops on an exception */
let lastPage = null;
const check = (name, ok, info = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`);
  if (!ok) failed++;
};

async function waitServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('preview server did not start');
}

async function run() {
  await waitServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'ko-KR' });
  const page = await ctx.newPage();
  lastPage = page;
  // battle resume probes, installed before the app on every load:
  //  - __fp(world): fingerprint of the whole battle state (units, squads, map, RNG)
  //  - on pagehide (after the app wrote its resume point) the fingerprint + step count go to sessionStorage
  //  - the replay overlay's texts and the long tasks while it is up
  await page.addInitScript(() => {
    // "storage full" for the save only (the record still fits), switched on by a sessionStorage flag
    if (sessionStorage.getItem('e2e.saveFull')) {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (this === localStorage && String(k).startsWith('ashen.save')) throw new DOMException('quota', 'QuotaExceededError');
        return set.call(this, k, v);
      };
    }
    window.__fp = (w) => {
      let h = 0;
      for (const u of w.units) h = (h * 31 + Math.round(u.x * 100) * 7 + Math.round(u.y * 100) * 13 + Math.round(u.hp * 100) + u.state * 17 + (u.fleeing ? 5 : 0)) | 0;
      let gh = 0;
      for (let i = 0; i < w.grid.n; i++) gh = (gh * 31 + w.grid.tiles[i] * 7 + Math.round(w.grid.hp[i] * 10)) | 0;
      return {
        t: Math.round(w.t * 1000),
        state: w.state,
        wave: w.waveIdx,
        units: w.units.length,
        h,
        gh,
        rng: w.rng.s,
        keep: Math.round(w.keepHp * 100),
        sup: { ...w.supplies },
        squads: w.squads.map((q) => [q.stance, q.auto, q.focus ? q.focus.id : -1, q.destTile, Math.round(q.morale * 100), q.alive]),
        orders: w.stats.orders,
      };
    };
    window.addEventListener('pagehide', () => {
      try {
        const app = window.__app;
        const b = app && app.battle;
        if (!b) return;
        const p = app.pre;
        sessionStorage.setItem('e2e.fp', JSON.stringify({ fp: window.__fp(b.world), steps: b.recorder.steps, cmds: b.recorder.cmds.length, pre: p && { mode: p.mode, lineup: p.lineup, extra: p.extra, seed: p.seed, mods: p.mods, modName: p.modName }, supplyCost: b.setup.supplyCost }));
      } catch (e) {
        sessionStorage.setItem('e2e.fp', 'error ' + e);
      }
    });
    window.__overlay = { texts: [], first: 0, last: 0 };
    setInterval(() => {
      const o = document.querySelector('.resume-overlay');
      if (!o) return;
      const t = o.textContent;
      const now = performance.now();
      if (!window.__overlay.first) window.__overlay.first = now;
      window.__overlay.last = now;
      if (window.__overlay.texts[window.__overlay.texts.length - 1] !== t) window.__overlay.texts.push(t);
    }, 30);
    window.__longTasks = [];
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__longTasks.push({ t: e.startTime, d: Math.round(e.duration) });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
  const errors = [];
  // failures the resume section provokes on purpose (logged locally by the app, then handled)
  const expectedErrors = [/rebuilt stage differs/, /replayed state differs/];
  page.on('console', (m) => {
    if (m.type() === 'error' && !expectedErrors.some((r) => r.test(m.text()))) errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
  const state = () => page.evaluate(() => window.__app.debugState());
  const save = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.save)));
  const closeModals = async (max = 6) => {
    await page.waitForTimeout(450);
    for (let i = 0; i < max; i++) {
      const b = await page.$('.modal-buttons .primary');
      if (!b) break;
      await b.click();
      await page.waitForTimeout(120);
    }
  };

  // ---------------------------------------------------------------- 1. home
  await page.goto(URL);
  await page.waitForSelector('.home');
  await shot('01_home');
  check('home renders', !!(await page.$('.game-title')));

  // ---------------------------------------------------------------- 2. stage 1 prebattle -> battle
  await page.click('.home-main .btn.primary');
  await page.waitForSelector('.prebattle');
  await shot('02_prebattle');
  const startBtn = await page.$('.pre-actions .btn.primary');
  const box = await startBtn.boundingBox();
  check('start button visible without scrolling', box && box.y + box.height <= 390, JSON.stringify(box));
  await startBtn.click();
  await page.waitForSelector('.battle');
  await page.waitForTimeout(400);
  await shot('03_tutorial');
  await closeModals();
  check('tutorial completes', (await save()).tutorialDone === true);
  await shot('04_deploy');
  // opening view: the whole wall ring sits between the HUD bars; the deploy banner is not cut off
  const view = await page.evaluate(() => {
    const b = window.__app.battle;
    const g = b.world.grid;
    const c = b.renderer.cam;
    let y0 = 1e9;
    let y1 = -1;
    for (let i = 0; i < g.n; i++) if ([4, 5, 6, 8, 14].includes(g.tiles[i])) ((y0 = Math.min(y0, Math.floor(i / 60))), (y1 = Math.max(y1, Math.floor(i / 60))));
    const ban = document.querySelector('.hud-banner');
    return { wallTop: c.toScreenY(y0 * 16), wallBottom: c.toScreenY((y1 + 1) * 16), top: document.querySelector('.hud-top').getBoundingClientRect().bottom, bar: document.querySelector('.hud-bottom').getBoundingClientRect().top, banner: ban.textContent, cut: ban.scrollWidth > ban.clientWidth + 1 };
  });
  check('castle walls between the HUD bars at the opening view', view.wallTop >= view.top && view.wallBottom <= view.bar, JSON.stringify(view));
  check('deploy banner shows the first-wave direction uncut', view.banner.includes('첫 공세') && !view.cut, view.banner);

  // drag a squad banner during deployment
  const before = await page.evaluate(() => {
    const w = window.__app.battle.world;
    const r = window.__app.battle.renderer;
    const sq = w.squads[0];
    return { tile: sq.homeTile, sx: r.cam.toScreenX(sq.cx), sy: r.cam.toScreenY(sq.cy - 14 * Math.max(0.55, Math.min(1.6, 1.1 / r.cam.zoom))) };
  });
  await page.mouse.move(before.sx, before.sy);
  await page.mouse.down();
  await page.mouse.move(before.sx + 20, before.sy + 30, { steps: 5 });
  await page.mouse.move(before.sx + 30, before.sy + 55, { steps: 5 });
  await page.mouse.up();
  const afterTile = await page.evaluate(() => window.__app.battle.world.squads[0].homeTile);
  check('deploy drag moves squad', afterTile !== before.tile, `${before.tile} -> ${afterTile}`);

  await page.click('.start-btn');
  await page.waitForTimeout(300);
  check('battle started', (await state()).state === 'battle');

  // soldiers are drawn (debug counter) and show up as pixels next to their banner, at fit zoom too
  const soldierPx = async () =>
    page.evaluate(() => {
      const b = window.__app.battle;
      const r = b.renderer;
      const c = b.canvas;
      const dpr = r.dpr;
      const ctx = c.getContext('2d');
      let px = 0;
      for (const sq of b.world.squads) {
        if (sq.alive === 0) continue;
        // a box just below the squad centre: soldiers stand there, the banner hangs above it
        const x = Math.round((r.cam.toScreenX(sq.cx) - 14) * dpr);
        const y = Math.round((r.cam.toScreenY(sq.cy) + 1) * dpr);
        const w = Math.round(28 * dpr);
        const hh = Math.round(14 * dpr);
        const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), w, hh).data;
        // defenders: dye body (blue) or the pale rim
        for (let i = 0; i < d.length; i += 4) if ((d[i + 2] > 150 && d[i + 2] - d[i] > 70) || (d[i] > 190 && d[i + 2] > 235)) px++;
      }
      return { drawn: r.drawnUnits, px, zoom: r.cam.zoom };
    });
  const sv = await soldierPx();
  check('soldiers visible (counter + pixels)', sv.drawn > 20 && sv.px > 40, JSON.stringify(sv));
  await page.evaluate(() => window.__app.battle.renderer.cam.fit());
  await page.waitForTimeout(150);
  const svFit = await soldierPx();
  check('soldiers visible at fit zoom', svFit.drawn > 20 && svFit.px > 80, JSON.stringify(svFit));
  await shot('04b_soldiers_fit');
  // auto fast-forward while the enemy is still walking in
  check('fast-forward indicator before contact', await page.evaluate(() => window.__app.battle.approaching && document.querySelector('.hud-banner').textContent.includes('적 접근 중')));

  // select squad via card, order by tapping ground
  await page.tap('.cards .card:nth-child(2)');
  await page.waitForTimeout(150);
  check('selection strip shown', await page.isVisible('.sel-strip'));
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.sel-strip .chip')].map((c) => {
      const r = document.createRange();
      r.selectNodeContents(c);
      return { t: c.textContent, h: Math.round(c.getBoundingClientRect().height), lines: r.getClientRects().length };
    }),
  );
  check('selection strip chips on one line', chips.length >= 5 && chips.every((c) => c.lines === 1 && c.h <= 46), JSON.stringify(chips));
  const stripBox = await page.evaluate(() => {
    const s = document.querySelector('.sel-strip').getBoundingClientRect();
    const cam = window.__app.battle.renderer.cam;
    return { top: s.top, right: s.right, mapBottom: cam.h - cam.insetBottom, vw: innerWidth };
  });
  check('selection strip stays off the map', stripBox.top >= stripBox.mapBottom - 2 && stripBox.right <= stripBox.vw, JSON.stringify(stripBox));
  const tgt = await page.evaluate(() => {
    const w = window.__app.battle.world;
    const r = window.__app.battle.renderer;
    const g = w.grid;
    const t = g.nearestTile(Math.floor((g.keepY - 32) / 16) * 60 + Math.floor((g.keepX - 48) / 16), (j) => g.deployable(j), 10);
    return { x: r.cam.toScreenX((t % 60) * 16 + 8), y: r.cam.toScreenY(Math.floor(t / 60) * 16 + 8), t };
  });
  await page.touchscreen.tap(tgt.x, tgt.y);
  await page.waitForTimeout(150);
  const sq1 = await page.evaluate(() => {
    const s = window.__app.battle.world.squads[1];
    return { auto: s.auto, dest: s.destTile };
  });
  check('tap ground orders squad (manual)', sq1.auto === false, JSON.stringify(sq1));
  await page.click('.sel-strip .chip.auto');
  check('auto toggle restores auto', await page.evaluate(() => window.__app.battle.world.squads[1].auto === true));
  await page.click('.sel-strip .chip.close');

  // ability with target
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 30 * 25; i++) w.step();
  });
  const abil = await page.$('.ability');
  if (abil) {
    await abil.click();
    await page.waitForTimeout(100);
    const armed = await page.$('.ability.armed');
    const k = await page.evaluate(() => {
      const w = window.__app.battle.world;
      const r = window.__app.battle.renderer;
      const sq = w.squads.find((s) => s.alive > 0);
      return { x: r.cam.toScreenX(sq.cx), y: r.cam.toScreenY(sq.cy) };
    });
    await page.touchscreen.tap(k.x, k.y);
    await page.waitForTimeout(150);
    const used = await page.evaluate(() => Object.values(window.__app.battle.world.abilities).some((a) => a.cd > 0));
    check('ability targeting works', !!armed && used);
  }
  // a burst of alerts: at most two toasts on screen, in a top corner between the side columns, particles fixed
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 6; i++) w.events.push({ type: 'test', text: i === 5 ? '징집병 무리이(가) 무너져 달아납니다!' : `시험 알림 ${i + 1}`, level: 'warn', x: 200, y: 200 });
  });
  await page.waitForTimeout(150);
  const toasts = await page.evaluate(() => {
    const top = document.querySelector('.hud-top').getBoundingClientRect().bottom;
    return [...document.querySelectorAll('.toasts .toast')].map((t) => {
      const r = t.getBoundingClientRect();
      const hitAbove = document.elementFromPoint(r.left + r.width / 2, r.top - 4) === t;
      return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), top: Math.round(top), text: t.textContent, hitAbove };
    });
  });
  check('battle toasts: at most 2, top corner between the side columns', toasts.length >= 1 && toasts.length <= 2 && toasts.every((q) => q.t >= q.top && q.l >= 64 && q.r <= 844 - 64 && q.b < 390 / 2), JSON.stringify(toasts));
  check('event particles read naturally ("무리가", not "무리이(가)")', toasts.some((q) => q.text.includes('징집병 무리가 무너져')) && !toasts.some((q) => q.text.includes('(가)')), JSON.stringify(toasts.map((q) => q.text)));
  check('tappable alert has a touch area beyond its edge', toasts.every((q) => q.hitAbove), JSON.stringify(toasts.map((q) => q.hitAbove)));

  await page.click('.speed[data-speed="3"]');
  await page.waitForTimeout(800);
  await shot('05_battle');
  check('battle speed saved', (await save()).settings.speed === 3);

  // war council: during an intermission, options from the world become big buttons
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    let n = 0;
    while (w.state === 'battle' && n++ < 30 * 600) w.step();
    window.__picked = [];
    w.councilOptions = () =>
      w.councilPick
        ? []
        : [
            { id: 'a', name: '성벽 보수', desc: '성벽 내구 회복' },
            { id: 'b', name: '휴식', desc: '전 분대 사기 +20' },
            { id: 'c', name: '보급 정비', desc: '화살 +150' },
          ];
    w.chooseCouncil = (id) => {
      window.__picked.push(id);
      w.councilPick = id;
      return true;
    };
  });
  await page.waitForTimeout(400);
  if ((await state()).state === 'intermission') {
    const opts = await page.$$('.council-opt');
    check('council options shown', opts.length === 3);
    check('next wave direction announced', ((await page.textContent('.inter-dir')) ?? '').startsWith('다음 공세:'));
    await shot('05b_council');
    await page.tap('.council-opt[data-id="b"]');
    await page.waitForTimeout(200);
    const picked = await page.evaluate(() => ({ p: window.__picked, label: document.querySelector('.inter-pick')?.textContent, n: document.querySelectorAll('.council-opt').length }));
    check('council pick applied and shown', picked.p[0] === 'b' && (picked.label ?? '').includes('휴식') && picked.n === 0, JSON.stringify(picked));
    const goH = await page.evaluate(() => document.querySelector('.inter-go').getBoundingClientRect().height);
    check('"바로 시작" is a 44 px target', goH >= 44, String(goH));
    // approach arrows for every edge stay inside the map area and out from under the HUD and the alerts
    await page.evaluate(() => {
      const w = window.__app.battle.world;
      w.nextWaveEdges = () => ['W', 'N', 'S', 'E'];
      w.events.push({ type: 'test', text: '물결을 막아냈습니다! (시험)', level: 'good' }, { type: 'test', text: '화살을 회수했습니다 (시험)', level: 'info' });
    });
    await page.waitForTimeout(300);
    const ap = await page.evaluate(() => {
      const b = window.__app.battle;
      const rect = (el) => el.getBoundingClientRect();
      const top = rect(document.querySelector('.hud-top')).bottom;
      const bar = rect(document.querySelector('.hud-bottom')).top;
      const covers = [...document.querySelectorAll('.toasts .toast, .inter, .hud-left .side-btn, .hud-right .ability')].map(rect);
      const R = 12;
      return b.renderer.approachPts.map((a) => ({ e: a.edge, x: Math.round(a.x), y: Math.round(a.y), ok: a.y - R >= top && a.y + R <= bar && a.x - R >= 0 && a.x + R <= innerWidth && !covers.some((q) => a.x + R > q.left && a.x - R < q.right && a.y + R > q.top && a.y - R < q.bottom) }));
    });
    await shot('05c_approach_all_edges');
    check('approach arrows visible on every edge (not under bars, panels or alerts)', ['W', 'N', 'S', 'E'].every((e) => ap.some((a) => a.e === e)) && ap.every((a) => a.ok), JSON.stringify(ap));
  } else check('council options shown', false, 'no intermission: ' + (await state()).state);

  // portrait screenshot of the running battle
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await shot('06_battle_portrait');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);

  // FPS sample at 3x
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(f);
          else res(n / 3);
        };
        requestAnimationFrame(f);
      }),
  );
  check('frame rate sample (headless, software canvas)', fps > 20, `${fps.toFixed(1)} fps`);

  // fast-forward to the end
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    let n = 0;
    while ((w.state === 'battle' || w.state === 'intermission') && n++ < 30 * 900) w.step();
  });
  await page.waitForSelector('.result', { timeout: 8000 });
  await shot('07_result');
  const won = await page.evaluate(() => window.__app.battle.world.result.won);
  const s1 = await save();
  check('result recorded', s1.stats.battles === 1, `won=${won} gold=${s1.gold} stars=${JSON.stringify(s1.stars)}`);
  await page.click('.result-buttons .btn.primary');
  await page.waitForTimeout(200);
  check('result continues to next castle or map', ['campaign', 'prebattle'].includes((await state()).screen) && !(await state()).battle, (await state()).screen);
  await shot('08_campaign');

  // ---------------------------------------------------------------- 3. persistence
  await page.reload();
  await page.waitForSelector('.home');
  const s2 = await save();
  check('save persists across reload', s2.stats.battles === 1 && s2.gold === s1.gold);
  await page.waitForTimeout(300);
  check('no resume prompt after a finished battle', !(await page.$('.modal')) && (await page.evaluate(() => localStorage.getItem('ashen.battle'))) === null);

  // ---------------------------------------------------------------- 4. meta screens
  await page.click('text=병영');
  await page.waitForSelector('.roster');
  await shot('09_barracks');
  const g0 = (await save()).gold;
  const fill = await page.$('.bulk .btn');
  if (fill) {
    await fill.click();
    await page.waitForTimeout(150);
  }
  check('barracks bulk action ok', (await save()).gold <= g0);
  await page.click('.topbar .back');
  await page.click('text=연구');
  await page.waitForSelector('.ups');
  await page.evaluate(() => {
    window.__app.save.gold += 1000;
  });
  await page.click('.up-card .btn');
  await page.waitForTimeout(100);
  check('research purchase', Object.values((await save()).upgrades).some((v) => v > 0));
  await shot('10_research');
  await page.click('.topbar .back');
  await page.click('text=전쟁 연대기');
  await page.waitForSelector('.tiers');
  await page.evaluate(() => {
    window.__app.save.pass.xp += 2500;
    window.__app.go('chronicle');
  });
  await page.click('.tier.reached .cell.free.ready');
  await page.waitForTimeout(100);
  check('season reward claim', (await save()).pass.claimedFree.length >= 1);
  await shot('11_chronicle');

  // mock purchase of the premium track
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.modal');
  await shot('12_test_purchase');
  await closeModals(1);
  await page.waitForTimeout(200);
  const s3 = await save();
  check('premium purchase grants entitlement', s3.entitlements.some((e) => e.startsWith('chronicle_s')));
  await page.click('.topbar .back');
  await page.click('text=상점·옷장');
  await page.waitForSelector('.shop');
  await page.click('.tab:nth-child(2)');
  await page.waitForTimeout(100);
  await shot('13_store');
  await page.click('.product .btn.primary');
  await closeModals(1);
  await page.waitForTimeout(200);
  check('supporter purchase grants cosmetics', (await save()).owned.includes('ban_supporter'));
  await page.click('.tab:nth-child(3)');
  await page.waitForTimeout(100);
  const eqBtns = await page.$$('.item:not(.equipped)');
  if (eqBtns.length) await eqBtns[0].click();
  await page.waitForTimeout(100);
  await shot('14_wardrobe');
  check('wardrobe equip', !!(await page.$('.item.equipped')));

  // ---------------------------------------------------------------- 4b. supply packs are planned, not paid, until a result
  await page.click('.topbar .back');
  await page.evaluate(() => {
    window.__app.save.gold = Math.max(window.__app.save.gold, 200);
    window.__app.go('campaign');
  });
  await (await page.$$('.stage-card'))[0].click();
  await page.waitForSelector('.prebattle');
  const gPlan = (await save()).gold;
  await page.click('.sup-row .btn');
  await page.waitForTimeout(120);
  const planText = (await page.textContent('.plan-line')) ?? '';
  check('supply pack planned, gold untouched', (await save()).gold === gPlan && planText.includes('◉'), planText);
  await shot('14b_supply_plan');
  await page.click('.topbar .back');
  await page.waitForTimeout(120);
  check('leaving prebattle charges nothing', (await save()).gold === gPlan, `${gPlan} -> ${(await save()).gold}`);

  // ---------------------------------------------------------------- 5. settings: export/import strips purchases
  await page.click('.topbar .back');
  await page.click('text=설정');
  await page.waitForSelector('.settings');
  await shot('15_settings');
  const exported = await page.evaluate(() => !!document.querySelector('.settings'));
  check('settings render', exported);
  await page.click('.set-row:has-text("큰 글씨") input');
  check('big text toggles', await page.evaluate(() => document.documentElement.classList.contains('big-text')));
  await page.click('.set-row:has-text("큰 글씨") input');

  // ---------------------------------------------------------------- 6. corrupt save -> backup recovery
  await page.evaluate(() => {
    window.__app.persist();
    window.__app.persist();
    localStorage.setItem('ashen.save', '{"c":"bad","b":"{}"}');
  });
  await page.reload();
  await page.waitForSelector('.home');
  const s4 = await save();
  check('corrupt save recovered from backup', s4.stats.battles === 1, `battles=${s4.stats.battles}`);

  // ---------------------------------------------------------------- 7. daily + endless entry (unlock by editing progress)
  await page.evaluate(() => {
    const s = window.__app.save;
    for (const id of ['s1', 's2', 's3', 's4', 's5']) s.stars[id] = Math.max(1, s.stars[id] ?? 0);
    window.__app.persist();
    window.__app.openDaily();
  });
  await page.waitForSelector('.prebattle');
  await shot('16_daily');
  check('daily challenge prebattle', (await page.textContent('.prebattle')).includes('오늘의 조건'));
  await page.evaluate(() => window.__app.openEndless());
  await page.waitForSelector('.prebattle');
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.battle');
  await closeModals();
  check('battle speed remembered', await page.evaluate(() => window.__app.battle.speed === 3 && document.querySelector('.speed.on')?.dataset.speed === '3'));
  await page.click('.start-btn');
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 30 * 120; i++) w.step();
  });
  await page.waitForTimeout(300);
  await shot('17_endless');
  check('endless runs', ['battle', 'intermission', 'lost'].includes((await state()).state));
  // menu -> restart -> quit
  await page.click('.hud-top .hud-btn');
  await page.waitForSelector('.modal');
  await shot('18_menu');
  await page.click('.modal-buttons .btn.danger');
  await page.waitForTimeout(100);
  await page.click('.modal-buttons .btn.danger');
  await page.waitForSelector('.result', { timeout: 8000 });
  await page.click('.result-buttons .btn.primary');
  await page.waitForTimeout(200);
  check('surrender returns to menu', !(await state()).battle);

  // ---------------------------------------------------------------- 8. late stage with dragon renders
  await page.evaluate(() => {
    const app = window.__app;
    for (const id of ['s6', 's7', 's8']) app.save.stars[id] = 1;
    app.go('campaign');
  });
  const cards = await page.$$('.stage-card:not(.locked)');
  await cards[cards.length - 1].click();
  await page.waitForSelector('.prebattle');
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.battle');
  await closeModals();
  await page.click('.start-btn');
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 30 * 70; i++) w.step();
  });
  await page.click('.speed[data-speed="1"]');
  await page.waitForTimeout(500);
  await shot('19_stage9');
  const fps2 = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(f);
          else res({ fps: n / 3, units: window.__app.battle.world.units.length });
        };
        requestAnimationFrame(f);
      }),
  );
  check('late-stage frame rate sample', fps2.fps > 20, JSON.stringify(fps2));

  // ---------------------------------------------------------------- 9. battle resume after the app is killed
  /** pre-battle: refill and treat with the screen's own buttons (earlier battles may have emptied the army) */
  const careUp = async () => {
    await page.evaluate(() => {
      window.__app.save.gold = Math.max(window.__app.save.gold, 5000);
      window.__app.go('prebattle');
    });
    for (let i = 0; i < 3; i++) {
      const b = await page.$('.pre-alert .btn');
      if (!b) break;
      await b.click();
      await page.waitForTimeout(150);
    }
    // a lineup picked while every squad was wounded is empty: pick ready squads with the rows themselves
    for (let i = 0; i < 4; i++) {
      if ((await page.$$('.lineup-row.on')).length >= 3) break;
      const r = await page.$('.lineup-row:not(.on):not(.disabled)');
      if (!r) break;
      await r.click();
      await page.waitForTimeout(100);
    }
  };
  // A fresh, fully manned battle on the last stage (section 8's army may already be spent, depending on
  // how many frames ran). Give orders through the real controls first.
  const recRaw = () => page.evaluate(() => localStorage.getItem('ashen.battle'));
  await page.evaluate(() => window.__app.exitBattle(window.__app.battle, null, false));
  await page.evaluate(() => window.__app.go('campaign'));
  const cards9 = await page.$$('.stage-card:not(.locked)');
  await cards9[cards9.length - 1].click();
  await page.waitForSelector('.prebattle');
  await careUp();
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.battle');
  await closeModals();
  await page.click('.start-btn');
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 30 * 20; i++) w.step();
  });
  const stage9 = await page.evaluate(() => window.__app.battle.setup.stage.name);
  await page.click('.speed[data-speed="3"]');
  await page.tap('.cards .card:nth-child(1)');
  await page.waitForTimeout(100);
  const ground = await page.evaluate(() => {
    const w = window.__app.battle.world;
    const r = window.__app.battle.renderer;
    const g = w.grid;
    const t = g.nearestTile(Math.floor(g.keepY / 16) * 60 + Math.floor((g.keepX - 40) / 16), (j) => g.deployable(j), 10);
    return { x: r.cam.toScreenX((t % 60) * 16 + 8), y: r.cam.toScreenY(Math.floor(t / 60) * 16 + 8) };
  });
  await page.touchscreen.tap(ground.x, ground.y);
  await page.waitForTimeout(100);
  await page.click('.sel-strip .chip:has-text("고수")');
  await page.click('.sel-strip .chip.close');
  await page.click('.hud-left .side-btn:has-text("위치 고수")');
  // a charge: a melee squad sent at an enemy (stance changes go through World commands)
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 30 * 40 && w.activeEnemies.length < 3 && w.state !== 'won' && w.state !== 'lost'; i++) w.step();
  });
  const charge = await page.evaluate(() => {
    const b = window.__app.battle;
    const w = b.world;
    const cam = b.renderer.cam;
    const i = w.squads.findIndex((q) => !q.type.ranged && q.alive > 0 && q.type.id !== 'surgeon' && q.type.id !== 'engineer');
    if (i < 0) return null;
    const e = w.activeEnemies.find((u) => !u.fleeing);
    if (!e) return null;
    cam.x = e.x;
    cam.y = e.y;
    cam.clamp();
    return { i };
  });
  if (charge) {
    await page.tap(`.cards .card:nth-child(${charge.i + 1})`);
    await page.waitForTimeout(80);
    const ep = await page.evaluate(() => {
      const b = window.__app.battle;
      const e = b.world.activeEnemies.find((u) => !u.fleeing);
      return e && { x: b.renderer.cam.toScreenX(e.x), y: b.renderer.cam.toScreenY(e.y) };
    });
    if (ep) await page.touchscreen.tap(ep.x, ep.y);
    await page.waitForTimeout(80);
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(1500);
  const given = await page.evaluate(() => window.__app.battle.recorder.cmds.map((c) => c.m));
  check(
    'orders given with the controls are recorded as World commands',
    ['commandMove', 'commandStance', 'preset'].every((m) => given.includes(m)) && (!charge || given.includes('commandFocus')),
    `${given.length} cmds, charge=${!!charge}: ${[...new Set(given)].join(',')}`,
  );
  // "kill" the app while the battle runs: a reload fires pagehide, the app writes its resume point
  await page.reload();
  await page.waitForSelector('.modal');
  const stash = JSON.parse(await page.evaluate(() => sessionStorage.getItem('e2e.fp')));
  const promptText = (await page.textContent('.modal')) ?? '';
  await shot('20_resume_prompt');
  check('resume prompt names the battle and its time', promptText.includes('중단된 전투') && promptText.includes(stage9) && /전투 시간 \d+:\d\d/.test(promptText) && promptText.includes('이어하기') && promptText.includes('포기'), promptText);
  for (const [vw, vh] of [
    [740, 360],
    [640, 360],
  ]) {
    await page.setViewportSize({ width: vw, height: vh });
    await page.waitForTimeout(150);
    const fits = await page.evaluate(() => [...document.querySelectorAll('.modal-buttons .btn')].every((b) => {
      const r = b.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height >= 36;
    }));
    await shot(`20_resume_prompt_${vw}`);
    check(`resume prompt buttons fit at ${vw}x${vh}`, fits);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  await page.click('.modal-buttons .btn.primary');
  await page.waitForFunction(() => window.__app.battle && !window.__app.resuming, null, { timeout: 60000 });
  await page.waitForTimeout(250);
  const resumed = await page.evaluate(() => {
    const app = window.__app;
    const b = app.battle;
    const p = app.pre;
    const ov = window.__overlay;
    return {
      fp: window.__fp(b.world),
      steps: b.recorder.steps,
      cmds: b.recorder.cmds.length,
      paused: b.paused,
      banner: document.querySelector('.hud-banner').textContent,
      // during a wave break the intermission panel shows the pause (⏸) instead of the banner
      inter: document.querySelector('.inter:not(.hidden)')?.textContent ?? '',
      wstate: b.world.state,
      toast: document.querySelector('.toasts')?.textContent ?? '',
      replay: app.lastReplay,
      overlay: ov.texts,
      long: window.__longTasks.filter((t) => t.t >= ov.first - 5 && t.t <= ov.last + 5).map((t) => t.d),
      pre: p && { mode: p.mode, lineup: p.lineup, extra: p.extra, seed: p.seed, mods: p.mods, modName: p.modName },
      supplyCost: b.setup.supplyCost,
    };
  });
  await shot('21_resumed_paused');
  check('resumed battle is identical at the saved step (world fingerprint)', resumed.steps === stash.steps && JSON.stringify(resumed.fp) === JSON.stringify(stash.fp), `steps ${stash.steps} -> ${resumed.steps}; ${JSON.stringify(stash.fp).slice(0, 160)} vs ${JSON.stringify(resumed.fp).slice(0, 160)}`);
  check('resumed recorder carries the earlier orders', resumed.cmds === stash.cmds, `${stash.cmds} -> ${resumed.cmds}`);
  check('replay progress is shown ("전투 복원 중… n%")', resumed.overlay.some((t) => /전투 복원 중… \d+%/.test(t)), JSON.stringify(resumed.overlay.slice(0, 6)));
  // every piece of work between two paints is timed by the app: building the world, each replay chunk,
  // the final state check and building the battle screen (the browser's long tasks are listed alongside)
  const blocks = resumed.replay && [resumed.replay.prepMs, resumed.replay.maxChunkMs, resumed.replay.hashMs, resumed.replay.viewMs];
  check(
    'replay never freezes the screen for long (world, chunks, check, battle screen each <= 50 ms)',
    !!blocks && blocks.every((x) => typeof x === 'number' && x <= 50),
    JSON.stringify(resumed.replay) + ' long tasks while the overlay was up: ' + JSON.stringify(resumed.long),
  );
  check(
    'resumed battle waits paused, with a toast',
    resumed.paused && (resumed.wstate === 'intermission' ? resumed.inter.includes('⏸') : resumed.banner.includes('일시정지')) && resumed.toast.includes('이어갑니다'),
    `${resumed.wstate}: ${resumed.banner || resumed.inter} | ${resumed.toast}`,
  );
  check('pre-battle state restored for retry / exit', JSON.stringify(resumed.pre) === JSON.stringify(stash.pre) && resumed.supplyCost === stash.supplyCost, JSON.stringify(resumed.pre));
  // the continued battle keeps recording after the old orders
  await page.click('.hud-top .speeds .hud-btn:first-child');
  await page.click('.hud-left .side-btn:has-text("전원 자동")');
  await page.waitForTimeout(600);
  const cont = await page.evaluate(() => {
    const r = window.__app.battle.recorder;
    const last = r.cmds[r.cmds.length - 1];
    return { n: r.cmds.length, last, steps: r.steps, paused: window.__app.battle.paused };
  });
  check('orders after the resume are recorded after the old ones', cont.n === stash.cmds + 1 && cont.last.m === 'preset' && cont.last.k >= stash.steps && cont.steps > stash.steps && !cont.paused, JSON.stringify(cont));
  // fight it out: the result clears the resume point
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    let n = 0;
    while ((w.state === 'battle' || w.state === 'intermission') && n++ < 30 * 900) w.step();
  });
  await page.waitForSelector('.result', { timeout: 8000 });
  check('result after a resume clears the resume point', (await recRaw()) === null);
  await page.click('.result-buttons .btn.primary');
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForSelector('.home');
  await page.waitForTimeout(300);
  check('no prompt after the resumed battle finished', !(await page.$('.modal')));

  // ---- the other modes resume the same way (daily: date key + progress, endless: seed)
  for (const mode of ['daily', 'endless']) {
    await page.evaluate((m) => (m === 'daily' ? window.__app.openDaily() : window.__app.openEndless()), mode);
    await page.waitForSelector('.prebattle');
    await careUp();
    await page.click('.pre-actions .btn.primary');
    await page.waitForSelector('.battle');
    await closeModals();
    await page.click('.start-btn');
    await page.evaluate(() => {
      const w = window.__app.battle.world;
      for (let i = 0; i < 30 * 50 && w.state !== 'won' && w.state !== 'lost'; i++) {
        if (i === 300) w.commandStance(w.squads[0], 'hold');
        if (i === 600) w.preset('fallback');
        w.step();
      }
    });
    await page.reload();
    await page.waitForSelector('.modal');
    const st0 = JSON.parse(await page.evaluate(() => sessionStorage.getItem('e2e.fp')));
    await page.click('.modal-buttons .btn.primary');
    await page.waitForFunction(() => window.__app.battle && !window.__app.resuming, null, { timeout: 60000 });
    const st1 = await page.evaluate(() => {
      const app = window.__app;
      const p = app.pre;
      return { fp: window.__fp(app.battle.world), steps: app.battle.recorder.steps, pre: p && { mode: p.mode, lineup: p.lineup, extra: p.extra, seed: p.seed, mods: p.mods, modName: p.modName } };
    });
    check(`${mode} battle resumes identically`, st0.steps === st1.steps && JSON.stringify(st0.fp) === JSON.stringify(st1.fp) && JSON.stringify(st0.pre) === JSON.stringify(st1.pre) && st1.pre.mode === mode, `${st0.steps}/${st1.steps} ${JSON.stringify(st1.pre)}`);
    await page.evaluate(() => window.__app.exitBattle(window.__app.battle, null, false));
    check(`${mode}: leaving the battle clears the resume point`, (await recRaw()) === null);
  }

  // ---- 포기: same as retreating from the in-battle menu, supplies charged once
  await page.evaluate(() => {
    window.__app.save.gold = Math.max(window.__app.save.gold, 3000);
    window.__app.persist();
    window.__app.go('campaign');
  });
  await (await page.$$('.stage-card'))[1].click();
  await page.waitForSelector('.prebattle');
  await careUp();
  await page.click('.sup-row .btn');
  await page.click('.sup-row .btn');
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.battle');
  await closeModals();
  await page.click('.start-btn');
  await page.evaluate(() => {
    const w = window.__app.battle.world;
    for (let i = 0; i < 30 * 60 && w.state !== 'won' && w.state !== 'lost'; i++) w.step();
  });
  const cost = await page.evaluate(() => window.__app.battle.setup.supplyCost);
  const ga0 = await save();
  await page.reload();
  await page.waitForSelector('.modal');
  await page.click('.modal-buttons .btn.ghost');
  await page.waitForSelector('.modal-buttons .btn.danger');
  await shot('22_abandon_confirm');
  await page.click('.modal-buttons .btn.danger');
  await page.waitForFunction(() => !window.__app.resuming && document.querySelector('.modal h2')?.textContent.includes('후퇴'), null, { timeout: 60000 });
  await shot('23_abandon_result');
  const summary = (await page.textContent('.modal')) ?? '';
  await page.click('.modal-buttons .btn.primary');
  await page.waitForTimeout(200);
  const ga1 = await save();
  const st1 = await state();
  const reward = Number((/보상: 금화 ([\d,]+)/.exec(summary) ?? [])[1]?.replace(/,/g, '') ?? NaN);
  check('포기 settles like a retreat: casualties, consolation, supplies charged once', cost > 0 && ga1.stats.battles === ga0.stats.battles + 1 && ga1.gold === ga0.gold + reward - cost && (summary.match(/보급품 비용/g) ?? []).length === 1, `cost ${cost}, gold ${ga0.gold} -> ${ga1.gold}, reward ${reward}: ${summary}`);
  check('포기 leaves no resume point and lands on home', (await recRaw()) === null && st1.screen === 'home' && !st1.battle && !!(await page.$('.home')), JSON.stringify(st1));
  await page.reload();
  await page.waitForSelector('.home');
  await page.waitForTimeout(300);
  check('nothing charged twice after 포기', !(await page.$('.modal')) && (await save()).gold === ga1.gold);

  // ---- 포기 before the battle started: like "나가기" in deployment, nothing happens
  await page.evaluate(() => window.__app.go('campaign'));
  await (await page.$$('.stage-card'))[0].click();
  await page.waitForSelector('.prebattle');
  await careUp();
  await page.click('.sup-row .btn');
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.battle');
  await closeModals();
  const ga2 = await save();
  await page.reload();
  await page.waitForSelector('.modal');
  check('deploy-only record is offered as "배치 중"', ((await page.textContent('.modal')) ?? '').includes('배치 중'));
  await page.click('.modal-buttons .btn.ghost');
  await page.waitForTimeout(300);
  const ga3 = await save();
  check('포기 during deployment costs nothing', ga3.gold === ga2.gold && ga3.stats.battles === ga2.stats.battles && (await recRaw()) === null && !(await page.$('.modal')), `${ga2.gold} -> ${ga3.gold}`);

  // ---- records that can't be resumed: other build, expired, already settled → dropped silently;
  //      a stage that does not rebuild identically → toast, home, nothing charged
  await page.evaluate(() => window.__app.go('campaign'));
  await (await page.$$('.stage-card'))[0].click();
  await page.waitForSelector('.prebattle');
  await careUp();
  await page.click('.pre-actions .btn.primary');
  await page.waitForSelector('.battle');
  await closeModals();
  await page.click('.start-btn');
  const good = await page.evaluate(() => {
    const b = window.__app.battle;
    for (let i = 0; i < 300; i++) b.world.step();
    const r = b.recorder.record({ t: b.world.t, wave: b.world.waveIdx, waves: b.world.totalWaves(), state: b.world.state });
    window.__app.exitBattle(b, null, false);
    return r;
  });
  for (const [label, patch] of [
    ['another app version', { ver: good.ver + '-old' }],
    ['expired', { savedAt: Date.now() - 8 * 86400000 }],
    ['already settled', { id: (await save()).battleDone || 'x' }],
    ['garbage', null],
  ]) {
    if (label === 'already settled' && !(await save()).battleDone) continue;
    await page.evaluate(([r, p]) => localStorage.setItem('ashen.battle', p === null ? '{"ver":' : JSON.stringify({ ...r, ...p })), [good, patch]);
    await page.reload();
    await page.waitForSelector('.home');
    await page.waitForTimeout(250);
    check(`record dropped silently: ${label}`, !(await page.$('.modal')) && (await recRaw()) === null);
  }
  const ga4 = await save();
  await page.evaluate((r) => localStorage.setItem('ashen.battle', JSON.stringify({ ...r, sig: 'not-this-stage' })), good);
  await page.reload();
  await page.waitForSelector('.modal');
  await page.click('.modal-buttons .btn.primary');
  await page.waitForFunction(() => !window.__app.resuming && !!document.querySelector('.home'), null, { timeout: 20000 });
  await page.waitForTimeout(200);
  const failToast = await page.evaluate(() => document.querySelector('.toasts')?.textContent ?? '');
  await shot('24_resume_failed');
  check('a record that does not rebuild: toast, home, nothing charged', failToast.includes('복원하지 못해') && (await recRaw()) === null && !(await state()).battle && (await save()).gold === ga4.gold, failToast);

  // ---- a replay that does not reach the saved state (e.g. a WebView update changed Math results): same failure path
  for (const choice of ['primary', 'ghost']) {
    await page.evaluate((r) => localStorage.setItem('ashen.battle', JSON.stringify({ ...r, h: 'drifted', savedAt: Date.now() })), good);
    await page.reload();
    await page.waitForSelector('.modal');
    await page.click(`.modal-buttons .btn.${choice}`);
    if (choice === 'ghost') {
      await page.waitForSelector('.modal-buttons .btn.danger');
      await page.click('.modal-buttons .btn.danger');
    }
    await page.waitForFunction(() => !window.__app.resuming && !!document.querySelector('.home') && !document.querySelector('.resume-overlay'), null, { timeout: 20000 });
    await page.waitForTimeout(200);
    const t = await page.evaluate(() => document.querySelector('.toasts')?.textContent ?? '');
    const g = await save();
    check(`a drifted replay is caught (${choice === 'primary' ? '이어하기' : '포기'}): toast, home, nothing charged`, t.includes('복원하지 못해') && (await recRaw()) === null && !(await state()).battle && g.gold === ga4.gold && g.stats.battles === ga4.stats.battles, t);
  }

  // ---- boot while the save can't be written (storage full): the interrupted battle is still offered and kept
  const diskSave = () => page.evaluate(() => localStorage.getItem('ashen.save'));
  const recFull = JSON.stringify({ ...good, savedAt: Date.now() });
  await page.evaluate((r) => {
    localStorage.setItem('ashen.battle', r);
    sessionStorage.setItem('e2e.saveFull', '1');
  }, recFull);
  await page.reload();
  await page.waitForSelector('.modal');
  await page.waitForTimeout(300);
  const bootFull = await page.evaluate(() => ({
    prompt: document.querySelector('.modal')?.textContent ?? '',
    banner: !!document.querySelector('.storage-banner'),
    rec: localStorage.getItem('ashen.battle'),
  }));
  await shot('25_boot_storage_full');
  // what is on disk now (the page before wrote it while unloading; this one can't write the save)
  const gb0 = await save();
  const disk0 = await diskSave();
  check('storage full at boot: the interrupted battle is still offered, its record kept', bootFull.prompt.includes('중단된 전투') && bootFull.banner && bootFull.rec === recFull, `banner=${bootFull.banner} kept=${bootFull.rec === recFull}`);
  // 포기 settles in memory but can't reach the disk: the record must stay, so nothing is lost if the app dies now
  await page.click('.modal-buttons .btn.ghost');
  await page.waitForSelector('.modal-buttons .btn.danger');
  await page.click('.modal-buttons .btn.danger');
  await page.waitForFunction(() => !window.__app.resuming && document.querySelector('.modal h2')?.textContent.includes('후퇴'), null, { timeout: 60000 });
  await page.click('.modal-buttons .btn.primary');
  await page.waitForTimeout(200);
  check('포기 while the save can not be written: the save on disk is untouched and the record stays', (await diskSave()) === disk0 && (await recRaw()) === recFull);
  // space again: the battle is offered once more and settled exactly once
  await page.evaluate(() => sessionStorage.removeItem('e2e.saveFull'));
  await page.reload();
  await page.waitForSelector('.modal');
  await page.click('.modal-buttons .btn.ghost');
  await page.waitForSelector('.modal-buttons .btn.danger');
  await page.click('.modal-buttons .btn.danger');
  await page.waitForFunction(() => !window.__app.resuming && document.querySelector('.modal h2')?.textContent.includes('후퇴'), null, { timeout: 60000 });
  const sumFull = (await page.textContent('.modal')) ?? '';
  await page.click('.modal-buttons .btn.primary');
  await page.waitForTimeout(200);
  const gb1 = await save();
  const rewardFull = Number((/보상: 금화 ([\d,]+)/.exec(sumFull) ?? [])[1]?.replace(/,/g, '') ?? NaN);
  await page.reload();
  await page.waitForSelector('.home');
  await page.waitForTimeout(300);
  const gb2 = await save();
  check(
    'once storage has room: the battle is settled exactly once',
    gb1.stats.battles === gb0.stats.battles + 1 && gb1.gold === gb0.gold + rewardFull && gb2.gold === gb1.gold && gb2.stats.battles === gb1.stats.battles && !(await page.$('.modal')) && (await recRaw()) === null,
    `battles ${gb0.stats.battles} -> ${gb1.stats.battles} -> ${gb2.stats.battles}, gold ${gb0.gold} -> ${gb1.gold} -> ${gb2.gold}, reward ${rewardFull}`,
  );

  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
}

try {
  await run();
} catch (err) {
  check('e2e run', false, String(err && err.stack ? err.stack.split('\n').slice(0, 3).join(' ') : err));
  try {
    await lastPage?.screenshot({ path: `${OUT}/zz_failure.png` });
  } catch {}
} finally {
  stopServer();
  console.log(results.join('\n'));
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}
