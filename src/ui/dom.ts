/** Tiny DOM builder used by all components and pages (no framework). */
export type Child = Node | string | number | null | undefined | false | Child[];

export interface Props {
  class?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  on?: { [K in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[K]) => void };
  text?: string;
  html?: never;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

function applyProps(el: HTMLElement, props: Props): void {
  if (props.class) el.className = props.class;
  if (typeof props.style === 'string') el.setAttribute('style', props.style);
  else if (props.style) Object.assign(el.style, props.style);
  if (props.dataset) Object.assign(el.dataset, props.dataset);
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const [ev, fn] of Object.entries(props.on ?? {})) {
    el.addEventListener(ev, fn as EventListener);
  }
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replace(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

/** Wraps text that may contain a minus sign / LTR digits so it renders correctly in RTL. */
export function bdi(text: string, className = 'num'): HTMLElement {
  return h('bdi', { class: className, text });
}
