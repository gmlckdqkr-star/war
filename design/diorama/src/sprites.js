// ============================================================================
// sprites: a tiny 3D rig per body plan, projected to 3 facings (+1 mirrored),
// baked at boot into one atlas page per unit kind. Dye = palette parameter.
// ============================================================================
const OUTLINE = '#24180f';
const PALS = {
  // Haldmere March (defenders): cool steel-blue + cream, light values
  realm: { cloth: '#2c5d93', clothD: '#1c3c63', trim: '#efe2bf', sleeve: '#9aa3ad', hose: '#353a46', boot: '#4a3222', metal: '#c9cfd5', metalD: '#7b838c', skin: '#e2b58c', hair: '#5a3a24', wood: '#8a5e36', leather: '#6b4a2e', emb: '#efe2bf' },
  realmA: { cloth: '#e4d5ae', clothD: '#b8a57a', trim: '#2c5d93', sleeve: '#d6c69e', hose: '#353a46', boot: '#4a3222', metal: '#c9cfd5', metalD: '#7b838c', skin: '#e2b58c', hair: '#5a3a24', wood: '#8a5e36', leather: '#6b4a2e', hood: '#2c5d93', emb: '#2c5d93' },
  // Aurel Concord (humans): crimson + ivory, mid values
  aurel: { cloth: '#a12f2b', clothD: '#641b1c', trim: '#e6d6b0', sleeve: '#878b92', hose: '#4a3426', boot: '#33241a', metal: '#b4b8bd', metalD: '#6a6f76', skin: '#d8a47c', hair: '#3a2618', wood: '#7a5230', leather: '#5a3a22', emb: '#e6d6b0' },
  aurelL: { cloth: '#8c4334', clothD: '#5c2b21', trim: '#d9c9a3', sleeve: '#8c4334', hose: '#5a4a3a', boot: '#33241a', metal: '#a9adb2', metalD: '#6a6f76', skin: '#d29d74', hair: '#3a2618', wood: '#7a5230', leather: '#5a3a22', cap: '#d9c9a3', emb: '#d9c9a3' },
  aurelB: { cloth: '#a12f2b', clothD: '#641b1c', trim: '#e6d6b0', sleeve: '#6e5638', hose: '#4a3426', boot: '#33241a', metal: '#b4b8bd', metalD: '#6a6f76', skin: '#d8a47c', hair: '#3a2618', wood: '#7a5230', leather: '#5a3a22', hat: '#5b4630', emb: '#e6d6b0' },
  // Ashtusk Horde (orcs, goblins): lichen green skin, dark leather, bone, rust paint, dark values
  orc: { cloth: '#7b3a22', clothD: '#4f2519', trim: '#ddd2b0', sleeve: '#7d9152', hose: '#47301f', boot: '#2b1e16', metal: '#8f8d86', metalD: '#55534e', skin: '#7d9152', skinD: '#566937', hair: '#231b16', wood: '#6e4b2c', leather: '#47301f', paint: '#b8392a', emb: '#b8392a' },
  orc2: { cloth: '#5d4a36', clothD: '#3d3024', trim: '#ddd2b0', sleeve: '#7d9152', hose: '#47301f', boot: '#2b1e16', metal: '#8f8d86', metalD: '#55534e', skin: '#748a4b', skinD: '#506232', hair: '#231b16', wood: '#6e4b2c', leather: '#47301f', paint: '#b8392a', emb: '#b8392a' },
  orcB: { cloth: '#8a201b', clothD: '#5a1512', trim: '#ddd2b0', sleeve: '#4f5056', hose: '#2f2a26', boot: '#201812', metal: '#55565c', metalD: '#2f3034', skin: '#6a7d44', skinD: '#4a5a2c', hair: '#1a1410', wood: '#5a3a22', leather: '#3a2618', paint: '#c23a28', emb: '#ddd2b0' },
  gob: { cloth: '#5e3f26', clothD: '#3f2a19', trim: '#a08a5a', sleeve: '#5e3f26', hose: '#3f2a19', boot: '#2b1e16', metal: '#9a978e', metalD: '#5a5853', skin: '#a9a84a', skinD: '#7b7a30', hair: '#2a2016', wood: '#6e4b2c', leather: '#47301f', hood: '#4d3420', emb: '#a08a5a' },
  // villagers (render-only life): muted, never steel-blue
  vW: { cloth: '#8b6a3c', clothD: '#5e4626', trim: '#e7dcc0', sleeve: '#d9cba8', hose: '#5e4626', boot: '#3a2a1c', skin: '#e0b28a', hair: '#4a2f1d', scarf: '#9c5a5a', wood: '#7a5230', leather: '#5a3a22', emb: '#e7dcc0' },
  vM: { cloth: '#6b7553', clothD: '#495037', trim: '#c9b98f', sleeve: '#6b7553', hose: '#5a4632', boot: '#3a2a1c', skin: '#d29d74', hair: '#6a6258', wood: '#7a5230', leather: '#5a3a22', emb: '#c9b98f' },
  vC: { cloth: '#a8693f', clothD: '#73482b', trim: '#e7dcc0', sleeve: '#a8693f', hose: '#5e4626', boot: '#3a2a1c', skin: '#e6b892', hair: '#7a4a24', wood: '#7a5230', leather: '#5a3a22', emb: '#e7dcc0' },
};
const BODY = {
  human: { hip: 4.3, su: 8.5, sh: 2.35, hw: 1.15, hr: 2.1, hu: 10.75, td: 1.3, leg: 1.85, arm: 1.55, hunch: 0, sc: 1 },
  orc: { hip: 4.0, su: 8.7, sh: 3.15, hw: 1.5, hr: 2.2, hu: 10.35, td: 1.8, leg: 2.25, arm: 2.05, hunch: 0.9, sc: 1.04 },
  orcbig: { hip: 4.0, su: 8.7, sh: 3.25, hw: 1.55, hr: 2.25, hu: 10.4, td: 1.9, leg: 2.3, arm: 2.15, hunch: 0.8, sc: 1.2 },
  goblin: { hip: 2.6, su: 5.7, sh: 1.75, hw: 0.95, hr: 2.3, hu: 8.0, td: 1.1, leg: 1.45, arm: 1.2, hunch: 0.5, sc: 1 },
  child: { hip: 2.9, su: 5.8, sh: 1.6, hw: 0.9, hr: 1.95, hu: 7.7, td: 1.0, leg: 1.4, arm: 1.15, hunch: 0, sc: 1 },
};
// unit kinds (stats used by the prototype sim; names match src/sim/defs.ts where they exist)
const KINDS = {
  d_spear: { nm: '창병', fac: '할드미어 변경군', pal: 'realm', body: 'human', helm: 'kettle', wc: 'spear', side: 0, hp: 100, atk: 10, cd: 1.1, spd: 26, reach: 15 },
  d_sword: { nm: '방패검병', fac: '할드미어 변경군', pal: 'realm', body: 'human', helm: 'kettle', wc: 'sword', sh: 'heater', side: 0, hp: 130, atk: 11, cd: 1.0, spd: 25, reach: 13 },
  d_archer: { nm: '궁수', fac: '할드미어 변경군', pal: 'realmA', body: 'human', helm: 'hood', wc: 'bow', quiver: 1, side: 0, hp: 75, atk: 10, cd: 1.7, spd: 26, reach: 9, range: 300 },
  h_levy: { nm: '징집병', fac: '아우렐 협약군', pal: 'aurelL', body: 'human', helm: 'cap', wc: 'bill', side: 1, hp: 70, atk: 7, cd: 1.2, spd: 21, reach: 13 },
  h_maa: { nm: '중보병', fac: '아우렐 협약군', pal: 'aurel', body: 'human', helm: 'sallet', wc: 'sword', sh: 'round', side: 1, hp: 115, atk: 11, cd: 1.0, spd: 19, reach: 13 },
  h_bow: { nm: '장궁병', fac: '아우렐 협약군', pal: 'aurelB', body: 'human', helm: 'hat', wc: 'longbow', quiver: 1, side: 1, hp: 65, atk: 8, cd: 2.0, spd: 21, reach: 9, range: 260 },
  h_ladder: { nm: '사다리조', fac: '아우렐 협약군', pal: 'aurelL', body: 'human', helm: 'hood2', wc: 'hatchet', carry: 1, side: 1, hp: 75, atk: 7, cd: 1.2, spd: 20, reach: 11 },
  o_grunt: { nm: '오크 전사', fac: '애쉬터스크 군단', pal: 'orc', body: 'orc', helm: 'orcband', wc: 'axe', sh: 'buckler', side: 1, hp: 125, atk: 12, cd: 1.0, spd: 22, reach: 13 },
  o_goblin: { nm: '고블린', fac: '애쉬터스크 군단', pal: 'gob', body: 'goblin', helm: 'gobhood', wc: 'knife', side: 1, hp: 40, atk: 5, cd: 0.9, spd: 30, reach: 11 },
  o_jav: { nm: '투창병', fac: '애쉬터스크 군단', pal: 'orc2', body: 'orc', helm: 'mohawk', wc: 'javelin', bundle: 1, side: 1, hp: 100, atk: 14, cd: 2.4, spd: 22, reach: 11, range: 120 },
  o_boss: { nm: '군단장', fac: '애쉬터스크 군단', pal: 'orcB', body: 'orcbig', helm: 'crest', wc: 'cleaver', trophy: 1, side: 1, hp: 480, atk: 24, cd: 1.0, spd: 21, reach: 15 },
  v_woman: { nm: '피란민', fac: '생활', pal: 'vW', body: 'human', helm: 'scarf', wc: 'bundle', side: 2 },
  v_man: { nm: '노인', fac: '생활', pal: 'vM', body: 'human', helm: 'bald', wc: 'staff', side: 2 },
  v_child: { nm: '아이', fac: '생활', pal: 'vC', body: 'child', helm: 'hair', wc: 'none', side: 2 },
};
const KIND_IDS = Object.keys(KINDS);
const AN = { idle: [0, 3], walk: [3, 4], atk: [7, 3], hit: [10, 1], die: [11, 3], climb: [14, 2], corpse: [16, 1] };
const NFR = 17;
const CW = 30, CH = 30, AX = 15, AY = 24; // atlas cell in world units, anchor at the feet

