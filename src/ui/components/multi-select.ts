import { h, replace } from '../dom';
import { fa } from '../../i18n/fa';
import { fv } from '../format';

export interface MultiOption {
  value: string;
  label: string;
  count?: number;
}

/** Dropdown with a search box and checkboxes; calls onChange with the selected values. */
export function multiSelect(
  title: string,
  options: MultiOption[],
  selected: string[],
  onChange: (values: string[]) => void,
): HTMLElement {
  let current = new Set(selected);
  const summary = h('summary', { class: 'chip' });
  const list = h('div', { class: 'ms-list' });
  const search = h('input', {
    class: 'input',
    attrs: { type: 'search', placeholder: fa.app.search, 'aria-label': title },
  });
  const renderSummary = () => {
    summary.textContent = current.size
      ? `${title}: ${fa.quick.selected(current.size)}`
      : `${title}: ${fa.quick.any}`;
    summary.classList.toggle('active', current.size > 0);
  };
  const renderList = () => {
    const q = search.value.trim();
    replace(
      list,
      options
        .filter((o) => !q || o.label.includes(q) || o.value.includes(q))
        .map((o) => {
          const box = h('input', { attrs: { type: 'checkbox', checked: current.has(o.value) } });
          box.addEventListener('change', () => {
            if (box.checked) current.add(o.value);
            else current.delete(o.value);
            renderSummary();
            onChange([...current]);
          });
          return h(
            'label',
            { class: 'ms-item' },
            box,
            h('span', { class: 'grow', text: o.label }),
            o.count !== undefined ? h('bdi', { class: 'faint num', text: fv(o.count, 'rank') }) : null,
          );
        }),
    );
  };
  const clearBtn = h('button', {
    class: 'btn sm ghost',
    text: fa.quick.reset,
    on: {
      click: () => {
        current = new Set();
        renderSummary();
        renderList();
        onChange([]);
      },
    },
  });
  search.addEventListener('input', renderList);
  renderSummary();
  renderList();
  return h(
    'details',
    { class: 'dropdown' },
    summary,
    h('div', { class: 'menu card' }, h('div', { class: 'row' }, search, clearBtn), list),
  );
}
