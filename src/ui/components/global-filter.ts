import { h } from '../dom';
import { fa } from '../../i18n/fa';
import type { App } from '../../app/appState';

/** Expression box for the global filter in the top bar; Enter applies, errors are shown inline. */
export function globalFilterBox(app: App, openStudio: () => void): HTMLElement {
  const input = h('input', {
    class: 'input',
    attrs: {
      type: 'text',
      placeholder: fa.filter.placeholder,
      'aria-label': fa.filter.global,
      spellcheck: 'false',
      dir: 'ltr',
    },
  });
  const apply = () => app.setFilterText(input.value);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') {
      input.value = '';
      apply();
    }
  });
  const studio = h('button', {
    class: 'btn sm',
    text: '⚗',
    attrs: { title: fa.filter.edit, 'aria-label': fa.filter.edit },
    on: { click: openStudio },
  });
  app.store.subscribe((s, prev) => {
    if (s.filterText !== prev.filterText && document.activeElement !== input) input.value = s.filterText;
    if (s.filterError !== prev.filterError) {
      input.classList.toggle('invalid', !!s.filterError);
      input.title = s.filterError ? `${fa.filter.invalid}: ${s.filterError.message}` : '';
    }
  });
  return h(
    'div',
    { class: 'global-filter hide-sm' },
    input,
    h('button', { class: 'btn sm', text: fa.filter.apply, on: { click: apply } }),
    studio,
  );
}