// ---------- vector helpers ----------
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sc: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  nrm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
function prj(f, p) {
  if (f === 0) return [-p[0], -p[1] + p[2] * 0.42, p[2]];
  if (f === 1) return [p[0], -p[1] - p[2] * 0.42, -p[2]];
  return [p[2], -p[1] + p[0] * 0.42, p[0]];
}

// ---------- poses ----------
function poseFor(kd, B, anim, i) {
  const su = B.su, sh = B.sh;
  const P = {
    bob: 0, lean: B.hunch * 0.12, sway: 0,
    fl: [-B.hw - 0.15, 0, 0.3], fr: [B.hw + 0.15, 0, -0.2],
    hr: [sh + 0.4, su - 3.1, 0.5], hl: [-sh - 0.4, su - 3.1, 0.5],
    w: null, shield: !!kd.sh, rot: 0, drop: 0, headTilt: 0, slung: false, nock: 0, carry: false,
  };
  const wc = kd.wc;
  // walk cycle
  if (anim === 'walk') {
    const F = [[1.6, 0, -1.4, 0], [0.1, 0.9, 0.1, 0], [-1.4, 0, 1.6, 0], [0.1, 0, 0.1, 0.9]][i];
    P.fl = [-B.hw - 0.1, F[3], F[0]]; P.fr = [B.hw + 0.1, F[1], F[2]];
    P.bob = [0, 0.45, 0, 0.45][i];
    P.hl[2] = 0.5 - F[0] * 0.55; P.hr[2] = 0.5 - F[2] * 0.55;
    P.lean += 0.06;
  } else if (anim === 'idle') {
    P.bob = [0, 0.25, 0.05][i];
    if (i === 2) { P.sway = 0.35; P.headTilt = 0.18; P.fr = [B.hw + 0.35, 0, 0.1]; }
    if (i === 1) { P.hr[1] += 0.2; P.hl[1] += 0.2; }
  } else if (anim === 'hit') {
    P.lean = -0.32; P.bob = 0.2;
    P.hr = [sh + 1.3, su - 0.8, -0.7]; P.hl = [-sh - 1.3, su - 0.9, -0.6];
    P.fl = [-B.hw - 0.2, 0, -0.4]; P.fr = [B.hw + 0.2, 0, -0.9];
  } else if (anim === 'die') {
    P.lean = -0.5; P.bob = -0.8;
    P.hr = [sh + 1.5, su - 0.4, -1.0]; P.hl = [-sh - 1.2, su - 1.6, -0.8];
    P.fl = [-B.hw - 0.4, 0, 0.6]; P.fr = [B.hw + 0.5, 0, -0.2];
    P.rot = [0.18, 0.95, 1.5708][i]; P.drop = [0, 1.2, 2.0][i];
    if (i === 2) { P.hr = [sh + 1.8, su - 1.6, 0.2]; P.hl = [-sh - 1.6, su - 2.4, 0.4]; P.lean = -0.2; P.bob = -0.4; }
  } else if (anim === 'climb') {
    const up = i === 0;
    P.hr = [sh * 0.75, su + (up ? 2.9 : 1.6), 1.0]; P.hl = [-sh * 0.75, su + (up ? 1.6 : 2.9), 1.0];
    P.fl = [-B.hw, up ? 0 : 1.8, 0.6]; P.fr = [B.hw, up ? 1.8 : 0, 0.6];
    P.lean = 0.1; P.slung = true; P.shield = false;
  }
  // weapon class poses
  const S = (grip, dir, back, fwd, type) => ({ grip, dir: V.nrm(dir), back, fwd, type });
  if (wc === 'spear' || wc === 'bill') {
    let grip = P.hr, dir = [0.05, 1, 0.14];
    if (anim === 'walk') dir = [0.05, 1, 0.32];
    if (anim === 'atk') {
      const A = [[[sh - 0.1, su - 1.5, -1.2], wc === 'bill' ? [0, 0.8, 0.6] : [0, -0.15, 1], -0.08],
                 [[sh - 0.7, su - 1.9, 2.9], [0, -0.3, 1], 0.24],
                 [[sh, su - 2.1, 1.1], [0, 0.3, 1], 0.07]][i];
      grip = A[0]; dir = A[1]; P.lean = A[2] + B.hunch * 0.12;
      if (i === 1) { P.fl = [-B.hw - 0.1, 0, 1.9]; P.fr = [B.hw + 0.1, 0, -1.3]; }
      P.hr = grip; P.hl = V.add(grip, V.sc(V.nrm(dir), 3.4));
    }
    if (anim === 'hit') { grip = P.hr; dir = [0.3, 1, -0.4]; }
    if (anim === 'die') { grip = P.hr; dir = [0.8, 0.6, -0.3]; }
    if (anim === 'climb') { grip = [0.2, su - 0.5, -1.5]; dir = [0.7, 1, -0.2]; }
    P.w = S(grip, dir, 4.6, 10.2, wc);
  } else if (wc === 'sword' || wc === 'axe' || wc === 'hatchet' || wc === 'knife' || wc === 'cleaver') {
    let grip = P.hr, dir = [0.15, 0.85, 0.55];
    if (anim === 'walk') dir = [0.2, 0.7, 0.7];
    if (anim === 'atk') {
      const big = wc === 'cleaver' || wc === 'axe';
      const A = [[[sh + 0.2, su + (big ? 2.6 : 2.0), -0.7], [0, 0.55, -0.85], -0.12],
                 [[sh - 0.8, su - 3.0, 2.7], [-0.15, -0.6, 0.8], 0.26],
                 [[sh, su - 2.4, 1.4], [0.1, 0.2, 1], 0.08]][i];
      grip = A[0]; dir = A[1]; P.lean = A[2] + B.hunch * 0.12;
      P.hr = grip;
      if (i === 1) { P.fl = [-B.hw - 0.1, 0, 1.7]; P.fr = [B.hw + 0.1, 0, -1.1]; }
      if (wc === 'cleaver') P.hl = V.add(grip, [-0.4, -0.6, 0.2]);
    }
    if (anim === 'hit') { grip = P.hr; dir = [0.4, 0.7, -0.5]; }
    if (anim === 'die') { grip = P.hr; dir = [0.9, 0.3, -0.3]; }
    if (anim === 'climb') { grip = [0.6, P.hip, -1.2]; dir = [0.2, -1, 0]; }
    if (wc === 'hatchet' && anim !== 'atk') { grip = [B.hw + 0.9, B.hip + 0.3, 0.2]; dir = [0.1, -1, 0.15]; }
    if (kd.carry && anim === 'walk') { P.hr = [sh * 0.9, su + 2.7, 0.2]; P.hl = [-sh * 0.9, su + 2.7, 0.2]; P.carry = true; }
    const L = { sword: 6.0, axe: 6.4, hatchet: 4.2, knife: 3.0, cleaver: 7.4 }[wc];
    P.w = S(grip, dir, wc === 'cleaver' ? 2.4 : 0.6, L, wc);
  } else if (wc === 'bow' || wc === 'longbow') {
    P.hl = [-sh - 0.2, su - 2.9, 0.9];
    if (anim === 'atk') {
      P.hl = [-sh + 1.0, su + 0.5, 2.7];
      P.hr = [[-sh + 1.3, su + 0.4, 2.1], [sh - 0.3, su + 1.0, -0.6], [sh + 0.7, su + 1.4, -1.7]][i];
      P.nock = i < 2 ? 1 : 0; P.lean = 0.05;
      P.fl = [-B.hw - 0.3, 0, 0.9]; P.fr = [B.hw + 0.3, 0, -0.8];
    }
    if (anim === 'climb') P.slung = true;
    P.w = { type: wc, grip: P.hl, L: wc === 'longbow' ? 5.6 : 4.4, pull: anim === 'atk' && i < 2 ? P.hr : null };
  } else if (wc === 'javelin') {
    let grip = [sh + 0.2, su + 0.4, -0.3], dir = [0, 0.35, 0.94], show = true;
    if (anim === 'atk') {
      if (i === 0) { grip = [sh + 0.4, su + 1.3, -2.1]; dir = [0, 0.25, 1]; P.lean = -0.1; }
      if (i === 1) { grip = [sh - 0.8, su + 0.3, 2.5]; show = false; P.lean = 0.24; P.fl = [-B.hw, 0, 1.7]; P.fr = [B.hw, 0, -1.2]; }
      if (i === 2) { grip = [sh, su - 2.0, 1.0]; show = false; }
    }
    if (anim === 'die' || anim === 'climb') show = false;
    P.hr = grip;
    P.w = show ? S(grip, dir, 4.0, 7.0, 'javelin') : null;
  } else if (wc === 'bundle') {
    P.hr = [0.9, su - 3.6, 1.4]; P.hl = [-0.9, su - 3.6, 1.4]; P.w = { type: 'sack' };
  } else if (wc === 'staff') {
    P.w = S([sh + 0.5, su - 2.8, 1.0], [0.05, 1, 0.25], 4.8, 2.6, 'staff'); P.hr = P.w.grip; P.lean += 0.18;
  }
  P.hip = B.hip;
  return P;
}

