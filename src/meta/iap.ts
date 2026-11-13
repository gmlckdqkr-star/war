/**
 * In-app purchase adapter.
 *
 * - Native app (Capacitor): NativeIAP talks to Google Play / App Store through cordova-plugin-purchase v13.
 *   It NEVER falls back to the test shop: if the store plugin is missing, purchases are disabled with a
 *   message (UnavailableIAP) so a store build can't ship free "test purchases".
 * - Web build: MockIAP, clearly labelled as a TEST purchase (no money moves). Set VITE_WEB_SHOP=off at
 *   build time to disable it on a public web deployment.
 * No receipt server by design (zero-maintenance requirement): non-consumables are granted when the store
 * reports them owned, and "구매 복원" re-reads ownership from the store.
 * STATUS: NativeIAP is written against the cordova-plugin-purchase v13 API and is NOT verified on a device
 * (that needs store accounts and a test track).
 */
import { storeProductIds } from './shop';

export interface PurchaseResult {
  ok: boolean;
  productId: string;
  txId: string;
  /** Korean message for the player; '취소됨' when the player cancelled (show nothing) */
  error?: string;
  test?: boolean;
}

export interface RestoreResult {
  ids: string[];
  /** Korean message when the store could not be reached */
  error?: string;
}

export interface IAPAdapter {
  readonly kind: 'mock' | 'native' | 'none';
  init(onOwned: (productId: string, txId: string) => void): Promise<void>;
  price(productId: string): string | null;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<RestoreResult>;
  /** Why purchases can't be made right now (null = they can). */
  unavailable(): string | null;
}

export const CANCELLED = '취소됨';

export class MockIAP implements IAPAdapter {
  readonly kind = 'mock' as const;
  private owned = new Set<string>();
  private onOwned: (p: string, tx: string) => void = () => {};
  /** UI hook to ask the player to confirm a test purchase. */
  confirm: (productId: string) => Promise<boolean> = async () => true;
  async init(onOwned: (p: string, tx: string) => void) {
    this.onOwned = onOwned;
  }
  price() {
    return null;
  }
  unavailable() {
    return null;
  }
  async purchase(productId: string): Promise<PurchaseResult> {
    const ok = await this.confirm(productId);
    if (!ok) return { ok: false, productId, txId: '', error: CANCELLED, test: true };
    const txId = `test-${productId}-${Date.now()}`;
    this.owned.add(productId);
    this.onOwned(productId, txId);
    return { ok: true, productId, txId, test: true };
  }
  async restore(): Promise<RestoreResult> {
    return { ids: [...this.owned] };
  }
}

/** Used when purchases are impossible (store plugin missing in a native build, or web shop disabled). */
export class UnavailableIAP implements IAPAdapter {
  readonly kind = 'none' as const;
  constructor(private reason: string) {}
  async init() {}
  price() {
    return null;
  }
  unavailable() {
    return this.reason;
  }
  async purchase(productId: string): Promise<PurchaseResult> {
    return { ok: false, productId, txId: '', error: this.reason };
  }
  async restore(): Promise<RestoreResult> {
    return { ids: [], error: this.reason };
  }
}

declare global {
  interface Window {
    CdvPurchase?: any;
    Capacitor?: any;
  }
}

export function isNativeApp(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  try {
    const p = window.Capacitor?.getPlatform?.();
    return p === 'ios' || p === 'android' ? p : 'web';
  } catch {
    return 'web';
  }
}

