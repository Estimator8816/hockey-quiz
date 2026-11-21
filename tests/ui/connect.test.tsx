import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLocalStore } from '../../src/storage/store';
import { GameProvider } from '../../src/ui/useGame';
import { Routes } from '../../src/app';
import { content, memStorage } from './fixtures';

const h = vi.hoisted(() => ({
  role: null as 'parent' | 'child' | null,
  join: vi.fn(async (_c: unknown, _code: string): Promise<string> => 'child'),
  sync: vi.fn(async () => ({ pushed: 0, pulled: 0 })),
}));
vi.mock('../../src/storage/auth', async (orig) => ({
  ...(await orig<object>()),
  myRole: async () => h.role,
  ensureSession: async () => 'u',
  joinFamily: (c: unknown, code: string) => h.join(c, code),
}));
vi.mock('../../src/storage/sync', async (orig) => ({ ...(await orig<object>()), syncNow: h.sync }));

afterEach(() => { cleanup(); h.role = null; h.join.mockClear(); h.sync.mockClear(); });

const mountWith = (hash: string) => {
  location.hash = hash;
  return render(<GameProvider store={createLocalStore(memStorage())} client={{} as SupabaseClient} content={content}><Routes /></GameProvider>);
};

describe('подключение', () => {
  it('wrongPinRedirectsToParentJoin', async () => {
    h.join.mockRejectedValueOnce(new Error('wrong pin'));
    mountWith('#/join/abc');
    await waitFor(() => expect(location.hash).toBe('#/parent/join/abc'));
  });
  it('childJoinSyncsAndGoesHome', async () => {
    mountWith('#/join/abc');
    await waitFor(() => expect(h.sync).toHaveBeenCalled());
  });
  it('rulesShowStatusAndConnectByCode', async () => {
    mountWith('#/rules');
    await waitFor(() => expect(screen.getByTestId('conn-status').textContent).toBe('Не подключено'));
    fireEvent.input(screen.getByLabelText(/Код приглашения/), { target: { value: ' xyz ' } });
    h.role = 'child';
    fireEvent.click(screen.getByText('Подключиться'));
    await waitFor(() => expect(screen.getByTestId('conn-status').textContent).toBe('Подключено к семье'));
    expect(h.join).toHaveBeenCalledWith(expect.anything(), 'xyz');
    expect(h.sync).toHaveBeenCalled();
  });
  it('rulesStatusConnected', async () => {
    h.role = 'child';
    mountWith('#/rules');
    await waitFor(() => expect(screen.getByTestId('conn-status').textContent).toBe('Подключено к семье'));
  });
});
