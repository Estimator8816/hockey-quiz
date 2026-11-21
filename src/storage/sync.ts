import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameEvent } from '../engine/events';
import type { EventStore } from './store';

const PAGE = 1000;

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
  const fetched: GameEvent[] = [];
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await client
        .from('events').select('*').order('ts').order('id').range(from, from + PAGE - 1);
      if (error || !data) break;
      for (const r of data as { body: unknown }[]) fetched.push(r.body as GameEvent);
      if (data.length < PAGE) break;
    }
  } catch {
    /* офлайн: сливаем, что успели скачать */
  }
  const before = store.all().length;
  store.merge(fetched);
  pulled = store.all().length - before;
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
