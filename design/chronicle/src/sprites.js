// ============================================================================
// sprites: one rig for all humanoids (human / orc / goblin body plans), equipment
// layers, poses per animation; baked at boot into an atlas with a woodcut light pass
// (rim of warm light on the west edge, ink shade on the east edge, pigment block
// printed slightly off-register like a real two-block print).
// ============================================================================
const OL = 0.52;           // ink outline half-width (world px)
const MIS = [0.34, 0.24];  // pigment block misregistration (world px, screen space)

const BODY = {
  human: { hipY: -6.4, shY: -10.9, headR: 1.85, neck: 1.95, thigh: 3.45, shin: 3.3, ua: 2.75, fa: 2.6, shW: 4.3, hemY: -3.7, hemW: 5.5, legW: 1.5, armW: 1.25, hunch: 0.02, headFwd: 0.2 },
  orc: { hipY: -7.2, shY: -12.3, headR: 2.1, neck: 1.55, thigh: 3.8, shin: 3.7, ua: 3.3, fa: 3.2, shW: 6.6, hemY: -4.6, hemW: 6.4, legW: 2.05, armW: 1.9, hunch: 0.27, headFwd: 1.25 },
  goblin: { hipY: -3.8, shY: -6.7, headR: 2.25, neck: 1.85, thigh: 2.0, shin: 1.95, ua: 1.85, fa: 1.75, shW: 3.0, hemY: -2.3, hemW: 3.8, legW: 1.15, armW: 1.0, hunch: 0.2, headFwd: 0.65 },
};

// Unit kinds drawn in the prototype. side 0 = 할드미어 변경군 (ours), 1 = attackers.
const KINDS = [
  { id: 'd_spear', name: '창병', race: '할드미어 변경군', side: 0, body: 'human', wpn: 'spear', wlen: 18, back: 'roundShield', heads: ['nasal', 'kettle'], tunic: P.indigo, tunicLo: P.indigoLo, sleeve: P.indigo, legs: P.ink2, tabard: true },
  { id: 'd_sword', name: '방패검병', race: '할드미어 변경군', side: 0, body: 'human', wpn: 'sword', wlen: 6.2, shield: 'kite', heads: ['spangen', 'nasal'], tunic: P.indigo, tunicLo: P.indigoLo, sleeve: P.indigoLo, legs: P.ink2, tabard: true },
  { id: 'd_archer', name: '궁수', race: '할드미어 변경군', side: 0, body: 'human', wpn: 'bow', wlen: 13, back: 'quiver', heads: ['hood', 'band'], tunic: P.indigoHi, tunicLo: P.indigo, sleeve: P.indigoHi, legs: P.ink2, tabard: true },
  { id: 'h_levy', name: '징집병', race: '아우렐 협약군', side: 1, body: 'human', wpn: 'bill', wlen: 15, heads: ['hoodR', 'bare'], tunic: P.rust, tunicLo: P.rustLo, sleeve: P.rustLo, legs: P.woodLo, ragged: true },
  { id: 'h_maa', name: '중보병', race: '아우렐 협약군', side: 1, body: 'human', wpn: 'sword', wlen: 6.4, shield: 'heater', heads: ['kettleB', 'bascinet'], tunic: P.rust, tunicLo: P.rustLo, sleeve: P.stoneMid, legs: P.ink2, mail: true },
  { id: 'h_bow', name: '장궁병', race: '아우렐 협약군', side: 1, body: 'human', wpn: 'bow', wlen: 14, heads: ['capBrim', 'hoodR'], tunic: P.cream, tunicLo: P.rustHi, sleeve: P.cream, legs: P.woodLo, beltBadge: true },
  { id: 'h_ladder', name: '사다리조', race: '아우렐 협약군', side: 1, body: 'human', wpn: 'ladder', wlen: 0, heads: ['hoodR', 'bare'], tunic: P.rust, tunicLo: P.rustLo, sleeve: P.rustLo, legs: P.woodLo, ragged: true },
  { id: 'o_grunt', name: '오크 전사', race: '애쉬터스크 군단', side: 1, body: 'orc', wpn: 'cleaver', wlen: 8, heads: ['topknot', 'horned'], tunic: P.leather, tunicLo: P.fur, sleeve: null, skin: P.orc, skinLo: P.orcLo, legs: P.fur, mantle: true },
  { id: 'o_goblin', name: '고블린', race: '애쉬터스크 군단', side: 1, body: 'goblin', wpn: 'knife', wlen: 3.2, heads: ['ears', 'pot'], tunic: P.leather, tunicLo: P.fur, sleeve: null, skin: P.gob, skinLo: P.gobLo, legs: null, ragged: true },
  { id: 'd_folk', name: '성민', race: '할드미어 변경군', side: 0, body: 'human', wpn: 'bucket', wlen: 0, heads: ['kerchief', 'bare'], tunic: P.cream, tunicLo: P.paperDk, sleeve: P.cream, legs: P.woodLo, apron: true, folk: true },
  { id: 'o_berserk', name: '광전사', race: '애쉬터스크 군단', side: 1, body: 'orc', wpn: 'axe2', wlen: 5.5, heads: ['mohawk', 'bald'], tunic: null, tunicLo: P.fur, sleeve: null, skin: P.orc, skinLo: P.orcLo, legs: P.fur, bare: true, paint: true },
];
const KIDX = {}; KINDS.forEach((k, i) => (KIDX[k.id] = i));

const ANIMS = { idle: 2, walk: 4, attack: 3, hit: 1, die: 2, dead: 3, climb: 2 };
const ANIM_ORDER = ['idle', 'walk', 'attack', 'hit', 'die', 'dead', 'climb'];
const ANIM_KO = { idle: '대기', walk: '걷기', attack: '공격', hit: '피격', die: '쓰러짐', dead: '주검', climb: '오르기' };

