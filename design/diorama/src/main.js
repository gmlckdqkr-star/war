// ============================================================================
// entry
// ============================================================================
window.addEventListener('load', () => {
  try {
    if (P_SHEET) { document.body.classList.add('sheet'); runSheet(); return; }
    if (P_UI) { document.body.classList.add('uimode'); runUI(); return; }
    runBattle();
  } catch (e) {
    console.error(e);
    document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:8px;bottom:8px;color:#f88;font:11px monospace;z-index:9">${String(e.stack || e)}</pre>`);
    window.__ready = true; window.__error = String(e.stack || e);
  }
});
