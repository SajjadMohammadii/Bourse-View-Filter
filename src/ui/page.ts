import type { App } from '../app/appState';

/** Everything a page may use: the app facade, route params and navigation. */
export interface PageContext {
  pickFile(): void;
  app: App;
  params: Record<string, string>;
  navigate(path: string): void;
}

/** Contract every routed page implements. */
export interface Page {
  readonly title: string;
  mount(root: HTMLElement): void;
  unmount?(): void;
}

export type PageFactory = (ctx: PageContext) => Page;
