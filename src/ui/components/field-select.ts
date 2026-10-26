import { h } from '../dom';
import type { Category, Dataset, FieldMeta } from '../../core/types';
import { categoryLabels } from '../../config/columns';

export interface FieldSelectOptions {
  placeholder: string;
  filter?: (m: FieldMeta) => boolean;
  value?: string;
}

/** <select> of dataset fields grouped by category (optgroups), searchable by typing. */
export function fieldSelect(ds: Dataset, opts: FieldSelectOptions): HTMLSelectElement {
  const groups = new Map<Category, FieldMeta[]>();
  for (const m of Object.values(ds.meta)) {
    if (opts.filter && !opts.filter(m)) continue;
    const list = groups.get(m.category) ?? [];
    list.push(m);
    groups.set(m.category, list);
  }
  const select = h(
    'select',
    { class: 'select', attrs: { 'aria-label': opts.placeholder } },
    h('option', { attrs: { value: '' }, text: opts.placeholder }),
  );
  for (const [cat, metas] of groups) {
    const og = h('optgroup', { attrs: { label: categoryLabels[cat] } });
    for (const m of metas) {
      og.append(
        h('option', { attrs: { value: m.id, selected: m.id === opts.value }, text: `${m.label} — ${m.id}` }),
      );
    }
    select.append(og);
  }
  return select;
}

/** <select> of categories present in the dataset. */
export function categorySelect(ds: Dataset, placeholder: string): HTMLSelectElement {
  const cats = [...new Set(Object.values(ds.meta).map((m) => m.category))];
  return h(
    'select',
    { class: 'select', attrs: { 'aria-label': placeholder } },
    h('option', { attrs: { value: '' }, text: placeholder }),
    cats.map((c) => h('option', { attrs: { value: c }, text: categoryLabels[c] })),
  );
}
