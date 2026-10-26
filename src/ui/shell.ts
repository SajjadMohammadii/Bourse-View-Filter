import { h, clear } from './dom';
import { fa } from '../i18n/fa';
import { HashRouter, type RouteMatch } from './router';
import { navItems, buildRoutes, defaultRoute } from './routes';
import type { Page } from './page';

/** Application chrome: top bar, side navigation and the routed page outlet. */
export class Shell {
  private readonly outlet = h('main', { class: 'main', attrs: { id: 'main', tabindex: -1 } });
  private readonly sidebar = h('aside', { class: 'sidebar', attrs: { 'aria-label': fa.app.menu } });
  private readonly topbar = h('header', { class: 'topbar' });
  private readonly navLinks = new Map<string, HTMLAnchorElement>();
  private readonly router = new HashRouter(buildRoutes(), defaultRoute);
  private current: Page | null = null;

  mount(root: HTMLElement): void {
    this.buildSidebar();
    this.buildTopbar();
    root.append(h('div', { class: 'shell' }, this.sidebar, this.topbar, this.outlet));
    this.router.onChange((m) => this.show(m));
    this.router.start();
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
    const brand = h('div', { class: 'brand' }, fa.app.name, h('span', { class: 'logo', text: 'BV' }));
    this.sidebar.append(brand, nav);
  }

  private buildTopbar(): void {
    const toggle = h('button', {
      class: 'btn ghost menu-toggle',
      text: '☰',
      attrs: { 'aria-label': fa.app.menu },
      on: { click: () => this.sidebar.classList.toggle('open') },
    });
    this.topbar.append(
      toggle,
      h('span', { class: 'snapshot-date', text: fa.app.noSnapshot }),
      h('div', { class: 'spacer' }),
    );
  }

  private show({ route, params }: RouteMatch): void {
    this.current?.unmount?.();
    clear(this.outlet);
    this.current = route.factory(params);
    this.current.mount(this.outlet);
    document.title = `${this.current.title} — ${fa.app.name}`;
    for (const [path, link] of this.navLinks) {
      if (path === route.path) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  }
}
