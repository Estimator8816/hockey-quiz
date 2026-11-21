import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameEvent } from '../engine/events';
import type { EventStore } from './store';

export async function syncNow(
  store: EventStore,
  client: SupabaseClient,
): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0;
  let pulled = 0;
  try {
    const pending = store.pending();
    if (pending.length > 0) {
      const rows = pending.map((e) => ({ id: e.id, ts: e.ts, kind: e.kind, body: e }));
      const { error } = await client.from('events').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
      if (!error) {
        store.markSynced(pending.map((e) => e.id));
        pushed = pending.length;
      }
    }
  } catch {
    /* офлайн: pending остаётся */
  }
  try {
    const { data, error } = await client.from('events').select('*').order('ts');
    if (!error && data) {
      const before = store.all().length;
      store.merge(data.map((r: { body: unknown }) => r.body as GameEvent));
      pulled = store.all().length - before;
    }
  } catch {
    /* офлайн */
  }
  return { pushed, pulled };
}

export function startAutoSync(store: EventStore, client: SupabaseClient): () => void {
  let inFlight = false;
  let again = false;
  const run = async () => {
    if (inFlight) { again = true; return; }
    inFlight = true;
    try {
      await syncNow(store, client);
    } finally {
      inFlight = false;
    }
    if (again) { again = false; void run(); }
  };
  const unsub = store.subscribe(() => {
    if (store.pending().some((e) => e.kind === 'match_end')) void run();
  });
  const onOnline = () => { void run(); };
  globalThis.addEventListener?.('online', onOnline);
  void run();
  return () => {
    unsub();
    globalThis.removeEventListener?.('online', onOnline);
  };
}
