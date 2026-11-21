import type { GameEvent } from '../engine/events';
import { dedupe } from '../engine/progress';

export interface EventStore {
  all(): GameEvent[];
  append(e: GameEvent): void;
  pending(): GameEvent[];
  markSynced(ids: string[]): void;
  merge(remote: GameEvent[]): void;
  subscribe(fn: () => void): () => void;
}

const EVENTS_KEY = 'hq.events.v1';
const PENDING_KEY = 'hq.pending.v1';

function readArray(storage: Storage | undefined, key: string): unknown[] {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function createLocalStore(storage: Storage | undefined = globalThis.localStorage): EventStore {
  let events: GameEvent[] = dedupe(
    readArray(storage, EVENTS_KEY).filter((e): e is GameEvent => !!e && typeof (e as GameEvent).id === 'string'),
  );
  const known = new Set(events.map((e) => e.id));
  let pendingIds: string[] = readArray(storage, PENDING_KEY).filter(
    (id): id is string => typeof id === 'string' && known.has(id),
  );
  const subs = new Set<() => void>();

  const persist = () => {
    try {
      storage?.setItem(EVENTS_KEY, JSON.stringify(events));
      storage?.setItem(PENDING_KEY, JSON.stringify(pendingIds));
    } catch {
      /* quota or blocked storage: keep in-memory state */
    }
  };
  const notify = () => subs.forEach((fn) => fn());

  return {
    all: () => events.slice(),
    append(e) {
      if (known.has(e.id)) return;
      known.add(e.id);
      events = [...events, e];
      pendingIds = [...pendingIds, e.id];
      persist();
      notify();
    },
    pending() {
      const p = new Set(pendingIds);
      return events.filter((e) => p.has(e.id));
    },
    markSynced(ids) {
      const drop = new Set(ids);
      const next = pendingIds.filter((id) => !drop.has(id));
      if (next.length === pendingIds.length) return;
      pendingIds = next;
      persist();
    },
    merge(remote) {
      const fresh = dedupe(remote).filter((e) => !known.has(e.id));
      if (fresh.length === 0) return;
      for (const e of fresh) known.add(e.id);
      events = [...events, ...fresh];
      persist();
      notify();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}

export async function requestPersistence(): Promise<boolean> {
  try {
    const persist = globalThis.navigator?.storage?.persist;
    if (!persist) return false;
    return !!(await globalThis.navigator.storage.persist());
  } catch {
    return false;
  }
}
