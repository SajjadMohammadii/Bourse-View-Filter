import { h } from '../dom';
import { fa } from '../../i18n/fa';

/** Shown on data pages until a file is loaded. */
export function emptyState(onPick: () => void): HTMLElement {
  return h(
    'div',
    { class: 'card empty' },
    h('div', { class: 'big', attrs: { 'aria-hidden': 'true' }, text: '⇪' }),
    h('h2', { text: fa.empty.title }),
    h('p', { class: 'muted', text: fa.empty.body }),
    h('button', { class: 'btn primary', text: fa.app.loadFile, on: { click: onPick } }),
  );
}
