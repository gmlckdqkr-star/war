/** Minimal DOM helpers (no framework, nothing to update or patch later). */
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Record<string, any> | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'disabled' || k === 'checked' || k === 'selected') (el as any)[k] = !!v;
      else if (k === 'value') (el as any).value = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function fmt(n: number) {
  return Math.round(n).toLocaleString('ko-KR');
}

// ------------------------------------------------------------------ toasts

let toastRoot: HTMLElement | null = null;
export function toast(text: string, level: 'info' | 'good' | 'warn' | 'danger' = 'info', onTap?: () => void, ms = 2600, cls = '') {
  if (!toastRoot) {
    toastRoot = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(toastRoot);
  }
  const t = h('div', { class: `toast ${level}${cls ? ' ' + cls : ''}`, role: 'status' }, text);
  if (onTap) {
    t.classList.add('tappable');
    t.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onTap();
      t.remove();
    });
  }
  toastRoot.append(t);
  // in battle the map matters more than the log: at most two alerts at a time
  const max = document.body.classList.contains('in-battle') ? 2 : 3;
  while (toastRoot.children.length > max) toastRoot.firstElementChild?.remove();
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

// ------------------------------------------------------------------ modal dialogs

export interface ModalButton {
  label: string;
  value: string;
  kind?: 'primary' | 'danger' | 'ghost';
}

export function modal(title: string, body: Child | Child[], buttons: ModalButton[], opts: { dismissable?: boolean; wide?: boolean } = {}): Promise<string> {
  return new Promise((resolve) => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const close = (v: string) => {
      back.remove();
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
      resolve(v);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opts.dismissable !== false) close('');
    };
    const box = h(
      'div',
      { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', null, title),
      h('div', { class: 'modal-body' }, ...(Array.isArray(body) ? body : [body])),
      h('div', { class: 'modal-buttons' }, ...buttons.map((b) => h('button', { class: `btn ${b.kind ?? ''}`, onclick: () => close(b.value) }, b.label))),
    );
    const back = h('div', { class: 'modal-back' }, box);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back && opts.dismissable !== false) close('');
    });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    (box.querySelector('.modal-buttons .primary') as HTMLElement | null)?.focus();
  });
}

export async function confirmBox(title: string, text: string, ok = '확인', danger = false): Promise<boolean> {
  const v = await modal(title, h('p', null, text), [
    { label: '취소', value: 'no', kind: 'ghost' },
    { label: ok, value: 'yes', kind: danger ? 'danger' : 'primary' },
  ]);
  return v === 'yes';
}

export function bar(frac: number, cls = '') {
  const f = Math.max(0, Math.min(1, frac));
  return h('div', { class: 'bar ' + cls }, h('div', { class: 'fill', style: { width: `${(f * 100).toFixed(1)}%` } }));
}

export function stars(n: number, max = 3) {
  return h('span', { class: 'stars', 'aria-label': `별 ${n}개` }, ...Array.from({ length: max }, (_, i) => h('span', { class: i < n ? 'star on' : 'star' }, '★')));
}
