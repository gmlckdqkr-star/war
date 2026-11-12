// ============================================================================
// ?sheet=1 — labelled frame sheet of every kind, facing and animation frame
// ============================================================================
function runSheet() {
  const cssW = innerWidth, cssH = innerHeight;
  const cv = document.getElementById('c');
  cv.width = Math.round(cssW * DPR); cv.height = Math.round(cssH * DPR);
  cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  const g = cv.getContext('2d');
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#8d8a83'; g.fillRect(0, 0, cssW, cssH);
  // faint paper grain so it is not a flat RGB slab
  const r = RNG(5);
  for (let k = 0; k < 2400; k++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)'; g.fillRect(r() * cssW, r() * cssH, 1 + r() * 2, 1); }
  const groups = [
    ['d_spear', 'd_sword', 'd_archer'],
    ['h_levy', 'h_maa', 'h_bow', 'h_ladder'],
    ['o_grunt', 'o_goblin', 'o_jav', 'o_boss'],
  ];
  const ids = groups.flat();
  const cellW = 32, cellH = 30, LBL = 76; // css px
  const sc = 1.4;               // css px per world px
  const PX = sc * DPR;
  const A = buildAtlas(PX, ids.concat(['v_woman', 'v_man', 'v_child']));
  const FONT = '"Noto Serif KR","Gowun Batang","WenQuanYi Zen Hei",serif';
  g.fillStyle = '#231a14'; g.font = `700 17px ${FONT}`; g.textBaseline = 'alphabetic';
  g.fillText('축경 병사 도감 — 생성 프레임 시트', 16, 26);
  g.font = `12px ${FONT}`; g.fillStyle = '#3a2e24';
  g.fillText('코드로 만든 3D 뼈대를 정면·후면·측면으로 투영해 부팅 때 굽는다(서쪽은 측면 반전). 대기3·걷기4·공격3·피격1·쓰러짐3·오르기2·시신1 = 17프레임 × 4방향.', 290, 26);
  const anCols = ['대기', '', '', '걷기', '', '', '', '공격', '', '', '피격', '쓰러짐', '', '', '오르기', '', '시신'];
  const faceNm = ['정면', '후면', '측면'];
  const colX0 = [12, 652];
  let slot = 0;
  const blockH = 104;
  const facTone = { '할드미어 변경군': '#2c5d93', '아우렐 협약군': '#8f2a27', '애쉬터스크 군단': '#4f5f2e', '생활': '#6b5a40' };
  for (const id of ids) {
    const col = slot % 2, row = Math.floor(slot / 2);
    const x0 = colX0[col], y0 = 40 + row * blockH;
    const kd = KINDS[id];
    g.save(); g.beginPath(); g.rect(x0, y0, 628, blockH - 6); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0, y0, 628, blockH - 6);
    g.fillStyle = facTone[kd.fac]; g.fillRect(x0, y0, 3, blockH - 6);
    g.fillStyle = '#1e1712'; g.font = `700 12px ${FONT}`; g.fillText(kd.nm, x0 + 8, y0 + 16);
    g.font = `10px ${FONT}`; g.fillStyle = '#3a2e24'; g.fillText(kd.fac, x0 + 8, y0 + 29);
    for (let c = 0; c < NFR; c++) if (anCols[c]) { g.fillStyle = '#3a2e24'; g.fillText(anCols[c], x0 + LBL + c * cellW + 2, y0 + 10); }
    for (let f = 0; f < 3; f++) {
      g.fillStyle = '#4a3c30'; g.font = `10px ${FONT}`; g.fillText('▸ ' + faceNm[f], x0 + 8, y0 + (f === 0 ? 41 : 12 + f * cellH + 19));
      for (let c = 0; c < NFR; c++) {
        const cx = x0 + LBL + c * cellW, cy = y0 + 12 + f * cellH;
        g.fillStyle = (c + f) % 2 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.035)'; g.fillRect(cx, cy, cellW, cellH);
        // draw the baked frame so feet sit near the cell bottom
        const dw = A.cw / DPR, dh = A.ch / DPR;
        g.drawImage(A.pages[id], c * A.cw, f * A.ch, A.cw, A.ch, cx + cellW / 2 - AX * sc, cy + cellH - 3 - AY * sc, dw, dh);
      }
    }
    g.restore();
    slot++;
  }
  // life row: villagers and livestock
  const col = slot % 2, row = Math.floor(slot / 2);
  const x0 = colX0[col], y0 = 40 + row * blockH;
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0, y0, 628, blockH - 6);
  g.fillStyle = facTone['생활']; g.fillRect(x0, y0, 3, blockH - 6);
  g.fillStyle = '#1e1712'; g.font = `700 13px ${FONT}`; g.fillText('성 안의 삶', x0 + 8, y0 + 16);
  g.font = `10px ${FONT}`; g.fillStyle = '#3a2e24'; g.fillText('피란민·가축 (렌더 전용)', x0 + 8, y0 + 30);
  let cx = x0 + 150;
  for (const id of ['v_woman', 'v_man', 'v_child']) {
    for (const fr of [0, 3, 4, 5]) {
      for (const f of [0, 3]) {
        const dw = A.cw / DPR, dh = A.ch / DPR;
        g.drawImage(A.pages[id], fr * A.cw, f * A.ch, A.cw, A.ch, cx + cellW / 2 - AX * sc, y0 + 40 - AY * sc + (f ? cellH : 0), dw, dh);
      }
      cx += 25;
    }
  }
  const AN2 = buildAnimals(sc * 1.4 * DPR);
  let ax = cx + 6;
  AN2.types.forEach((ty, k) => {
    for (let fr = 0; fr < 4; fr++) {
      g.drawImage(AN2.page, fr * AN2.cw, k * 2 * AN2.ch, AN2.cw, AN2.ch, ax, y0 + 18 + (fr % 2) * 0, AN2.cw / DPR, AN2.ch / DPR);
      ax += AN2.cw / DPR - 4;
    }
  });
  window.__ready = true;
}