// ---------------------------------------------------------------------------
function ik(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const md = l1 + l2 - 0.02;
  if (d > md) { const k = md / d; dx *= k; dy *= k; bx = ax + dx; by = ay + dy; d = md; }
  if (d < 0.05) d = 0.05;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + (dx * a) / d, my = ay + (dy * a) / d;
  return [mx + (bend * -dy * h) / d, my + (bend * dx * h) / d, bx, by];
}
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// Pose: everything in local space, facing +x, feet at y=0
function makePose(K, anim, f) {
  const B = BODY[K.body];
  const p = { lean: B.hunch, hx: 0, hy: B.hipY, ff: [1.3, 0], bf: [-1.1, 0], fh: null, bh: null, wa: 0, draw: 0, arrow: false, rot: 0, rx: 0, ry: 0, flat: false };
  const tl = B.hipY - B.shY;
  const w = K.wpn;
  // default hands (relative to shoulder centre, un-rotated)
  let fh = [1.3, 4.3], bh = [-0.6, 4.6];
  if (w === 'spear' || w === 'bill') { fh = [1.5, 3.6]; bh = [0.6, 4.9]; p.wa = -1.22; }
  else if (w === 'sword' || w === 'cleaver') { fh = [1.7, 4.4]; bh = [2.0, 3.1]; p.wa = 0.95; }
  else if (w === 'axe2') { fh = [1.9, 4.3]; bh = [-1.2, 4.2]; p.wa = 1.0; }
  else if (w === 'knife') { fh = [1.2, 2.6]; bh = [-0.5, 2.9]; p.wa = 0.35; }
  else if (w === 'bow') { fh = [2.2, 3.4]; bh = [0.4, 4.4]; p.wa = 0.45; }
  else if (w === 'ladder') { fh = [1.2, -2.6]; bh = [-1.0, -2.5]; }
  else if (w === 'bucket') { fh = [0.9, 5.4]; bh = [-0.9, 5.0]; }
  if (K.shield) bh = [2.2, 3.0];
  const sc = B === BODY.goblin ? 0.62 : B === BODY.orc ? 1.12 : 1;
  const S = (v) => [v[0] * sc, v[1] * sc];
  fh = S(fh); bh = S(bh);

  if (anim === 'idle') {
    p.hy += f ? 0.32 : 0; p.lean += f ? 0.035 : 0;
    if (w === 'bow') fh = S([2.2, 3.6 + f * 0.2]);
    else fh = [fh[0], fh[1] + f * 0.25];
  } else if (anim === 'walk') {
    const A = [2.3, 0.4, -1.9, 0.4][f] * sc, Bx = [-1.9, 0.4, 2.3, 0.4][f] * sc;
    const la = [0, 0, 0, 1.15][f] * sc, lb = [0, 1.15, 0, 0][f] * sc;
    p.ff = [A, -la]; p.bf = [Bx, -lb];
    p.hy += [0.15, -0.35, 0.15, -0.35][f] * sc; p.lean += 0.08;
    const sw = [0.9, 0, -0.9, 0][f] * sc;
    if (w === 'ladder') { fh = [fh[0] + sw * 0.2, fh[1]]; bh = [bh[0] + sw * 0.2, bh[1]]; }
    else { fh = [fh[0] - sw * 0.4, fh[1]]; if (!K.shield) bh = [bh[0] + sw, bh[1]]; }
  } else if (anim === 'attack') {
    if (w === 'spear' || w === 'bill') {
      const H = [[-2.4, 3.0, -0.6], [4.4, 2.2, 0.9], [2.4, 2.8, 0.35]][f];
      fh = S([H[0] + 1.6, H[1]]); bh = S([H[0] - 0.4, H[1] + 0.5]); p.wa = [0.06, 0.1, 0.02][f];
      p.hx = H[2] * sc; p.lean += [-0.06, 0.24, 0.1][f]; p.ff = [[1.8, 0], [3.2, 0], [2.4, 0]][f].map((v) => v * sc); p.bf = [-1.8 * sc, 0];
    } else if (w === 'sword' || w === 'cleaver' || w === 'axe2') {
      const big = w === 'cleaver' ? 1.25 : 1;
      fh = S([[-0.9 * big, -2.0 * big], [3.4, 2.0], [2.3, 4.3]][f]);
      p.wa = [-2.35 * (big > 1 ? 1.08 : 1), 0.28, 1.05][f];
      p.lean += [-0.1, 0.27, 0.12][f]; p.hx = [-0.5, 0.9, 0.4][f] * sc;
      p.ff = [[1.5, 0], [3.0, 0], [2.2, 0]][f].map((v) => v * sc); p.bf = [-1.7 * sc, 0];
      if (w === 'axe2') bh = S([[-1.6, -1.6], [2.6, 3.0], [1.0, 4.4]][(f + 1) % 3]);
      if (K.shield) bh = S([[2.0, 2.4], [1.2, 3.4], [2.0, 3.0]][f]);
    } else if (w === 'knife') {
      fh = S([[-0.8, 2.4], [3.6, 1.4], [2.0, 2.4]][f]); p.wa = [0.1, 0.02, 0.4][f];
      p.lean += [-0.05, 0.3, 0.12][f]; p.hx = [-0.4, 0.8, 0.3][f] * sc; p.ff = [[1.3, 0], [2.6, 0], [1.8, 0]][f].map((v) => v * sc);
    } else if (w === 'bow') {
      fh = S([[2.8, 1.2], [3.7, 0.7], [3.7, 0.7]][f]);
      bh = S([[2.0, 1.4], [-0.9, 0.1], [-1.9, 1.4]][f]);
      p.draw = [0.12, 1, 0][f]; p.arrow = f < 2; p.wa = -Math.PI / 2 + 0.12; p.lean += [0, -0.04, -0.02][f];
    } else if (w === 'ladder') {
      fh = S([1.6, -3.4]); bh = S([-0.4, -3.2]);
    }
  } else if (anim === 'hit') {
    p.lean -= 0.34; p.hx = -0.9 * sc; p.hy += 0.35 * sc; p.ff = [1.7 * sc, 0]; p.bf = [-1.5 * sc, 0];
    fh = [fh[0] - 0.6, fh[1] - 2.0]; p.wa -= 0.45;
  } else if (anim === 'die') {
    p.lean -= 0.55; p.hx = -1.3 * sc; p.hy += 1.6 * sc; p.ff = [1.3 * sc, 0]; p.bf = [-1.9 * sc, 0];
    fh = [fh[0] - 0.4, fh[1] - 3.2]; bh = [bh[0] - 1.6, bh[1] - 1.8]; p.wa += 0.8;
    if (f === 1) { p.rot = -0.8; p.rx = -1.4 * sc; p.ry = 0.6; }
  } else if (anim === 'dead') {
    p.flat = true;
    p.lean += [-0.2, 0.25, 0.6][f]; p.hy += [0.2, 0.2, 1.4][f] * sc;
    p.ff = [[1.8, 0], [1.4, -0.6], [2.4, -1.0]][f].map((v) => v * sc); p.bf = [[-1.4, 0], [-2.0, 0.6], [0.4, -0.8]][f].map((v) => v * sc);
    fh = S([[1.8, -1.2], [3.2, 2.0], [2.6, 3.4]][f]); bh = S([[-2.6, 0.6], [-1.2, 4.2], [1.6, 4.0]][f]);
    p.rot = [-1.5, 1.48, -1.35][f]; p.rx = [-0.5, 0.6, -0.2][f] * sc; p.ry = [-1.0, -1.2, -1.4][f];
    p.wa += [0.6, -0.4, 0.9][f];
  } else if (anim === 'climb') {
    p.lean = 0.12; p.hy += 0.4;
    const up = f === 0;
    fh = S(up ? [1.7, -3.4] : [1.4, -0.6]); bh = S(up ? [1.0, -0.8] : [1.2, -3.6]);
    p.ff = up ? [1.4 * sc, -2.2 * sc] : [0.7 * sc, 0]; p.bf = up ? [0.4 * sc, 0] : [1.3 * sc, -2.2 * sc];
  }
  p.fh = fh; p.bh = bh; p.tl = tl;
  return p;
}

