/** Minimal observable store (pub/sub). */
export class Store<S extends object> {
  private listeners = new Set<(s: S, prev: S) => void>();

  constructor(private state: S) {}

  get(): S {
    return this.state;
  }

  set(patch: Partial<S>): void {
    const prev = this.state;
    this.state = { ...prev, ...patch };
    for (const fn of this.listeners) fn(this.state, prev);
  }

  subscribe(fn: (s: S, prev: S) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
