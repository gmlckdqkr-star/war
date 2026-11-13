// ============================================================================
// HUD: DOM (like the game's src/ui), skinned with code-drawn paper, ink and seals.
// Text nodes are only touched when values change.
// ============================================================================
const UIART = {
  paper(w, h, seed, tone = P.paper) {
    const c = mkCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = tone; g.fillRect(0, 0, w, h);
    const r = RNG(seed);
    for (let i = 0; i < (w * h) / 26; i++) { const x = r() * w, y = r() * h, a = r() * 3.14, L = 1 + r() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,0.10)' : 'rgba(255,250,240,0.25)'; g.lineWidth = 0.6; g.stroke(); }
    for (let i = 0; i < 18; i++) { const x = r() * w, y = r() * h, rg = g.createRadialGradient(x, y, 0, x, y, 20 + r() * 40); rg.addColorStop(0, 'rgba(150,120,80,0.06)'); rg.addColorStop(1, 'rgba(150,120,80,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); }
    return c;
  },
  // ink frame drawn like a brush: heavier at the top-left, dry at the ends
  frame(g, w, h, seed, col = P.ink, wgt = 1) {
    const r = RNG(seed), j = (k) => (r() - 0.5) * k;
    const side = (x0, y0, x1, y1, w0, w1) => brush(g, qpts(x0 + j(1), y0 + j(1), (x0 + x1) / 2 + j(1.5), (y0 + y1) / 2 + j(1.5), x1 + j(1), y1 + j(1), 10), (u) => (w0 + (w1 - w0) * u) * (u < 0.06 || u > 0.94 ? 0.5 : 1) * wgt, col, 0.92);
    side(3, 3, w - 3, 3.5, 2.2, 1.0); side(w - 3, 3, w - 3.5, h - 3, 1.4, 0.8); side(w - 3, h - 3, 3, h - 3.4, 1.0, 1.8); side(3, h - 3, 3.5, 3, 1.8, 2.2);
  },
  tornClip(w, h, seed, edges = 'tb') {
    const r = RNG(seed), pts = [];
    const n = Math.max(6, Math.round(w / 9));
    for (let i = 0; i <= n; i++) pts.push([(i / n) * w, edges.includes('t') ? r() * 2.4 : 0]);
    for (let i = n; i >= 0; i--) pts.push([(i / n) * w, h - (edges.includes('b') ? r() * 2.6 : 0)]);
    return 'polygon(' + pts.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',') + ')';
  },
  icon(kind, size, opts = {}) {
    const c = mkCanvas(size * DPR, size * DPR), g = c.getContext('2d');
    c.style.width = size + 'px'; c.style.height = size + 'px';
    g.scale(DPR * size / 32, DPR * size / 32); g.lineCap = 'round'; g.lineJoin = 'round';
    const ink = P.ink;
    if (kind === 'keep') {
      poly(g, [[7, 28], [7, 12], [10, 12], [10, 9], [13, 9], [13, 12], [19, 12], [19, 9], [22, 9], [22, 12], [25, 12], [25, 28]]);
      g.fillStyle = P.stone; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.8; g.stroke();
      g.save(); poly(g, [[16, 12], [25, 12], [25, 28], [16, 28]]); g.clip(); hatch(g, 14, 10, 27, 30, 1.0, 2.2, 0.9, ink, 0.7, 4); g.restore();
      g.beginPath(); g.moveTo(16, 28); g.lineTo(16, 22); g.arc(16, 22, 2.6, Math.PI, 0); g.lineTo(18.6, 28); g.fillStyle = ink; g.fill();
      g.beginPath(); g.moveTo(16, 9); g.lineTo(16, 2); g.stroke(); poly(g, [[16, 2.5], [23, 4], [16, 6]]); g.fillStyle = P.indigo; g.fill();
    } else if (kind === 'sun') {
      // half-sunk sun over a horizon of brush: the time of day is the clock
      const k = opts.k ?? 0.4;
      g.save(); g.beginPath(); g.rect(0, 0, 32, 20); g.clip();
      g.beginPath(); g.arc(16, 20 + k * 8, 8.5, 0, 7); g.fillStyle = P.cinnabar; g.fill(); g.restore();
      brush(g, [[2, 20.5], [11, 19.6], [21, 20.8], [30, 20]], nib(2.2), ink, 1);
      brush(g, [[6, 24.5], [16, 24], [26, 24.8]], nib(1.2), ink, 0.6);
    } else if (kind === 'oil') {
      // cauldron tipping over a crenel, a pour of oil, steam
      poly(g, [[3, 22], [3, 29], [29, 29], [29, 22], [25, 22], [25, 25], [21, 25], [21, 22], [11, 22], [11, 25], [7, 25], [7, 22]]);
      g.fillStyle = P.stone; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.4; g.stroke();
      g.save(); g.translate(15, 13); g.rotate(-0.45);
      g.beginPath(); g.moveTo(-8, -4); g.quadraticCurveTo(-8, 7, 0, 7); g.quadraticCurveTo(8, 7, 8, -4); g.closePath(); g.fillStyle = ink; g.fill();
      g.beginPath(); g.moveTo(-9, -4); g.lineTo(9, -4); g.lineWidth = 1.8; g.strokeStyle = ink; g.stroke();
      g.beginPath(); g.moveTo(-5, 2); g.lineTo(-2, 5); g.strokeStyle = P.paperHi; g.lineWidth = 0.9; g.stroke();
      g.restore();
      brush(g, qpts(23, 9, 27, 12, 26.5, 21, 6), taper(2.6, 0.8), P.goldLo, 1);
      for (const x of [9, 14]) brush(g, qpts(x, 6, x - 2, 3.5, x + 1, 0.5, 6), nib(1.3), ink, 0.55);
    } else if (kind === 'tally') {
      const n = opts.n ?? 5, done = opts.done ?? 2;
      for (let i = 0; i < n; i++) {
        const x = 4 + i * 5.6, col = i < done ? ink : i === done ? P.cinnabar : 'rgba(30,25,22,0.22)';
        brush(g, qpts(x, 26, x + 0.8, 16, x + 1.4, 6, 6), (u) => (i <= done ? 2.6 : 1.8) * (u < 0.15 ? 0.6 + u * 2.6 : 1 - u * 0.45), col, 1);
      }
      if (done >= 0) brush(g, [[1.5, 21], [12, 14.5]], nib(1.6), P.cinnabar, 0.85);
    } else if (kind === 'emblem') {
      g.save(); g.translate(5, 3.5);
      const w = 22, h = 25, path = () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h * 0.62); g.quadraticCurveTo(w * 0.85, h * 0.92, w / 2, h); g.quadraticCurveTo(w * 0.15, h * 0.92, 0, h * 0.62); g.closePath(); };
      g.save(); g.translate(0.8, 0.6); path(); g.clip(); drawEmblem(g, opts.e, w, h); g.restore();
      path(); g.strokeStyle = ink; g.lineWidth = 1.7; g.stroke();
      g.restore();
    }
    return c;
  },
};

