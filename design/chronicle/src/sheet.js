// ============================================================================
// ?sheet=1 — the woodcut "plate book": every unit kind of both attacking races and
// the defenders, every animation frame, on a neutral ground. Same code path as the
// game (Atlas + drawFigure + lightPass), only drawn larger.
// ============================================================================
function drawSheet() {
  const cv = document.getElementById('c'), W = window.innerWidth, H = window.innerHeight;
  cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  document.getElementById('hud').style.display = 'none';
  const g = cv.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#E6E1D7'; g.fillRect(0, 0, W, H);
  // faint ruled grid like a plate register
  g.strokeStyle = 'rgba(30,25,22,0.05)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y < H; y += 16) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  const font = (w, s) => `${w} ${s}px "Gowun Batang", serif`;
  const txt = (s, x, y, size, col = P.ink, w = 400, align = 'left') => { g.font = font(w, size); g.fillStyle = col; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); };

  // title
  txt('잿빛 연대기 — 병종 판화첩', 18, 30, 21, P.ink, 700);
  txt('코드로 새긴 목판 스프라이트 · 모든 병종 · 모든 프레임 · 빛은 늘 서남서에서', 262, 29, 12, P.ink2);
  g.fillStyle = P.cinnabar; g.fillRect(W - 120, 12, 102, 24);
  txt('제5권 부록', W - 69, 29, 13, P.paperHi, 700, 'center');

  const sc = 1.85, RH = 47, LX = 186, X1 = W - 12, nF = 17, cw = (X1 - LX) / nF;
  ATLAS = new Atlas(sc * DPR, 36, 34, 18, 28);
  // column header: animation groups with their frame counts
  let col = 0;
  const groups = ANIM_ORDER.map((a) => ({ a, n: ANIMS[a] }));
  const top = 46;
  for (const G of groups) {
    const x0 = LX + col * cw, x1 = x0 + G.n * cw;
    g.fillStyle = G.a === 'dead' ? 'rgba(30,25,22,0.08)' : col % 2 ? 'rgba(30,25,22,0.035)' : 'rgba(255,255,255,0.25)';
    g.fillRect(x0, top + 16, x1 - x0, 11 * RH + 2);
    txt(`${ANIM_KO[G.a]}${G.a === 'dead' ? ' (먹으로)' : ''} · ${G.n}`, (x0 + x1) / 2, top + 6, 12, G.a === 'die' || G.a === 'dead' ? P.cinnabar : P.ink, 700, 'center');
    for (let f = 0; f < G.n; f++) txt(String(f + 1), x0 + (f + 0.5) * cw, top + 22, 9, P.ink2, 400, 'center');
    g.beginPath(); g.moveTo(x0 + 0.5, top + 12); g.lineTo(x0 + 0.5, top + 16 + 11 * RH); g.strokeStyle = 'rgba(30,25,22,0.25)'; g.stroke();
    col += G.n;
  }
  const raceCol = { '할드미어 변경군': P.indigo, '아우렐 협약군': P.rust, '애쉬터스크 군단': P.orc };
  const order = ['d_spear', 'd_sword', 'd_archer', 'd_folk', 'h_levy', 'h_maa', 'h_bow', 'h_ladder', 'o_grunt', 'o_goblin', 'o_berserk'];
  const notes = { d_spear: '문턱을 지키는 창벽', d_sword: '연 모양 방패, 반격', d_archer: '성가퀴의 활', d_folk: '물·화살·들것을 나르는 성안 사람', h_levy: '빚에 끌려온 갈고리창', h_maa: '사슬갑옷, 해 문장 방패', h_bow: '방패 뒤의 장궁', h_ladder: '사다리를 메고 달린다', o_grunt: '털망토, 식칼 같은 도끼', o_goblin: '작고 빠르다, 단검', o_berserk: '맨몸, 붉은 칠, 쌍도끼' };
  order.forEach((id, row) => {
    const k = KIDX[id], K = KINDS[k], y0 = top + 26 + row * RH, base = y0 + 40;
    if (row === 4 || row === 8) { g.beginPath(); g.moveTo(10, y0 - 1.5); g.lineTo(X1, y0 - 1.5); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke(); g.lineWidth = 1; }
    g.fillStyle = raceCol[K.race]; g.fillRect(14, y0 + 5, 5, 34);
    txt(K.name, 26, y0 + 18, 15, P.ink, 700);
    txt(K.race, 26, y0 + 31, 10.5, raceCol[K.race], 700);
    txt(notes[id], 26, y0 + 43, 9.5, P.ink2);
    const dir = K.side === 0 && !K.folk ? -1 : 1;
    let c = 0;
    for (const G of groups) {
      for (let f = 0; f < G.n; f++, c++) {
        const cx = LX + (c + 0.5) * cw;
        const skip = (K.folk && (G.a === 'attack' || G.a === 'climb')) || (K.side === 0 && G.a === 'climb');
        if (skip) { txt('—', cx, base - 10, 12, 'rgba(30,25,22,0.3)', 400, 'center'); continue; }
        const fr = G.a === 'dead' ? corpseFrame(k, 0, f, dir) : unitFrame(k, (f + c) % 2 && G.a === 'idle' ? 1 : 0, G.a, f, dir);
        g.setTransform(1, 0, 0, 1, 0, 0);
        // ground shadow, as in game
        g.drawImage(fr.img, fr.sx, fr.sy, fr.sw, fr.sh, Math.round(cx * DPR - fr.ax), Math.round(base * DPR - fr.ay), fr.sw, fr.sh);
        g.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
    }
    // second head variant, small, at the label (2 headgear per kind)
    const alt = unitFrame(k, 1, 'idle', 0, dir); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(alt.img, alt.sx, alt.sy, alt.sw, alt.sh, Math.round(166 * DPR - alt.ax * 0.8), Math.round(base * DPR - alt.ay * 0.8), alt.sw * 0.8, alt.sh * 0.8);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  });

  // bottom strip: siege engine (swing phases + wreck), gate states, standards
  const by = top + 26 + 11 * RH + 8;
  g.beginPath(); g.moveTo(10, by - 4); g.lineTo(X1, by - 4); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke(); g.lineWidth = 1;
  const S2 = 1.25 * DPR;
  const big = (w, h, ax, ay, fn) => { const c = mkCanvas(w * S2, h * S2), q = c.getContext('2d'); q.setTransform(S2, 0, 0, S2, ax * S2, ay * S2); fn(q); lightPass(c, S2, 0.7, 0.28); return { img: c, ax: ax * S2, ay: ay * S2 }; };
  const shed = big(60, 42, 30, 34, (q) => drawRamShed(q, 'ok')), wreck = big(60, 42, 30, 34, (q) => drawRamShed(q, 'wreck')), log = big(60, 42, 30, 34, (q) => drawRamLog(q));
  const put = (b, x, y) => { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(b.img, Math.round(x * DPR - b.ax), Math.round(y * DPR - b.ay)); g.setTransform(DPR, 0, 0, DPR, 0, 0); };
  txt('애쉬터스크 충차 — 당김 · 내지름 · 되돌림 · 불탄 잔해', 18, by + 10, 11, P.orcLo || P.ink, 700);
  [-6, 5, -1].forEach((dx, i) => { const x = 54 + i * 82, y = by + 64; put(log, x + dx * 1.25, y); put(shed, x, y); });
  put(wreck, 54 + 3 * 82, by + 64);
  ['당김', '내지름', '되돌림', '잔해'].forEach((l, i) => txt(l, 54 + i * 82 + 6, by + 96, 10, P.ink2, 400, 'center'));
  txt('서문 — 온전 · 갈라짐 · 부서짐', 372, by + 10, 11, P.ink, 700);
  ['intact', 'splintered', 'broken'].forEach((st, i) => {
    const s = gateSprite(S2, st); g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(s.img, Math.round((380 + i * 66) * DPR), Math.round((by + 14) * DPR), s.img.width * 0.92, s.img.height * 0.92);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    txt(['온전', '갈라짐', '부서짐'][i], 380 + i * 66 + 22, by + 96, 10, P.ink2, 400, 'center');
  });
  txt('깃발 — 회색매 · 브란 · 갈대피리 · 물레 · 협약 해 · 군단 손, 그리고 해골 토템', 600, by + 10, 11, P.ink, 700);
  const flags = ['hawk', 'chevron', 'reed', 'wheel', 'sun', 'hand'];
  flags.forEach((e, i) => { g.save(); g.translate(612 + i * 52, by + 82); g.scale(2.2, 2.2); drawBanner(g, e, i, i === 1 ? 0.6 : 0); g.restore(); });
  g.save(); g.translate(612 + 6 * 52 + 10, by + 82); g.scale(2.2, 2.2); drawTotem(g, 1); g.restore();
  txt('지면 그림자·주검·피는 바닥 캔버스에 찍혀 지워지지 않습니다', W - 14, H - 8, 9.5, P.ink2, 400, 'right');
}
