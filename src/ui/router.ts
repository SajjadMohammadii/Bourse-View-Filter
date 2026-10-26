import type { PageFactory } from './page';

export interface RouteDef {
  path: string;
  factory: PageFactory;
}

export interface RouteMatch {
  route: RouteDef;
  params: Record<string, string>;
}

/** Minimal hash router: "#/path?key=value". */
export class HashRouter {
  private listeners: Array<(m: RouteMatch) => void> = [];

  constructor(
    private readonly routes: RouteDef[],
    private readonly fallback: string,
  ) {
    window.addEventListener('hashchange', () => this.emit());
  }

  onChange(fn: (m: RouteMatch) => void): void {
    this.listeners.push(fn);
  }

  start(): void {
    if (!location.hash) location.replace(`#${this.fallback}`);
    this.emit();
  }

  navigate(path: string): void {
    location.hash = path;
  }

  current(): string {
    return parseHash(location.hash).path;
  }

  private emit(): void {
    const { path, params } = parseHash(location.hash);
    const route =
      this.routes.find((r) => r.path === path) ?? this.routes.find((r) => r.path === this.fallback);
    if (!route) return;
    for (const fn of this.listeners) fn({ route, params });
  }
}

export function parseHash(hash: string): { path: string; params: Record<string, string> } {
  const raw = hash.replace(/^#/, '') || '/';
  const [path = '/', query = ''] = raw.split('?');
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(query)) params[k] = v;
  return { path, params };
}
