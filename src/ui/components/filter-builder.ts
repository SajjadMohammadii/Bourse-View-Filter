import { h, replace, type Child } from '../dom';
import { fa } from '../../i18n/fa';
import type { Dataset, FieldMeta } from '../../core/types';
import {
  newId,
  emptyGroup,
  type BuilderCond,
  type BuilderGroup,
  type BuilderNode,
  type CondOp,
} from '../../core/filters/builderModel';
import { summarize } from '../../core/utils/fieldSummary';
import { exchangeLabels } from '../../config/columns';
import { fieldSelect } from './field-select';
import { multiSelect } from './multi-select';
import { miniHistogram } from './mini-histogram';
import { inputScale, toDisplay, toStored } from './value-units';

const S = fa.builder;

const OPS: Record<'num' | 'text' | 'bool', Array<[CondOp, string]>> = {
  num: [
    ['>', '>'],
    ['>=', '≥'],
    ['<', '<'],
    ['<=', '≤'],
    ['=', '='],
    ['!=', '≠'],
    ['between', S.ops.between],
    ['isNull', S.ops.isNull],
    ['notNull', S.ops.notNull],
  ],
  text: [
    ['in', S.ops.in],
    ['notIn', S.ops.notIn],
    ['=', '='],
    ['!=', '≠'],
    ['contains', S.ops.contains],
    ['isNull', S.ops.isNull],
    ['notNull', S.ops.notNull],
  ],
  bool: [
    ['isTrue', S.ops.isTrue],
    ['isFalse', S.ops.isFalse],
  ],
};

type Kind = 'num' | 'text' | 'bool';

function kindOf(meta: FieldMeta | undefined): Kind {
  if (!meta || meta.kind === 'text') return meta ? 'text' : 'num';
  return meta.unit === 'flag' ? 'bool' : 'num';
}

/**
 * Visual filter builder (PLAN.md §11.6): nested AND/OR groups, per-row enable toggle,
 * drag-to-reorder within a group, unit-aware values and a distribution preview.
 */
export class FilterBuilder {
  readonly el = h('div', { class: 'builder' });
  private dragged: string | null = null;

  constructor(
    private readonly ds: Dataset,
    private root: BuilderGroup,
    private readonly onChange: (root: BuilderGroup) => void,
  ) {
    this.render();
  }

  setRoot(root: BuilderGroup): void {
    this.root = root;
    this.render();
  }

  private changed(): void {
    this.render();
    this.onChange(this.root);
  }

  private render(): void {
    replace(
      this.el,
      this.group(this.root, null),
      this.root.children.length ? null : h('p', { class: 'faint', text: S.empty }),
    );
  }

  private group(g: BuilderGroup, parent: BuilderGroup | null): HTMLElement {
    const opToggle = h(
      'div',
      { class: 'seg' },
      (['AND', 'OR'] as const).map((op) =>
        h('button', {
          text: op === 'AND' ? S.and : S.or,
          attrs: { 'aria-pressed': g.op === op },
          on: {
            click: () => {
              g.op = op;
              this.changed();
            },
          },
        }),
      ),
    );
    const head = h(
      'div',
      { class: 'row builder-head' },
      this.enabledBox(g),
      opToggle,
      h('button', {
        class: 'btn sm',
        text: S.addCond,
        on: {
          click: () => {
            g.children.push(this.newCond());
            this.changed();
          },
        },
      }),
      h('button', {
        class: 'btn sm',
        text: S.addGroup,
        on: {
          click: () => {
            g.children.push(emptyGroup(g.op === 'AND' ? 'OR' : 'AND'));
            this.changed();
          },
        },
      }),
      parent ? this.removeBtn(parent, g) : null,
    );
    const children = g.children.map((c) =>
      this.draggable(g, c, c.kind === 'group' ? this.group(c, g) : this.cond(c, g)),
    );
    return h(
      'div',
      { class: `builder-group ${g.enabled ? '' : 'disabled'}` },
      head,
      h('div', { class: 'builder-children' }, children),
    );
  }

