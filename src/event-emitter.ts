export class EventEmitter<
  Events extends { [K in keyof Events]: (...args: never[]) => void },
> {
  private listeners = new Map<keyof Events, Set<Events[keyof Events]>>();

  on<K extends keyof Events>(event: K, handler: Events[K]): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }

  off<K extends keyof Events>(event: K, handler: Events[K]): void {
    this.listeners.get(event)?.delete(handler);
  }

  protected emit<K extends keyof Events>(
    event: K,
    ...args: Parameters<Events[K]>
  ): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of set) {
        (handler as (...a: Parameters<Events[K]>) => void)(...args);
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}