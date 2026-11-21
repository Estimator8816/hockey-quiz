import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/preact';
import { createLocalStore } from '../../src/storage/store';
import { newEvent, type MatchEndEvent } from '../../src/engine/events';
import { memStorage, mount } from './fixtures';

afterEach(cleanup);

describe('навигация', () => {
  it('lockedLevelNotPlayable', () => {
    const { container } = mount('#/t/math-01');
    expect(container.querySelector('a[href="#/play/regular/math/math-01/1"]')).toBeTruthy();
    expect(container.querySelector('a[href="#/play/regular/math/math-01/2"]')).toBeNull();
    const locked = container.querySelector('[data-level="2"]') as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(screen.getByText('Математика — лёгкий состав')).toBeTruthy();
  });

  it('lockedLevelRouteShowsNoMatch', () => {
    mount('#/play/regular/math/math-01/3');
    expect(screen.getByText('Закрыто')).toBeTruthy();
    expect(screen.queryByTestId('score')).toBeNull();
  });

  it('finalButtonHiddenWhenLocked', () => {
    mount('#/s/math');
    expect(screen.getByText('Тема один')).toBeTruthy();
    expect(screen.getByText('скоро')).toBeTruthy();
    expect(screen.queryByText('Финал')).toBeNull();
  });

  it('friendlyButtonOnlyWhenDue', () => {
    const store = createLocalStore(memStorage());
    mount('#/t/math-01', store);
    expect(screen.queryByText('Товарищеский матч')).toBeNull();
  });

  it('topicWithoutQuestionsSaysSoon', () => {
    mount('#/play/friendly/math/math-02');
    expect(screen.getByText(/Вопросы скоро/)).toBeTruthy();
  });
});