// ---------------------------------------------------------------------------
// Drawing in local space (facing +x). `mis` = pigment offset in local coords.
function drawFigure(g, K, v, anim, f, dir) {
  const B = BODY[K.body];
  const p = makePose(K, anim, f);
  const mx = MIS[0] * dir, my = MIS[1];
  g.save();
  g.scale(dir, 1);
  if (p.rot) { g.translate(p.rx, p.ry); g.rotate(p.rot); }
  g.lineCap = 'round'; g.lineJoin = 'round';

  const hip = [p.hx, p.hy];
  const S0 = rot(0, -p.tl, p.lean); const sh = [hip[0] + S0[0], hip[1] + S0[1]];
  const H0 = rot(B.headFwd, -p.tl - B.neck - B.headR * 0.35, p.lean);
  const head = [hip[0] + H0[0], hip[1] + H0[1]];
  const fShoulder = [sh[0] + rot(0.7, 0.4, p.lean)[0], sh[1] + rot(0.7, 0.4, p.lean)[1]];
  const bShoulder = [sh[0] + rot(-0.9, 0.4, p.lean)[0], sh[1] + rot(-0.9, 0.4, p.lean)[1]];
  const fhand = [sh[0] + p.fh[0], sh[1] + p.fh[1]];
  const bhand = [sh[0] + p.bh[0], sh[1] + p.bh[1]];

  const pigment = (fn, col) => { if (!col) return; g.save(); g.translate(mx, my); fn(); g.fillStyle = col; g.fill(); g.restore(); };
  const inkStroke = (fn, w = OL * 2) => { fn(); g.strokeStyle = P.ink; g.lineWidth = w; g.stroke(); };
  const limb = (pts, w, col) => {
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    path(); g.strokeStyle = P.ink; g.lineWidth = w + OL * 2; g.stroke();
    if (col) { g.save(); g.translate(mx, my); path(); g.strokeStyle = col; g.lineWidth = w * 0.92; g.stroke(); g.restore(); }
  };
  const leg = (hipOff, foot, col) => {
    const hj = [hip[0] + hipOff, hip[1]];
    const k = ik(hj[0], hj[1], foot[0], foot[1], B.thigh, B.shin, -1);
    limb([hj, [k[0], k[1]], [k[2], k[3]]], B.legW, col);
    // boot / foot
    g.beginPath(); g.ellipse(k[2] + 0.55, k[3] - 0.35, B.legW * 0.75, B.legW * 0.42, 0, 0, Math.PI * 2);
    g.fillStyle = P.ink; g.fill();
  };
  const arm = (shp, hand, col, w = B.armW) => {
    const k = ik(shp[0], shp[1], hand[0], hand[1], B.ua, B.fa, 1);
    limb([shp, [k[0], k[1]], [k[2], k[3]]], w, col);
    const sk = K.skin || P.skin;
    g.beginPath(); g.arc(k[2], k[3], w * 0.5, 0, Math.PI * 2); g.fillStyle = P.ink; g.fill();
    g.beginPath(); g.arc(k[2] + mx * 0.6, k[3] + my * 0.6, w * 0.3, 0, Math.PI * 2); g.fillStyle = sk; g.fill();
    return [k[2], k[3]];
  };
  const armCol = K.sleeve || K.skin;
  const legCol = K.legs || K.skin;

  // ---- back leg, back arm, back gear
  leg(-0.45, p.bf, legCol ? mix(legCol, P.ink, 0.25) : null);
  if (K.back === 'quiver' && anim !== 'dead') {
    const q0 = [sh[0] - 1.6, sh[1] - 1.2], q1 = [hip[0] - 1.9, hip[1] - 0.2];
    limb([q0, q1], 1.3, P.wood);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(q0[0] - 0.4 + i * 0.45, q0[1]); g.lineTo(q0[0] - 0.7 + i * 0.5, q0[1] - 1.3); g.strokeStyle = P.paperHi; g.lineWidth = 0.45; g.stroke(); }
  }
  const bArm = arm(bShoulder, bhand, armCol ? mix(armCol, P.ink, 0.3) : null);
  if (K.back === 'roundShield') {
    const c = [sh[0] - 1.9, sh[1] + 2.2];
    pigment(() => { g.beginPath(); g.arc(c[0], c[1], 2.4, 0, 7); }, P.indigoLo);
    g.beginPath(); g.arc(c[0], c[1], 2.4, 0, 7); g.strokeStyle = P.ink; g.lineWidth = OL * 2; g.stroke();
    g.beginPath(); g.arc(c[0], c[1], 1.75, -2.2, 0.3); g.strokeStyle = P.paperHi; g.lineWidth = 0.4; g.stroke();
  }
  if (K.wpn === 'axe2') drawWeapon(g, K, 'axe', bArm, p.wa + 0.6, mx, my);

  // ---- front leg
  leg(0.45, p.ff, legCol);

  // ---- torso
  const tl = p.tl, hd = B.hemY - B.hipY;
  const tpts = [
    [-B.shW * 0.5, -tl], [B.shW * 0.42, -tl], [B.shW * 0.5 + 0.25, -tl * 0.55], [B.hemW * 0.42, -tl * 0.12],
    [B.hemW * 0.5, hd], [B.hemW * 0.18, hd + 0.35], [-B.hemW * 0.2, hd + 0.2], [-B.hemW * 0.5, hd], [-B.shW * 0.55 - 0.15, -tl * 0.25],
  ].map((q) => { const r = rot(q[0], q[1], p.lean); return [hip[0] + r[0], hip[1] + r[1]]; });
  if (K.ragged) {
    // zig-zag hem: replace the bottom edge
    const a = tpts[4], b = tpts[7];
    const zz = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5; zz.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + (i % 2 ? -0.75 : 0.35)]); }
    tpts.splice(4, 4, ...zz);
  }
  const torsoPath = () => poly(g, tpts);
  const torsoCol = K.bare ? K.skin : K.tunic;
  pigment(torsoPath, torsoCol);
  if (K.mail) { // mail skirt: dotted
    g.save(); torsoPath(); g.clip();
    g.fillStyle = hexA(P.ink, 0.55);
    for (let yy = -tl * 0.3; yy < hd + 0.5; yy += 0.75) for (let xx = -3.2; xx < 3.2; xx += 0.75) {
      const r = rot(xx + ((yy * 4) % 1.5) * 0.25, yy, p.lean); g.fillRect(hip[0] + r[0], hip[1] + r[1], 0.32, 0.32);
    }
    g.restore();
  }
  if (K.tabard && anim !== 'dead') { // white tabard band (blue-and-white = our colours)
    const t0 = rot(B.shW * 0.1, -tl + 0.4, p.lean), t1 = rot(B.hemW * 0.12, hd - 0.2, p.lean);
    limb([[hip[0] + t0[0], hip[1] + t0[1]], [hip[0] + t1[0], hip[1] + t1[1]]], 1.25, P.paperHi);
  }
  if (K.mantle) { // fur mantle on orc shoulders
    const m = [];
    for (let i = 0; i <= 7; i++) { const t = i / 7; const xx = -B.shW * 0.62 + t * B.shW * 1.18; m.push(rot(xx, -tl - 0.6 + (i % 2 ? 1.6 : 0.4), p.lean)); }
    const mp = () => { g.beginPath(); m.forEach((q, i) => (i ? g.lineTo(hip[0] + q[0], hip[1] + q[1]) : g.moveTo(hip[0] + q[0], hip[1] + q[1]))); const e = rot(B.shW * 0.5, -tl - 1.2, p.lean), s = rot(-B.shW * 0.6, -tl - 1.0, p.lean); g.lineTo(hip[0] + e[0], hip[1] + e[1]); g.lineTo(hip[0] + s[0], hip[1] + s[1]); g.closePath(); };
    pigment(mp, P.fur); inkStroke(mp, OL * 1.6);
  }
  if (K.paint) { // berserker war paint
    for (let i = 0; i < 3; i++) { const a = rot(-1.6 + i * 1.3, -tl * 0.75, p.lean), b = rot(-0.6 + i * 1.3, -tl * 0.25, p.lean); limb([[hip[0] + a[0], hip[1] + a[1]], [hip[0] + b[0], hip[1] + b[1]]], 0.45, P.cinnabar); }
    const kb = rot(0, hd - 0.6, p.lean); // fur kilt
    const kp = () => { g.beginPath(); g.ellipse(hip[0] + kb[0], hip[1] + kb[1], B.hemW * 0.55, 1.4, p.lean, 0, 7); };
    pigment(kp, P.fur); inkStroke(kp, OL * 1.4);
  }
  // belt
  { const a = rot(-B.shW * 0.55, -tl * 0.2, p.lean), b = rot(B.hemW * 0.45, -tl * 0.12, p.lean); g.beginPath(); g.moveTo(hip[0] + a[0], hip[1] + a[1]); g.lineTo(hip[0] + b[0], hip[1] + b[1]); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke(); }
  if (K.apron && anim !== 'dead') { const a = rot(B.shW * 0.12, -tl * 0.35, p.lean), b = rot(B.hemW * 0.2, hd + 0.1, p.lean); limb([[hip[0] + a[0], hip[1] + a[1]], [hip[0] + b[0], hip[1] + b[1]]], 2.0, P.paperHi); }
  if (K.beltBadge) { const c = rot(B.shW * 0.1, -tl * 0.7, p.lean); g.beginPath(); g.arc(hip[0] + c[0], hip[1] + c[1], 0.6, 0, 7); g.fillStyle = P.gold; g.fill(); }
  inkStroke(torsoPath);
  // shade line down the back
  { const a = rot(-B.shW * 0.25, -tl * 0.85, p.lean), b = rot(-B.hemW * 0.3, hd - 0.3, p.lean); g.beginPath(); g.moveTo(hip[0] + a[0], hip[1] + a[1]); g.lineTo(hip[0] + b[0], hip[1] + b[1]); g.strokeStyle = hexA(P.ink, 0.45); g.lineWidth = 0.4; g.stroke(); }

  // ---- head
  drawHead(g, K, v, head, B.headR, p, mx, my);

  // ---- weapon + front arm
  const wpn = K.wpn;
  if (wpn === 'ladder') drawLadderCarry(g, sh, mx, my);
  if (wpn === 'bow') {
    drawBow(g, K, fhand, bhand, p, mx, my);
  } else if (wpn !== 'ladder' && !(anim === 'climb')) {
    drawWeapon(g, K, wpn === 'axe2' ? 'axe' : wpn, fhand, p.wa, mx, my);
  } else if (anim === 'climb' && wpn !== 'ladder') {
    // weapon slung on the back while climbing
    const a = [sh[0] - 1.5, sh[1] - 2], b = [hip[0] - 1.8, hip[1] + 1.5];
    limb([a, b], 0.5, P.wood);
  }
  arm(fShoulder, fhand, armCol);
  if (K.shield) drawShield(g, K, bhand, p, mx, my, anim);
  g.restore();
}

