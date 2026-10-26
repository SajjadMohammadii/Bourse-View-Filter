import { h, replace } from '../dom';
import type { Result } from '../../core/types';
import { completions, type Compiled, type FieldCatalog, type FilterErrorInfo } from '../../core/filters';

export interface ExpressionEditorOptions {
  value: string;
  placeholder: string;
  catalog: FieldCatalog;
  label: (id: string) => string | undefined;
  compile: (text: string) => Result<Compiled>;
  /** Called on every edit with the text and its compile result (null when empty). */
  onChange: (text: string, result: Result<Compiled> | null) => void;
  rows?: number;
}

const WORD = /[A-Za-z0-9_.؀-ۿ-]+$/;

/** Textarea with live validation, error caret and keyboard autocomplete (PLAN.md §11.8). */
export class ExpressionEditor {
  readonly el: HTMLElement;
  readonly textarea: HTMLTextAreaElement;
  private readonly list = h('ul', { class: 'completions card', attrs: { role: 'listbox', hidden: true } });
  private readonly message = h('div', { attrs: { 'aria-live': 'polite' } });
  private items: Array<{ label: string }> = [];
  private active = 0;

  constructor(private readonly opts: ExpressionEditorOptions) {
    this.textarea = h('textarea', {
      class: 'textarea',
      attrs: {
        rows: opts.rows ?? 3,
        placeholder: opts.placeholder,
        spellcheck: 'false',
        dir: 'ltr',
        'aria-label': opts.placeholder,
        'aria-autocomplete': 'list',
      },
    });
    this.textarea.value = opts.value;
    this.textarea.addEventListener('input', () => {
      this.validate();
      this.suggest();
    });
    this.textarea.addEventListener('keydown', (e) => this.onKey(e));
    this.textarea.addEventListener('blur', () => setTimeout(() => this.hide(), 150));
    this.el = h('div', { class: 'expr-editor' }, this.textarea, this.list, this.message);
    this.validate(false);
  }

  setValue(text: string): void {
    this.textarea.value = text;
    this.validate(false);
  }

  get value(): string {
    return this.textarea.value;
  }

  private validate(notify = true): void {
    const text = this.textarea.value;
    const result = text.trim() ? this.opts.compile(text) : null;
    this.textarea.classList.toggle('invalid', !!result && !result.ok);
    replace(this.message);
    if (result && !result.ok) {
      const info = (result.error.details ?? {}) as Partial<FilterErrorInfo>;
      const line = text.split('\n')[0] ?? '';
      const caret =
        info.start !== undefined && info.start <= line.length ? `${line}\n${' '.repeat(info.start)}^` : null;
      this.message.append(
        h(
          'div',
          { class: 'error-box' },
          result.error.message,
          caret ? h('pre', { class: 'error-caret', text: caret }) : null,
        ),
      );
    }
    if (notify) this.opts.onChange(text, result);
  }

  private suggest(): void {
    const before = this.textarea.value.slice(0, this.textarea.selectionStart);
    const word = WORD.exec(before)?.[0] ?? '';
    const found = word.length >= 2 ? completions(word, this.opts.catalog, this.opts.label, 12) : [];
    // A fully typed name needs no suggestions (and the list must not cover nearby buttons).
    const exact = found.some((c) => c.label === word || c.label === `${word}(`);
    this.items = exact ? [] : found;
    this.active = 0;
    if (!this.items.length) return this.hide();
    this.drawList();
  }

  private drawList(): void {
    this.list.hidden = false;
    replace(
      this.list,
      (this.items as ReturnType<typeof completions>).map((c, k) =>
        h(
          'li',
          {
            attrs: { role: 'option', 'aria-selected': k === this.active },
            on: {
              mousedown: (e) => {
                e.preventDefault();
                this.accept(k);
              },
            },
          },
          c.label,
          c.detail ? h('span', { text: c.detail }) : null,
        ),
      ),
    );
  }

  private onKey(e: KeyboardEvent): void {
    if (this.list.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.active = (this.active + (e.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
      this.drawList();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      this.accept(this.active);
    } else if (e.key === 'Escape') this.hide();
  }

  private accept(k: number): void {
    const item = this.items[k];
    if (!item) return;
    const pos = this.textarea.selectionStart;
    const before = this.textarea.value.slice(0, pos);
    const word = WORD.exec(before)?.[0] ?? '';
    const insert =
      /[^A-Za-z0-9_.(]/.test(item.label) && !item.label.includes(' ') ? `[${item.label}]` : item.label;
    this.textarea.value =
      before.slice(0, before.length - word.length) + insert + this.textarea.value.slice(pos);
    const caret = pos - word.length + insert.length;
    this.textarea.setSelectionRange(caret, caret);
    this.hide();
    this.textarea.focus();
    this.validate();
  }

  private hide(): void {
    this.list.hidden = true;
  }
}
