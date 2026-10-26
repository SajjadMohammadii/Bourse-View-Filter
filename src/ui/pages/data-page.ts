import { h, clear } from '../dom';
import type { Page, PageContext } from '../page';
import type { AppState } from '../../app/appState';
import type { Dataset } from '../../core/types';
import { emptyState } from '../components/empty-state';
import { quickFilterBar } from '../components/quick-filters';

export type Cleanup = () => void;

/** Renders body when a dataset exists; returns an optional cleanup (destroy charts/tables). */
export type DataRenderer = (body: HTMLElement, ds: Dataset, state: AppState) => Cleanup | void;

export interface DataPageOptions {
  /** Show the quick filter chips and re-render when the global filter changes. */
  filters?: boolean;
}

/**
 * Base for every page that needs loaded data: shows the empty state until a file
 * is loaded and re-renders when the dataset, the global filter or display settings change.
 */
export function createDataPage(
  ctx: PageContext,
  title: string,
  render: DataRenderer,
  opts: DataPageOptions = {},
): Page {
  let unsubscribe: (() => void) | null = null;
  let cleanup: Cleanup | void;
  let bar: ReturnType<typeof quickFilterBar> | null = null;
  const root = h('div', { class: 'page' });
  const top = h('div');
  const body = h('div', { class: 'stack' });
  root.append(top, body);

  const draw = (state: AppState): void => {
    cleanup?.();
    cleanup = undefined;
    clear(body);
    if (!state.dataset) {
      body.append(
        h('h1', { text: title }),
        emptyState(() => ctx.pickFile()),
      );
      return;
    }
    if (opts.filters && !bar) {
      bar = quickFilterBar(ctx.app);
      top.append(bar.el);
    }
    cleanup = render(body, state.dataset, state);
  };

  const shouldRedraw = (s: AppState, prev: AppState): boolean =>
    s.dataset !== prev.dataset ||
    s.renderTick !== prev.renderTick ||
    s.settings.display !== prev.settings.display ||
    (opts.filters === true && s.visible !== prev.visible);

  return {
    title,
    mount(mountPoint) {
      mountPoint.append(root);
      draw(ctx.app.store.get());
      unsubscribe = ctx.app.store.subscribe((s, prev) => {
        if (shouldRedraw(s, prev)) draw(s);
      });
    },
    unmount() {
      unsubscribe?.();
      bar?.destroy();
      cleanup?.();
    },
  };
}