function drawHead(g, K, v, c, r, p, mx, my) {
  const type = K.heads[v % K.heads.length];
  const skin = K.skin || P.skin;
  const x = c[0], y = c[1];
  const faceP = () => { g.beginPath(); if (K.body === 'orc') { g.ellipse(x + 0.15, y + 0.15, r * 1.05, r * 0.98, 0, 0, 7); } else g.arc(x, y, r, 0, 7); };
  g.save(); g.translate(mx, my); faceP(); g.fillStyle = skin; g.fill(); g.restore();
  faceP(); g.strokeStyle = P.ink; g.lineWidth = OL * 2; g.stroke();
  // eye
  g.beginPath(); g.arc(x + r * 0.5, y - r * 0.05, Math.max(0.22, r * 0.14), 0, 7); g.fillStyle = P.ink; g.fill();
  const fillInk = (fn) => { fn(); g.fillStyle = P.ink; g.fill(); };
  const pig = (fn, col) => { g.save(); g.translate(mx, my); fn(); g.fillStyle = col; g.fill(); g.restore(); fn(); g.strokeStyle = P.ink; g.lineWidth = OL * 2; g.stroke(); };
  switch (type) {
    case 'nasal':
      fillInk(() => { g.beginPath(); g.moveTo(x - r * 1.08, y + r * 0.12); g.quadraticCurveTo(x - r * 1.0, y - r * 1.2, x - r * 0.05, y - r * 1.7); g.quadraticCurveTo(x + r * 0.95, y - r * 1.1, x + r * 1.05, y + r * 0.08); g.closePath(); });
      g.beginPath(); g.moveTo(x + r * 0.92, y - r * 0.1); g.lineTo(x + r * 1.0, y + r * 0.75); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke();
      break;
    case 'kettle':
      fillInk(() => { g.beginPath(); g.arc(x, y - r * 0.2, r * 1.02, Math.PI, 0); g.closePath(); });
      g.beginPath(); g.moveTo(x - r * 1.75, y - r * 0.05); g.quadraticCurveTo(x, y - r * 0.45, x + r * 1.75, y + r * 0.05); g.strokeStyle = P.ink; g.lineWidth = 0.75; g.stroke();
      break;
    case 'spangen':
      fillInk(() => { g.beginPath(); g.ellipse(x, y - r * 0.3, r * 1.08, r * 1.22, 0, Math.PI, 0); g.closePath(); });
      g.beginPath(); g.moveTo(x, y - r * 1.5); g.lineTo(x, y - r * 0.3); g.strokeStyle = P.goldHi; g.lineWidth = 0.4; g.stroke();
      g.beginPath(); g.moveTo(x + r * 0.8, y - r * 0.2); g.lineTo(x + r * 0.82, y + r * 0.6); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
      break;
    case 'hood': case 'hoodR': {
      const col = type === 'hood' ? K.tunic : P.rust;
      pig(() => { g.beginPath(); g.moveTo(x + r * 0.95, y + r * 1.0); g.quadraticCurveTo(x + r * 1.2, y - r * 1.3, x - r * 0.1, y - r * 1.28); g.quadraticCurveTo(x - r * 1.5, y - r * 1.1, x - r * 2.3, y + r * 0.7); g.lineTo(x - r * 0.9, y + r * 1.35); g.closePath(); }, col);
      g.beginPath(); g.ellipse(x + r * 0.42, y + r * 0.12, r * 0.55, r * 0.72, 0, 0, 7); g.fillStyle = skin; g.fill();
      g.beginPath(); g.arc(x + r * 0.62, y - r * 0.02, Math.max(0.2, r * 0.13), 0, 7); g.fillStyle = P.ink; g.fill();
      break;
    }
    case 'kerchief': // a cinnabar headscarf knotted at the nape: townsfolk, never soldiers
      pig(() => { g.beginPath(); g.moveTo(x + r * 0.9, y - r * 0.2); g.quadraticCurveTo(x + r * 0.6, y - r * 1.35, x - r * 0.3, y - r * 1.2); g.quadraticCurveTo(x - r * 1.3, y - r * 0.9, x - r * 1.15, y + r * 0.3); g.lineTo(x - r * 1.9, y + r * 0.9); g.lineTo(x - r * 1.0, y + r * 0.6); g.closePath(); }, P.cinnabar);
      break;
    case 'band':
      fillInk(() => { g.beginPath(); g.moveTo(x - r * 1.05, y + r * 0.5); g.quadraticCurveTo(x - r * 1.2, y - r * 1.25, x + r * 0.2, y - r * 1.12); g.quadraticCurveTo(x + r * 1.0, y - r * 0.9, x + r * 0.9, y - r * 0.35); g.lineTo(x - r * 0.3, y - r * 0.45); g.closePath(); });
      g.beginPath(); g.moveTo(x - r * 1.0, y - r * 0.35); g.lineTo(x + r * 0.95, y - r * 0.5); g.strokeStyle = P.paperHi; g.lineWidth = 0.55; g.stroke();
      break;
    case 'bare':
      fillInk(() => { g.beginPath(); g.moveTo(x - r * 1.1, y + r * 0.6); for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.05 + i * 0.16); const rr = r * (i % 2 ? 1.28 : 1.05); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.lineTo(x + r * 0.2, y - r * 0.5); g.lineTo(x - r * 0.5, y); g.closePath(); });
      g.beginPath(); g.moveTo(x + r * 0.2, y + r * 0.75); g.quadraticCurveTo(x + r * 0.7, y + r * 1.3, x + r * 1.0, y + r * 0.55); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
      break;
    case 'kettleB':
      fillInk(() => { g.beginPath(); g.arc(x, y - r * 0.25, r * 1.05, Math.PI, 0); g.closePath(); });
      g.beginPath(); g.moveTo(x - r * 2.0, y + r * 0.15); g.quadraticCurveTo(x, y - r * 0.55, x + r * 2.0, y + r * 0.2); g.strokeStyle = P.ink; g.lineWidth = 0.9; g.stroke();
      break;
    case 'bascinet':
      fillInk(() => { g.beginPath(); g.moveTo(x - r * 1.1, y + r * 0.9); g.quadraticCurveTo(x - r * 1.25, y - r * 1.2, x - r * 0.4, y - r * 1.75); g.quadraticCurveTo(x + r * 1.3, y - r * 0.6, x + r * 1.6, y + r * 0.35); g.lineTo(x + r * 0.6, y + r * 1.0); g.closePath(); });
      g.beginPath(); g.moveTo(x + r * 0.1, y - r * 0.15); g.lineTo(x + r * 1.15, y - r * 0.05); g.strokeStyle = P.paperHi; g.lineWidth = 0.35; g.stroke();
      break;
    case 'capBrim':
      pig(() => { g.beginPath(); g.ellipse(x - r * 0.1, y - r * 0.55, r * 1.12, r * 0.75, -0.15, Math.PI * 0.95, Math.PI * 2.05); g.closePath(); }, P.cream);
      g.beginPath(); g.moveTo(x - r * 0.4, y - r * 0.3); g.lineTo(x + r * 1.9, y - r * 0.15); g.strokeStyle = P.ink; g.lineWidth = 0.65; g.stroke();
      g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.9); g.quadraticCurveTo(x - r * 2.0, y - r * 2.1, x - r * 2.6, y - r * 1.5); g.strokeStyle = P.paperHi; g.lineWidth = 0.6; g.stroke();
      break;
    case 'topknot': case 'horned': case 'mohawk': case 'bald': {
      // heavy brow + jaw with tusk
      g.beginPath(); g.moveTo(x + r * 0.05, y - r * 0.35); g.lineTo(x + r * 1.05, y - r * 0.25); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
      g.beginPath(); g.moveTo(x + r * 0.55, y + r * 0.7); g.lineTo(x + r * 0.9, y + r * 0.05); g.lineTo(x + r * 1.0, y + r * 0.72); g.closePath(); g.fillStyle = P.bone; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.3; g.stroke();
      if (type === 'topknot') fillInk(() => { g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.85); g.quadraticCurveTo(x - r * 0.9, y - r * 2.0, x - r * 0.1, y - r * 2.1); g.quadraticCurveTo(x - r * 1.6, y - r * 2.6, x - r * 1.8, y - r * 1.4); g.lineTo(x - r * 0.95, y - r * 0.55); g.closePath(); });
      if (type === 'horned') {
        fillInk(() => { g.beginPath(); g.arc(x, y - r * 0.2, r * 1.06, Math.PI, 0); g.closePath(); });
        g.beginPath(); g.moveTo(x - r * 0.7, y - r * 0.9); g.quadraticCurveTo(x - r * 2.2, y - r * 1.3, x - r * 1.9, y - r * 2.6); g.lineWidth = 0.9; g.strokeStyle = P.ink; g.stroke(); g.lineWidth = 0.5; g.strokeStyle = P.bone; g.stroke();
      }
      if (type === 'mohawk') {
        fillInk(() => { g.beginPath(); g.moveTo(x - r * 1.0, y - r * 0.6); for (let i = 0; i < 5; i++) { const a = Math.PI * (1.08 + i * 0.2); g.lineTo(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0); g.lineTo(x + Math.cos(a + 0.3) * r * 1.85, y + Math.sin(a + 0.3) * r * 1.85); } g.lineTo(x + r * 0.6, y - r * 0.8); g.closePath(); });
      }
      if (type === 'mohawk' || type === 'bald') { g.beginPath(); g.moveTo(x - r * 0.2, y - r * 0.1); g.lineTo(x + r * 1.0, y); g.strokeStyle = P.cinnabar; g.lineWidth = 0.55; g.stroke(); }
      break;
    }
    case 'ears': case 'pot': {
      // long ear (back), nose (front)
      const ear = () => { g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.2); g.lineTo(x - r * 2.6, y - r * 1.15); g.lineTo(x - r * 0.65, y + r * 0.45); g.closePath(); };
      g.save(); g.translate(mx, my); ear(); g.fillStyle = skin; g.fill(); g.restore(); ear(); g.strokeStyle = P.ink; g.lineWidth = OL * 1.6; g.stroke();
      g.beginPath(); g.moveTo(x + r * 0.85, y - r * 0.15); g.lineTo(x + r * 1.55, y + r * 0.3); g.lineTo(x + r * 0.8, y + r * 0.45); g.fillStyle = skin; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.35; g.stroke();
      if (type === 'pot') fillInk(() => { g.beginPath(); g.moveTo(x - r * 1.1, y - r * 0.15); g.lineTo(x - r * 0.9, y - r * 1.25); g.lineTo(x + r * 0.95, y - r * 1.25); g.lineTo(x + r * 1.15, y - r * 0.15); g.closePath(); });
      break;
    }
  }
}

