import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLocalStore } from '../../src/storage/store';
import { syncNow, startAutoSync } from '../../src/storage/sync';
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

interface Fake { client: SupabaseClient; upserts: { rows: unknown[]; opts: unknown }[]; selects: number[][] }
function fakeClient(opts: { remote?: GameEvent[]; upsertError?: boolean; throws?: boolean; gate?: () => Promise<void>; failAfterPages?: number } = {}): Fake {
  const upserts: Fake['upserts'] = [];
  const selects: number[][] = [];
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
          order: () => ({
            order: () => ({
              range: async (from: number, to: number) => {
                selects.push([from, to]);
                if (opts.gate) await opts.gate();
                if (opts.throws) throw new Error('network down');
                if (opts.failAfterPages !== undefined && selects.length > opts.failAfterPages) {
                  return { data: null, error: { message: 'fail' } };
                }
                return { data: (opts.remote ?? []).slice(from, to + 1).map(row), error: null };
              },
            }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, upserts, selects };
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
  it('pullsAllPagesBeyondThousand', async () => {
    const s = createLocalStore(fakeStorage());
    const remote = Array.from({ length: 1005 }, (_, i) => ev('e' + i, i));
    const f = fakeClient({ remote });
    const res = await syncNow(s, f.client);
    expect(f.selects).toEqual([[0, 999], [1000, 1999]]);
    expect(s.all()).toHaveLength(1005);
    expect(res.pulled).toBe(1005);
  });
  it('pagingErrorMergesWhatWasFetched', async () => {
    const s = createLocalStore(fakeStorage());
    const remote = Array.from({ length: 2500 }, (_, i) => ev('e' + i, i));
    await syncNow(s, fakeClient({ remote, failAfterPages: 1 }).client);
    expect(s.all()).toHaveLength(1000);
  });
  it('emptyConfigGivesNullClient', () => {
    expect(getClient('', '')).toBeNull();
    expect(getClient('https://x.supabase.co', '')).toBeNull();
  });
});

describe('startAutoSync', () => {
  it('syncsAtStartOnceFollowUpDuringFlightAndStopRemovesListener', async () => {
    const s = createLocalStore(fakeStorage());
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const f = fakeClient({ gate: () => gate });
    const add = vi.spyOn(globalThis, 'addEventListener');
    const remove = vi.spyOn(globalThis, 'removeEventListener');
    const stop = startAutoSync(s, f.client);
    expect(f.selects).toHaveLength(1); // start sync in flight
    const onlineCb = add.mock.calls.find((c) => c[0] === 'online')![1];
    s.append({ id: 'm1', ts: 1, kind: 'match_end' } as unknown as GameEvent);
    s.append({ id: 'm2', ts: 2, kind: 'match_end' } as unknown as GameEvent);
    expect(f.selects).toHaveLength(1); // still one in flight
    release();
    await vi.waitFor(() => expect(f.selects).toHaveLength(2)); // exactly one follow-up
    await new Promise((r) => setTimeout(r, 20));
    expect(f.selects).toHaveLength(2);
    stop();
    expect(remove).toHaveBeenCalledWith('online', onlineCb);
    add.mockRestore(); remove.mockRestore();
  });
});
