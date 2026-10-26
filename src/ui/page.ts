/** Contract every routed page implements. */
export interface Page {
  readonly title: string;
  mount(root: HTMLElement): void;
  unmount?(): void;
}

export type PageFactory = (params: Record<string, string>) => Page;