function drawWeapon(g, K, w, hand, a, mx, my) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const [x, y] = hand;
  if (w === 'spear' || w === 'bill') {
    const L = K.wlen, b = [x - ca * L * 0.34, y - sa * L * 0.34], t = [x + ca * L * 0.66, y + sa * L * 0.66];
    g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(t[0], t[1]); g.strokeStyle = P.ink; g.lineWidth = 0.75; g.stroke();
    g.beginPath(); g.moveTo(b[0] + mx, b[1] + my); g.lineTo(t[0] + mx, t[1] + my); g.strokeStyle = P.woodHi; g.lineWidth = 0.28; g.stroke();
    // blade
    const n = [-sa, ca];
    const tip = [t[0] + ca * 2.6, t[1] + sa * 2.6];
    g.beginPath(); g.moveTo(t[0] + n[0] * 0.7, t[1] + n[1] * 0.7); g.lineTo(tip[0], tip[1]); g.lineTo(t[0] - n[0] * 0.7, t[1] - n[1] * 0.7); g.closePath();
    g.fillStyle = P.paperHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.38; g.stroke();
    if (w === 'bill') { g.beginPath(); g.moveTo(t[0] - ca * 0.6, t[1] - sa * 0.6); g.quadraticCurveTo(t[0] - n[0] * 2.2, t[1] - n[1] * 2.2, t[0] - n[0] * 1.6 - ca * 1.6, t[1] - n[1] * 1.6 - sa * 1.6); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke(); }
    // pennon on our spears: a single indigo tongue
    if (K.side === 0) { g.beginPath(); g.moveTo(t[0] - ca * 0.6, t[1] - sa * 0.6); g.lineTo(t[0] - ca * 0.6 - n[0] * 0 - 1.8, t[1] - sa * 0.6 + 0.9); g.lineTo(t[0] - ca * 1.9, t[1] - sa * 1.9); g.closePath(); g.fillStyle = P.indigo; g.fill(); }
  } else if (w === 'sword') {
    const L = K.wlen, t = [x + ca * L, y + sa * L];
    g.beginPath(); g.moveTo(x, y); g.lineTo(t[0], t[1]); g.strokeStyle = P.ink; g.lineWidth = 1.15; g.stroke();
    g.beginPath(); g.moveTo(x + ca * 0.6, y + sa * 0.6); g.lineTo(t[0] - ca * 0.3, t[1] - sa * 0.3); g.strokeStyle = P.paperHi; g.lineWidth = 0.42; g.stroke();
    const n = [-sa, ca];
    g.beginPath(); g.moveTo(x + n[0] * 1.1, y + n[1] * 1.1); g.lineTo(x - n[0] * 1.1, y - n[1] * 1.1); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
  } else if (w === 'cleaver' || w === 'axe') {
    const L = w === 'axe' ? 5.4 : K.wlen, t = [x + ca * L, y + sa * L], n = [-sa, ca];
    g.beginPath(); g.moveTo(x - ca * 1.2, y - sa * 1.2); g.lineTo(t[0], t[1]); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
    const bw = w === 'axe' ? 2.0 : 2.8, bl = w === 'axe' ? 2.0 : 3.6;
    const b0 = [t[0] - ca * bl, t[1] - sa * bl];
    g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(t[0], t[1]); g.lineTo(t[0] + n[0] * bw, t[1] + n[1] * bw); g.quadraticCurveTo(b0[0] + n[0] * bw * 1.4, b0[1] + n[1] * bw * 1.4, b0[0] + n[0] * bw * 0.8 - ca * 0.6, b0[1] + n[1] * bw * 0.8 - sa * 0.6); g.closePath();
    g.fillStyle = P.stoneMid; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
    g.beginPath(); g.moveTo(t[0] + n[0] * bw * 0.9, t[1] + n[1] * bw * 0.9); g.quadraticCurveTo(b0[0] + n[0] * bw * 1.3, b0[1] + n[1] * bw * 1.3, b0[0] + n[0] * bw * 0.75, b0[1] + n[1] * bw * 0.75); g.strokeStyle = P.paperHi; g.lineWidth = 0.4; g.stroke();
  } else if (w === 'bucket') {
    // a wooden pail on a rope handle, slopping water
    const bx = x + 0.2, by = y + 1.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(bx - 1.0, by); g.moveTo(x, y); g.lineTo(bx + 1.0, by); g.strokeStyle = P.ink; g.lineWidth = 0.3; g.stroke();
    g.beginPath(); g.moveTo(bx - 1.3, by); g.lineTo(bx + 1.3, by); g.lineTo(bx + 1.0, by + 2.3); g.lineTo(bx - 1.0, by + 2.3); g.closePath();
    g.fillStyle = P.woodHi; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.4; g.stroke();
    g.beginPath(); g.moveTo(bx - 1.2, by + 0.9); g.lineTo(bx + 1.2, by + 0.9); g.strokeStyle = P.ink; g.lineWidth = 0.3; g.stroke();
  } else if (w === 'knife') {
    const L = K.wlen, t = [x + ca * L, y + sa * L];
    g.beginPath(); g.moveTo(x, y); g.lineTo(t[0], t[1]); g.strokeStyle = P.ink; g.lineWidth = 0.9; g.stroke();
    g.beginPath(); g.moveTo(x + ca * 0.8, y + sa * 0.8); g.lineTo(t[0], t[1]); g.strokeStyle = P.paperHi; g.lineWidth = 0.3; g.stroke();
  }
}