const BARKS = {
  gate_break: [{ who: '브란', sq: 0, text: '문이 터졌다! 창끝 세워, 문턱에서 받는다!' }, { who: '브란', sq: 0, text: '빗장이 갔다. 회색매, 앞으로!' }],
  on_wall: [{ who: '갈대피리 궁수대', sq: 2, text: '성가퀴에 놈들이 올라왔다! 활 내리고 칼 뽑아!' }],
  oil: [{ who: '물레 궁수대', sq: 3, text: '기름 간다! 사다리에서 손 떼라!' }],
  ram_burn: [{ who: '갈대피리 궁수대', sq: 2, text: '충차에 불붙었다, 계속 먹여라!' }],
  ladder_up: [{ who: '물레 궁수대', sq: 3, text: '남쪽에 사다리 또 건다!' }],
  archer_down: [{ who: '물레 궁수대', sq: 3, text: '한 명 쓰러졌다… 자리 메워!' }],
  ram_dead: [{ who: '브란', sq: 1, text: '충차가 주저앉았다!' }],
};

const HUD = {
  els: {}, last: {}, barkQ: [], chronQ: [], ren: null,
  init(ren, sim) {
    this.ren = ren;
    const root = document.getElementById('hud');
    const paperURL = UIART.paper(256, 128, 3).toDataURL();
    root.style.setProperty('--paperimg', `url(${paperURL})`);
    root.innerHTML = `
      <div class="slip top-l" id="tl"><span class="book">제5권 포위</span><b class="castle">쌍둥이탑 성</b><span class="sep"></span><span class="lbl">물결</span><span id="tally"></span><span class="wave" id="waveTxt">셋째</span></div>
      <div class="slip top-r" id="tr"><span id="keepI"></span><span class="lbl">본성</span><span class="kbar"><canvas id="kbar"></canvas></span><b id="keepTxt">94%</b><span class="sep"></span><span id="sunI"></span><span class="lbl" id="todTxt">해 질 녘</span></div>
      <div class="chron" id="chron"><span class="rub"></span><span id="chronTxt"></span><span class="by">사관 텔마</span></div>
      <div id="barks"></div>
      <div class="cards" id="cards"></div>
      <div class="abil" id="abil"><canvas id="enso"></canvas><span id="oilI"></span><span class="alb">끓는 기름</span><span class="acd" id="acd"></span></div>`;
    const tl = document.getElementById('tl'), tr = document.getElementById('tr');
    document.getElementById('tally').appendChild(UIART.icon('tally', 22, { n: 5, done: 2 }));
    document.getElementById('keepI').appendChild(UIART.icon('keep', 20));
    document.getElementById('sunI').appendChild(UIART.icon('sun', 22, { k: 0.45 }));
    // the torn bottom edge is measured after the icons are in, so nothing is clipped
    tl.style.clipPath = UIART.tornClip(tl.offsetWidth, tl.offsetHeight, 11, 'b');
    tr.style.clipPath = UIART.tornClip(tr.offsetWidth, tr.offsetHeight, 12, 'b');
    document.getElementById('oilI').appendChild(UIART.icon('oil', 30));
    // squad cards (two: the selected spear block and the sword reserve)
    const cards = document.getElementById('cards');
    this.cards = [0, 1].map((i) => {
      const s = sim.squads[i];
      const d = document.createElement('div'); d.className = 'card' + (s.sel ? ' sel' : '');
      const bg = mkCanvas(152 * DPR, 46 * DPR); bg.className = 'cbg'; bg.style.width = '152px'; bg.style.height = '46px';
      const g = bg.getContext('2d'); g.scale(DPR, DPR); g.drawImage(UIART.paper(152, 46, 20 + i, P.paperHi), 0, 0); UIART.frame(g, 152, 46, 30 + i, P.ink, s.sel ? 1.15 : 0.8);
      if (s.sel) brush(g, [[10, 43.5], [80, 42.8], [142, 43.6]], nib(2.2), P.gold, 0.95);
      d.appendChild(bg);
      const em = UIART.icon('emblem', 30, { e: s.emblem }); em.className = 'em'; d.appendChild(em);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name; d.appendChild(nm);
      const ct = document.createElement('div'); ct.className = 'ct'; d.appendChild(ct);
      const st = document.createElement('div'); st.className = 'st'; d.appendChild(st);
      const mb = mkCanvas(40 * DPR, 7 * DPR); mb.className = 'mb'; mb.style.width = '40px'; mb.style.height = '7px'; d.appendChild(mb);
      cards.appendChild(d);
      return { s, ct, st, mb, last: {} };
    });
    this.ens = document.getElementById('enso');
    this.ens.width = 58 * DPR; this.ens.height = 58 * DPR;
    this.kbar = document.getElementById('kbar'); this.kbar.width = 64 * DPR; this.kbar.height = 10 * DPR;
    this.drawBar(this.kbar, 64, 10, sim.keep / 100, P.indigo);
    const ab = document.getElementById('abil');
    const abg = mkCanvas(58 * DPR, 58 * DPR); abg.className = 'abg'; abg.style.width = '58px'; abg.style.height = '58px';
    const ag = abg.getContext('2d'); ag.scale(DPR, DPR); ag.save(); ag.beginPath(); ag.arc(29, 29, 26, 0, 7); ag.clip(); ag.drawImage(UIART.paper(58, 58, 41, P.paperHi), 0, 0); ag.restore();
    brush(ag, Array.from({ length: 33 }, (_, i) => { const a = -1.2 + (i / 32) * 6.1; return [29 + Math.cos(a) * 26, 29 + Math.sin(a) * 26]; }), (u) => 0.6 + 2.4 * Math.sin(Math.PI * u), P.ink, 0.95);
    ab.insertBefore(abg, ab.firstChild);
  },
  drawBar(c, w, h, k, col) {
    const g = c.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, w, h);
    brush(g, [[2, h / 2 + 0.5], [w - 2, h / 2 - 0.3]], nib(h * 0.55), 'rgba(30,25,22,0.18)', 1);
    if (k > 0.01) brush(g, [[2, h / 2 + 0.6], [2 + (w - 4) * k, h / 2 - 0.2]], (u) => h * 0.62 * (u > 0.9 ? 1 - (u - 0.9) * 6 : 1), col, 1);
  },
  bark(key, sim, live) {
    const pool = BARKS[key]; if (!pool) return;
    const b = pool[(sim.steps + key.length) % pool.length];
    this.barkQ.push({ ...b, t: sim.t });
    if (this.barkQ.length > 4) this.barkQ.shift();
    // the chronicler writes down what actually happened, with real numbers
    if (key === 'gate_break') this.chronQ.push({ t: sim.t, text: `셋째 물결. 서문 빗장이 충차에 부러졌다. 회색매 창병대가 문턱을 막아선다.` });
    if (key === 'oil') this.chronQ.push({ t: sim.t, text: `남쪽 사다리에 끓는 기름을 부었다. 협약군 ${sim.stats.oilFell || 0}명이 떨어졌다.` });
    if (key === 'ram_burn') this.chronQ.push({ t: sim.t + 5, text: null });
  },
  chronicleNow(sim) {
    // a live line built from the sim's counts (josa picked by the last syllable)
    const sp = sim.squads[0], lostAll = sim.squads.reduce((a, s) => a + s.lost, 0);
    const brokeT = sim.stats.gateBrokenT;
    if (brokeT < 0) return null;
    const mins = Math.max(1, Math.round(sim.t - brokeT));
    return `서문이 뚫린 지 ${mins}초. ${josa(sp.name, '이/가')} 문턱을 지킨다. 우리 쪽 쓰러진 이 ${lostAll}명, 적 ${sim.kills.ours}명.`;
  },
  update(sim) {
    const ren = this.ren;
    // keep + wave
    const keep = Math.round(sim.keep);
    if (this.last.keep !== keep) { this.last.keep = keep; document.getElementById('keepTxt').textContent = keep + '%'; this.drawBar(this.kbar, 64, 10, keep / 100, P.indigo); }
    // cards
    for (const c of this.cards) {
      const s = c.s, alive = s.units.filter((u) => u.st === ST.ACTIVE).length;
      const engaged = s.units.some((u) => u.st === ST.ACTIVE && u.tgt && u.tgt.st === ST.ACTIVE && Math.hypot(u.tgt.x - u.x, u.tgt.y - u.y) < 16);
      const word = s.morale < 35 ? '흔들림' : engaged ? '교전' : '대기';
      if (c.last.alive !== alive) { c.last.alive = alive; c.ct.innerHTML = `<b>${alive}</b><i>/${s.n}</i>`; }
      if (c.last.word !== word) { c.last.word = word; c.st.textContent = word; c.st.className = 'st' + (word === '교전' ? ' red' : word === '흔들림' ? ' warn' : ''); }
      const m = Math.round(s.morale);
      if (c.last.m !== m) { c.last.m = m; this.drawBar(c.mb, 40, 7, m / 100, m < 35 ? P.cinnabar : P.ink2); }
    }
    // ability cooldown: a brush circle that closes as the cauldron reheats
    const a = sim.abil.oil, k = a.cd > 0 ? 1 - a.cd / a.max : 1;
    const kk = Math.round(k * 60);
    if (this.last.cd !== kk) {
      this.last.cd = kk;
      const g = this.ens.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, 58, 58);
      if (k < 1) {
        const pts = []; const n = 40; for (let i = 0; i <= n; i++) { const t = (i / n) * k; const ang = -Math.PI / 2 + t * 6.283; pts.push([29 + Math.cos(ang) * 21.5, 29 + Math.sin(ang) * 21.5]); }
        brush(g, pts, (u) => 1.2 + 2.4 * Math.sin(Math.PI * Math.min(1, u * 1.1)), P.cinnabar, 0.9);
        g.fillStyle = 'rgba(232,223,203,0.55)'; g.beginPath(); g.arc(29, 29, 19.5, 0, 7); g.fill();
      }
      document.getElementById('acd').textContent = a.cd > 0 ? Math.ceil(a.cd) + '' : '';
      document.getElementById('abil').classList.toggle('ready', a.cd <= 0);
    }
    // chronicle line (top centre)
    let line = null;
    for (const c of this.chronQ) if (sim.t >= c.t && sim.t - c.t < 7) line = c.text === null ? this.chronicleNow(sim) : c.text;
    if (!line && sim.t > 14) line = this.chronicleNow(sim);
    const ch = document.getElementById('chron');
    if (line !== this.last.line) { this.last.line = line; document.getElementById('chronTxt').textContent = line || ''; ch.classList.toggle('on', !!line); }
    // barks: world-anchored slips over the squad that speaks (never over the enemy's side)
    const box = document.getElementById('barks');
    const live = this.barkQ.filter((b) => sim.t - b.t < 3.2).slice(-1);
    const key = live.map((b) => b.text).join('|');
    if (key !== this.last.barks) {
      this.last.barks = key; box.innerHTML = '';
      for (const b of live) { const d = document.createElement('div'); d.className = 'bark'; d.innerHTML = `<b>${b.who}</b>${b.text}`; d.dataset.sq = b.sq; box.appendChild(d); }
    }
    for (const d of box.children) {
      const s = sim.squads[+d.dataset.sq]; const al = s.units.filter((u) => u.st === ST.ACTIVE); if (!al.length) continue;
      let cx = 0, cy = 0; for (const u of al) { cx += u.x; cy += u.y; } cx /= al.length; cy /= al.length;
      const p = PR(cx, cy, s.type === 'wall' ? WH : 0);
      const sx = (p[0] * ren.Sz + ren.ox) / DPR, sy = (p[1] * ren.Sz + ren.oy) / DPR;
      const w = d.offsetWidth;
      // the gate fight is sacred: a bark never sits over the gate passage, it goes above-right
      const gp = PR(WX + WW + 10, GYC, 0), gx = (gp[0] * ren.Sz + ren.ox) / DPR, gy = (gp[1] * ren.Sz + ren.oy) / DPR;
      let L = Math.max(ren.vw * 0.55, Math.min(ren.vw - w - 8, sx + 10)), T = Math.max(62, Math.min(ren.vh - 112 - d.offsetHeight, sy - 58));
      if (L < gx + 70 && L + w > gx - 50 && T + d.offsetHeight > gy - 40 && T < gy + 30) T = Math.max(62, gy - 48 - d.offsetHeight - 30);
      d.style.left = L + 'px'; d.style.top = T + 'px';
    }
  },
};
