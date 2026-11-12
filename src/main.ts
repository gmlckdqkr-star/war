import './style.css';
import { browserKV } from './meta/save';
import { createIAP } from './meta/iap';
import { App } from './ui/app';
import { toast } from './ui/dom';

declare global {
  interface Window {
    __app?: App;
  }
}

function boot() {
  const root = document.getElementById('app')!;
  let app: App;
  try {
    app = new App(root, browserKV(), createIAP());
  } catch (err) {
    console.error(err);
    root.innerHTML = '<div class="page"><h1>시작하지 못했습니다</h1><p>앱을 완전히 닫았다가 다시 열어 주세요. 진행 상황은 기기에 그대로 남아 있습니다.</p></div>';
    return;
  }
  window.__app = app;

  // Global safety net: log locally, keep playing. Never show a blank screen.
  let burst = 0;
  const onErr = (where: string, err: unknown) => {
    app.logError(where, err);
    burst++;
    if (burst === 1) toast('일시적인 문제를 자동으로 처리했습니다.', 'warn', undefined, 2500);
    setTimeout(() => (burst = Math.max(0, burst - 1)), 5000);
    if (!app.battle && !app.screenRoot.firstChild) app.go('home');
  };
  window.addEventListener('error', (e) => onErr('window', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => onErr('promise', e.reason));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) app.onHidden();
    else app.onVisible();
  });
  window.addEventListener('pagehide', () => app.persist());

  // Hardware/gesture back (Android WebView, PWA, browser): keep one history entry as a guard.
  // In battle it opens the pause menu, on other screens it returns home, on home it lets the app close.
  try {
    history.replaceState({ ashen: 'root' }, '');
    history.pushState({ ashen: 'guard' }, '');
    window.addEventListener('popstate', () => {
      if (document.querySelector('.modal-back')) {
        // close the open dialog the same way Esc does (resolves its promise)
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        history.pushState({ ashen: 'guard' }, '');
      } else if (app.battle) {
        void app.battle.openMenu();
        history.pushState({ ashen: 'guard' }, '');
      } else if (app.screen !== 'home') {
        app.go('home');
        history.pushState({ ashen: 'guard' }, '');
      }
    });
  } catch {
    /* history API unavailable: ignore */
  }

  // Offline cache (PWA). Native builds serve files locally, so the service worker is web-only.
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window as any).Capacitor) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
