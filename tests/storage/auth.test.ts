import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSession } from '../../src/storage/auth';

describe('ensureSession', () => {
  it('parallelCallsMakeOneAnonymousSignIn', async () => {
    let session: { user: { id: string } } | null = null;
    const signInAnonymously = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      session = { user: { id: `u${signInAnonymously.mock.calls.length}` } };
      return { data: { user: session.user }, error: null };
    });
    const client = {
      auth: { getSession: async () => ({ data: { session } }), signInAnonymously },
    } as unknown as SupabaseClient;
    const [a, b] = await Promise.all([ensureSession(client), ensureSession(client)]);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(await ensureSession(client)).toBe(a);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('failedSignInCanBeRetried', async () => {
    const signInAnonymously = vi.fn()
      .mockResolvedValueOnce({ data: { user: null }, error: new Error('offline') })
      .mockResolvedValueOnce({ data: { user: { id: 'u' } }, error: null });
    const client = { auth: { getSession: async () => ({ data: { session: null } }), signInAnonymously } } as unknown as SupabaseClient;
    await expect(ensureSession(client)).rejects.toThrow();
    expect(await ensureSession(client)).toBe('u');
  });
});
