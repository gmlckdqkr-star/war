// ============================================================================
// ?ui=1 — the campaign is the chronicle itself: an open book on the war-table.
// Left page: the frontier map in ink (held castles sealed in gold, the lost one
// hatched in cinnabar, the next one ringed). Right page: tonight's entry, written
// from what actually happened last battle, and the red seal that starts the battle.
// Everything is drawn by code; text is Gowun Batang (OFL).
// ============================================================================
function drawUI() {
  const cv = document.getElementById('c'), W = window.innerWidth, H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  document.getElementById('hud').style.display = 'none';
  const g = cv.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round';
  const font = (s, w = 400) => `${w} ${s}px "Gowun Batang", serif`;
  const txt = (s, x, y, size, col = P.ink, w = 400, align = 'left') => { g.font = font(size, w); g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); return g.measureText(s).width; };
  const r = RNG(77);
  const halo = (s, x, y, size, col, w = 400, align = 'left') => { g.font = font(size, w); g.textAlign = align; g.textBaseline = 'alphabetic'; g.strokeStyle = 'rgba(236,228,210,0.95)'; g.lineWidth = 3; g.lineJoin = 'round'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };

  // --- the war-table: dark walnut with a candle pool of light
  g.fillStyle = '#211A15'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { const y = r() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + r.range(-6, 6), W * 0.6, y + r.range(-6, 6), W, y + r.range(-4, 4)); g.strokeStyle = `rgba(${90 + r() * 40},${60 + r() * 25},${36},${0.05 + r() * 0.07})`; g.lineWidth = 0.6 + r() * 1.4; g.stroke(); }
  { const rg = g.createRadialGradient(W * 0.62, H * 0.2, 10, W * 0.55, H * 0.5, W * 0.7); rg.addColorStop(0, 'rgba(240,180,90,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0.35)'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }

  // --- the book
  const BX0 = 10, BX1 = W - 10, BY0 = 14, BY1 = H - 8, GX = W / 2;
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.roundRect(BX0 + 4, BY0 + 6, BX1 - BX0, BY1 - BY0, 6); g.fill();
  g.fillStyle = '#5A2A1C'; g.beginPath(); g.roundRect(BX0 - 3, BY0 - 3, BX1 - BX0 + 6, BY1 - BY0 + 7, 6); g.fill(); // leather cover edge
  for (let i = 3; i >= 1; i--) { g.fillStyle = i % 2 ? '#D9CCAF' : '#CBBB98'; g.fillRect(BX0 + i * 0.8, BY0 + i * 1.2, BX1 - BX0 - i * 1.6, BY1 - BY0); } // page stack
  const page = (x0, x1, seed, left) => {
    const p = UIART.paper(Math.round(x1 - x0), Math.round(BY1 - BY0), seed, P.paper);
    g.drawImage(p, x0, BY0, x1 - x0, BY1 - BY0);
    const lg = g.createLinearGradient(left ? x1 : x0, 0, left ? x1 - 46 : x0 + 46, 0); lg.addColorStop(0, 'rgba(90,70,40,0.42)'); lg.addColorStop(0.35, 'rgba(90,70,40,0.12)'); lg.addColorStop(1, 'rgba(90,70,40,0)');
    g.fillStyle = lg; g.fillRect(x0, BY0, x1 - x0, BY1 - BY0);
    const eg = g.createLinearGradient(left ? x0 : x1, 0, left ? x0 + 14 : x1 - 14, 0); eg.addColorStop(0, 'rgba(80,60,30,0.18)'); eg.addColorStop(1, 'rgba(80,60,30,0)'); g.fillStyle = eg; g.fillRect(x0, BY0, x1 - x0, BY1 - BY0);
  };
  page(BX0 + 4, GX, 3, true); page(GX, BX1 - 4, 4, false);
  g.beginPath(); g.moveTo(GX, BY0); g.lineTo(GX, BY1); g.strokeStyle = 'rgba(60,40,20,0.5)'; g.lineWidth = 1; g.stroke();

  // --- chapter tabs (bookmarks) along the top edge
  const books = ['제1권', '제2권', '제3권', '제4권', '제5권', '제6권', '제7권'];
  books.forEach((b, i) => {
    const x = 470 + i * 50, cur = i === 4, done = i < 4;
    g.fillStyle = cur ? P.cinnabar : done ? '#CDBF9F' : '#B9AC8D'; g.beginPath(); g.moveTo(x, BY0 + 1); g.lineTo(x, BY0 - 9); g.lineTo(x + 40, BY0 - 9); g.lineTo(x + 40, BY0 + 1); g.fill();
    txt(b, x + 20, BY0 - 1.5, 9, cur ? P.paperHi : done ? P.ink : 'rgba(30,25,22,0.45)', 700, 'center');
  });
  // back mark + title of the left page
  txt('‹ 연대기 목록', BX0 + 16, BY0 + 20, 10.5, P.ink2, 700);
  txt('할드미어 변경 — 겨울 전선도', 210, BY0 + 22, 14, P.ink, 700, 'center');
  brush(g, [[128, BY0 + 28], [210, BY0 + 27], [292, BY0 + 28.5]], nib(1.4), P.cinnabar, 0.8);
  txt('물러난 길은 점선으로,', BX0 + 18, BY0 + 52, 9, P.ink2); txt('적의 걸음은 붓으로 적는다.', BX0 + 18, BY0 + 64, 9, P.ink2);

  // ================= LEFT PAGE: the frontier map in ink =================
  const MX = (x) => BX0 + 8 + x, MY = (y) => BY0 + 12 + y;
  // river (indigo, two strokes), tributary
  const river = [[0, 210], [60, 200], [96, 182], [120, 196], [170, 214], [210, 236], [262, 232], [300, 246], [350, 290], [400, 300]];
  brush(g, river.map(([x, y]) => [MX(x), MY(y)]), (u) => 1.6 + 2.2 * u, P.indigo, 0.55);
  brush(g, river.map(([x, y]) => [MX(x), MY(y + 3)]), nib(0.6), P.indigoLo, 0.5);
  brush(g, [[MX(96), MY(182)], [MX(110), MY(140)], [MX(150), MY(102)]], (u) => 1.6 - u, P.indigo, 0.45);
  // mountains (woodcut triangles, hatched east flanks)
  const mtn = (x, y, s) => { const a = [MX(x - 9 * s), MY(y)], b = [MX(x), MY(y - 13 * s)], c = [MX(x + 10 * s), MY(y)]; g.save(); poly(g, [b, c, [MX(x), MY(y)]]); g.clip(); hatch(g, MX(x - 2), MY(y - 14 * s), MX(x + 11 * s), MY(y), 1.0, 1.4, 0.45, P.ink, 0.75, x | 0); g.restore(); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.strokeStyle = P.ink; g.lineWidth = 0.9; g.stroke(); g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - 3 * s, b[1] + 5 * s); g.lineTo(b[0] + 1, b[1] + 4 * s); g.closePath(); g.fillStyle = P.paperHi; g.fill(); };
  for (const [x, y, s] of [[140, 112, 1.2], [158, 104, 1.5], [178, 118, 1.0], [196, 100, 1.3], [120, 120, 0.9], [215, 112, 0.9], [338, 112, 1.1], [358, 98, 1.4], [380, 114, 1.0], [276, 70, 0.9], [300, 58, 1.2]]) mtn(x, y, s);
  // forests (pine ticks), the silver forest burned (ash-grey stumps)
  const pineTick = (x, y, s, col) => { g.beginPath(); g.moveTo(MX(x), MY(y - 7 * s)); g.lineTo(MX(x - 2.6 * s), MY(y)); g.lineTo(MX(x + 2.6 * s), MY(y)); g.closePath(); g.fillStyle = col; g.fill(); g.beginPath(); g.moveTo(MX(x), MY(y)); g.lineTo(MX(x), MY(y + 1.6)); g.strokeStyle = col; g.lineWidth = 0.7; g.stroke(); };
  for (let i = 0; i < 28; i++) pineTick(30 + r() * 70, 236 + r() * 60, 0.8 + r() * 0.4, P.ink2);
  for (let i = 0; i < 22; i++) { const x = 214 + r() * 54, y = 150 + r() * 30; g.beginPath(); g.moveTo(MX(x), MY(y)); g.lineTo(MX(x + 0.4), MY(y - 4)); g.strokeStyle = 'rgba(30,25,22,0.45)'; g.lineWidth = 0.9; g.stroke(); }
  halo('은빛숲 — 불탄 자리', MX(244), MY(198), 8, 'rgba(30,25,22,0.6)', 400, 'center');
  // marsh (reed strokes)
  for (let i = 0; i < 26; i++) { const x = 296 + r() * 60, y = 304 + r() * 34; g.beginPath(); g.moveTo(MX(x), MY(y)); g.lineTo(MX(x + 5), MY(y)); g.strokeStyle = 'rgba(43,74,120,0.45)'; g.lineWidth = 0.7; g.stroke(); if (r() < 0.4) { g.beginPath(); g.moveTo(MX(x + 2), MY(y)); g.lineTo(MX(x + 2.5), MY(y - 4)); g.strokeStyle = P.ink2; g.stroke(); } }
  // the road between the castles (dotted, the way the defenders fell back)
  const C = [
    { n: '개울목 초소', x: 40, y: 286, st: 'held' }, { n: '갈대언덕 보루', x: 92, y: 248, st: 'lost' },
    { n: '회색다리 요새', x: 92, y: 186, st: 'held' }, { n: '늑대고개 관문', x: 168, y: 134, st: 'held' },
    { n: '은빛숲 성채', x: 238, y: 168, st: 'held' }, { n: '쌍둥이탑 성', x: 232, y: 262, st: 'cur' },
    { n: '검은늪 수도원', x: 322, y: 320, st: 'next' }, { n: '철모루 성', x: 334, y: 226, st: 'next' },
    { n: '불탄왕관 성', x: 366, y: 150, st: 'next' }, { n: '최후의 성채', x: 300, y: 84, st: 'next' },
  ];
  g.setLineDash([1.5, 3]); g.beginPath(); C.forEach((c, i) => (i ? g.lineTo(MX(c.x), MY(c.y)) : g.moveTo(MX(c.x), MY(c.y)))); g.strokeStyle = 'rgba(30,25,22,0.5)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]);
  // enemy advances: rust (the Concord, from the south-west), green (the Legion, from the west)
  const arrow = (pts, col) => { brush(g, pts.map(([x, y]) => [MX(x), MY(y)]), (u) => 0.8 + 2.6 * Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.05)), col, 0.75); const a = pts[pts.length - 2], b = pts[pts.length - 1]; const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); g.beginPath(); g.moveTo(MX(b[0]) + Math.cos(ang) * 4, MY(b[1]) + Math.sin(ang) * 4); g.lineTo(MX(b[0]) + Math.cos(ang + 2.5) * 6, MY(b[1]) + Math.sin(ang + 2.5) * 6); g.lineTo(MX(b[0]) + Math.cos(ang - 2.5) * 6, MY(b[1]) + Math.sin(ang - 2.5) * 6); g.closePath(); g.fillStyle = col; g.fill(); };
  arrow([[60, 340], [120, 320], [170, 300], [214, 278]], P.rust);
  arrow([[6, 150], [60, 214], [140, 246], [212, 258]], P.orc);
  // castles
  const castleIcon = (x, y, st) => {
    const X = MX(x), Y = MY(y), faint = st === 'next';
    const col = faint ? 'rgba(30,25,22,0.4)' : P.ink;
    g.fillStyle = faint ? 'rgba(232,223,203,0.6)' : P.paperHi;
    poly(g, [[X - 6, Y + 3], [X - 6, Y - 5], [X - 4, Y - 5], [X - 4, Y - 7], [X - 2, Y - 7], [X - 2, Y - 5], [X + 2, Y - 5], [X + 2, Y - 7], [X + 4, Y - 7], [X + 4, Y - 5], [X + 6, Y - 5], [X + 6, Y + 3]]); g.fill(); g.strokeStyle = col; g.lineWidth = 0.9; g.stroke();
    g.save(); g.beginPath(); g.rect(X, Y - 5, 6, 8); g.clip(); hatch(g, X, Y - 6, X + 7, Y + 4, 1.0, 1.3, 0.4, col, 0.8, x | 0); g.restore();
    g.beginPath(); g.arc(X, Y + 3, 1.6, Math.PI, 0); g.fillStyle = col; g.fill();
    if (st === 'held') { g.beginPath(); g.arc(X + 8, Y - 7, 3.6, 0, 7); g.fillStyle = P.gold; g.fill(); g.strokeStyle = P.goldLo; g.lineWidth = 0.7; g.stroke(); g.beginPath(); g.moveTo(X + 6.4, Y - 7.6); g.lineTo(X + 8, Y - 5.6); g.lineTo(X + 9.8, Y - 8.6); g.strokeStyle = P.paperHi; g.lineWidth = 0.9; g.stroke(); }
    if (st === 'lost') { g.save(); g.beginPath(); g.arc(X, Y - 2, 9, 0, 7); g.clip(); hatch(g, X - 10, Y - 12, X + 10, Y + 8, 0.8, 1.6, 0.8, P.cinnabar, 0.85, 3); g.restore(); }
    if (st === 'cur') {
      const pts = []; for (let i = 0; i <= 30; i++) { const a = -1.0 + (i / 30) * 5.9; pts.push([X + Math.cos(a) * 13, Y - 2 + Math.sin(a) * 11]); }
      brush(g, pts, (u) => 0.5 + 2.4 * Math.sin(Math.PI * Math.min(1, u * 1.05)), P.cinnabar, 0.9);
    }
  };
  for (const c of C) {
    castleIcon(c.x, c.y, c.st);
    const right = c.x > 300, lx = MX(c.x) + (right ? -11 : 11), al = right ? 'right' : 'left';
    if (c.st === 'cur') halo(c.n, MX(c.x) + 16, MY(c.y) + 17, 12.5, P.cinnabar, 700, 'left');
    else halo(c.n, lx, MY(c.y) + 12, 9.5, c.st === 'next' ? 'rgba(30,25,22,0.55)' : P.ink, 400, al);
    if (c.st === 'lost') halo('불탐 — 제1권, 갈대에 불을 놓다', lx, MY(c.y) + 23, 8, P.cinnabar, 400, al);
  }
  // legend + compass
  { const lx = MX(8), ly = MY(350); g.fillStyle = 'rgba(236,228,210,0.85)'; g.fillRect(lx - 4, ly - 11, 262, 17); txt('범례', lx, ly + 1, 9, P.ink, 700); const it = (dx, col, s) => { g.beginPath(); g.arc(lx + dx, ly - 2, 3, 0, 7); g.fillStyle = col; g.fill(); txt(s, lx + dx + 6, ly + 1.5, 8.5, P.ink2); };
    it(30, P.gold, '지켜낸 성'); it(88, P.cinnabar, '잃은 성'); it(136, 'rgba(30,25,22,0.35)', '아직 쓰이지 않은 장'); brush(g, [[lx + 216, ly - 2], [lx + 242, ly - 2.5]], nib(2), P.rust, 0.8); txt('적', lx + 246, ly + 1.5, 8.5, P.ink2); }
  { const cx = MX(372), cy = MY(330); brush(g, [[cx, cy + 14], [cx, cy - 14]], nib(1.2), P.ink, 0.9); brush(g, [[cx - 10, cy], [cx + 10, cy]], nib(0.8), P.ink, 0.7); poly(g, [[cx, cy - 18], [cx - 3, cy - 10], [cx + 3, cy - 10]]); g.fillStyle = P.cinnabar; g.fill(); txt('북', cx, cy - 20, 9, P.ink, 700, 'center'); }
  // ================= RIGHT PAGE: tonight's entry =================
  const RX = GX + 22, RW = BX1 - 4 - 22 - RX;
  txt('제5권 · 포위 · 셋째 장', RX, BY0 + 24, 10.5, P.cinnabar, 700);
  txt('쌍둥이탑 성', RX, BY0 + 50, 25, P.ink, 700);
  txt('첫눈 오는 저녁, 세 갈래 문', RX + 152, BY0 + 49, 11.5, P.ink2);
  // currencies as stamps (top-right of the page)
  const stamp = (x, y, kind, val) => {
    if (kind === 'ink') { g.save(); g.translate(x, y); g.rotate(-0.5); g.fillStyle = P.ink; g.beginPath(); g.roundRect(-2.5, -7, 5, 14, 1); g.fill(); g.fillStyle = P.gold; g.fillRect(-2.5, -3, 5, 1.2); g.restore(); }
    else { g.beginPath(); g.ellipse(x, y, 6, 4.6, -0.3, 0, 7); g.fillStyle = '#EDE3CF'; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke(); g.beginPath(); g.ellipse(x + 0.6, y + 0.4, 3.6, 2.6, -0.3, 0, 7); g.fillStyle = P.cinnabar; g.fill(); }
    txt(val, x + 9, y + 4, 11.5, P.ink, 700);
  };
  stamp(BX1 - 118, BY0 + 20, 'ink', '1,240'); stamp(BX1 - 58, BY0 + 20, 'cin', '12');
  txt('먹', BX1 - 118, BY0 + 36, 8, P.ink2, 400, 'center'); txt('진사', BX1 - 58, BY0 + 36, 8, P.ink2, 400, 'center');
  g.beginPath(); g.moveTo(RX, BY0 + 60); g.lineTo(BX1 - 26, BY0 + 60); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();

  // the entry: illuminated drop cap + rubricated names, wrapped by measured width
  const capX = RX, capY = BY0 + 68, capS = 40;
  g.fillStyle = P.gold; g.fillRect(capX, capY, capS, capS);
  g.save(); g.beginPath(); g.rect(capX, capY, capS, capS); g.clip(); for (let i = 0; i < 14; i++) { const a = r() * 6.28; g.beginPath(); g.moveTo(capX + 20, capY + 20); g.quadraticCurveTo(capX + 20 + Math.cos(a) * 30, capY + 20 + Math.sin(a + 1) * 30, capX + 20 + Math.cos(a + 0.7) * 26, capY + 20 + Math.sin(a + 0.7) * 26); g.strokeStyle = 'rgba(142,102,24,0.55)'; g.lineWidth = 0.8; g.stroke(); } g.restore();
  g.strokeStyle = P.ink; g.lineWidth = 1.4; g.strokeRect(capX + 0.5, capY + 0.5, capS - 1, capS - 1);
  txt('첫', capX + capS / 2, capY + 31, 30, P.cinnabar, 700, 'center');
  const segs = [
    ['눈이 성가퀴에 쌓이기도 전에 '], ['협약의 해 깃발', 1], ['이 서쪽 개울을 건넜다. 그 뒤로 '], ['애쉬터스크 군단', 1], ['의 북소리가 따라온다. 늑대고개에서 잃은 창 셋의 자리는 아직 비어 있다. '],
    ['브란', 1], ['은 서문을 고치라 했으나 빗장은 반쯤만 갈았다. 나는 그 말과 그 반쯤을 함께 적어 둔다.'],
  ];
  const lineH = 16.5; let lx = capX + capS + 8, ly = capY + 12; const L0 = capX + capS + 8, Rr = BX1 - 28;
  let lineN = 0;
  for (const [s, red] of segs) {
    g.font = font(12, red ? 700 : 400);
    for (const ch of s) {
      const w = g.measureText(ch).width;
      const left = lineN < 3 ? L0 : RX;
      if (lx + w > Rr) { lineN++; ly += lineH; lx = lineN < 3 ? L0 : RX; if (ch === ' ') continue; }
      g.fillStyle = red ? P.cinnabar : P.ink; g.textAlign = 'left'; g.fillText(ch, lx, ly); lx += w;
    }
  }
  txt('— 사관 텔마, 셋째 날 저녁', BX1 - 28, ly + 19, 10, P.ink2, 400, 'right');

  // what the last battle actually cost (numbers from the save, not flavour)
  let y = ly + 34;
  g.fillStyle = 'rgba(179,39,29,0.08)'; g.fillRect(RX, y - 12, RW, 40);
  txt('지난 장의 값', RX + 8, y + 2, 10, P.cinnabar, 700);
  txt('지킨 밤 2  ·  쓰러진 우리 편 7  ·  노병 3  ·  성안 사람 41', RX + 70, y + 2, 10.5, P.ink);
  txt('어젯밤의 결정 — 피난민을 들였다. 물과 들것을 나를 손이 생겼고, 곡식은 사흘 치.', RX + 8, y + 19, 9.5, P.ink2);

  // conditions: weather, hour, enemy sigils
  y += 44;
  const cell = (x, w, label, val, icon) => { g.strokeStyle = 'rgba(30,25,22,0.35)'; g.lineWidth = 0.8; g.strokeRect(x + 0.5, y + 0.5, w, 38); txt(label, x + 34, y + 14, 9, P.ink2); txt(val, x + 34, y + 30, 11.5, P.ink, 700); icon(x + 16, y + 20); };
  const cw3 = (RW - 8) / 3;
  cell(RX, cw3, '날씨', '첫눈', (x, yy) => { for (let i = 0; i < 3; i++) { const a = i * 1.047; brush(g, [[x - Math.cos(a) * 8, yy - Math.sin(a) * 8], [x + Math.cos(a) * 8, yy + Math.sin(a) * 8]], nib(1.2), P.indigo, 0.9); } });
  cell(RX + cw3 + 4, cw3, '시각', '해 질 녘', (x, yy) => { g.save(); g.beginPath(); g.rect(x - 11, yy - 12, 22, 13); g.clip(); g.beginPath(); g.arc(x, yy + 2, 7, 0, 7); g.fillStyle = P.cinnabar; g.fill(); g.restore(); brush(g, [[x - 11, yy + 1.5], [x + 11, yy + 1]], nib(1.4), P.ink, 1); });
  cell(RX + 2 * (cw3 + 4), cw3, '적', '협약 · 군단', (x, yy) => { g.save(); g.translate(x - 12, yy - 8); drawEmblem(g, 'sun', 11, 15); g.restore(); g.save(); g.translate(x + 1, yy - 8); drawEmblem(g, 'hand', 11, 15); g.restore(); g.strokeStyle = P.ink; g.lineWidth = 0.7; g.strokeRect(x - 12, yy - 8, 11, 15); g.strokeRect(x + 1, yy - 8, 11, 15); });

  // squads going out tonight, with veterans as gold ticks
  y += 60;
  const sq = [['hawk', '회색매 창병대', 12, 2], ['chevron', '브란의 방패검병대', 12, 1], ['reed', '갈대피리 궁수대', 8, 0], ['wheel', '물레 궁수대', 8, 0]];
  sq.forEach(([e, n, c, vet], i) => {
    const x = RX + (i % 2) * 150, yy = y + Math.floor(i / 2) * 22;
    g.drawImage(UIART.icon('emblem', 18, { e }), x, yy - 13, 18, 18);
    txt(n, x + 22, yy, 10.5, P.ink, 700); const w = g.measureText(n).width;
    txt(String(c), x + 26 + w, yy, 10.5, P.ink2);
    for (let v = 0; v < vet; v++) brush(g, [[x + 40 + w + v * 4, yy - 1], [x + 41.5 + w + v * 4, yy - 9]], nib(1.3), P.gold, 1);
  });

  // the red seal: press to march out
  { const sx = BX1 - 74, sy = BY1 - 46;
    g.save(); g.translate(sx, sy); g.rotate(-0.06);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-26, -24, 56, 54);
    g.fillStyle = P.cinnabar; g.beginPath(); g.roundRect(-28, -27, 56, 54, 3); g.fill();
    // carved, slightly broken border (a real seal's worn edge)
    g.strokeStyle = '#F2E4CC'; g.lineWidth = 1.6; g.setLineDash([22, 1.5, 9, 2, 30, 1]); g.strokeRect(-23.5, -22.5, 47, 45); g.setLineDash([]);
    txt('출정', 0, 7, 19, '#F7EBD3', 700, 'center');
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(232,223,203,0.35)'; g.fillRect(-26 + r() * 52, -25 + r() * 50, 0.8 + r(), 0.8); }
    g.restore();
    txt('도장을 눌러 싸움을 시작한다', sx, BY1 - 9, 8.5, P.ink2, 400, 'center'); }
  // marginalia: two of the game's own plates printed big, as a woodcut vignette in the margin
  ATLAS = new Atlas(2.2 * DPR, 36, 34, 18, 28);
  const put = (fr, x, y) => { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, Math.round(x * DPR - fr.ax), Math.round(y * DPR - fr.ay), fr.sw, fr.sh); g.setTransform(DPR, 0, 0, DPR, 0, 0); };
  put(unitFrame(KIDX.o_grunt, 0, 'attack', 0, 1), RX + 16, BY1 - 12);
  put(unitFrame(KIDX.d_spear, 0, 'attack', 1, -1), RX + 46, BY1 - 12);
  txt('여백 그림 — 문턱의 싸움', RX + 76, BY1 - 34, 8.5, P.ink2);
  // secondary action in plain ink
  txt('진형 다시 짜기', RX + 196, BY1 - 34, 11, P.ink, 700); brush(g, [[RX + 196, BY1 - 29], [RX + 274, BY1 - 29.5]], nib(1.0), P.ink, 0.8);
  txt('별책 「전쟁 연대기」 · 금니 테두리', RX + 76, BY1 - 12, 8.5, P.goldLo);
}
