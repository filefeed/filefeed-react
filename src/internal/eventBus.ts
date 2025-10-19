/**
 * Tiny event emitter for internal use.
 */
type Handler = (payload: any) => void;

class Emitter {
  private map = new Map<string, Set<Handler>>();

  on(eventName: string, handler: Handler): () => void {
    if (!this.map.has(eventName)) this.map.set(eventName, new Set());
    const set = this.map.get(eventName)!;
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.map.delete(eventName);
    };
  }

  emit(eventName: string, payload?: any) {
    const set = this.map.get(eventName);
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (e) {
        // swallow to avoid crashing all listeners
        console.error("[filefeed:eventBus] handler error", e);
      }
    }
  }
}

export const eventBus = new Emitter();

export function matchesFilter(payload: any, filter?: Record<string, any>) {
  if (!filter) return true;
  for (const [k, v] of Object.entries(filter)) {
    if (payload?.[k] !== v) return false;
  }
  return true;
}


