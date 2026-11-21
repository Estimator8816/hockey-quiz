import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLocalStore } from '../../src/storage/store';
import { newEvent, type MatchEndEvent } from '../../src/engine/events';
import { GameProvider } from '../../src/ui/useGame';
import { Routes } from '../../src/app';
import { content, memStorage, mount } from './fixtures';

const role = vi.hoisted(() => ({ value: 'parent' as 'parent' | 'child' | null }));
vi.mock('../../src/storage/auth', async (orig) => ({ ...(await orig<object>()), myRole: async () => role.value }));
vi.mock('../../src/storage/sync', async (orig) => ({ ...(await orig<object>()), syncNow: async () => ({ pushed: 0, pulled: 0 }) }));

afterEach(cleanup);

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
});
