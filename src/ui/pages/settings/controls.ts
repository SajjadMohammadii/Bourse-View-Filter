import { h } from '../../dom';

/** Small labelled form controls used by the settings page. */

export function numberField(
  label: string,
  value: number,
  onChange: (v: number) => void,
  opts: { min?: number; max?: number; step?: number } = {},
): HTMLElement {
  const input = h('input', {
    class: 'input num',
    style: 'width:140px',
    attrs: {
      type: 'number',
      value: String(value),
      min: opts.min,
      max: opts.max,
      step: opts.step ?? 'any',
      'aria-label': label,
    },
  });
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (input.value !== '' && Number.isFinite(v)) onChange(v);
  });
  return h('label', { class: 'field' }, h('span', { text: label }), input);
}

export function toggleField(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const box = h('input', { attrs: { type: 'checkbox', checked } });
  box.addEventListener('change', () => onChange(box.checked));
  return h('label', { class: 'row', style: 'cursor:pointer' }, box, h('span', { text: label }));
}

export function segField<T extends string>(
  label: string,
  options: Array<[T, string]>,
  value: T,
  onChange: (v: T) => void,
): HTMLElement {
  return h(
    'div',
    { class: 'field' },
    h('span', { text: label }),
    h(
      'div',
      { class: 'seg', attrs: { role: 'group', 'aria-label': label } },
      options.map(([v, l]) =>
        h('button', { text: l, attrs: { 'aria-pressed': v === value }, on: { click: () => onChange(v) } }),
      ),
    ),
  );
}

/** Percent ↔ fraction helper for inputs shown in ٪. */
export const pctIn = (fraction: number): number => Math.round(fraction * 10000) / 100;
