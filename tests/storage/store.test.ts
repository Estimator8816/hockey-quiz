import { describe, it, expect } from 'vitest';
import { createLocalStore } from '../../src/storage/store';
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
const ev = (id: string): GameEvent => ({ id, ts: 1, kind: 'flag', questionId: 'q' });

describe('local store', () => {
  it('appendGoesToAllAndPending', () => {
    const s = createLocalStore(fakeStorage());
    s.append(ev('a'));
    s.append(ev('a'));
    expect(s.all().map((e) => e.id)).toEqual(['a']);
    expect(s.pending().map((e) => e.id)).toEqual(['a']);
  });
  it('markSyncedClearsPending', () => {
    const s = createLocalStore(fakeStorage());
    s.append(ev('a')); s.append(ev('b'));
    s.markSynced(['a', 'zzz']);
    expect(s.pending().map((e) => e.id)).toEqual(['b']);
    expect(s.all()).toHaveLength(2);
  });
  it('mergeSkipsKnownIds', () => {
    const s = createLocalStore(fakeStorage());
    s.append(ev('a'));
    s.merge([ev('a'), ev('r1')]);
    expect(s.all().map((e) => e.id)).toEqual(['a', 'r1']);
    expect(s.pending().map((e) => e.id)).toEqual(['a']);
  });
  it('survivesReload', () => {
    const st = fakeStorage();
    createLocalStore(st).append(ev('a'));
    const s2 = createLocalStore(st);
    expect(s2.all().map((e) => e.id)).toEqual(['a']);
    expect(s2.pending().map((e) => e.id)).toEqual(['a']);
  });
  it('corruptJsonStartsEmpty', () => {
    const st = fakeStorage();
    st.setItem('hq.events.v1', '{oops');
    st.setItem('hq.pending.v1', '{"x":1}');
    const s = createLocalStore(st);
    expect(s.all()).toEqual([]);
    expect(s.pending()).toEqual([]);
    expect(() => s.append(ev('a'))).not.toThrow();
  });
  it('subscribersNotified', () => {
    const s = createLocalStore(fakeStorage());
    let n = 0;
    const off = s.subscribe(() => n++);
    s.append(ev('a'));
    s.merge([ev('a')]);
    s.merge([ev('r')]);
    expect(n).toBe(2);
    off();
    s.append(ev('b'));
    expect(n).toBe(2);
  });
});
