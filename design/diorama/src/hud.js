// ============================================================================
// hud: code-drawn icons (one stroke weight), the sun dial, squad cards, barks.
// Barks are tied to sim events, spoken by named people of the March.
// ============================================================================
const ICO = {
  // every icon is drawn in a 24-unit box with the same 1.7 stroke
  map(g) { g.beginPath(); g.moveTo(3, 6); g.lineTo(9, 4); g.lineTo(15, 6); g.lineTo(21, 4); g.lineTo(21, 18); g.lineTo(15, 20); g.lineTo(9, 18); g.lineTo(3, 20); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(9, 4); g.lineTo(9, 18); g.moveTo(15, 6); g.lineTo(15, 20); g.stroke(); g.beginPath(); g.arc(12, 11, 1.2, 0, 6.28); g.fill(); },
  keep(g) { g.beginPath(); g.moveTo(5, 21); g.lineTo(5, 7); g.lineTo(8, 7); g.lineTo(8, 4); g.lineTo(11, 4); g.lineTo(11, 7); g.lineTo(13, 7); g.lineTo(13, 4); g.lineTo(16, 4); g.lineTo(16, 7); g.lineTo(19, 7); g.lineTo(19, 21); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(10, 21); g.lineTo(10, 16); g.quadraticCurveTo(12, 13, 14, 16); g.lineTo(14, 21); g.stroke(); },
  arrows(g) { for (const dx of [-3.5, 0, 3.5]) { g.beginPath(); g.moveTo(12 + dx * 0.6, 21); g.lineTo(12 + dx, 5); g.stroke(); g.beginPath(); g.moveTo(12 + dx - 1.6, 7.4); g.lineTo(12 + dx, 4); g.lineTo(12 + dx + 1.6, 7.4); g.stroke(); } g.beginPath(); g.moveTo(7, 15); g.lineTo(17, 15); g.stroke(); },
  bread(g) { g.beginPath(); g.moveTo(4, 17); g.quadraticCurveTo(3, 8, 12, 7); g.quadraticCurveTo(21, 8, 20, 17); g.closePath(); g.stroke(); for (const x of [9, 12.5, 16]) { g.beginPath(); g.moveTo(x - 1.5, 13); g.lineTo(x + 1, 10); g.stroke(); } },
  herb(g) { g.beginPath(); g.moveTo(12, 21); g.quadraticCurveTo(11, 13, 13, 4); g.stroke(); for (const [y, s] of [[15, -1], [11, 1], [8, -1]]) { g.beginPath(); g.moveTo(12.2, y); g.quadraticCurveTo(12 + s * 6, y - 4, 12 + s * 7, y - 1); g.quadraticCurveTo(12 + s * 4, y + 1, 12.2, y); g.stroke(); } },
  folk(g) { g.beginPath(); g.arc(9, 7, 2.6, 0, 6.28); g.stroke(); g.beginPath(); g.moveTo(4, 20); g.quadraticCurveTo(4, 12, 9, 12); g.quadraticCurveTo(14, 12, 14, 20); g.stroke(); g.beginPath(); g.arc(17, 11, 2, 0, 6.28); g.stroke(); g.beginPath(); g.moveTo(14.5, 20); g.quadraticCurveTo(15, 15.5, 17, 15.5); g.quadraticCurveTo(20.5, 15.5, 20.5, 20); g.stroke(); },
  pause(g) { g.beginPath(); g.moveTo(9, 6); g.lineTo(9, 18); g.moveTo(15, 6); g.lineTo(15, 18); g.stroke(); },
  oil(g) { // a tipped cauldron pouring
    g.beginPath(); g.moveTo(4, 9); g.lineTo(16, 5); g.lineTo(18, 11); g.quadraticCurveTo(15, 17, 9, 16); g.quadraticCurveTo(5, 14, 4, 9); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(17, 7); g.quadraticCurveTo(20, 9, 19.5, 13); g.lineTo(19.5, 21); g.stroke();
    g.beginPath(); g.moveTo(15.5, 21); g.quadraticCurveTo(16.5, 18, 16, 16); g.moveTo(22, 20); g.quadraticCurveTo(22, 17, 21, 15.5); g.stroke();
  },
};
function paintIcon(cv, name, col) {
  const g = cv.getContext('2d'), s = cv.width / 24;
  g.clearRect(0, 0, cv.width, cv.height);
  g.save(); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.7; g.lineCap = 'round'; g.lineJoin = 'round';
  ICO[name](g); g.restore();
}
function paintDial(cv, t) {
  // the sun sinking toward the hills: the stage clock is the light itself
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, s = W / 60;
  g.clearRect(0, 0, W, H); g.save(); g.scale(s, s);
  const k = clamp(t / 34, 0, 1);
  const sky = g.createLinearGradient(0, 2, 0, 32); sky.addColorStop(0, mix('#7d93ad', '#3b3a5a', k)); sky.addColorStop(1, mix('#e6c58e', '#c8714a', k));
  g.fillStyle = sky; g.beginPath(); g.moveTo(4, 32); g.arc(30, 32, 26, Math.PI, 0); g.closePath(); g.fill();
  const a = Math.PI * (1.18 + 0.5 * k * 0.98 + 0.22), sx = 30 + Math.cos(a) * 18, sy = 32 + Math.sin(a) * 18 + k * 9;
  g.fillStyle = mix('#ffe8b0', '#ff9a52', k); g.beginPath(); g.arc(sx, sy, 4.2, 0, 6.28); g.fill();
  g.fillStyle = '#3b2e22'; g.beginPath(); g.moveTo(4, 32); g.quadraticCurveTo(16, 24, 26, 29); g.quadraticCurveTo(38, 22, 56, 30); g.lineTo(56, 32); g.closePath(); g.fill();
  g.strokeStyle = '#7d6545'; g.lineWidth = 1.2; g.beginPath(); g.arc(30, 32, 26, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(2, 32); g.lineTo(58, 32); g.stroke();
  for (let i = 0; i <= 4; i++) { const aa = Math.PI + (i / 4) * Math.PI; g.beginPath(); g.moveTo(30 + Math.cos(aa) * 26, 32 + Math.sin(aa) * 26); g.lineTo(30 + Math.cos(aa) * 29, 32 + Math.sin(aa) * 29); g.stroke(); }
  g.restore();
}

// ---------- barks: who speaks, about what ----------
const WHO = { born: ['보른', 'b'], ise: ['이세', 'b'], hamel: ['하멜', 'b'], grom: ['그로마크', 'r'], cass: ['협약군 고수', 'r'] };
const BARKS = {
  open: [['born', '방패 붙여라. 수레 뒤로는 한 놈도 못 넘는다.']],
  pavise: [['ise', '협약군 궁수들이 방패 뒤에 섰다. 종탑, 머리 낮추고 사다리 든 놈부터!']],
  ladder0: [['ise', '서쪽 사다리! 종탑, 발치부터 쏴라. 올라오는 놈 말고 받치는 놈!']],
  ladder1: [['hamel', '동쪽에도 사다리. 갈대 궁수대, 그쪽은 너희 몫이다.']],
  ladder2: [['ise', '셋째 사다리… 활 쥔 손이 모자라.']],
  jav: [['born', '투창이다, 방패 올려! 고개 숙이지 말고 방패를 올려!']],
  boss: [['grom', '돌벽 뒤에 숨은 쥐들아, 내 장대에 자리가 남았다!'], ['born', '그로마크 재엄니… 저 장대에 걸린 투구들, 다 우리 이웃 거다.']],
  oil: [['born', '기름 붓는다! 앞줄 반 걸음 물러서!']],
  shove: [['hamel', '버들골이 사다리를 밀어냈다! 한 번 더 그렇게만 하면 돼.']],
  topped: [['ise', '성벽 위에 적이다! 종탑 아래로, 칼 뽑아!']],
  dock: [['hamel', '공성탑이 붙었다! 창병 넷, 동쪽 성벽으로 올라가!']],
  bridge: [['cass', '다리 내려라! 협약의 이름으로, 성문은 오늘 연다.']],
  board: [['hamel', '탑에서 쏟아진다! 동쪽 성벽 붙잡아!']],
  breach: [['born', '수레가 뚫렸다! 둘째 줄, 창 내려! 한 발도 물러서지 마!']],
  bossdown: [['ise', '재엄니가 쓰러졌다! 장대가 넘어간다!']],
  rain: [['ise', '비다. 시위 젖기 전에 쏘고, 남은 건 아껴.']],
  dusk: [['born', '해가 기운다. 조금만 더 버티면 놈들도 어둠은 싫어해.']],
};
Battle.prototype.onEvent = function (e) {
  let key = e.k;
  if (e.k === 'ladder') key = 'ladder' + (e.li || 0);
  if (e.k === 'topped' && this._toppedOnce) return;
  if (e.k === 'topped') this._toppedOnce = 1;
  if (e.k === 'board' && this._boardOnce) return;
  if (e.k === 'board') this._boardOnce = 1;
  if (e.k === 'shove' && this._shoveN > 1) return;
  if (e.k === 'shove') this._shoveN = (this._shoveN || 0) + 1;
  const lines = BARKS[key]; if (!lines) return;
  lines.forEach((l, i) => this.barks.push({ t: e.t + i * 2.6, who: l[0], txt: l[1] }));
};
Battle.prototype.timedBarks = function () {
  if (!this._tb) { this._tb = 1; for (const [t, k] of [[0.3, 'open'], [2.4, 'pavise'], [12.2, 'rain'], [23.5, 'dusk']]) BARKS[k].forEach((l) => this.barks.push({ t, who: l[0], txt: l[1] })); }
};
Battle.prototype.currentBark = function () {
  // the latest line whose time has come; each holds ~3.4 s unless a newer one replaces it
  let best = null;
  for (const b of this.barks) if (b.t <= this.t && (!best || b.t >= best.t)) best = b;
  if (!best || this.t - best.t > 3.6) return null;
  return best;
};

// ---------- DOM ----------
let HUD = null;
function hudInit(B) {
  if (!P_HUD) { document.getElementById('hud').style.display = 'none'; return; }
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll('canvas[data-ico]').forEach((cv) => paintIcon(cv, cv.dataset.ico, cv.dataset.ico === 'oil' ? '#efe3c2' : '#d8c9a4'));
  paintEmblemIcon($('em0'), SQUADS[0]); paintEmblemIcon($('em1'), SQUADS[1]);
  const mor = (id) => { const el = $(id); el.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i>'; return [...el.children]; };
  HUD = { bark: $('bark'), dial: $('dial'), keepV: $('keepV'), keepB: $('keepB'), cnt: [$('cnt0'), $('cnt1')], mor: [mor('mor0'), mor('mor1')], st: [document.querySelector('#card0 .st'), document.querySelector('#card1 .st')], supA: $('supA'), abil: $('abil'), ring: document.querySelector('#abil .ring'), lastBark: null, lastDial: -1 };
  const cd = document.createElement('span'); cd.className = 'cd'; HUD.abil.appendChild(cd); HUD.cd = cd;
  const tot = [0, 0]; for (const u of B.sim.units) if (u.side === 0 && (u.sq === 0 || u.sq === 1)) tot[u.sq]++;
  HUD.tot = tot; B.shots = 0;
}
function hudUpdate(B, force) {
  if (!HUD) return;
  B.timedBarks();
  const S = B.sim, t = B.t;
  // sun dial (repaint ~4x per second)
  const q = Math.floor(t * 4);
  if (q !== HUD.lastDial || force) {
    HUD.lastDial = q; paintDial(HUD.dial, t);
    const inside = 148 + B.life.folk.filter((f) => (t - f.s0) * f.v > 760).length * 4;
    HUD.keepV.textContent = `${inside}/212`; HUD.keepB.style.width = (inside / 212 * 100).toFixed(1) + '%';
    const alive = [0, 0]; for (const u of S.units) if (u.st !== 'dead' && u.side === 0 && (u.sq === 0 || u.sq === 1)) alive[u.sq]++;
    for (let i = 0; i < 2; i++) {
      HUD.cnt[i].textContent = `${alive[i]}/${HUD.tot[i]}`;
      const m = Math.round(6 * (0.35 + 0.65 * alive[i] / Math.max(1, HUD.tot[i])) - (S.bar.broken && i === 1 ? 1 : 0));
      HUD.mor[i].forEach((el, k) => { el.className = k < m ? (m <= 2 ? 'low' : 'on') : ''; });
    }
    HUD.st[0].textContent = S.bar.broken ? '후퇴' : '고수';
    HUD.st[1].textContent = S.bar.broken ? '앞줄' : '뒷줄';
    HUD.supA.textContent = (1840 - B.shots).toLocaleString('en-US');
    // ability ring: the oil was poured at 8.6 s, cooldown 40 s
    const oilT = 8.6, CD = 40, k = t < oilT ? 1 : clamp((t - oilT) / CD, 0, 1);
    const g = HUD.ring.getContext('2d'); g.clearRect(0, 0, 144, 144);
    g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(72, 72, 64, 0, 6.28); g.stroke();
    g.strokeStyle = k >= 1 ? '#d9a441' : '#8f7a58'; g.beginPath(); g.arc(72, 72, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.stroke();
    HUD.abil.classList.toggle('ready', k >= 1);
    HUD.cd.textContent = k >= 1 ? '' : `${Math.ceil(CD - (t - oilT))}초`;
  }
  const b = B.currentBark();
  if (b !== HUD.lastBark) {
    HUD.lastBark = b;
    if (b) { const [nm, side] = WHO[b.who]; HUD.bark.innerHTML = `<b class="who-${side}">${nm}</b>${b.txt}`; HUD.bark.classList.add('on'); }
    else HUD.bark.classList.remove('on');
  }
}
