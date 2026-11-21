import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { createLocalStore } from '../../src/storage/store';
import { newEvent, type HintSeenEvent } from '../../src/engine/events';
import { HINTS, RULES, SCREEN_HELP } from '../../src/ui/hints';
import { App } from '../../src/app';
import { content, memStorage, mount } from './fixtures';

afterEach(cleanup);

const mountApp = (hash: string, store = createLocalStore(memStorage())) => {
  location.hash = hash;
  render(<App store={store} client={null} content={content} />);
  return store;
};
const seen = (store: ReturnType<typeof createLocalStore>, id: string) =>
  store.append(newEvent<HintSeenEvent>({ kind: 'hint_seen', hintId: id }));

describe('подсказки тренера', () => {
  it('trainingOnFirstLaunchOnly', async () => {
    mountApp('#/');
    await waitFor(() => expect(screen.getByTestId('score')).toBeTruthy());
    expect(location.hash).toBe('#/training');
    cleanup();
    const store = createLocalStore(memStorage());
    seen(store, 'training_end');
    mountApp('#/', store);
    expect(location.hash).toBe('#/');
    expect(screen.getByText('Тренировка')).toBeTruthy();
  });

  it('firstLaunchDoesNotHijackJoinAndParent', () => {
    mountApp('#/join/abc');
    expect(location.hash).toBe('#/join/abc');
    cleanup();
    mountApp('#/parent');
    expect(location.hash).toBe('#/parent');
  });

  it('trainingFlowShowsBubblesThenHome', () => {
    const store = mountApp('#/training');
    const answers = () => [...document.querySelectorAll('button.ans')] as HTMLButtonElement[];
    fireEvent.click(answers().find((b) => b.textContent!.includes('ПРАВИЛЬНО'))!);
    expect(screen.getByText(HINTS.training_correct[0])).toBeTruthy();
    fireEvent.click(screen.getByText(HINTS.training_correct[0]));
    expect(store.all().some((e) => e.kind === 'hint_seen' && e.hintId === 'training_correct')).toBe(true);
    fireEvent.click(screen.getByText('Дальше'));
    fireEvent.click(answers().find((b) => !b.textContent!.includes('ПРАВИЛЬНО'))!);
    expect(screen.getByText(HINTS.training_wrong[0])).toBeTruthy();
  });

  it('coachShownOnceThenNever', () => {
    const store = createLocalStore(memStorage());
    seen(store, 'training_end');
    mount('#/play/regular/math/math-01/1', store);
    fireEvent.click(document.querySelector('button.ans') as HTMLButtonElement);
    const line = HINTS.first_timer[0];
    fireEvent.click(screen.getByText(line));
    expect(screen.queryByText(line)).toBeNull();
    cleanup();
    mount('#/play/regular/math/math-01/1', store);
    fireEvent.click(document.querySelector('button.ans') as HTMLButtonElement);
    expect(screen.queryByText(line)).toBeNull();
  });

  it('helpButtonShowsScreenText', () => {
    mount('#/');
    expect(screen.queryByText(SCREEN_HELP.home[0])).toBeNull();
    fireEvent.click(screen.getByLabelText('Помощь'));
    expect(screen.getByText(SCREEN_HELP.home[0])).toBeTruthy();
    expect((screen.getByText('Все правила') as HTMLAnchorElement).getAttribute('href')).toBe('#/rules');
  });

  it('rulesPageShowsMechanics', () => {
    mount('#/rules');
    expect(screen.getByText(RULES[0])).toBeTruthy();
  });

  it('allHintLinesAtMost12Words', () => {
    const lines = [...Object.values(HINTS).flat(), ...Object.values(SCREEN_HELP).flat(), ...RULES];
    expect(lines.length).toBeGreaterThan(20);
    for (const l of lines) expect(l.trim().split(/\s+/).length, l).toBeLessThanOrEqual(12);
  });
});
