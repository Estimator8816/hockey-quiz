import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLocalStore } from '../../src/storage/store';
import { newEvent, type MatchEndEvent } from '../../src/engine/events';
import { GameProvider } from '../../src/ui/useGame';
import { Routes } from '../../src/app';
import { content, memStorage, mount } from './fixtures';
import { clearDeviceRole, setDeviceRole } from '../../src/storage/deviceRole';
import { rememberInviteLink } from '../../src/ui/install';

const role = vi.hoisted(() => ({ value: 'parent' as 'parent' | 'child' | null, offline: false }));
vi.mock('../../src/storage/auth', async (orig) => ({ ...(await orig<object>()), myRole: async () => { if (role.offline) throw new Error('Load failed'); return role.value; }, ensureSession: async () => 'u', joinFamily: async () => { role.value = 'parent'; return 'parent'; } }));
vi.mock('../../src/storage/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => ({ pushed: 0, pulled: 0 }) }));

afterEach(() => { cleanup(); role.offline = false; clearDeviceRole(); localStorage.clear(); });

describe('родительская страница', () => {
  it('parentSeesStats', async () => {
    role.value = 'parent';
    const store = createLocalStore(memStorage());
    store.append(newEvent<MatchEndEvent>({ kind: 'match_end', matchId: 'm1', mode: 'regular', subject: 'math',
      topicId: 'math-01', level: 1, goalsFor: 5, goalsAgainst: 2, bullitGoal: false, won: true }));
    location.hash = '#/parent';
    render(<GameProvider store={store} client={{} as SupabaseClient} content={content}><Routes /></GameProvider>);
    await waitFor(() => expect(screen.getByText('Скопировать для Claude')).toBeTruthy());
    expect(screen.getByText('Последние матчи')).toBeTruthy();
  });
  it('notParentSeesJoin', async () => {
    role.value = 'child';
    location.hash = '#/parent';
    render(<GameProvider store={createLocalStore(memStorage())} client={{} as SupabaseClient} content={content}><Routes /></GameProvider>);
    await waitFor(() => expect(screen.getByText(/нужна родительская ссылка/)).toBeTruthy());
    expect(screen.queryByText('Скопировать для Claude')).toBeNull();
  });
  it('noClientSeesJoin', () => {
    mount('#/parent');
    expect(screen.getByText(/нужна родительская ссылка/)).toBeTruthy();
  });
  it('joinFromEmbeddedFormShowsStats', async () => {
    role.value = 'child';
    location.hash = '#/parent';
    const { container } = render(<GameProvider store={createLocalStore(memStorage())} client={{} as SupabaseClient} content={content}><Routes /></GameProvider>);
    await waitFor(() => expect(screen.getByText(/нужна родительская ссылка/)).toBeTruthy());
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'CODE' } });
    fireEvent.click(screen.getByText('Войти'));
    await waitFor(() => expect(screen.getByText('Скопировать для Claude')).toBeTruthy());
  });
  it('parentPhoneOfflineShowsSavedStats', async () => {
    // Иконка папы, ночью нет связи: не форма входа, а сохранённая статистика с пометкой.
    setDeviceRole('parent');
    role.offline = true;
    location.hash = '#/parent';
    render(<GameProvider store={createLocalStore(memStorage())} client={{} as SupabaseClient} content={content}><Routes /></GameProvider>);
    await waitFor(() => expect(screen.getByText(/Нет связи/)).toBeTruthy());
    expect(screen.queryByText(/нужна родительская ссылка/)).toBeNull();
  });
  it('lostSessionPrefillsSavedCode', async () => {
    // Телефон помнит ссылку, а сервер вход не узнал: код подставлен, остаётся PIN.
    setDeviceRole('parent');
    rememberInviteLink('https://x.test/hockey-quiz/#/parent/join/PAPACODE1');
    role.value = null;
    location.hash = '#/parent';
    const { container } = render(<GameProvider store={createLocalStore(memStorage())} client={{} as SupabaseClient} content={content}><Routes /></GameProvider>);
    await waitFor(() => expect(screen.getByText(/нужна родительская ссылка/)).toBeTruthy());
    expect((container.querySelector('input') as HTMLInputElement).value).toBe('PAPACODE1');
  });
});
