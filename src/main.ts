import './style.css';
import './ui/shop.css';
import { browserKV } from './meta/save';
import { createIAP } from './meta/iap';
import { App } from './ui/app';
import { confirmBox, toast } from './ui/dom';
import { exitNativeApp, lockTextZoom, mirrorToNative, restoreFromNativeBackup, setupNativeBack, setupNativePause } from './ui/native';

declare global {
  interface Window {
    __app?: App;
  }
}

async function boot() {
  const root = document.getElementById('app')!;
  const kv = browserKV();
  try {
    await restoreFromNativeBackup(kv);
  } catch {
    /* optional */
  }
  let app: App;
  try {
    app = new App(root, kv, createIAP());
  } catch (err) {
    console.error(err);
    root.innerHTML = '<div class="page"><h1>시작하지 못했습니다</h1><p>앱을 완전히 닫았다가 다시 열어 주세요. 진행 상황은 기기에 그대로 남아 있습니다.</p></div>';
    return;
  }
  window.__app = app;
  app.afterPersist = () => mirrorToNative(kv);
  lockTextZoom();

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
    if (document.hidden) {
      app.onHidden();
      mirrorToNative(kv, true);
    } else app.onVisible();
  });
  window.addEventListener('pagehide', () => {
    app.onPageHide();
    mirrorToNative(kv, true);
  });
  // native app sent to the background: Android may kill it there, so save (and keep a battle resume point) now
  setupNativePause(() => {
    app.onHidden();
    mirrorToNative(kv, true);
  });

  /** Back gesture: close a dialog, else pause the battle, else go home. Returns false on the home screen. */
  const handleBack = (): boolean => {
    // a saved battle is being rebuilt: the progress overlay finishes on its own
    if (app.resuming) return true;
    if (document.querySelector('.modal-back')) {
      // close the open dialog the same way Esc does (resolves its promise)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      return true;
    }
    if (app.battle) {
      void app.battle.openMenu();
      return true;
    }
    if (app.screen !== 'home') {
      app.go('home');
      return true;
    }
    return false;
  };

  // Android app: the hardware back button goes through @capacitor/app when present.
  const nativeBack = setupNativeBack(() => {
    if (handleBack()) return;
    void confirmBox('게임 종료', '잿빛 성벽을 종료할까요? 진행 상황은 저장되어 있습니다.', '종료').then((yes) => {
      if (yes) {
        app.persist();
        mirrorToNative(kv, true);
        exitNativeApp();
      }
    });
  });

  // Browser / PWA / WebView without the plugin: keep one history entry as a guard.
  if (!nativeBack) {
    try {
      history.replaceState({ ashen: 'root' }, '');
      history.pushState({ ashen: 'guard' }, '');
      window.addEventListener('popstate', () => {
        if (handleBack()) history.pushState({ ashen: 'guard' }, '');
      });
    } catch {
      /* history API unavailable: ignore */
    }
  }

  // Offline cache (PWA). Native builds serve files locally, so the service worker is web-only.
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !(window as any).Capacitor) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot());
else void boot();