/** Wait until cordova plugins are ready (Capacitor fires 'deviceready'), at most `ms`. */
function waitForStorePlugin(ms: number): Promise<any | null> {
  return new Promise((resolve) => {
    if (window.CdvPurchase?.store) return resolve(window.CdvPurchase);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(iv);
      clearTimeout(to);
      resolve(window.CdvPurchase?.store ? window.CdvPurchase : null);
    };
    const iv = setInterval(() => window.CdvPurchase?.store && finish(), 100);
    const to = setTimeout(finish, ms);
    document.addEventListener('deviceready', () => setTimeout(finish, 0), { once: true });
  });
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export class NativeIAP implements IAPAdapter {
  readonly kind = 'native' as const;
  private C: any = null;
  private store: any = null;
  private platform: any = null;
  private ids: string[] = [];
  private ready = false;
  private failure: string | null = null;
  private onOwned: (p: string, tx: string) => void = () => {};

  async init(onOwned: (p: string, tx: string) => void) {
    this.onOwned = onOwned;
    const C = await waitForStorePlugin(10000);
    if (!C) {
      this.failure = '스토어 결제 모듈을 불러오지 못했습니다. 앱을 완전히 닫았다가 다시 열어 주세요.';
      return;
    }
    this.C = C;
    this.store = C.store;
    // Capacitor reports the real platform (iPadOS WebViews pretend to be a Mac, so never sniff the UA)
    this.platform = nativePlatform() === 'ios' ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
    this.ids = storeProductIds(new Date());
    this.store.register(this.ids.map((id) => ({ id, type: C.ProductType.NON_CONSUMABLE, platform: this.platform })));
    this.store.error?.((e: any) => console.warn('store error', e?.code, e?.message));
    this.store
      .when()
      .approved((tx: any) => tx.finish())
      .finished((tx: any) => {
        for (const p of tx.products ?? []) this.onOwned(p.id, String(tx.transactionId ?? `${p.id}-owned`));
      })
      .productUpdated((p: any) => {
        if (this.isOwned(p.id)) this.onOwned(p.id, `${p.id}-owned`);
      });
    try {
      const errs = await this.store.initialize([this.platform]);
      if (Array.isArray(errs) && errs.length) console.warn('store init', errs.map((e: any) => e?.code));
    } catch (e) {
      console.warn('store init failed', e);
    }
    this.ready = true;
    this.syncOwned();
    // came back online: refresh products/ownership quietly
    window.addEventListener('online', () => {
      void Promise.resolve(this.store.update?.()).then(() => this.syncOwned()).catch(() => {});
    });
  }

  private isOwned(id: string): boolean {
    try {
      return !!this.store?.owned?.(id);
    } catch {
      return false;
    }
  }

  private syncOwned() {
    for (const id of this.ids) if (this.isOwned(id)) this.onOwned(id, `${id}-owned`);
  }

  unavailable() {
    if (this.failure) return this.failure;
    if (!this.ready) return '스토어에 연결하는 중입니다. 잠시 후 다시 시도해 주세요.';
    return null;
  }

  price(productId: string) {
    try {
      return this.store?.get(productId, this.platform)?.pricing?.price ?? null;
    } catch {
      return null;
    }
  }

  async purchase(productId: string): Promise<PurchaseResult> {
    const fail = (error: string): PurchaseResult => ({ ok: false, productId, txId: '', error });
    const why = this.unavailable();
    if (why) return fail(why);
    if (offline()) return fail('인터넷에 연결되어 있지 않습니다. 연결한 뒤 다시 시도해 주세요.');
    const offer = this.store.get(productId, this.platform)?.getOffer?.();
    if (!offer) return fail('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    let err: any;
    try {
      err = await offer.order();
    } catch (e) {
      err = e ?? { code: -1 };
    }
    if (err) {
      if (err.code === this.C?.ErrorCode?.PAYMENT_CANCELLED) return fail(CANCELLED);
      return fail(`결제가 완료되지 않았습니다 (코드 ${err.code ?? '알 수 없음'}). 돈이 빠져나갔다면 "구매 복원"을 눌러 주세요.`);
    }
    // ownership is granted when the store reports the transaction finished (onOwned)
    return { ok: true, productId, txId: '' };
  }

  async restore(): Promise<RestoreResult> {
    const why = this.unavailable();
    if (why) return { ids: [], error: why };
    if (offline()) return { ids: [], error: '인터넷에 연결되어 있지 않습니다. 연결한 뒤 다시 시도해 주세요.' };
    try {
      const err = await this.store.restorePurchases();
      if (err) return { ids: [], error: '스토어에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    } catch {
      return { ids: [], error: '스토어에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { ids: this.ids.filter((id) => this.isOwned(id)) };
  }
}

export function createIAP(): IAPAdapter {
  if (typeof window === 'undefined') return new MockIAP();
  // A native build must use the real store, never the test shop.
  if (isNativeApp() || window.CdvPurchase) return new NativeIAP();
  const env = (import.meta as any).env ?? {};
  if (env.VITE_WEB_SHOP === 'off') return new UnavailableIAP('웹 버전에서는 구매할 수 없습니다. 앱 스토어 버전을 이용해 주세요.');
  return new MockIAP();
}