// ---------- the figure painter ----------
function paintFigure(g, kd, anim, i, f) {
  const B = BODY[kd.body], C = PALS[kd.pal];
  const P = poseFor(kd, B, anim, i);
  const hipU = B.hip + P.bob;
  const cl = Math.cos(P.lean), sl = Math.sin(P.lean);
  const L = (p) => { const dy = p[1] - B.hip, dz = p[2]; return [p[0] + P.sway * 0.4, hipU + dy * cl - dz * sl, dz * cl + dy * sl]; };
  const Ld = (d) => [d[0], d[1] * cl - d[2] * sl, d[2] * cl + d[1] * sl];
  const pr = (p) => prj(f, p);
  const shR = L([B.sh, B.su, 0]), shL = L([-B.sh, B.su, 0]);
  const head = L([0, B.hu, B.hunch]);
  const hR = L(P.hr), hL = L(P.hl);
  const hipR = [B.hw + P.sway * 0.6, hipU, 0], hipL = [-B.hw + P.sway * 0.6, hipU, 0];
  const items = [];
  const push = (d, fn) => items.push({ d, fn });
  const far = (p) => (pr(p)[2] < -0.2);
  const dk = (c, isFar) => (isFar ? shade(c, -0.22) : c);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const seg = (pts, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); pts.forEach((p, k) => { const q = pr(p); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke(); };
  const dot = (p, r, col) => { const q = pr(p); g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], r, 0, 6.2832); g.fill(); };
  // legs
  const leg = (hip, foot, side) => {
    const mid = [(hip[0] + foot[0]) / 2, (hip[1] + foot[1]) / 2, (hip[2] + foot[2]) / 2];
    const d = Math.hypot(hip[1] - foot[1], hip[2] - foot[2]);
    const bend = Math.sqrt(Math.max(0, (B.hip / 2) ** 2 - (d / 2) ** 2));
    const knee = [mid[0], mid[1], mid[2] + bend + 0.2];
    const isFar = far(foot) || (f === 2 && side < 0);
    const skinLeg = kd.pal.startsWith('orc') || kd.pal === 'gob';
    push(-5 + pr(foot)[2] * 0.1, () => {
      seg([hip, knee, foot], B.leg, dk(skinLeg ? C.skinD || C.skin : C.hose, isFar));
      const toe = f === 2 ? [foot[0], foot[1] + 0.25, foot[2] + 0.9] : f === 1 ? [foot[0], foot[1] + 0.3, foot[2] - 0.3] : [foot[0], foot[1] + 0.25, foot[2] + 0.5];
      seg([[foot[0], foot[1] + 0.9, foot[2]], toe], B.leg * 1.08, dk(C.boot, isFar));
    });
  };
  leg(hipL, P.fl, -1); leg(hipR, P.fr, 1);
  // torso
  push(0, () => {
    const sk = B.hip - 1.4 + P.bob * 0.5;
    let pts;
    if (f < 2) pts = [L([-B.sh - 0.15, B.su + 0.2, 0]), L([B.sh + 0.15, B.su + 0.2, 0]), [B.hw + 0.8, hipU + 0.3, 0], [B.hw + 1.1, sk, 0.2], [-B.hw - 1.1, sk, 0.2], [-B.hw - 0.8, hipU + 0.3, 0]];
    else pts = [L([0, B.su + 0.2, -B.td]), L([0, B.su + 0.2, B.td + B.hunch * 0.4]), [0, hipU + 0.3, B.td - 0.1], [0, sk, B.td + 0.25], [0, sk, -B.td - 0.2], [0, hipU + 0.3, -B.td + 0.1]];
    const q = pts.map(pr);
    const torsoCol = kd.body.startsWith('orc') && kd.pal !== 'orcB' ? C.skin : C.cloth;
    g.fillStyle = torsoCol; g.strokeStyle = torsoCol; g.lineWidth = 0.9;
    g.beginPath(); q.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.stroke();
    // kilt / skirt in cloth for orcs
    const at = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    if (kd.body.startsWith('orc') || kd.body === 'goblin') {
      g.fillStyle = C.cloth; g.beginPath();
      const a = at(q[5], q[4], 0.15), b = at(q[2], q[3], 0.15);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(q[3][0], q[3][1] + 0.3); g.lineTo(q[4][0], q[4][1] + 0.3); g.closePath(); g.fill();
    }
    // belt
    g.strokeStyle = C.leather; g.lineWidth = 0.75;
    const b1 = at(q[5], q[4], 0.1), b2 = at(q[2], q[3], 0.1);
    g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke();
    // chest heraldry: a band for the March, a disc for the Concord, harness for orcs
    const c1 = at(q[0], q[5], 0.38), c2 = at(q[1], q[2], 0.38);
    if (kd.pal === 'realm') {
      g.strokeStyle = C.trim; g.lineWidth = 1.05; g.beginPath(); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.stroke();
      g.strokeStyle = C.trim; g.lineWidth = 0.5; const h1 = at(q[5], q[4], 0.8), h2 = at(q[2], q[3], 0.8); g.beginPath(); g.moveTo(h1[0], h1[1]); g.lineTo(h2[0], h2[1]); g.stroke();
    } else if (kd.pal === 'realmA') {
      g.strokeStyle = C.trim; g.lineWidth = 1.0; g.beginPath(); g.moveTo(q[0][0], q[0][1] + 0.5); g.lineTo(b2[0], b2[1] - 0.3); g.stroke();
    } else if (kd.pal === 'aurel' && f !== 1) {
      const m = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2 + 0.3];
      g.fillStyle = C.trim; g.beginPath(); g.ellipse(m[0], m[1], f === 2 ? 0.7 : 1.15, 1.15, 0, 0, 6.28); g.fill();
      g.strokeStyle = C.cloth; g.lineWidth = 0.35; g.beginPath(); g.moveTo(m[0], m[1] - 1); g.lineTo(m[0], m[1] + 1); g.moveTo(m[0] - 0.9, m[1]); g.lineTo(m[0] + 0.9, m[1]); g.stroke();
    } else if (kd.pal === 'aurelL') {
      g.strokeStyle = C.clothD; g.lineWidth = 0.3; for (let k = 0.25; k < 0.9; k += 0.25) { const a = at(q[0], q[1], k), b = at(q[5], q[2], k); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    } else if (kd.pal === 'orc' || kd.pal === 'orc2') {
      g.strokeStyle = C.leather; g.lineWidth = 0.7; g.beginPath(); g.moveTo(q[0][0], q[0][1]); g.lineTo(b2[0], b2[1]); g.moveTo(q[1][0], q[1][1]); g.lineTo(b1[0], b1[1]); g.stroke();
      if (kd.pal === 'orc2') { g.fillStyle = '#6b5a44'; g.beginPath(); g.ellipse((q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2 + 0.3, Math.abs(q[1][0] - q[0][0]) / 2 + 0.7, 1.1, 0, 0, 6.28); g.fill(); }
    } else if (kd.pal === 'orcB') {
      g.fillStyle = C.metal; g.beginPath(); const a = at(q[0], q[5], 0.1), b = at(q[1], q[2], 0.1), c = at(q[1], q[2], 0.8), d = at(q[0], q[5], 0.8);
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill();
      g.strokeStyle = C.paint; g.lineWidth = 0.8; g.beginPath(); g.moveTo(d[0], d[1] + 0.6); g.lineTo(c[0], c[1] + 0.6); g.stroke();
    } else if (kd.pal === 'vW') {
      g.fillStyle = C.trim; g.beginPath(); const a = at(q[5], q[4], 0.2), b = at(q[2], q[3], 0.2); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(q[3][0] - 0.2, q[3][1]); g.lineTo(q[4][0] + 0.2, q[4][1]); g.closePath(); g.fill();
    }
  });
  // arms
  const arm = (sh, hand, side) => {
    const mid = [(sh[0] + hand[0]) / 2 + side * 0.45, (sh[1] + hand[1]) / 2 - 0.5, (sh[2] + hand[2]) / 2 - 0.3];
    const ds = (pr(sh)[2] + pr(hand)[2]) / 2;
    const isFar = ds < -0.25;
    const sleeve = kd.body.startsWith('orc') && kd.pal !== 'orcB' ? C.skin : C.sleeve;
    push(ds + 0.05, () => {
      seg([sh, mid, hand], B.arm, dk(sleeve, isFar));
      dot(hand, B.arm * 0.52, dk(C.skin, isFar));
      if (side > 0 && kd.pal === 'orc') { const q = pr(sh); g.fillStyle = C.trim; g.beginPath(); g.ellipse(q[0], q[1] - 0.2, 1.3, 0.9, 0, 0, 6.28); g.fill(); }
      if (kd.pal === 'orcB') { const q = pr(sh); g.fillStyle = C.metal; g.beginPath(); g.ellipse(q[0], q[1] - 0.2, 1.5, 1.0, 0, 0, 6.28); g.fill(); }
    });
  };
  arm(shR, hR, 1); arm(shL, hL, -1);
  // head
  push(0.6, () => paintHead(g, kd, B, C, f, pr(head), P));
  // weapon
  const W = P.w;
  if (W && !P.slung) {
    if (W.type === 'bow' || W.type === 'longbow') {
      const gq = L(W.grip);
      push(pr(gq)[2] + (f === 1 ? -0.4 : 0.3), () => paintBow(g, pr, gq, W.L, W.pull ? L(W.pull) : null, P.nock, C));
    } else if (W.type === 'sack') {
      push(pr(L([0, B.su - 3.4, 1.6]))[2] + 0.2, () => { const q = pr(L([0, B.su - 3.0, 1.7])); g.fillStyle = '#b39a6a'; g.beginPath(); g.ellipse(q[0], q[1], 2.0, 1.7, 0, 0, 6.28); g.fill(); g.strokeStyle = '#7a6440'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(q[0] - 0.6, q[1] - 1.5); g.lineTo(q[0] + 0.5, q[1] - 1.2); g.stroke(); });
    } else {
      const gq = L(W.grip), dq = Ld(W.dir);
      const a = V.add(gq, V.sc(dq, -W.back)), b = V.add(gq, V.sc(dq, W.fwd));
      push(pr(gq)[2] + 0.02 - (f === 1 ? 0.1 : 0), () => paintWeapon(g, pr, a, gq, b, dq, W.type, C));
    }
  } else if (W && P.slung && W.type !== 'bow' && W.type !== 'longbow') {
    const a = L([-1.6, B.su - 3.5, -1.4]), b = L([1.8, B.su + 3.8, -1.4]);
    push(pr(a)[2], () => seg([a, b], 0.6, C.wood));
  }
  // shield
  if (P.shield && kd.sh) {
    const sp = L(V.add(P.hl, [0.3, 0.2, 0.7]));
    push(pr(sp)[2] + 0.3, () => paintShield(g, pr(sp), kd.sh, f, C));
  }
  // back gear
  if (kd.quiver) { const qp = L([0.9, B.su - 1.0, -B.td - 0.3]); push(pr(qp)[2] - 0.1, () => { const a = pr(L([0.6, B.su - 3.2, -B.td - 0.3])), b = pr(L([1.3, B.su + 1.4, -B.td - 0.3])); g.strokeStyle = '#5a3a22'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.strokeStyle = '#efe7d0'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(b[0] - 0.4, b[1]); g.lineTo(b[0] - 0.2, b[1] - 1.1); g.moveTo(b[0] + 0.3, b[1]); g.lineTo(b[0] + 0.6, b[1] - 1.0); g.stroke(); }); }
  if (kd.bundle && !(anim === 'atk' && i > 0)) { const qp = L([0, B.su, -B.td - 0.4]); push(pr(qp)[2] - 0.1, () => { for (let k = -1; k <= 1; k++) seg([L([k * 0.5 - 1.2, B.su - 3, -B.td - 0.4]), L([k * 0.5 + 1.6, B.su + 4.5, -B.td - 0.4])], 0.45, C.wood); }); }
  if (kd.trophy) {
    const base = L([0.4, B.su - 1.0, -B.td - 0.5]), top = L([0.4, B.su + 12.5, -B.td - 0.5]);
    push(pr(base)[2] - 0.1, () => {
      seg([base, top], 0.75, '#4a3420');
      const cb1 = L([-2.4, B.su + 10.5, -B.td - 0.5]), cb2 = L([3.2, B.su + 10.5, -B.td - 0.5]);
      seg([cb1, cb2], 0.6, '#4a3420');
      const t = pr(top); g.fillStyle = '#e8dfc6'; g.beginPath(); g.arc(t[0], t[1] + 0.2, 1.05, 0, 6.28); g.fill();
      g.fillStyle = OUTLINE; g.fillRect(t[0] - 0.55, t[1] + 0.1, 0.4, 0.35); g.fillRect(t[0] + 0.15, t[1] + 0.1, 0.4, 0.35);
      const r1 = pr(cb1), r2 = pr(cb2); g.fillStyle = '#8a201b';
      g.beginPath(); g.moveTo(r1[0], r1[1]); g.lineTo(r1[0] + 0.5, r1[1] + 3.2); g.lineTo(r1[0] + 1.3, r1[1] + 2.2); g.lineTo(r1[0] + 1.7, r1[1] + 3.6); g.lineTo(r1[0] + 2.4, r1[1]); g.closePath(); g.fill();
      g.fillStyle = '#e8dfc6'; g.beginPath(); g.arc(r2[0] - 0.3, r2[1] + 1.2, 0.8, 0, 6.28); g.fill();
    });
  }
  if (kd.wc === 'bundle') { const qp = L([0, B.su - 0.5, -B.td - 0.8]); push(pr(qp)[2] - 0.1, () => { const q = pr(qp); g.fillStyle = '#7d6a4a'; g.beginPath(); g.ellipse(q[0], q[1], 2.2, 2.0, 0, 0, 6.28); g.fill(); }); }
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.fn();
}

