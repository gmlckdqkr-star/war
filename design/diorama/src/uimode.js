// ============================================================================
// ?ui=1 — "변경 행군도": the campaign as a painted relief table. The March
// retreats east castle by castle, holding each until the refugees are through;
// the seasons turn as the route goes on. Right: the briefing for chapter 6.
// ============================================================================
const MARCH = [
  { n: '개울목 초소', x: 46, y: 318, st: 'held' },
  { n: '갈대언덕 보루', x: 98, y: 262, st: 'lost' },
  { n: '회색다리 요새', x: 150, y: 312, st: 'held' },
  { n: '늑대고개 관문', x: 206, y: 226, st: 'held' },
  { n: '은빛숲 성채', x: 262, y: 156, st: 'held' },
  { n: '쌍둥이탑 성', x: 312, y: 238, st: 'now' },
  { n: '검은늪 수도원', x: 362, y: 316, st: 'foe' },
  { n: '철모루 성', x: 410, y: 196, st: 'foe' },
  { n: '불탄왕관 성', x: 452, y: 112, st: 'foe' },
  { n: '최후의 성채', x: 476, y: 262, st: 'far' },
];
function mapHeight(x, y) {
  let h = fbm(x * 0.011, y * 0.013, 21) * 0.55 + fbm(x * 0.04, y * 0.045, 22) * (0.12 + smooth(150, 330, x) * 0.2);
  // wolf-pass ridge (north-south) with a notch where the pass is
  h += Math.exp(-(((x - 212) / 22) ** 2)) * smooth(300, 160, y) * 0.5 * (1 - Math.exp(-(((y - 226) / 16) ** 2)) * 0.8);
  // the iron mountains and the burnt crown
  h += Math.exp(-(((x - 412) ** 2 + (y - 120) ** 2) / (2 * 70 * 70))) * 0.62;
  h += Math.exp(-(((x - 470) ** 2 + (y - 64) ** 2) / (2 * 30 * 30))) * 0.55;
  // river valleys cut down
  h -= Math.exp(-((riverDist(x, y) / 10) ** 2)) * 0.14;
  return h;
}
const RIVERS = [
  [[238, -10], [224, 60], [190, 150], [172, 240], [150, 312], [96, 340], [-10, 352]],
  [[338, 40], [326, 120], [318, 190], [312, 238], [330, 300], [372, 400]],
];
function riverDist(x, y) { let d = 1e9; for (const P of RIVERS) for (let i = 0; i < P.length - 1; i++) d = Math.min(d, distSeg(x, y, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1])); return d; }
function mapColor(x, y, h, shade) {
  const s = x / 520; // west -> east is autumn -> winter -> ash summer
  const n = fbm(x * 0.035, y * 0.04, 33) * 0.8 + vnoise(x * 0.21, y * 0.23, 34) * 0.2;
  let c;
  const autumn = mixA([128, 136, 70], [196, 166, 92], smooth(0.35, 0.7, n));
  const frost = mixA([150, 116, 74], [176, 160, 132], smooth(0.3, 0.8, n));
  const winter = mixA([170, 176, 182], [214, 218, 224], smooth(0.3, 0.8, n));
  const ash = mixA([78, 70, 64], [104, 92, 82], n);
  c = mixA(autumn, frost, smooth(0.18, 0.38, s));
  c = mixA(c, winter, smooth(0.42, 0.56, s));
  c = mixA(c, ash, smooth(0.8, 0.9, s) * smooth(260, 120, y) + smooth(0.86, 0.98, s) * 0.5);
  // marsh around the black monastery
  const mk = smooth(60, 20, Math.hypot(x - 362, (y - 318) * 1.3));
  c = mixA(c, [70, 76, 54], mk * 0.85);
  // reeds around the reed-hill
  c = mixA(c, [178, 160, 96], smooth(46, 16, Math.hypot(x - 98, y - 262)) * 0.6);
  // rock and snow on the heights
  c = mixA(c, [126, 120, 112], smooth(0.62, 0.8, h));
  c = mixA(c, [236, 238, 242], smooth(0.78, 0.92, h) * smooth(0.2, 0.36, s) * lerp(1, 0.35, smooth(0.78, 0.95, s)));
  // embers in the burnt crown
  const eb = Math.exp(-(((x - 470) ** 2 + (y - 64) ** 2) / (2 * 14 * 14)));
  c = mixA(c, [180, 70, 34], eb * 0.7);
  const k = shade;
  return [c[0] * k, c[1] * k, c[2] * k];
}
function castleMini(g, x, y, st, big) {
  const s = big ? 1.35 : 1;
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(30,20,16,0.35)'; g.beginPath(); g.ellipse(2, 1, 11, 3.6, 0, 0, 6.28); g.fill();
  const stone = st === 'lost' ? '#4a423c' : st === 'foe' || st === 'far' ? '#8d867c' : '#c9c0ae';
  const dark = st === 'lost' ? '#2a2420' : '#7d766b';
  // curtain wall (front face + top) and two towers and a keep behind
  g.fillStyle = dark; g.fillRect(-4, -12, 9, 9); g.fillStyle = stone; g.fillRect(-4, -14, 9, 2.4);
  g.fillStyle = stone; g.fillRect(-9, -6, 18, 6); g.fillStyle = dark; g.fillRect(-9, -1.5, 18, 1.5);
  for (let i = -9; i < 9; i += 3) { g.fillStyle = stone; g.fillRect(i, -7.6, 1.8, 1.6); }
  for (const tx of [-10, 6]) { g.fillStyle = stone; g.fillRect(tx, -10, 4.4, 10); g.fillStyle = 'rgba(30,20,20,0.25)'; g.fillRect(tx + 2.6, -10, 1.8, 10); g.fillStyle = '#5a4a3e'; g.beginPath(); g.moveTo(tx - 0.6, -10); g.lineTo(tx + 2.2, -14.5); g.lineTo(tx + 5, -10); g.fill(); }
  g.fillStyle = '#1e1712'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(-2, -3); g.arc(0, -3, 2, Math.PI, 0); g.lineTo(2, 0); g.fill();
  if (st === 'held' || st === 'now') { g.strokeStyle = '#3a2a1c'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0.5, -14); g.lineTo(0.5, -22); g.stroke(); g.fillStyle = '#2c5d93'; g.beginPath(); g.moveTo(0.8, -22); g.lineTo(7, -21); g.lineTo(5, -19.4); g.lineTo(7, -17.8); g.lineTo(0.8, -18.4); g.fill(); }
  if (st === 'foe') { g.strokeStyle = '#3a2a1c'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0.5, -14); g.lineTo(0.5, -21); g.stroke(); g.fillStyle = '#a12f2b'; g.fillRect(0.8, -21, 5, 3.4); }
  g.restore();
}
function runUI() {
  const cssW = innerWidth, cssH = innerHeight, MW = cssW - 322;
  const cv = document.getElementById('c');
  cv.width = Math.round(cssW * DPR); cv.height = Math.round(cssH * DPR); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  const g = cv.getContext('2d');
  // ---- terrain: half-res height field with hillshade from the north-west ----
  const hw = Math.ceil(MW * DPR / 2), hh = Math.ceil(cssH * DPR / 2), lo = mkCanvas(hw, hh), lg = lo.getContext('2d'), id = lg.createImageData(hw, hh), d = id.data;
  const sx = MW / hw, sy = cssH / hh;
  for (let py = 0; py < hh; py++) for (let px = 0; px < hw; px++) {
    const x = px * sx, y = py * sy;
    const h = mapHeight(x, y), hx = mapHeight(x + 1.5, y) - mapHeight(x - 1.5, y), hy = mapHeight(x, y + 1.5) - mapHeight(x, y - 1.5);
    const lit = clamp(1 - (hx + hy) * 10, 0.5, 1.4);
    let c = mapColor(x, y, h, lit);
    const rd = riverDist(x, y);
    if (rd < 2.6) c = mixA(c, x > 230 ? [168, 186, 198] : [92, 124, 140], smooth(2.6, 1.2, rd));
    const o = (py * hw + px) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  lg.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(lo, 0, 0, MW * DPR, cssH * DPR);
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const r = RNG(404);
  // forests: little painted trees (birch-silver in the snow, dark firs on the ridge, autumn copses in the west)
  for (let k = 0; k < 1500; k++) {
    const x = r() * MW, y = 50 + r() * (cssH - 50), h = mapHeight(x, y);
    if (h > 0.78 || riverDist(x, y) < 5) continue;
    const silver = Math.hypot(x - 262, y - 150) < 58, fir = Math.abs(x - 212) < 30 && y < 300, copse = fbm(x * 0.03, y * 0.03, 77) > 0.6 && x < 300;
    if (!(silver && r() < 0.8) && !(fir && r() < 0.35) && !(copse && r() < 0.5)) continue;
    if (Math.hypot(x - 312, y - 238) < 22) continue;
    if (silver) { g.fillStyle = 'rgba(30,26,30,0.25)'; g.beginPath(); g.ellipse(x + 1.2, y + 0.6, 2, 0.8, 0, 0, 6.28); g.fill(); g.fillStyle = r() < 0.5 ? '#e9ecef' : '#c7ced3'; g.beginPath(); g.ellipse(x, y - 2.4, 1.5, 2.6, 0, 0, 6.28); g.fill(); g.fillStyle = '#5d5a58'; g.fillRect(x - 0.2, y - 0.6, 0.5, 1.4); }
    else if (fir) { g.fillStyle = 'rgba(30,26,30,0.25)'; g.beginPath(); g.ellipse(x + 1.2, y + 0.6, 2, 0.8, 0, 0, 6.28); g.fill(); g.fillStyle = r() < 0.5 ? '#3e4e3a' : '#4a5a42'; g.beginPath(); g.moveTo(x - 2, y); g.lineTo(x, y - 6); g.lineTo(x + 2, y); g.fill(); if (x > 200) { g.fillStyle = 'rgba(240,242,246,0.8)'; g.beginPath(); g.moveTo(x - 0.8, y - 3.6); g.lineTo(x, y - 6); g.lineTo(x + 0.8, y - 3.6); g.fill(); } }
    else { g.fillStyle = 'rgba(30,26,30,0.25)'; g.beginPath(); g.ellipse(x + 1.2, y + 0.6, 2.2, 0.9, 0, 0, 6.28); g.fill(); g.fillStyle = r() < 0.4 ? '#b0652c' : r() < 0.6 ? '#c99a3e' : '#7d8a3c'; g.beginPath(); g.arc(x, y - 2, 2, 0, 6.28); g.fill(); }
  }
  // fields in the west: a few painted parcels
  for (let k = 0; k < 40; k++) { const x = 10 + r() * 150, y = 290 + r() * 90; if (riverDist(x, y) < 8) continue; g.fillStyle = r() < 0.5 ? 'rgba(214,184,104,0.35)' : 'rgba(150,120,70,0.3)'; g.save(); g.translate(x, y); g.rotate(-0.2 + r() * 0.4); g.fillRect(-5, -2.5, 10, 5); g.restore(); }
  // burnt-crown smoke
  for (let k = 0; k < 18; k++) { const gr = g.createRadialGradient(470 + k * 2.2, 60 - k * 3, 0, 470 + k * 2.2, 60 - k * 3, 6 + k * 0.8); gr.addColorStop(0, 'rgba(60,54,52,0.32)'); gr.addColorStop(1, 'rgba(60,54,52,0)'); g.fillStyle = gr; g.fillRect(440, 0, 80, 90); }
  // region names, spaced and quiet
  g.textAlign = 'center'; g.font = '500 11px "Gowun Batang","Noto Serif KR","WenQuanYi Zen Hei",serif';
  for (const [t, x, y] of [['개 울 목  들 판', 40, 290], ['갈 대  습 지', 70, 214], ['늑 대  고 개', 236, 290], ['은 빛 숲', 226, 120], ['검 은  늪', 424, 300], ['철 모 루  산 맥', 404, 150], ['불 탄  왕 관', 480, 40]]) {
    g.fillStyle = 'rgba(255,248,232,0.35)'; g.fillText(t, x + 0.6, y + 0.6); g.fillStyle = 'rgba(40,30,24,0.55)'; g.fillText(t, x, y);
  }
  // ---- the route: walked part solid, the road ahead dashed ----
  const pts = MARCH.map((c) => [c.x, c.y]);
  const curve = (i0, i1) => { g.beginPath(); g.moveTo(pts[i0][0], pts[i0][1]); for (let i = i0; i < i1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]; g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 12, p1[1] + (p2[1] - p0[1]) / 12, p2[0] - (p3[0] - p1[0]) / 12, p2[1] - (p3[1] - p1[1]) / 12, p2[0], p2[1]); } };
  g.lineCap = 'round'; g.lineJoin = 'round';
  curve(0, 5); g.strokeStyle = 'rgba(30,20,14,0.55)'; g.lineWidth = 4.2; g.stroke(); g.strokeStyle = '#efe3c2'; g.lineWidth = 2; g.stroke();
  curve(5, 9); g.setLineDash([3, 4]); g.strokeStyle = 'rgba(30,20,14,0.5)'; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = 'rgba(239,227,194,0.75)'; g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
  // the refugee column following the army (tiny figures on the road behind)
  for (let k = 0; k < 26; k++) { const q = k / 26, x = lerp(262, 306, q) + Math.sin(q * 9) * 3, y = lerp(160, 232, q) + Math.cos(q * 7) * 2; g.fillStyle = k % 4 ? '#e2d4b0' : '#9c6b4a'; g.fillRect(x + (r() - 0.5) * 3, y + (r() - 0.5) * 3, 1.4, 2); }
  // ---- castles ----
  g.textAlign = 'center';
  MARCH.forEach((c, i) => {
    if (c.st === 'now') { g.strokeStyle = 'rgba(217,164,65,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.ellipse(c.x, c.y + 1, 19, 7.5, 0, 0, 6.28); g.stroke(); g.strokeStyle = 'rgba(217,164,65,0.35)'; g.lineWidth = 4; g.beginPath(); g.ellipse(c.x, c.y + 1, 23, 9.5, 0, 0, 6.28); g.stroke(); }
    castleMini(g, c.x, c.y, c.st, c.st === 'now' || i === 9);
    if (c.st === 'lost') for (let k = 0; k < 8; k++) { const gr = g.createRadialGradient(c.x + 3 + k * 1.8, c.y - 18 - k * 4, 0, c.x + 3 + k * 1.8, c.y - 18 - k * 4, 4 + k * 0.7); gr.addColorStop(0, 'rgba(46,40,38,0.45)'); gr.addColorStop(1, 'rgba(46,40,38,0)'); g.fillStyle = gr; g.fillRect(c.x - 20, c.y - 60, 50, 50); }
    const below = c.y < 150 || i === 0 || i === 2 || i === 5 || i === 6 || i === 7;
    const ly = below ? c.y + 15 : c.y - 25;
    g.font = `${c.st === 'now' ? '700 11.5px' : '10px'} "Gowun Batang","Noto Serif KR","WenQuanYi Zen Hei",serif`;
    const label = `${i + 1} · ${c.n}`;
    g.lineWidth = 3; g.strokeStyle = 'rgba(28,20,16,0.75)'; g.strokeText(label, c.x, ly);
    g.fillStyle = c.st === 'lost' ? '#c9a08a' : c.st === 'now' ? '#f3d58e' : c.st === 'held' ? '#efe3c2' : '#c9bfae'; g.fillText(label, c.x, ly);
    if (c.st === 'lost') { g.font = '9.5px "Noto Sans KR","WenQuanYi Zen Hei",sans-serif'; g.strokeText('불탐 · 넷만 돌아옴', c.x, c.y + 14); g.fillStyle = '#d8a890'; g.fillText('불탐 · 넷만 돌아옴', c.x, c.y + 14); }
  });
  // legend
  g.textAlign = 'left'; g.font = '10px "Noto Sans KR","WenQuanYi Zen Hei",sans-serif';
  { const L0 = MW - 272; g.fillStyle = 'rgba(28,21,16,0.72)'; g.fillRect(L0, cssH - 30, 262, 22);
  [['held', '지켜낸 성'], ['lost', '잃은 성'], ['foe', '적이 쥔 성']].forEach(([st, t], k) => { castleMini(g, L0 + 16 + k * 86, cssH - 13, st, false); g.fillStyle = '#efe3c2'; g.fillText(t, L0 + 30 + k * 86, cssH - 15); }); }
  // a light vignette so the table reads as an object under a lamp
  const vg = g.createRadialGradient(MW * 0.45, cssH * 0.55, cssH * 0.3, MW * 0.45, cssH * 0.55, MW * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,8,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, MW, cssH);
  // header band so the title reads over the terrain
  { const hb = g.createLinearGradient(0, 0, 0, 64); hb.addColorStop(0, 'rgba(24,17,12,0.82)'); hb.addColorStop(1, 'rgba(24,17,12,0)'); g.fillStyle = hb; g.fillRect(0, 0, MW, 64); }
  // ---- DOM: header + briefing ----
  const ui = document.getElementById('ui');
  ui.innerHTML = `
  <div id="maphead"><div class="ib hit"><canvas data-ico="map" width="36" height="36"></canvas></div><div><div class="t">변경 행군도</div><div class="s">가을걷이에서 첫서리로 · 병력 212 · 뒤따르는 피란민 1,140</div></div></div>
  <div id="brief">
    <div class="kick">제6장 · 첫서리 내린 저녁</div>
    <h1>쌍둥이탑 성</h1>
    <div class="sub">강을 사이에 둔 두 탑. 서·남·북 세 성문이 모두 열려 있다.</div>
    <div class="quote"><b>보른, 개울목 방패대</b>탑 하나는 우리 할아비들이 쌓았고, 하나는 놈들이 무너뜨렸지. 이번엔 둘 다 지킨다.</div>
    <dl>
      <dt>적</dt><dd><span class="sig"><canvas id="sg0" width="28" height="36"></canvas>아우렐 협약군</span><span class="sig"><canvas id="sg1" width="28" height="36"></canvas>애쉬터스크 군단</span></dd>
      <dt>때·날씨</dt><dd>해 질 녘, 강안개 <em>— 밤에는 비</em></dd>
      <dt>목표</dt><dd>해 질 때까지 세 성문 사수 <em>· 피란민 300 입성</em></dd>
      <dt>지난 일</dt><dd>은빛숲에서 활시위가 끊겼다 <em>· 화살 −20%</em></dd>
    </dl>
    <div class="sq">${SQUADS.map((q, i) => `<span><canvas id="bq${i}" width="40" height="52"></canvas><i>${[10, 12, 18, 4][i]}</i>${i === 0 ? '<b>노련</b>' : ''}${i === 3 ? '<b class="w">지침</b>' : ''}</span>`).join('')}</div>
    <div class="pick"><div class="ph">출정 전 결정 <em>— 하멜의 장부에 남는다</em></div><div class="ch on"><b>피란민 먼저</b>북문을 늦게 닫는다 · 성 안 접전</div><div class="ch"><b>성문 먼저</b>지금 닫는다 · 60명이 밖에 남는다</div></div>
    <div class="go hit">출정<small>세 성문 · 약 9분</small></div>
  </div>`;
  const st = document.createElement('style');
  st.textContent = `#brief .sig{display:inline-flex;align-items:center;gap:3px;margin-right:8px;white-space:nowrap}#brief .sig canvas{width:11px;height:14px}
  #brief .sq{display:flex;gap:8px;margin-top:2px}#brief .sq span{position:relative;display:flex;align-items:center;gap:3px;font:11px var(--sans);color:var(--dim)}
  #brief .sq canvas{width:18px;height:24px}#brief .sq i{font-style:normal;color:var(--cream);font-variant-numeric:tabular-nums}
  #brief .sq b{font:700 9.5px var(--sans);color:var(--walnut);background:var(--ok);padding:0 3px;border-radius:2px}#brief .sq b.w{background:var(--brass)}
  #brief .pick{margin-top:8px}#brief .ph{font:700 11px var(--serif);color:var(--cream);margin-bottom:4px}#brief .ph em{font:400 10px var(--sans);color:var(--mute);font-style:normal}
  #brief .go{height:36px;bottom:10px}#brief .ch{white-space:nowrap;font:10.5px/1.35 var(--sans);color:var(--dim);border:1px solid var(--line);border-radius:3px;padding:4px 7px;margin-bottom:4px;background:rgba(255,236,200,.03)}#brief .ch b{color:var(--cream);margin-right:6px;font-family:var(--serif)}#brief .ch.on{border-color:var(--brass);box-shadow:inset 2px 0 0 var(--brass)}
  #brief h1{font-size:20px}#brief .quote{margin:7px 0 7px;font-size:12px;line-height:1.45}#brief dl{gap:3px 8px;font-size:11px}`;
  document.head.appendChild(st);
  document.querySelectorAll('#ui canvas[data-ico]').forEach((c) => paintIcon(c, c.dataset.ico, '#d8c9a4'));
  SQUADS.forEach((q, i) => paintEmblemIcon(document.getElementById('bq' + i), q));
  paintEmblemIcon(document.getElementById('sg0'), { field: '#a12f2b', charge: '#e6d6b0', emb: 'sun', shape: 'rect' });
  paintEmblemIcon(document.getElementById('sg1'), { field: '#4f5f2e', charge: '#d8c9a4', emb: 'tusk', shape: 'swallow' });
  window.__ready = true;
}
