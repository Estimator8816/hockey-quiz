import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/preact';
import { createLocalStore } from '../../src/storage/store';
import { newEvent, type AnswerEvent, type MatchEndEvent } from '../../src/engine/events';
import { memStorage, mount } from './fixtures';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('экран матча', () => {
  it('timeoutConcedesGoal', async () => {
    const store = createLocalStore(memStorage());
    for (const level of [1, 2] as const) {
      store.append(newEvent<MatchEndEvent>({
        kind: 'match_end', matchId: `w${level}`, mode: 'regular', subject: 'math', topicId: 'math-01', level,
        goalsFor: 10, goalsAgainst: 0, bullitGoal: false, won: true,
      }));
    }
    mount('#/play/regular/math/math-01/3', store);
    expect(screen.getByTestId('score').textContent).toBe('0 : 0');
    await act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId('score').textContent).toBe('0 : 1');
    expect(screen.getByText('Пропустил…')).toBeTruthy();
  });

  it('hiddenTabConcedesAsLeft', async () => {
    const { store } = mount('#/play/regular/math/math-01/1');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const answers = store.all().filter((e): e is AnswerEvent => e.kind === 'answer');
    expect(answers).toHaveLength(1);
    expect(answers[0].outcome).toBe('left');
    expect(screen.getByTestId('score').textContent).toBe('0 : 1');
  });

  it('wrongAnswerShowsCorrectAndWhy', async () => {
    mount('#/play/regular/math/math-01/1');
    await act(() => { fireEvent.click(screen.getByText('икс1')); });
    expect(screen.getByText('Пропустил…')).toBeTruthy();
    expect(screen.getByText('ПОЯСНЕНИЕ')).toBeTruthy();
    const right = screen.getByText('ПРАВИЛЬНО').closest('button')!;
    expect(right.getAttribute('data-correct')).toBe('true');
    expect(screen.getByText('Дальше')).toBeTruthy();
  });

  it('flagButtonOnlyAfterAnswer', async () => {
    const { store } = mount('#/play/regular/math/math-01/1');
    expect(screen.queryByText('тут ошибка')).toBeNull();
    await act(() => { fireEvent.click(screen.getByText('ПРАВИЛЬНО')); });
    expect(screen.getByText('ГОЛ!')).toBeTruthy();
    await act(() => { fireEvent.click(screen.getByText('тут ошибка')); });
    expect(store.all().some((e) => e.kind === 'flag')).toBe(true);
  });

  it('lostMatchShowsBurnedGoals', () => {
    const store = createLocalStore(memStorage());
    store.append(newEvent<MatchEndEvent>({
      kind: 'match_end', matchId: 'm1', mode: 'regular', subject: 'math', topicId: 'math-01', level: 1,
      goalsFor: 4, goalsAgainst: 2, bullitGoal: false, won: false,
    }));
    mount('#/result/m1', store);
    expect(screen.getByText('Поражение')).toBeTruthy();
    expect(screen.getByText(/Голы сгорели: 4/)).toBeTruthy();
  });
});