function paintHead(g, kd, B, C, f, q, P) {
  const r = B.hr, x = q[0] + (f === 2 ? 0.2 : 0), y = q[1];
  const skin = C.skin;
  g.save(); g.translate(x, y); g.rotate(P.headTilt * (f === 1 ? -1 : 1));
  const circ = (cx, cy, rr, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, rr, 0, 6.2832); g.fill(); };
  const ell = (cx, cy, rx, ry, col, a0 = 0, a1 = 6.2832) => { g.fillStyle = col; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, a0, a1); g.fill(); };
  const h = kd.helm;
  const sideDir = f === 2 ? 1 : 0;
  // ears (goblins, orcs) behind the head
  if (h === 'gobhood') {
    g.fillStyle = C.skin;
    if (f < 2) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.7, -0.4); g.lineTo(s * (r + 2.9), -1.6); g.lineTo(s * r * 0.7, 0.9); g.closePath(); g.fill(); } }
    else { g.beginPath(); g.moveTo(-0.6, -0.4); g.lineTo(-r - 2.6, -1.9); g.lineTo(-0.3, 0.9); g.closePath(); g.fill(); }
  }
  circ(0, 0, r, h === 'hood' ? C.hood : h === 'hood2' ? '#5e4630' : h === 'gobhood' ? C.hood : skin);
  // face
  if (f === 0 || f === 2) {
    const fx = f === 2 ? 0.9 : 0;
    if (h === 'hood' || h === 'hood2' || h === 'gobhood') ell(fx, 0.45, f === 2 ? 1.0 : 1.3, 1.35, skin);
    if (h !== 'sallet') {
      g.fillStyle = OUTLINE;
      if (f === 0) { g.fillRect(-0.95, 0.05, 0.55, 0.6); g.fillRect(0.4, 0.05, 0.55, 0.6); }
      else { g.fillRect(1.15, 0.0, 0.5, 0.6); g.fillStyle = shade(skin, -0.15); g.fillRect(r - 0.15, 0.4, 0.6, 0.6); }
    }
    if (kd.body.startsWith('orc')) {
      g.fillStyle = '#efe6cc';
      if (f === 0) { g.beginPath(); g.moveTo(-0.9, 1.7); g.lineTo(-0.6, 0.85); g.lineTo(-0.35, 1.7); g.fill(); g.beginPath(); g.moveTo(0.35, 1.7); g.lineTo(0.6, 0.85); g.lineTo(0.9, 1.7); g.fill(); }
      else { g.beginPath(); g.moveTo(1.2, 1.8); g.lineTo(1.6, 0.9); g.lineTo(1.9, 1.8); g.fill(); }
      if (C.paint) { g.fillStyle = C.paint; g.globalAlpha = 0.85; g.fillRect(f === 0 ? -r + 0.3 : 0.2, -0.65, f === 0 ? 2 * r - 0.6 : r - 0.2, 0.55); g.globalAlpha = 1; }
    }
    if (h === 'gobhood') { g.fillStyle = shade(skin, -0.2); if (f === 0) { g.beginPath(); g.ellipse(0, 1.1, 0.5, 0.75, 0, 0, 6.28); g.fill(); } else { g.beginPath(); g.ellipse(2.0, 0.9, 0.9, 0.5, 0, 0, 6.28); g.fill(); } }
  } else {
    // back of the head
    if (h !== 'hood' && h !== 'hood2' && h !== 'gobhood' && h !== 'bald') circ(0, 0.15, r * 0.96, C.hair);
  }
  // headgear
  const m = C.metal || '#a9adb2';
  if (h === 'kettle') {
    ell(0, -0.25, r + 1.45, 0.85, shade(m, -0.25));
    ell(0, -0.55, r + 1.3, 0.7, m);
    ell(0, -0.7, r * 0.95, r * 0.9, m, Math.PI, 2 * Math.PI);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(-0.7, -1.6, 0.6, 0.35, -0.4, 0, 6.28); g.fill();
  } else if (h === 'sallet') {
    ell(0, -0.3, r + 0.25, r + 0.15, m, Math.PI * 0.95, Math.PI * 2.05);
    g.fillStyle = m; g.fillRect(-r - 0.25, -0.4, 2 * r + 0.5, 1.0);
    if (f === 2) { g.beginPath(); g.moveTo(-r + 0.2, -0.2); g.lineTo(-r - 1.7, 1.2); g.lineTo(-r + 0.6, 0.9); g.closePath(); g.fill(); }
    if (f === 1) { g.beginPath(); g.moveTo(-r, 0.3); g.lineTo(0, 1.6); g.lineTo(r, 0.3); g.closePath(); g.fill(); }
    if (f !== 1) { g.fillStyle = OUTLINE; g.fillRect(f === 2 ? 0.4 : -r + 0.4, 0.1, f === 2 ? r - 0.3 : 2 * r - 0.8, 0.45); }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(-0.6, -1.4, 0.55, 0.3, -0.4, 0, 6.28); g.fill();
  } else if (h === 'cap') {
    ell(0, -0.2, r + 0.2, r + 0.1, C.cap, Math.PI, 2 * Math.PI);
    g.fillStyle = C.cap; g.fillRect(-r - 0.2, -0.3, 2 * r + 0.4, 0.6);
    if (f === 1) circ(0, -0.1, r + 0.1, C.cap);
  } else if (h === 'hat') {
    ell(0.1, -0.85, r + 1.75, 0.7, shade(C.hat, -0.15));
    ell(0, -1.25, r * 0.85, 1.3, C.hat);
    g.strokeStyle = '#efe7d0'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-0.8, -1.6); g.quadraticCurveTo(-2.6, -3.6, -3.4, -3.2); g.stroke();
  } else if (h === 'hood' || h === 'hood2' || h === 'gobhood') {
    const col = h === 'hood' ? C.hood : h === 'hood2' ? '#5e4630' : C.hood;
    g.fillStyle = col;
    if (f === 1) { g.beginPath(); g.moveTo(-r * 0.6, 0.5); g.quadraticCurveTo(0.2, 3.2, 0.7, 4.0); g.lineTo(r * 0.6, 0.5); g.closePath(); g.fill(); }
    if (h === 'gobhood') { g.beginPath(); g.moveTo(-r * 0.8, -1.0); g.lineTo(f === 2 ? -r - 1.6 : 0.4, -r - 2.2); g.lineTo(r * 0.8, -1.0); g.closePath(); g.fill(); }
    if (f === 2 && h !== 'gobhood') { g.beginPath(); g.moveTo(-r + 0.2, -0.6); g.quadraticCurveTo(-r - 1.6, 1.4, -r - 1.2, 2.6); g.lineTo(-r + 0.9, 1.0); g.closePath(); g.fill(); }
  } else if (h === 'orcband') {
    circ(f === 2 ? -0.7 : 0, -r - 0.3, 0.85, C.hair);
    g.fillStyle = C.skin; if (f < 2) { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * (r - 0.2), -0.7); g.lineTo(s * (r + 1.1), -1.3); g.lineTo(s * (r - 0.1), 0.4); g.fill(); } }
  } else if (h === 'mohawk') {
    g.fillStyle = C.hair;
    if (f === 2) { g.beginPath(); g.moveTo(1.2, -r + 0.2); g.lineTo(0.6, -r - 1.2); g.lineTo(-0.6, -r - 1.4); g.lineTo(-1.6, -r - 0.6); g.lineTo(-1.4, -r + 0.6); g.closePath(); g.fill(); }
    else g.fillRect(-0.45, -r - 1.3, 0.9, 1.9);
  } else if (h === 'crest') {
    ell(0, -0.2, r + 0.3, r + 0.2, m, Math.PI * 0.95, Math.PI * 2.05);
    g.fillStyle = '#e8dfc6';
    const n = f === 2 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      const bx = f === 2 ? -1.6 + k * 1.1 : (k - 1) * 0.9, hh = f === 2 ? 2.2 - Math.abs(k - 1.5) * 0.4 : 2.4 - Math.abs(k - 1) * 0.7;
      g.beginPath(); g.moveTo(bx - 0.4, -r + 0.2); g.lineTo(bx + (f === 2 ? -0.5 : (k - 1) * 0.5), -r - hh); g.lineTo(bx + 0.4, -r + 0.2); g.closePath(); g.fill();
    }
  } else if (h === 'scarf') {
    ell(0, -0.3, r + 0.3, r + 0.2, C.scarf, Math.PI, 2 * Math.PI);
    g.fillStyle = C.scarf; g.fillRect(-r - 0.3, -0.4, 2 * r + 0.6, 0.7);
    if (f !== 0) { g.beginPath(); g.moveTo(-r * 0.5, 0.2); g.lineTo(f === 2 ? -r - 0.8 : 0, r + 1.4); g.lineTo(r * 0.5, 0.2); g.closePath(); g.fill(); }
  } else if (h === 'hair') {
    ell(0, -0.5, r + 0.1, r * 0.8, C.hair, Math.PI, 2 * Math.PI);
  } else if (h === 'bald') {
    g.fillStyle = C.hair; if (f < 2) { g.fillRect(-r, -0.2, 0.5, 1.0); g.fillRect(r - 0.5, -0.2, 0.5, 1.0); } else g.fillRect(-r, -0.2, 1.2, 1.2);
  }
  g.restore();
}

