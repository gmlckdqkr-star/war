// ============================================================================
// main: fixed-step loop (1/30 s), catch-up capped at 4 steps, ?t= fast-forward
// ============================================================================
async function fontsReady() {
  try { await Promise.race([Promise.all([document.fonts.load('700 16px "Gowun Batang"'), document.fonts.load('16px "Gowun Batang"')]), new Promise((r) => setTimeout(r, 1500))]); } catch (e) {}
}
async function main() {
  await fontsReady();
  if (PARAM.sheet) { drawSheet(); window.__ready = true; return; }
  if (PARAM.ui) { drawUI(); window.__ready = true; return; }
  if (PARAM.prof) window.__prof = {};
  const sim = new Sim(PARAM.seed, PARAM.n);
  window.sim = sim;
  const cv = document.getElementById('c');
  const ren = new Renderer(cv, sim);
  if (!PARAM.off.has('freeze')) await ATLAS.freeze();
  window.ren = ren;
  window.HUD = HUD;
  if (PARAM.hud) HUD.init(ren, sim); else window.HUD = null;
  const steps = Math.round(PARAM.t / DT);
  const tf0 = performance.now();
  for (let i = 0; i < steps; i++) { sim.step(); ren.ffStep(DT, (steps - i) * DT < 2.6); }
  const ffMs = performance.now() - tf0;
  ren.frame(0, 1 / 60);
  if (PARAM.hud) HUD.update(sim);
  const perf = (window.__perf = { frames: 0, upd: [], draw: [], tot: [], gap: [], ffMs, bakeMs: ren.bakeMs, atlasMs: ren.atlasMs, rec: false });
  window.__ready = true;
  if (PARAM.still) return;
  let last = performance.now(), acc = 0, fc = 0;
  function loop(now) {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // RAF time can precede the setup timestamp
    if (perf.rec) perf.gap.push(now - last);
    last = now;
    acc += dt;
    let n = 0;
    const t0 = performance.now();
    while (acc >= DT && n < 4) { sim.step(); acc -= DT; n++; }
    if (n === 4) acc = 0;
    const t1 = performance.now();
    ren.frame(acc / DT, dt);
    const t2 = performance.now();
    if (perf.rec) { perf.upd.push(t1 - t0); perf.draw.push(t2 - t1); perf.tot.push(t2 - t0); perf.frames++; }
    if (PARAM.hud && (fc++ % 3 === 0)) HUD.update(sim);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
main();
