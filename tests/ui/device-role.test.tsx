import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/preact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLocalStore } from '../../src/storage/store';
import { App } from '../../src/app';
import { clearDeviceRole, getDeviceRole, setDeviceRole } from '../../src/storage/deviceRole';
import { content, memStorage } from './fixtures';

const h = vi.hoisted(() => ({
  join: vi.fn(async (): Promise<string> => 'child'),
}));
vi.mock('../../src/storage/auth', async (orig) => ({
  ...(await orig<object>()),
  myRole: async () => null,
  ensureSession: async () => 'u',
  joinFamily: () => h.join(),
}));
vi.mock('../../src/storage/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => ({ pushed: 0, pulled: 0 }) }));

afterEach(() => { cleanup(); clearDeviceRole(); h.join.mockClear(); });

const mountApp = (hash: string, client: SupabaseClient | null = {} as SupabaseClient) => {
  location.hash = hash;
  render(<App store={createLocalStore(memStorage())} client={client} content={content} />);
};

describe('чей телефон', () => {
  it('parentPhoneHomeGoesToParentNotTraining', async () => {
    setDeviceRole('parent');
    mountApp('#/');
    await waitFor(() => expect(location.hash).toBe('#/parent'));
  });
  it('parentIconRelaunchSkipsPin', async () => {
    setDeviceRole('parent');
    mountApp('#/parent/join/abc');
    await waitFor(() => expect(location.hash).toBe('#/parent'));
  });
  it('childIconRelaunchOfflineGoesHome', async () => {
    setDeviceRole('child');
    mountApp('#/join/abc', null);
    await waitFor(() => expect(location.hash).toBe('#/'));
    expect(h.join).not.toHaveBeenCalled();
  });
  it('childJoinRemembersPhone', async () => {
    mountApp('#/join/abc');
    await waitFor(() => expect(getDeviceRole()).toBe('child'));
  });
  it('firstLaunchShowsHomeButtonsNotGame', async () => {
    mountApp('#/', null);
    await waitFor(() => expect(document.querySelector('a.card-start')).toBeTruthy());
    expect(location.hash).toBe('#/');
    expect(document.querySelector('[data-testid="score"]')).toBeNull();
  });
});