function paintWeapon(g, pr, a, grip, b, d, type, C) {
  const A = pr(a), Gq = pr(grip), Bq = pr(b);
  g.lineCap = 'round';
  const shaft = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(Bq[0], Bq[1]); g.stroke(); };
  const dx = Bq[0] - A[0], dy = Bq[1] - A[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  if (type === 'spear' || type === 'javelin' || type === 'staff') {
    shaft(type === 'javelin' ? 0.55 : 0.7, type === 'staff' ? '#7a5a3a' : C.wood);
    if (type !== 'staff') {
      const hl = type === 'javelin' ? 1.6 : 2.4;
      g.fillStyle = C.metal; g.beginPath();
      g.moveTo(Bq[0] + ux * hl, Bq[1] + uy * hl); g.lineTo(Bq[0] - uy * 0.75, Bq[1] + ux * 0.75); g.lineTo(Bq[0] - ux * 0.4, Bq[1] - uy * 0.4); g.lineTo(Bq[0] + uy * 0.75, Bq[1] - ux * 0.75); g.closePath(); g.fill();
    }
  } else if (type === 'bill') {
    shaft(0.7, C.wood);
    g.fillStyle = C.metal; g.beginPath();
    g.moveTo(Bq[0] + ux * 2.2, Bq[1] + uy * 2.2); g.lineTo(Bq[0] + uy * 1.6, Bq[1] - ux * 1.6); g.lineTo(Bq[0] + uy * 1.0 - ux * 0.6, Bq[1] - ux * 1.0 - uy * 0.6); g.lineTo(Bq[0] - ux * 0.8, Bq[1] - uy * 0.8); g.closePath(); g.fill();
  } else if (type === 'sword' || type === 'knife') {
    g.strokeStyle = C.metal; g.lineWidth = type === 'knife' ? 0.6 : 0.8; g.beginPath(); g.moveTo(Gq[0], Gq[1]); g.lineTo(Bq[0], Bq[1]); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(Gq[0] + ux * 1.2, Gq[1] + uy * 1.2); g.lineTo(Bq[0] - ux * 0.5, Bq[1] - uy * 0.5); g.stroke();
    if (type === 'sword') { g.strokeStyle = C.metalD || '#666'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(Gq[0] - uy * 1.1 + ux * 0.6, Gq[1] + ux * 1.1 + uy * 0.6); g.lineTo(Gq[0] + uy * 1.1 + ux * 0.6, Gq[1] - ux * 1.1 + uy * 0.6); g.stroke(); }
  } else if (type === 'axe' || type === 'hatchet' || type === 'cleaver') {
    shaft(type === 'cleaver' ? 0.85 : 0.65, C.wood);
    const s = type === 'cleaver' ? 1.6 : type === 'axe' ? 1.25 : 0.9;
    g.fillStyle = C.metal; g.beginPath();
    g.moveTo(Bq[0] - ux * 0.3, Bq[1] - uy * 0.3); g.lineTo(Bq[0] + uy * 2.0 * s - ux * 1.2 * s, Bq[1] - ux * 2.0 * s - uy * 1.2 * s);
    g.quadraticCurveTo(Bq[0] + uy * 2.6 * s, Bq[1] - ux * 2.6 * s, Bq[0] + uy * 2.0 * s + ux * 1.2 * s, Bq[1] - ux * 2.0 * s + uy * 1.2 * s);
    g.lineTo(Bq[0] + ux * 0.6, Bq[1] + uy * 0.6); g.closePath(); g.fill();
    if (type === 'cleaver') { g.strokeStyle = '#7a2a20'; g.lineWidth = 0.35; g.stroke(); }
  }
}
function paintBow(g, pr, grip, L, pull, nock, C) {
  const top = pr(V.add(grip, [0, L, -1.1])), mt = pr(V.add(grip, [0, L * 0.5, 0.2])), gq = pr(grip), mb = pr(V.add(grip, [0, -L * 0.5, 0.2])), bot = pr(V.add(grip, [0, -L, -1.1]));
  g.strokeStyle = '#6e4724'; g.lineWidth = 0.75; g.lineCap = 'round';
  g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(mt[0], mt[1], gq[0], gq[1]); g.quadraticCurveTo(mb[0], mb[1], bot[0], bot[1]); g.stroke();
  g.strokeStyle = 'rgba(240,230,205,0.9)'; g.lineWidth = 0.3; g.beginPath(); g.moveTo(top[0], top[1]);
  if (pull) { const p = pr(pull); g.lineTo(p[0], p[1]); } g.lineTo(bot[0], bot[1]); g.stroke();
  if (nock && pull) { const p = pr(pull); g.strokeStyle = '#d9cfb3'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(p[0], p[1]); const tx = gq[0] + (gq[0] - p[0]) * 0.25, ty = gq[1] + (gq[1] - p[1]) * 0.25; g.lineTo(tx, ty); g.stroke(); }
}
function paintShield(g, q, type, f, C) {
  g.save(); g.translate(q[0], q[1]);
  if (f === 2) g.scale(0.38, 1);
  if (type === 'heater') {
    g.beginPath(); g.moveTo(-1.9, -2.3); g.lineTo(1.9, -2.3); g.lineTo(1.8, 0.2); g.quadraticCurveTo(1.2, 2.0, 0, 2.9); g.quadraticCurveTo(-1.2, 2.0, -1.8, 0.2); g.closePath();
    if (f === 1) { g.fillStyle = '#7a5434'; g.fill(); g.strokeStyle = '#4e331f'; g.lineWidth = 0.4; g.stroke(); }
    else {
      g.fillStyle = C.cloth; g.fill(); g.save(); g.clip();
      g.strokeStyle = C.trim; g.lineWidth = 0.75; g.beginPath(); g.moveTo(-2, -0.2); g.quadraticCurveTo(-1, -1.0, 0, -0.2); g.quadraticCurveTo(1, 0.6, 2, -0.2); g.stroke();
      g.restore(); g.strokeStyle = C.trim; g.lineWidth = 0.35; g.stroke();
    }
  } else if (type === 'round') {
    g.beginPath(); g.arc(0, 0, 2.05, 0, 6.28);
    if (f === 1) { g.fillStyle = '#7a5434'; g.fill(); }
    else { g.fillStyle = C.trim; g.fill(); g.strokeStyle = C.cloth; g.lineWidth = 0.45; g.beginPath(); g.arc(0, 0, 1.05, 0, 6.28); g.stroke(); g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 2); g.moveTo(-2, 0); g.lineTo(2, 0); g.stroke(); }
    g.strokeStyle = '#6a6f76'; g.lineWidth = 0.35; g.beginPath(); g.arc(0, 0, 2.05, 0, 6.28); g.stroke();
  } else if (type === 'buckler') {
    g.beginPath(); g.arc(0, 0, 1.9, 0, 6.28); g.fillStyle = '#6e4b2c'; g.fill();
    if (f !== 1) { g.strokeStyle = C.paint || '#b8392a'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-1.1, 1.0); g.quadraticCurveTo(-0.6, -0.8, 0.1, -1.2); g.moveTo(1.1, 1.0); g.quadraticCurveTo(0.6, -0.8, -0.1, -1.2); g.stroke(); g.fillStyle = '#8f8d86'; g.beginPath(); g.arc(0, 0.1, 0.5, 0, 6.28); g.fill(); }
    g.strokeStyle = '#3a2618'; g.lineWidth = 0.35; g.beginPath(); g.arc(0, 0, 1.9, 0, 6.28); g.stroke();
  }
  g.restore();
}

