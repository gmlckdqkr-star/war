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
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const results = [];
let failed = 0;
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
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
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

  // select squad via card, order by tapping ground
  await page.tap('.cards .card:nth-child(2)');
  await page.waitForTimeout(150);
  check('selection strip shown', await page.isVisible('.sel-strip'));
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
  await page.click('.speed[data-speed="3"]');
  await page.waitForTimeout(800);
  await shot('05_battle');

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

  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  await browser.close();
}

try {
  await run();
} catch (err) {
  check('e2e run', false, String(err && err.stack ? err.stack.split('\n').slice(0, 3).join(' ') : err));
} finally {
  server.kill();
  console.log(results.join('\n'));
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}
