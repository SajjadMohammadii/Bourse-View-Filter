import { h, clear } from './dom';
import { fa } from '../i18n/fa';
import { HashRouter, type RouteMatch } from './router';
import { navItems, buildRoutes, defaultRoute } from './routes';
import type { Page, PageContext } from './page';
import type { App, AppState } from '../app/appState';
import { formatDate } from '../core/utils/format';
import { toast } from './components/toast';
import { globalFilterBox } from './components/global-filter';
import { StockDrawer } from './pages/stock/stock-drawer';
import { num, setFormat } from './format';

const toPersianDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)] ?? d);

const ACCEPT = '.xlsx,.xls,.csv';

/** Application chrome: top bar, side navigation, routed outlet, file loading. */
export class Shell {
  private readonly outlet = h('main', { class: 'main', attrs: { id: 'main', tabindex: -1 } });
  private readonly sidebar = h('aside', { class: 'sidebar', attrs: { 'aria-label': fa.app.menu } });
  private readonly topbar = h('header', { class: 'topbar' });
  private readonly dateLabel = h('span', { class: 'snapshot-date', text: fa.app.noSnapshot });
  private readonly status = h('span', { class: 'row muted', attrs: { 'aria-live': 'polite' } });
  private readonly fileInput = h('input', { attrs: { type: 'file', accept: ACCEPT, hidden: true } });
  private readonly overlay = h('div', { class: 'drop-overlay', text: fa.app.dropHere });
  private readonly navLinks = new Map<string, HTMLAnchorElement>();
  private readonly router = new HashRouter(buildRoutes(), defaultRoute);
  private readonly search = h('input', {
    class: 'input symbol-search',
    attrs: {
      type: 'search',
      list: 'bv-symbols',
      placeholder: fa.app.searchSymbol,
      'aria-label': fa.app.searchSymbol,
    },
  });
  private readonly symbolList = h('datalist', { attrs: { id: 'bv-symbols' } });
  private current: Page | null = null;

  constructor(private readonly app: App) {
    setFormat(app.store.get().settings.display);
    app.confirmReplace = (date) => Promise.resolve(window.confirm(fa.history.replace(toPersianDigits(date))));
  }

  mount(root: HTMLElement): void {
    this.buildSidebar();
    this.buildTopbar();
    root.append(
      h('div', { class: 'shell' }, this.sidebar, this.topbar, this.outlet),
      this.overlay,
      this.fileInput,
      this.symbolList,
    );
    new StockDrawer(this.app).mount(root);
    this.bindFileLoading();
    this.bindSearch();
    this.app.store.subscribe((s, prev) => this.onState(s, prev));
    this.router.onChange((m) => this.show(m));
    this.router.start();
  }

  pickFile(): void {
    this.fileInput.click();
  }

  private context(params: Record<string, string>): PageContext {
    return {
      app: this.app,
      params,
      navigate: (path) => this.router.navigate(path),
      pickFile: () => this.pickFile(),
    };
  }

  private buildSidebar(): void {
    const nav = h('nav', { class: 'nav' });
    for (const item of navItems) {
      if (item.separatorBefore) nav.append(h('div', { class: 'nav-sep', attrs: { role: 'separator' } }));
      const link = h(
        'a',
        { attrs: { href: `#${item.path}` }, on: { click: () => this.sidebar.classList.remove('open') } },
        h('span', { class: 'nav-icon', attrs: { 'aria-hidden': 'true' }, text: item.icon }),
        item.label,
      );
      this.navLinks.set(item.path, link);
      nav.append(link);
    }
    this.sidebar.append(
      h('div', { class: 'brand' }, fa.app.name, h('span', { class: 'logo', text: 'BV' })),
      nav,
    );
  }

  private buildTopbar(): void {
    const toggle = h('button', {
      class: 'btn ghost menu-toggle',
      text: '☰',
      attrs: { 'aria-label': fa.app.menu },
      on: { click: () => this.sidebar.classList.toggle('open') },
    });
    const load = h('button', {
      class: 'btn primary',
      text: `⇪ ${fa.app.loadFile}`,
      on: { click: () => this.pickFile() },
    });
    const filter = globalFilterBox(this.app, () => this.router.navigate('/filter-studio'));
    this.topbar.append(toggle, this.dateLabel, this.status, filter, this.search, load);
  }

  private bindFileLoading(): void {
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (file) void this.app.loadFile(file);
      this.fileInput.value = '';
    });
    let depth = 0;
    window.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      this.overlay.classList.add('active');
    });
    window.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) this.overlay.classList.remove('active');
    });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      depth = 0;
      this.overlay.classList.remove('active');
      const file = e.dataTransfer?.files[0];
      if (file) void this.app.loadFile(file);
    });
  }

  private bindSearch(): void {
    const open = () => {
      const q = this.search.value.trim();
      const ds = this.app.store.get().dataset;
      if (!q || !ds) return;
      const i = ds.symbols.indexOf(q);
      const k = i >= 0 ? i : (ds.text['Company'] ?? []).findIndex((c) => c.includes(q));
      if (k >= 0) {
        this.app.select(ds.symbols[k] ?? null);
        this.search.value = '';
      } else toast(fa.stock.notFound, 'error');
    };
    this.search.addEventListener('change', open);
    this.search.addEventListener('keydown', (e) => e.key === 'Enter' && open());
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.search.focus();
      }
    });
  }

  private onState(s: AppState, prev: AppState): void {
    if (s.settings.display !== prev.settings.display) setFormat(s.settings.display);
    clear(this.status);
    if (s.status === 'loading') this.status.append(h('span', { class: 'spinner' }), fa.app.loading);
    if (s.error && s.error !== prev.error) toast(s.error, 'error');
    if (s.dataset && s.dataset.fileName !== prev.dataset?.fileName) {
      this.symbolList.replaceChildren(
        ...s.dataset.symbols.map((sym, i) =>
          h('option', { attrs: { value: sym }, text: s.dataset?.text['Company']?.[i] ?? '' }),
        ),
      );
    }
    if (s.dataset && s.dataset !== prev.dataset && s.status === 'ready' && prev.status === 'loading') {
      const ds = s.dataset;
      this.dateLabel.textContent = `${fa.app.snapshot}: ${formatDate(ds.snapshotDate, s.settings.display)} · ${num(ds.size, 0)} ${fa.app.symbols}`;
      const total = Object.values(s.timings).reduce((a, b) => a + b, 0);
      toast(`${fa.app.loaded} (${num(total, 0)} ms)`, 'ok');
    }
  }

  private show({ route, params }: RouteMatch): void {
    this.current?.unmount?.();
    clear(this.outlet);
    this.current = route.factory(this.context(params));
    this.current.mount(this.outlet);
    document.title = `${this.current.title} — ${fa.app.name}`;
    for (const [path, link] of this.navLinks) {
      if (path === route.path) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
}