// ---------- baking: shading pass + warm dark outline ----------
let _tmp = null, _tmp2 = null;
function bakeFrame(dst, dx, dy, PX, drawFn, opts) {
  const cw = Math.ceil(CW * PX), ch = Math.ceil(CH * PX);
  if (!_tmp || _tmp.width < cw || _tmp.height < ch) { _tmp = mkCanvas(cw, ch); _tmp2 = mkCanvas(cw, ch); }
  const t = _tmp.getContext('2d'), t2 = _tmp2.getContext('2d');
  t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, _tmp.width, _tmp.height);
  t.setTransform(PX, 0, 0, PX, AX * PX, AY * PX);
  drawFn(t);
  // light from the upper-left (low western sun): warm highlight, cool shade
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-atop';
  const gr = t.createLinearGradient(AX * PX - 6 * PX, AY * PX - 15 * PX, AX * PX + 6 * PX, AY * PX + 1 * PX);
  gr.addColorStop(0, 'rgba(255,238,205,0.26)'); gr.addColorStop(0.45, 'rgba(255,240,220,0)'); gr.addColorStop(1, 'rgba(30,18,40,0.34)');
  t.fillStyle = gr; t.fillRect(0, 0, cw, ch);
  if (opts && opts.corpse) { t.fillStyle = 'rgba(58,40,30,0.38)'; t.fillRect(0, 0, cw, ch); }
  t.globalCompositeOperation = 'source-over';
  // outline: silhouette tinted, stamped at 8 offsets
  t2.setTransform(1, 0, 0, 1, 0, 0); t2.clearRect(0, 0, _tmp2.width, _tmp2.height);
  t2.drawImage(_tmp, 0, 0); t2.globalCompositeOperation = 'source-in'; t2.fillStyle = opts && opts.corpse ? 'rgba(36,24,15,0.7)' : OUTLINE; t2.fillRect(0, 0, cw, ch); t2.globalCompositeOperation = 'source-over';
  const o = Math.max(1, Math.round(PX * 0.42));
  const d = dst.getContext('2d');
  d.save(); d.beginPath(); d.rect(dx, dy, cw, ch); d.clip();
  for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) d.drawImage(_tmp2, 0, 0, cw, ch, dx + ox, dy + oy, cw, ch);
  d.drawImage(_tmp, 0, 0, cw, ch, dx, dy, cw, ch);
  d.restore();
}

