import { h } from '../dom';

let host: HTMLElement | null = null;

/** Shows a transient message; `kind` only changes the border color (text carries the meaning). */
export function toast(message: string, kind: 'info' | 'ok' | 'error' = 'info', ms = 4500): void {
  if (!host) {
    host = h('div', { class: 'toast-host', attrs: { role: 'status', 'aria-live': 'polite' } });
    document.body.append(host);
  }
  const el = h('div', { class: `toast ${kind}`, text: message });
  host.append(el);
  window.setTimeout(() => el.remove(), ms);
}