function drawBow(g, K, bowHand, drawHand, p, mx, my) {
  const L = K.wlen * 0.5;
  // bow is held by the front hand; limbs bend back toward the archer
  const a = p.wa, ca = Math.cos(a), sa = Math.sin(a);
  const top = [bowHand[0] + ca * L, bowHand[1] + sa * L], bot = [bowHand[0] - ca * L, bowHand[1] - sa * L];
  const bend = 2.0 + p.draw * 1.3;
  const n = [sa, -ca]; // points forward (away from the archer) when wa ~ -90deg
  const ctl = [bowHand[0] + n[0] * bend * 1.25, bowHand[1] + n[1] * bend * 1.25];
  g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(ctl[0], ctl[1], bot[0], bot[1]);
  g.strokeStyle = P.ink; g.lineWidth = 0.95; g.stroke();
  g.beginPath(); g.moveTo(top[0] + mx, top[1] + my); g.quadraticCurveTo(ctl[0] + mx, ctl[1] + my, bot[0] + mx, bot[1] + my); g.strokeStyle = P.woodHi; g.lineWidth = 0.35; g.stroke();
  // string
  g.beginPath(); g.moveTo(top[0], top[1]);
  if (p.draw > 0.2) g.lineTo(drawHand[0], drawHand[1]);
  g.lineTo(bot[0], bot[1]);
  g.strokeStyle = hexA(P.ink, 0.85); g.lineWidth = 0.28; g.stroke();
  if (p.arrow) {
    const s = p.draw > 0.2 ? drawHand : [bowHand[0] - 1.6, bowHand[1]];
    const e = [bowHand[0] + 2.4, bowHand[1] - 0.15];
    g.beginPath(); g.moveTo(s[0], s[1]); g.lineTo(e[0], e[1]); g.strokeStyle = P.ink; g.lineWidth = 0.4; g.stroke();
    g.beginPath(); g.moveTo(e[0] + 0.9, e[1]); g.lineTo(e[0] - 0.2, e[1] - 0.5); g.lineTo(e[0] - 0.2, e[1] + 0.5); g.closePath(); g.fillStyle = P.ink; g.fill();
  }
}

function drawShield(g, K, hand, p, mx, my, anim) {
  const [x, y] = hand;
  g.save(); g.translate(x + 0.3, y + 0.4); g.rotate(p.lean * 0.5 + (anim === 'dead' ? 0.4 : 0));
  if (K.shield === 'kite') {
    const path = () => { g.beginPath(); g.moveTo(-2.2, -3.0); g.quadraticCurveTo(0, -3.7, 2.2, -3.0); g.quadraticCurveTo(2.4, 1.6, 0, 5.0); g.quadraticCurveTo(-2.4, 1.6, -2.2, -3.0); g.closePath(); };
    g.save(); g.translate(mx, my); path(); g.fillStyle = P.paperHi; g.fill();
    g.save(); path(); g.clip(); g.beginPath(); g.moveTo(-3, 1.3); g.lineTo(0, -1.4); g.lineTo(3, 1.3); g.lineTo(3, 3.0); g.lineTo(0, 0.4); g.lineTo(-3, 3.0); g.closePath(); g.fillStyle = P.indigo; g.fill(); g.restore();
    g.restore();
    path(); g.strokeStyle = P.ink; g.lineWidth = OL * 2.3; g.stroke();
  } else {
    const path = () => { g.beginPath(); g.moveTo(-2.1, -2.6); g.lineTo(2.1, -2.6); g.quadraticCurveTo(2.3, 1.2, 0, 3.6); g.quadraticCurveTo(-2.3, 1.2, -2.1, -2.6); g.closePath(); };
    g.save(); g.translate(mx, my); path(); g.fillStyle = P.rust; g.fill();
    g.beginPath(); g.arc(0, -0.3, 1.05, 0, 7); g.fillStyle = P.gold; g.fill();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 1.25, -0.3 + Math.sin(a) * 1.25); g.lineTo(Math.cos(a) * 1.75, -0.3 + Math.sin(a) * 1.75); g.strokeStyle = P.gold; g.lineWidth = 0.35; g.stroke(); }
    g.restore();
    path(); g.strokeStyle = P.ink; g.lineWidth = OL * 2.3; g.stroke();
  }
  g.restore();
}

function drawLadderCarry(g, sh, mx, my) {
  const y = sh[1] - 3.1;
  g.lineCap = 'butt';
  for (const yy of [y, y + 1.5]) { g.beginPath(); g.moveTo(-8, yy); g.lineTo(9, yy - 0.4); g.strokeStyle = P.ink; g.lineWidth = 0.85; g.stroke(); g.beginPath(); g.moveTo(-8 + mx, yy + my); g.lineTo(9 + mx, yy - 0.4 + my); g.strokeStyle = P.woodHi; g.lineWidth = 0.32; g.stroke(); }
  for (let x = -7; x <= 8; x += 2.4) { g.beginPath(); g.moveTo(x, y - 0.1); g.lineTo(x, y + 1.5); g.strokeStyle = P.ink; g.lineWidth = 0.45; g.stroke(); }
  g.lineCap = 'round';
}