function frameOf(anim, i) { return AN[anim][0] + Math.min(i, AN[anim][1] - 1); }
function animList(anim) { return AN[anim]; }

// one atlas page per kind: rows = facing 0 front, 1 back, 2 side-east, 3 side-west (mirrored, baked)
function buildAtlas(PX, ids) {
  const cw = Math.ceil(CW * PX), ch = Math.ceil(CH * PX);
  const A = { PX, cw, ch, pages: {} };
  for (const id of ids) {
    const kd = KINDS[id];
    const page = mkCanvas(cw * NFR, ch * 4);
    for (let f = 0; f < 3; f++) {
      for (const an of ['idle', 'walk', 'atk', 'hit', 'die', 'climb']) {
        const [s, n] = AN[an];
        for (let i = 0; i < n; i++) {
          const fi = s + i;
          bakeFrame(page, fi * cw, f * ch, PX, (g) => {
            const P = poseFor(kd, BODY[kd.body], an, i);
            if (P.rot) { g.translate(0, -P.drop * 0.2); g.rotate(P.rot); }
            g.scale(BODY[kd.body].sc, BODY[kd.body].sc);
            paintFigure(g, kd, an, i, f);
          });
        }
      }
      bakeFrame(page, 16 * cw, f * ch, PX, (g) => { g.rotate(1.5708); g.scale(BODY[kd.body].sc, BODY[kd.body].sc); paintFigure(g, kd, 'die', 2, f); }, { corpse: true });
    }
    // mirrored west-facing row
    const pg = page.getContext('2d');
    for (let fi = 0; fi < NFR; fi++) {
      pg.save(); pg.translate((fi + 1) * cw, 3 * ch); pg.scale(-1, 1);
      pg.drawImage(page, fi * cw, 2 * ch, cw, ch, 0, 0, cw, ch); pg.restore();
    }
    A.pages[id] = page;
  }
  return A;
}

