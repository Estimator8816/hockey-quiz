import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/preact';
import { createLocalStore } from '../../src/storage/store';
import { newEvent, type AnswerEvent, type MatchEndEvent } from '../../src/engine/events';
import { HIDDEN_LEFT_MS } from '../../src/config';
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

  const setVis = async (v: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    await act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  };

  it('longHiddenTabConcedesAsLeft', async () => {
    const { store } = mount('#/play/regular/math/math-01/1');
    await setVis('hidden');
    await act(() => { vi.advanceTimersByTime(HIDDEN_LEFT_MS + 1000); });
    await setVis('visible');
    const answers = store.all().filter((e): e is AnswerEvent => e.kind === 'answer');
    expect(answers).toHaveLength(1);
    expect(answers[0].outcome).toBe('left');
    expect(screen.getByTestId('score').textContent).toBe('0 : 1');
  });

  it('shortHiddenTabPausesTimerNoGoal', async () => {
    const { store } = mount('#/play/regular/math/math-01/1');
    await act(() => { vi.advanceTimersByTime(5_000); });
    await setVis('hidden');
    await act(() => { vi.advanceTimersByTime(60_000); }); // дольше таймера вопроса, но короче порога
    await setVis('visible');
    expect(store.all().filter((e) => e.kind === 'answer')).toHaveLength(0);
    expect(screen.getByTestId('score').textContent).toBe('0 : 0');
    await act(() => { vi.advanceTimersByTime(10_000); }); // 5 + 10 = 15 с из 20: ещё идёт
    expect(store.all().filter((e) => e.kind === 'answer')).toHaveLength(0);
    await act(() => { vi.advanceTimersByTime(6_000); }); // 21 с: время вышло
    expect(store.all().filter((e): e is AnswerEvent => e.kind === 'answer')[0].outcome).toBe('timeout');
  });

  it('backDuringQuestionAsksThenConcedesGoal', async () => {
    const { store } = mount('#/play/regular/math/math-01/1');
    await act(() => { fireEvent.click(screen.getByLabelText('Назад')); });
    expect(screen.getByText(/Покинуть матч\?/)).toBeTruthy();
    expect(store.all().filter((e) => e.kind === 'answer')).toHaveLength(0);
    await act(() => { fireEvent.click(screen.getByText('Остаться')); });
    expect(screen.queryByText(/Покинуть матч\?/)).toBeNull();
    await act(() => { fireEvent.click(screen.getByLabelText('Назад')); });
    await act(() => { fireEvent.click(screen.getByRole('button', { name: 'Покинуть матч' })); });
    await act(() => { vi.advanceTimersByTime(100); });
    const answers = store.all().filter((e): e is AnswerEvent => e.kind === 'answer');
    expect(answers).toHaveLength(1);
    expect(answers[0].outcome).toBe('left');
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