// ---------------------------------------------------------------------------
// Woodcut light pass on a finished cell: warm rim inside the lit (west, upper) edge,
// ink shade inside the east/lower edge. Same rule for every frame of every kind, so the
// light can never disagree between sprites (anti-generic checklist #7).
const _lp = { a: null, b: null };
function lightPass(c, s, rimA = 0.85, shadeA = 0.32) {
  const w = c.width, h = c.height;
  if (!_lp.a || _lp.a.width < w || _lp.a.height < h) { _lp.a = mkCanvas(w, h); _lp.b = mkCanvas(w, h); }
  const A = _lp.a.getContext('2d'), Bc = _lp.b.getContext('2d');
  const o1 = Math.max(1, Math.round(0.55 * s)), o2 = o1 + Math.max(1, Math.round(0.6 * s)), o3 = o1 + Math.max(1, Math.round(0.85 * s));
  // shade band (lower-right)
  Bc.clearRect(0, 0, w, h); Bc.globalCompositeOperation = 'source-over'; Bc.drawImage(c, 0, 0);
  Bc.globalCompositeOperation = 'destination-in'; Bc.drawImage(c, -o1, -Math.round(o1 * 0.6));
  Bc.globalCompositeOperation = 'destination-out'; Bc.drawImage(c, -o3, -Math.round(o3 * 0.6));
  Bc.globalCompositeOperation = 'source-in'; Bc.fillStyle = P.ink; Bc.fillRect(0, 0, w, h);
  // rim band (upper-left)
  A.clearRect(0, 0, w, h); A.globalCompositeOperation = 'source-over'; A.drawImage(c, 0, 0);
  A.globalCompositeOperation = 'destination-in'; A.drawImage(c, o1, Math.round(o1 * 0.6));
  A.globalCompositeOperation = 'destination-out'; A.drawImage(c, o2, Math.round(o2 * 0.6));
  A.globalCompositeOperation = 'source-in'; A.fillStyle = '#F7E6BF'; A.fillRect(0, 0, w, h);
  const g = c.getContext('2d');
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = shadeA; g.drawImage(_lp.b, 0, 0, w, h, 0, 0, w, h);
  g.globalAlpha = rimA; g.drawImage(_lp.a, 0, 0, w, h, 0, 0, w, h);
  g.restore();
  A.globalCompositeOperation = 'source-over'; Bc.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------------------
// Atlas: lazily generated frames packed into pages. key -> {img, sx, sy, sw, sh, ax, ay}
class Atlas {
  constructor(scale, cellW, cellH, ax, ay) {
    this.s = scale; this.cw = Math.ceil(cellW * scale); this.ch = Math.ceil(cellH * scale);
    this.ax = ax * scale; this.ay = ay * scale; this.cellW = cellW; this.cellH = cellH; this.axw = ax; this.ayw = ay;
    this.pages = []; this.map = new Map(); this.col = 0; this.row = 0; this.perRow = Math.floor(ATLAS_PAGE / this.cw); this.rows = Math.floor(ATLAS_PAGE / this.ch);
    this.tmp = mkCanvas(this.cw, this.ch); this.generated = 0; this.genMs = 0;
  }
  // after the loading-time print run, pages become immutable ImageBitmaps (cheaper to blit on every browser)
  async freeze() {
    if (typeof createImageBitmap !== 'function') return;
    const bm = await Promise.all(this.pages.map((p) => createImageBitmap(p)));
    for (const r of this.map.values()) { const i = this.pages.indexOf(r.img); if (i >= 0) r.img = bm[i]; }
    this.pages = this.pages.map(() => null); this.row = this.rows; // new frames start a fresh page
  }
  slot() {
    if (!this.pages.length || this.row >= this.rows) { const c = mkCanvas(this.perRow * this.cw, this.rows * this.ch); this.pages.push(c); this.col = 0; this.row = 0; }
    const page = this.pages[this.pages.length - 1];
    const r = { img: page, sx: this.col * this.cw, sy: this.row * this.ch, sw: this.cw, sh: this.ch, ax: this.ax, ay: this.ay };
    if (++this.col >= this.perRow) { this.col = 0; this.row++; }
    return r;
  }
  get(key, drawFn, post) {
    let r = this.map.get(key);
    if (r) return r;
    const t0 = performance.now();
    const c = this.tmp, g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(this.s, 0, 0, this.s, this.ax, this.ay);
    drawFn(g);
    lightPass(c, this.s);
    if (post) { g.setTransform(1, 0, 0, 1, 0, 0); post(c, g); }
    r = this.slot();
    const pg = r.img.getContext('2d'); pg.drawImage(c, r.sx, r.sy);
    this.map.set(key, r); this.generated++; this.genMs += performance.now() - t0;
    return r;
  }
}

let ATLAS = null, BIG = null;
const ATLAS_PAGE = +(new URLSearchParams(location.search).get("page") || 1024);
const ANIM_IDX = { idle: 0, walk: 1, attack: 2, hit: 3, die: 4, dead: 5, climb: 6 };
function unitFrame(k, v, anim, f, dir) {
  const key = k * 100000 + v * 10000 + ANIM_IDX[anim] * 1000 + f * 10 + (dir > 0 ? 1 : 0);
  const hit = ATLAS.map.get(key); if (hit) return hit; // hot path: no closures
  return ATLAS.get(key, (g) => drawFigure(g, KINDS[k], v, anim, f, dir), (c, g) => { if (anim === 'hit') flashPost(c, g); if (anim !== 'climb') shadowPost(c, g, k); });
}
// the contact shadow is printed into the plate itself (behind the figure): one blit per soldier, not two
function shadowPost(c, g, k) {
  const A = ATLAS, L = KINDS[k].body === 'goblin' ? 5 : 8;
  g.setTransform(A.s, 0, 0, A.s, A.ax, A.ay);
  g.globalCompositeOperation = 'destination-over'; g.fillStyle = 'rgba(38,40,58,0.24)';
  g.beginPath(); g.ellipse(L * 0.42, -0.2, L * 0.62, 1.35, -0.27, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over'; g.setTransform(1, 0, 0, 1, 0, 0);
}
// The dead keep only their ink: pigment drains out of a fallen body; the blood stays red.
const _ink = { c: null };
function inkPost(c, g) {
  if (!_ink.c || _ink.c.width !== c.width || _ink.c.height !== c.height) _ink.c = mkCanvas(c.width, c.height);
  const k = _ink.c.getContext('2d'); k.clearRect(0, 0, c.width, c.height); k.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(214,206,190,0.38)'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in'; g.drawImage(_ink.c, 0, 0);
  g.globalCompositeOperation = 'source-over';
}
// a hit frame is printed lighter: the paper shows through for a beat (1–2 frames of flash)
function flashPost(c, g) {
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(250,240,220,0.42)'; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
}
function corpseFrame(k, v, pose, dir) {
  const key = -1 - (k * 100000 + v * 10000 + pose * 10 + (dir > 0 ? 1 : 0));
  const hit = ATLAS.map.get(key); if (hit) return hit;
  return ATLAS.get(key, (g) => drawFigure(g, KINDS[k], v, 'dead', pose, dir), inkPost);
}

// ---------------------------------------------------------------------------
// Big things: the orc log ram (part rig: shed + swinging log), ladders, banners
function drawRamShed(g, state) {
  const wreck = state === 'wreck';
  g.lineCap = 'round'; g.lineJoin = 'round';
  const mx = MIS[0], my = MIS[1];
  // wheels
  for (const wx of [-12, 10]) {
    const cx = wx, cy = -3.8, r = wreck && wx > 0 ? 3.0 : 3.8;
    g.save(); g.translate(mx, my); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = P.wood; g.fill(); g.restore();
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * 1.047 + (wx > 0 ? 0.3 : 0); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.strokeStyle = P.ink; g.lineWidth = 0.45; g.stroke(); }
    g.beginPath(); g.arc(cx, cy, 0.9, 0, 7); g.fillStyle = P.ink; g.fill();
  }
  // base beam
  g.beginPath(); g.moveTo(-20, -6); g.lineTo(20, -6); g.strokeStyle = P.ink; g.lineWidth = 2.2; g.stroke();
  g.beginPath(); g.moveTo(-20 + mx, -6 + my); g.lineTo(20 + mx, -6 + my); g.strokeStyle = P.woodLo; g.lineWidth = 1.0; g.stroke();
  // roof of hides
  const roof = wreck
    ? [[-21, -6], [-15, -14], [2, -11], [9, -16], [19, -6]]
    : [[-21, -6], [-16.5, -19.5], [15, -19.5], [20.5, -6]];
  const rp = () => poly(g, roof);
  g.save(); g.translate(mx, my); rp(); g.fillStyle = wreck ? P.ink2 : P.leather; g.fill(); g.restore();
  g.save(); rp(); g.clip();
  // hide patches + stitches
  const patches = [[-19, -17, 12, 11, P.rust], [-6, -19, 11, 9, P.fur], [4, -18, 14, 12, P.rustLo], [-12, -11, 13, 6, P.wood]];
  for (const [x, y, w, h, c] of patches) {
    g.fillStyle = wreck ? mix(c, P.ink, 0.6) : c; g.fillRect(x, y, w, h);
    g.beginPath(); for (let i = 0; i < w; i += 1.6) { g.moveTo(x + i, y - 0.5); g.lineTo(x + i + 0.7, y + 0.6); } g.strokeStyle = P.ink; g.lineWidth = 0.3; g.stroke();
  }
  hatch(g, -22, -10, 22, -5, -0.5, 1.1, 0.35, P.ink, 0.55, 3);
  if (!wreck) { // a red hand: the horde's mark
    g.fillStyle = P.cinnabar; g.beginPath(); g.ellipse(0, -13.2, 1.5, 1.8, 0, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) { g.fillRect(-1.6 + i * 0.95, -16.6, 0.55, 2.2); }
  }
  g.restore();
  rp(); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke();
  if (!wreck) {
    // bone skull on the ridge
    g.beginPath(); g.arc(13.5, -21.2, 1.7, 0, 7); g.fillStyle = P.bone; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.5; g.stroke();
    g.fillStyle = P.ink; g.fillRect(13.6, -21.6, 0.6, 0.6); g.fillRect(14.4, -21.6, 0.6, 0.6);
    g.beginPath(); g.moveTo(-17, -19.5); g.quadraticCurveTo(-19, -23, -16.5, -25); g.strokeStyle = P.bone; g.lineWidth = 0.9; g.stroke();
  } else {
    // charred broken rafters
    g.beginPath(); g.moveTo(-8, -12); g.lineTo(-3, -21); g.moveTo(5, -13); g.lineTo(12, -22); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke();
  }
}
function drawRamLog(g) {
  const mx = MIS[0], my = MIS[1];
  g.save(); g.translate(mx, my); g.beginPath(); g.roundRect(-14, -11.6, 34, 3.6, 1.6); g.fillStyle = P.wood; g.fill(); g.restore();
  g.beginPath(); g.roundRect(-14, -11.6, 34, 3.6, 1.6); g.strokeStyle = P.ink; g.lineWidth = 0.8; g.stroke();
  g.beginPath(); for (let x = -12; x < 17; x += 3.4) { g.moveTo(x, -10.6); g.lineTo(x + 2.0, -10.2); } g.strokeStyle = P.ink; g.lineWidth = 0.35; g.stroke();
  // iron boar head with bone tusks
  g.beginPath(); g.moveTo(19, -12.4); g.lineTo(24.5, -10.4); g.lineTo(24.5, -9.2); g.lineTo(19, -7.2); g.closePath(); g.fillStyle = P.ink; g.fill();
  g.beginPath(); g.moveTo(22.5, -9.0); g.quadraticCurveTo(25.8, -8.2, 26, -11.5); g.strokeStyle = P.bone; g.lineWidth = 0.7; g.stroke();
  g.fillStyle = P.cinnabar; g.fillRect(21.0, -11.1, 0.8, 0.8);
}

// Banners: a pole + a flag in 3 wave frames. Emblems are drawn from a fixed rule per squad
// (anti-generic #9: the same heraldry everywhere it appears: field, card, chronicle).
const EMBLEMS = {
  hawk: { field: P.indigo, charge: P.paperHi, name: '회색매' },
  chevron: { field: P.paperHi, charge: P.indigo, name: '브란' },
  reed: { field: P.indigo, charge: P.paperHi, name: '갈대피리' },
  wheel: { field: P.paperHi, charge: P.indigoLo, name: '물레' },
  sun: { field: P.rust, charge: P.gold, name: '협약' },
  hand: { field: P.bone, charge: P.cinnabar, name: '군단' },
};
function drawEmblem(g, kind, w, h) {
  const E = EMBLEMS[kind];
  g.fillStyle = E.field; g.fillRect(0, 0, w, h);
  g.fillStyle = E.charge; g.strokeStyle = E.charge;
  const cx = w / 2, cy = h / 2, u = Math.min(w, h);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'hawk') {
    g.beginPath(); g.moveTo(cx - u * 0.42, cy - u * 0.1); g.quadraticCurveTo(cx - u * 0.18, cy - u * 0.05, cx, cy + u * 0.22); g.quadraticCurveTo(cx + u * 0.18, cy - u * 0.05, cx + u * 0.42, cy - u * 0.1); g.quadraticCurveTo(cx + u * 0.2, cy + u * 0.12, cx + u * 0.05, cy + u * 0.32); g.lineTo(cx - u * 0.05, cy + u * 0.32); g.quadraticCurveTo(cx - u * 0.2, cy + u * 0.12, cx - u * 0.42, cy - u * 0.1); g.fill();
    g.beginPath(); g.arc(cx, cy - u * 0.07, u * 0.07, 0, 7); g.fill();
  } else if (kind === 'chevron') {
    g.beginPath(); g.moveTo(0, cy + u * 0.32); g.lineTo(cx, cy - u * 0.18); g.lineTo(w, cy + u * 0.32); g.lineTo(w, cy + u * 0.55); g.lineTo(cx, cy + u * 0.05); g.lineTo(0, cy + u * 0.55); g.closePath(); g.fill();
    g.fillStyle = P.cinnabar; g.beginPath(); g.arc(cx, cy - u * 0.32, u * 0.08, 0, 7); g.fill();
  } else if (kind === 'reed') {
    g.fillStyle = P.paperHi; g.fillRect(cx, 0, w / 2, h);
    g.lineWidth = u * 0.07; g.strokeStyle = P.paperHi; g.beginPath(); g.moveTo(cx - u * 0.18, h); g.quadraticCurveTo(cx - u * 0.2, cy, cx - u * 0.05, u * 0.12); g.stroke();
    g.strokeStyle = P.indigo; g.beginPath(); g.moveTo(cx + u * 0.18, h); g.quadraticCurveTo(cx + u * 0.22, cy, cx + u * 0.08, u * 0.12); g.stroke();
  } else if (kind === 'wheel') {
    g.lineWidth = u * 0.07; g.beginPath(); g.arc(cx, cy, u * 0.3, 0, 7); g.stroke();
    for (let i = 0; i < 6; i++) { const a = i * 1.047; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * u * 0.3, cy + Math.sin(a) * u * 0.3); g.stroke(); }
  } else if (kind === 'sun') {
    g.beginPath(); g.arc(cx, cy, u * 0.2, 0, 7); g.fill();
    g.lineWidth = u * 0.06; for (let i = 0; i < 12; i++) { const a = i * 0.5236; g.beginPath(); g.moveTo(cx + Math.cos(a) * u * 0.26, cy + Math.sin(a) * u * 0.26); g.lineTo(cx + Math.cos(a) * u * 0.4, cy + Math.sin(a) * u * 0.4); g.stroke(); }
  } else if (kind === 'hand') {
    g.beginPath(); g.ellipse(cx, cy + u * 0.1, u * 0.18, u * 0.2, 0, 0, 7); g.fill();
    for (let i = 0; i < 4; i++) g.fillRect(cx - u * 0.2 + i * u * 0.11, cy - u * 0.32, u * 0.07, u * 0.3);
    g.beginPath(); g.ellipse(cx + u * 0.22, cy, u * 0.06, u * 0.15, -0.6, 0, 7); g.fill();
  }
}
function drawBanner(g, emblem, frame, sag) {
  // pole
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -24); g.strokeStyle = P.ink; g.lineWidth = 1.0; g.stroke();
  g.beginPath(); g.moveTo(0, -24); g.lineTo(0, -25.6); g.strokeStyle = P.gold; g.lineWidth = 1.1; g.stroke();
  const w = 10, h = 6.4, ph = frame * 2.1;
  // flag as a waving quad; drawn through a clip of the flag shape
  const top = (t) => -23 + sag * t * 2 + Math.sin(ph + t * 3.2) * 0.8 * t;
  const bot = (t) => -23 + h + sag * t * 2.6 + Math.sin(ph + t * 3.2 + 0.4) * 0.8 * t;
  const shape = () => { g.beginPath(); g.moveTo(0.5, top(0)); for (let i = 1; i <= 8; i++) { const t = i / 8; g.lineTo(0.5 + w * t, top(t)); } g.lineTo(0.5 + w - 1.6, (top(1) + bot(1)) / 2); g.lineTo(0.5 + w, bot(1)); for (let i = 8; i >= 0; i--) { const t = i / 8; g.lineTo(0.5 + w * t, bot(t)); } g.closePath(); };
  g.save(); g.translate(MIS[0], MIS[1]); shape(); g.clip();
  g.translate(0.5, -23 + sag); drawEmblem(g, emblem, w, h + sag * 2.6);
  g.restore();
  // fold shading
  g.save(); shape(); g.clip();
  for (let i = 0; i < 3; i++) { const t = 0.25 + i * 0.3; const x = 0.5 + w * t; g.beginPath(); g.moveTo(x, top(t)); g.lineTo(x + 0.4, bot(t)); g.strokeStyle = hexA(P.ink, Math.sin(ph + t * 3.2) > 0 ? 0.28 : 0.08); g.lineWidth = 1.4; g.stroke(); }
  g.restore();
  shape(); g.strokeStyle = P.ink; g.lineWidth = 0.65; g.stroke();
}
function drawTotem(g, frame) {
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0.4, -24); g.strokeStyle = P.ink; g.lineWidth = 1.2; g.stroke();
  // crossbar with hanging hide
  g.beginPath(); g.moveTo(-4.5, -20); g.lineTo(5, -21); g.stroke();
  const sw = Math.sin(frame * 2.1) * 0.6;
  g.save(); g.translate(MIS[0], MIS[1]);
  g.beginPath(); g.moveTo(-4, -20); g.lineTo(4.5, -21); g.lineTo(4 + sw, -13); g.lineTo(1 + sw, -14.5); g.lineTo(-1 + sw, -12.5); g.lineTo(-3.6 + sw, -14); g.closePath(); g.fillStyle = P.bone; g.fill(); g.restore();
  g.beginPath(); g.moveTo(-4, -20); g.lineTo(4.5, -21); g.lineTo(4 + sw, -13); g.lineTo(1 + sw, -14.5); g.lineTo(-1 + sw, -12.5); g.lineTo(-3.6 + sw, -14); g.closePath(); g.strokeStyle = P.ink; g.lineWidth = 0.6; g.stroke();
  g.fillStyle = P.cinnabar; g.beginPath(); g.ellipse(0.3 + sw * 0.5, -16.4, 1.3, 1.5, 0, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) g.fillRect(-1.0 + i * 0.75 + sw * 0.5, -19.4, 0.45, 1.9);
  // skull on top + tusks
  g.beginPath(); g.arc(0.4, -25.6, 2.0, 0, 7); g.fillStyle = P.bone; g.fill(); g.strokeStyle = P.ink; g.lineWidth = 0.55; g.stroke();
  g.fillStyle = P.ink; g.fillRect(-0.5, -26.1, 0.7, 0.8); g.fillRect(0.8, -26.1, 0.7, 0.8);
  g.beginPath(); g.moveTo(-1.4, -24.5); g.quadraticCurveTo(-3.4, -24.0, -3.6, -26.8); g.moveTo(2.2, -24.5); g.quadraticCurveTo(4.2, -24.0, 4.4, -26.8); g.strokeStyle = P.bone; g.lineWidth = 0.7; g.stroke();
}