// ---------- livestock & birds (render-only life) ----------
function paintAnimal(g, type, fr) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const leg = (x, y1, dx, col) => { g.strokeStyle = col; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y1); g.lineTo(x + dx, 0); g.stroke(); };
  const sw = fr === 1 ? 0.9 : fr === 2 ? -0.9 : 0;
  if (type === 'goat') {
    const c = '#d8cfbc', cd = '#a89e88';
    leg(-2.2, -2.4, sw, cd); leg(1.8, -2.4, -sw, cd); leg(-1.5, -2.4, -sw, c); leg(2.4, -2.4, sw, c);
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -3.6, 3.4, 1.7, 0, 0, 6.28); g.fill();
    g.beginPath(); g.ellipse(3.6, -5.0, 1.2, 1.0, 0.4, 0, 6.28); g.fill();
    g.strokeStyle = '#6d6252'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(3.2, -5.8); g.quadraticCurveTo(2.6, -7.3, 1.9, -6.9); g.stroke();
    g.fillStyle = '#8f8270'; g.beginPath(); g.moveTo(4.3, -4.4); g.lineTo(4.5, -3.2); g.lineTo(4.0, -4.2); g.fill();
    g.fillStyle = OUTLINE; g.fillRect(3.9, -5.3, 0.4, 0.4);
    g.fillStyle = '#6d6252'; g.fillRect(-3.6, -4.4, 0.8, 0.5);
  } else if (type === 'goose') {
    const c = '#efebe0';
    leg(-0.3, -1.5, sw * 0.6, '#d98a2a'); leg(0.5, -1.5, -sw * 0.6, '#d98a2a');
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -2.6, 2.3, 1.4, -0.15, 0, 6.28); g.fill();
    g.strokeStyle = c; g.lineWidth = 0.9; g.beginPath(); g.moveTo(1.6, -3.0); g.quadraticCurveTo(2.4, -4.6, 2.3, -5.8); g.stroke();
    g.fillStyle = '#d98a2a'; g.beginPath(); g.moveTo(2.6, -6.0); g.lineTo(3.7, -5.6); g.lineTo(2.6, -5.5); g.fill();
    g.fillStyle = '#b9b3a3'; g.beginPath(); g.ellipse(-0.4, -2.9, 1.3, 0.6, -0.2, 0, 6.28); g.fill();
    if (fr === 3) { g.fillStyle = c; g.beginPath(); g.moveTo(-0.5, -3.2); g.lineTo(-2.4, -5.6); g.lineTo(0.8, -3.6); g.fill(); }
  } else if (type === 'dog') {
    const c = '#8a5a34', cd = '#5e3c22';
    leg(-1.8, -2.0, sw, cd); leg(1.6, -2.0, -sw, cd); leg(-1.2, -2.0, -sw, c); leg(2.1, -2.0, sw, c);
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -2.9, 2.8, 1.25, 0, 0, 6.28); g.fill();
    g.beginPath(); g.ellipse(3.0, -4.0, 1.3, 1.0, 0, 0, 6.28); g.fill();
    g.fillStyle = cd; g.beginPath(); g.moveTo(2.4, -4.8); g.lineTo(2.0, -3.6); g.lineTo(2.9, -4.2); g.fill();
    g.fillStyle = '#2a1e18'; g.fillRect(3.9, -4.1, 0.6, 0.5);
    g.strokeStyle = c; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-2.6, -3.3); g.lineTo(-3.8, -4.8 + sw * 0.5); g.stroke();
  }
}
function buildAnimals(PX) {
  const types = ['goat', 'goose', 'dog'];
  const cw = Math.ceil(16 * PX), ch = Math.ceil(12 * PX);
  const page = mkCanvas(cw * 4, ch * 2 * types.length);
  const g = page.getContext('2d');
  types.forEach((ty, k) => {
    for (let fr = 0; fr < 4; fr++) for (let m = 0; m < 2; m++) {
      g.setTransform(PX * (m ? -1 : 1), 0, 0, PX, (fr + 0.5) * cw, (k * 2 + m) * ch + 10 * PX);
      // soft outline: draw dark slightly enlarged first
      g.save(); g.translate(0, 0.25); g.scale(1.08, 1.12); g.globalAlpha = 0.9;
      const oc = mkCanvas(1, 1); void oc; g.restore();
      paintAnimal(g, ty, fr);
    }
  });
  g.setTransform(1, 0, 0, 1, 0, 0);
  return { page, cw, ch, types, ax: 0.5 * cw, ay: 10 * PX };
}
