import { describe, it, expect } from 'vitest';
import type { Bullit, Level, Question } from '../../src/content/types';
import { seeded } from '../../src/engine/rng';
import {
  answer, concededLeft, createMatch, currentItem, BULLIT_SEC, TIMER_SEC,
  type MatchState, type Mode, type Outcome,
} from '../../src/engine/match';

const mkQ = (i: number, level: Level = 1): Question => ({
  id: `math-01-${level}-${String(i).padStart(3, '0')}`, subject: 'math', topicId: 'math-01', level,
  text: `q${i}`, options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], answer: (i % 4) as 0 | 1 | 2 | 3, why: 'w',
});
const bullit: Bullit = { id: 'b1', category: 'logic', text: 'bt', options: ['x', 'y', 'z', 'w'], answer: 2, why: 'w' };
const qs = (n: number, level: Level = 1) => Array.from({ length: n }, (_, i) => mkQ(i, level));
const N: Record<Mode, number> = { regular: 10, friendly: 5, final: 20, training: 3 };

function start(mode: Mode, seed = 1, level: Level | null = 1): MatchState {
  return createMatch({
    mode, subject: 'math', topicId: 'math-01', level, questions: qs(N[mode], level ?? 1),
    bullit: mode === 'regular' ? bullit : null, rng: seeded(seed),
  });
}
/** Играет матч: outcomes по обычным атакам, буллит — bullitOutcome. Возвращает финал и число сыгранных обычных. */
function play(s: MatchState, outcomes: Outcome[], bullitOutcome: Outcome = 'correct') {
  let regular = 0;
  while (!s.over) {
    const it = currentItem(s)!;
    if (it.isBullit) s = answer(s, bullitOutcome);
    else s = answer(s, outcomes[regular++] ?? 'correct');
  }
  return { s, regular };
}

describe('match engine', () => {
  it('tenCorrectIsShutoutWin', () => {
    const { s } = play(start('regular'), []);
    expect(s.goalsFor).toBe(10);
    expect(s.goalsAgainst).toBe(0);
    expect(s.won).toBe(true);
    expect(s.over).toBe(true);
  });

  it('oneMissStillWins', () => {
    const { s } = play(start('regular'), ['correct', 'wrong']);
    expect(s.goalsFor).toBe(9);
    expect(s.goalsAgainst).toBe(1);
    expect(s.won).toBe(true);
  });

  it('secondMissEndsMatchImmediately', () => {
    const { s, regular } = play(start('regular'), ['wrong', 'correct', 'wrong']);
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    expect(currentItem(s)).toBeNull();
    expect(regular).toBeLessThanOrEqual(10);
    expect(regular).toBe(3);
  });

  it('timeoutAndLeftCountAsConceded', () => {
    for (const [first, second] of [['timeout', 'left'], ['left', 'timeout']] as const) {
      const { s } = play(start('regular'), [first, second]);
      expect(s.goalsAgainst).toBe(2);
      expect(s.over).toBe(true);
      expect(s.won).toBe(false);
    }
    const { s: one } = play(start('regular'), ['timeout']);
    expect(one.goalsAgainst).toBe(1);
    expect(one.won).toBe(true);
  });

  it('emptyMatchIsNotAWin', () => {
    const s = createMatch({ mode: 'regular', subject: 'math', topicId: null, level: null, questions: [], bullit, rng: seeded(1) });
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    expect(currentItem(s)).toBeNull();
  });

  it('lossBeforeBullitSkipsBullit', () => {
    let seed = 1;
    const bullitIdx = (sd: number) => {
      let s = start('regular', sd);
      let n = 0;
      while (!currentItem(s)!.isBullit) { s = answer(s, 'correct'); n++; }
      return n;
    };
    while (bullitIdx(seed) < 2) seed++;
    let s = start('regular', seed);
    s = answer(s, 'wrong');
    s = answer(s, 'wrong');
    expect(s.over).toBe(true);
    expect(s.won).toBe(false);
    expect(currentItem(s)).toBeNull();
    expect(s.bullitGoal).toBe(false);
  });

  it('bullitWrongDoesNotConcede', () => {
    const { s } = play(start('regular'), [], 'wrong');
    expect(s.goalsAgainst).toBe(0);
    expect(s.bullitGoal).toBe(false);
    expect(s.won).toBe(true);
  });

  it('bullitCorrectSetsBullitGoal', () => {
    const { s } = play(start('regular'), [], 'correct');
    expect(s.bullitGoal).toBe(true);
    expect(s.goalsFor).toBe(10);
  });

  it('bullitAppearsExactlyOnceInRegular', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = start('regular', seed);
      let count = 0;
      let idx = -1;
      let n = 0;
      while (!s.over) {
        const it = currentItem(s)!;
        if (it.isBullit) { count++; idx = n; }
        n++;
        s = answer(s, 'correct');
      }
      expect(count).toBe(1);
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(9);
    }
  });

  it('noBullitInFriendlyAndFinal', () => {
    for (const mode of ['friendly', 'final'] as const) {
      let s = start(mode);
      while (!s.over) {
        expect(currentItem(s)!.isBullit).toBe(false);
        s = answer(s, 'correct');
      }
    }
  });

  it('finalAllowsTwoMisses', () => {
    const ok = play(start('final'), ['wrong', 'wrong']).s;
    expect(ok.goalsFor).toBe(18);
    expect(ok.goalsAgainst).toBe(2);
    expect(ok.won).toBe(true);
    const lost = play(start('final'), ['wrong', 'wrong', 'wrong']).s;
    expect(lost.won).toBe(false);
    expect(lost.over).toBe(true);
  });

  it('optionsAreShuffledButCorrectIndexTracks', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const s = start('friendly', seed);
      const it = currentItem(s)!;
      const q = it.question as Question;
      expect(it.options[it.correctIndex]).toBe(q.options[q.answer]);
      expect([...it.options].sort()).toEqual([...q.options].sort());
      orders.add(it.options.join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('timerByLevelAndBullit', () => {
    expect(TIMER_SEC).toEqual({ 1: 20, 2: 30, 3: 60 });
    for (const lvl of [1, 2, 3] as const) {
      const s = createMatch({ mode: 'friendly', subject: 'math', topicId: null, level: null, questions: qs(5, lvl), bullit: null, rng: seeded(1) });
      expect(currentItem(s)!.timerSec).toBe(TIMER_SEC[lvl]);
      expect(currentItem(s)!.level).toBe(lvl);
    }
    let s = start('regular');
    while (!currentItem(s)!.isBullit) s = answer(s, 'correct');
    expect(currentItem(s)!.timerSec).toBe(BULLIT_SEC);
  });

  it('trainingNeverLosesAndEndsAfterThree; concededLeft', () => {
    const { s } = play(start('training'), ['wrong', 'wrong', 'wrong']);
    expect(s.won).toBe(true);
    expect(concededLeft(start('regular'))).toBe(1);
    expect(concededLeft(start('final'))).toBe(2);
    expect(answer(s, 'correct')).toBe(s);
  });
});