  private cond(c: BuilderCond, parent: BuilderGroup): HTMLElement {
    const meta = this.ds.meta[c.field];
    const kind = kindOf(meta);
    const fields = fieldSelect(this.ds, { placeholder: S.field, value: c.field });
    fields.addEventListener('change', () => {
      const next = this.ds.meta[fields.value];
      c.field = fields.value;
      c.op = OPS[kindOf(next)][0]?.[0] ?? '>';
      c.value = undefined;
      c.value2 = undefined;
      c.values = [];
      this.changed();
    });
    const ops = h(
      'select',
      { class: 'select', attrs: { 'aria-label': S.operator } },
      OPS[kind].map(([op, label]) =>
        h('option', { attrs: { value: op, selected: op === c.op }, text: label }),
      ),
    );
    ops.addEventListener('change', () => {
      c.op = ops.value as CondOp;
      this.changed();
    });
    const preview =
      meta && kind === 'num' && this.ds.num[c.field]
        ? miniHistogram(summarize(this.ds.num[c.field] as Float64Array), meta.unit)
        : null;
    return h(
      'div',
      { class: `builder-cond ${c.enabled ? '' : 'disabled'}` },
      h(
        'div',
        { class: 'row' },
        this.enabledBox(c),
        fields,
        c.field ? ops : null,
        c.field ? this.valueInputs(c, kind, meta) : null,
        this.removeBtn(parent, c),
      ),
      preview ? h('div', { style: 'padding-inline-start:28px' }, preview) : null,
    );
  }

  private valueInputs(c: BuilderCond, kind: Kind, meta: FieldMeta | undefined): Child {
    if (kind === 'bool' || c.op === 'isNull' || c.op === 'notNull') return null;
    if (kind === 'text') {
      if (c.op === 'in' || c.op === 'notIn') {
        const counts = new Map<string, number>();
        for (const v of this.ds.text[c.field] ?? []) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
        const opts = [...counts]
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({
            value,
            label: c.field === 'Exchange' ? (exchangeLabels[value] ?? value) : value,
            count,
          }));
        return multiSelect(meta?.label ?? c.field, opts, (c.values ?? []).map(String), (vals) => {
          c.values = vals;
          this.onChange(this.root);
        });
      }
      return this.textInput(String(c.value ?? ''), (v) => (c.value = v));
    }
    const unit = meta?.unit;
    const suffix = inputScale(unit).suffix;
    const num = (val: number | undefined, set: (v: number | undefined) => void) => {
      const input = h('input', {
        class: 'input num',
        style: 'width:110px',
        attrs: {
          type: 'number',
          step: 'any',
          value: val === undefined ? '' : String(toDisplay(val, unit)),
          'aria-label': S.value,
        },
      });
      input.addEventListener('change', () => {
        set(input.value === '' ? undefined : toStored(Number(input.value), unit));
        this.onChange(this.root);
      });
      return input;
    };
    const first = num(typeof c.value === 'number' ? c.value : undefined, (v) => (c.value = v));
    const unitLabel = suffix ? h('span', { class: 'muted', text: suffix }) : null;
    if (c.op !== 'between') return [first, unitLabel];
    return [
      first,
      h('span', { class: 'muted', text: S.to }),
      num(c.value2, (v) => (c.value2 = v)),
      unitLabel,
    ];
  }

  private textInput(value: string, set: (v: string) => void): HTMLElement {
    const input = h('input', { class: 'input', attrs: { type: 'text', value, 'aria-label': S.value } });
    input.addEventListener('change', () => {
      set(input.value);
      this.onChange(this.root);
    });
    return input;
  }

  private enabledBox(node: BuilderNode): HTMLElement {
    const box = h('input', {
      attrs: { type: 'checkbox', checked: node.enabled, title: S.enabled, 'aria-label': S.enabled },
    });
    box.addEventListener('change', () => {
      node.enabled = box.checked;
      this.changed();
    });
    return box;
  }

  private removeBtn(parent: BuilderGroup, node: BuilderNode): HTMLElement {
    return h('button', {
      class: 'btn sm ghost',
      text: '✕',
      attrs: { title: S.remove, 'aria-label': S.remove },
      on: {
        click: () => {
          parent.children = parent.children.filter((c) => c !== node);
          this.changed();
        },
      },
    });
  }

  private newCond(): BuilderCond {
    return { kind: 'cond', id: newId(), enabled: true, field: '', op: '>' };
  }

  /** Drag handle reorders siblings inside the same group. */
  private draggable(parent: BuilderGroup, node: BuilderNode, content: HTMLElement): HTMLElement {
    const wrap = h(
      'div',
      { class: 'builder-item', attrs: { draggable: 'true', title: S.drag } },
      h('span', { class: 'drag-handle', attrs: { 'aria-hidden': 'true' }, text: '⋮⋮' }),
      content,
    );
    wrap.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      this.dragged = node.id;
      e.dataTransfer?.setData('text/plain', node.id);
    });
    wrap.addEventListener('dragover', (e) => {
      if (this.dragged && parent.children.some((c) => c.id === this.dragged)) e.preventDefault();
    });
    wrap.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const from = parent.children.findIndex((c) => c.id === this.dragged);
      const to = parent.children.indexOf(node);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = parent.children.splice(from, 1);
      if (moved) parent.children.splice(to, 0, moved);
      this.dragged = null;
      this.changed();
    });
    return wrap;
  }
}
