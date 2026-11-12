/**
 * In-app purchase adapter.
 *
 * - Web / dev build: MockIAP, clearly labelled as a TEST purchase (no money moves).
 * - Native build (Capacitor + cordova-plugin-purchase): NativeIAP talks to Google Play / App Store.
 *   No receipt server by design (zero-maintenance requirement): non-consumables are granted when the
 *   store reports them owned, and "구매 복원" re-reads ownership from the store.
 *   STATUS: written against the cordova-plugin-purchase v13 API, NOT verified on a device (needs store accounts).
 */
import { allProducts } from './shop';

export interface PurchaseResult {
  ok: boolean;
  productId: string;
  txId: string;
  error?: string;
  test?: boolean;
}

export interface IAPAdapter {
  readonly kind: 'mock' | 'native';
  init(onOwned: (productId: string, txId: string) => void): Promise<void>;
  price(productId: string): string | null;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;
}

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
  async purchase(productId: string): Promise<PurchaseResult> {
    const ok = await this.confirm(productId);
    if (!ok) return { ok: false, productId, txId: '', error: '취소됨', test: true };
    const txId = `test-${productId}-${Date.now()}`;
    this.owned.add(productId);
    this.onOwned(productId, txId);
    return { ok: true, productId, txId, test: true };
  }
  async restore() {
    return [...this.owned];
  }
}

declare global {
  interface Window {
    CdvPurchase?: any;
  }
}

export class NativeIAP implements IAPAdapter {
  readonly kind = 'native' as const;
  private store: any;
  private onOwned: (p: string, tx: string) => void = () => {};
  async init(onOwned: (p: string, tx: string) => void) {
    this.onOwned = onOwned;
    const C = window.CdvPurchase;
    this.store = C.store;
    const platform = /iphone|ipad|ipod/i.test(navigator.userAgent) ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
    const ids = allProducts(new Date()).map((p) => p.id);
    this.store.register(ids.map((id) => ({ id, type: C.ProductType.NON_CONSUMABLE, platform })));
    this.store
      .when()
      .approved((tx: any) => tx.finish())
      .finished((tx: any) => {
        for (const p of tx.products ?? []) this.onOwned(p.id, String(tx.transactionId ?? `${p.id}-owned`));
      })
      .productUpdated((p: any) => {
        if (p.owned) this.onOwned(p.id, `${p.id}-owned`);
      });
    await this.store.initialize([platform]);
  }
  price(productId: string) {
    return this.store?.get(productId)?.pricing?.price ?? null;
  }
  async purchase(productId: string): Promise<PurchaseResult> {
    const p = this.store?.get(productId);
    const offer = p?.getOffer?.();
    if (!offer) return { ok: false, productId, txId: '', error: '상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요.' };
    const err = await offer.order();
    if (err) return { ok: false, productId, txId: '', error: err.message ?? '결제가 완료되지 않았습니다.' };
    return { ok: true, productId, txId: '' };
  }
  async restore() {
    await this.store?.restorePurchases?.();
    return allProducts(new Date())
      .map((p) => p.id)
      .filter((id) => this.store?.owned?.(id));
  }
}

export function createIAP(): IAPAdapter {
  if (typeof window !== 'undefined' && window.CdvPurchase?.store) return new NativeIAP();
  return new MockIAP();
}
