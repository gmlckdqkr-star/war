/**
 * Optional native integrations through Capacitor plugins, feature-detected at runtime (no imports, so
 * the web build has zero dependencies and simply skips them):
 *  - @capacitor/app        Android hardware back button (otherwise the WebView would just close the app)
 *  - @capacitor/text-zoom  ignore the phone's system font scale inside the game (it has its own "큰 글씨")
 *  - @capacitor/preferences second copy of the save in native storage, which Android Auto Backup and
 *    iCloud device backups carry to a new phone; restored automatically if the WebView storage is empty.
 * STATUS: written against the documented plugin APIs; verifiable only in a native build.
 */
import { SAVE_KEY, type KV } from '../meta/save';

function plugin(name: string): any {
  try {
    return (window as any).Capacitor?.Plugins?.[name] ?? null;
  } catch {
    return null;
  }
}

/** Before the app reads its save: if WebView storage lost the save but the native copy exists, put it back. */
export async function restoreFromNativeBackup(kv: KV): Promise<boolean> {
  const P = plugin('Preferences');
  if (!P?.get) return false;
  try {
    if (kv.get(SAVE_KEY)) return false;
    const r = await P.get({ key: SAVE_KEY });
    if (!r?.value) return false;
    kv.set(SAVE_KEY, r.value);
    return true;
  } catch {
    return false;
  }
}

let mirrorTimer = 0;
let lastMirrored = '';
/** Copy the current save to native storage (throttled; call after every successful save). */
export function mirrorToNative(kv: KV, now = false) {
  const P = plugin('Preferences');
  if (!P?.set) return;
  const run = () => {
    mirrorTimer = 0;
    try {
      const v = kv.get(SAVE_KEY);
      if (!v || v === lastMirrored) return;
      lastMirrored = v;
      void Promise.resolve(P.set({ key: SAVE_KEY, value: v })).catch(() => {});
    } catch {
      /* best effort */
    }
  };
  if (now) {
    clearTimeout(mirrorTimer);
    run();
  } else if (!mirrorTimer) mirrorTimer = window.setTimeout(run, 4000);
}

/** Wire the Android back button to the same handler the browser history guard uses. */
export function setupNativeBack(onBack: () => void): boolean {
  const A = plugin('App');
  if (!A?.addListener) return false;
  try {
    A.addListener('backButton', () => onBack());
    return true;
  } catch {
    return false;
  }
}

export function exitNativeApp(): boolean {
  const A = plugin('App');
  if (!A?.exitApp) return false;
  try {
    A.exitApp();
    return true;
  } catch {
    return false;
  }
}

/** Keep game text at 100% regardless of the system font size (layouts are designed for that). */
export function lockTextZoom() {
  const T = plugin('TextZoom');
  if (!T?.set) return;
  try {
    void Promise.resolve(T.set({ value: 1 })).catch(() => {});
  } catch {
    /* ignore */
  }
}
