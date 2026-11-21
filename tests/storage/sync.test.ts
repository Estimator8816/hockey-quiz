import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLocalStore } from '../../src/storage/store';
import { syncNow } from '../../src/storage/sync';
import { getClient } from '../../src/storage/client';
import type { GameEvent } from '../../src/engine/events';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}
const ev = (id: string, ts = 1): GameEvent => ({ id, ts, kind: 'flag', questionId: 'q' });
const row = (e: GameEvent) => ({ id: e.id, ts: e.ts, kind: e.kind, body: e });

interface Fake { client: SupabaseClient; upserts: { rows: unknown[]; opts: unknown }[] }
function fakeClient(opts: { remote?: GameEvent[]; upsertError?: boolean; throws?: boolean } = {}): Fake {
  const upserts: Fake['upserts'] = [];
  const client = {
    from: (table: string) => {
      if (table !== 'events') throw new Error('unexpected table ' + table);
      return {
        upsert: async (rows: unknown[], o: unknown) => {
          if (opts.throws) throw new Error('network down');
          upserts.push({ rows, opts: o });
          return { error: opts.upsertError ? { message: 'fail' } : null };
        },
        select: () => ({
          order: async () => {
            if (opts.throws) throw new Error('network down');
            return { data: (opts.remote ?? []).map(row), error: null };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, upserts };
}

describe('sync', () => {
  it('pushesPendingThenPulls', async () => {
    const s = createLocalStore(fakeStorage());
    s.append(ev('a')); s.append(ev('b'));
    const f = fakeClient({ remote: [ev('r1', 5)] });
    const res = await syncNow(s, f.client);
    expect(f.upserts).toHaveLength(1);
    expect(f.upserts[0].rows).toEqual([row(ev('a')), row(ev('b'))]);
    expect(f.upserts[0].opts).toEqual({ onConflict: 'id', ignoreDuplicates: true });
    expect(s.pending()).toEqual([]);
    expect(s.all().map((e) => e.id)).toEqual(['a', 'b', 'r1']);
    expect(res).toEqual({ pushed: 2, pulled: 1 });
  });
  it('networkErrorKeepsPending', async () => {
    const s = createLocalStore(fakeStorage());
    s.append(ev('a'));
    const r1 = await syncNow(s, fakeClient({ throws: true }).client);
    expect(r1).toEqual({ pushed: 0, pulled: 0 });
    expect(s.pending().map((e) => e.id)).toEqual(['a']);
    const r2 = await syncNow(s, fakeClient({ upsertError: true }).client);
    expect(r2.pushed).toBe(0);
    expect(s.pending().map((e) => e.id)).toEqual(['a']);
  });
  it('pullMergesRemoteFromOtherDevice', async () => {
    const s = createLocalStore(fakeStorage());
    const f = fakeClient({ remote: [ev('x', 1), ev('y', 2)] });
    const res = await syncNow(s, f.client);
    expect(f.upserts).toHaveLength(0);
    expect(s.all().map((e) => e.id)).toEqual(['x', 'y']);
    expect(s.pending()).toEqual([]);
    expect(res).toEqual({ pushed: 0, pulled: 2 });
  });
  it('emptyConfigGivesNullClient', () => {
    expect(getClient()).toBeNull();
  });
});
