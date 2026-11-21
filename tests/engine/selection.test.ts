import { describe, it, expect } from 'vitest';
import type { Level, Question, SubjectId } from '../../src/content/types';
import type { AnswerEvent } from '../../src/engine/events';
import type { Outcome } from '../../src/engine/match';
import { seeded } from '../../src/engine/rng';
import { pickFinal, pickFriendly, pickQuestions } from '../../src/engine/selection';

function q(id: string, topicId = 't1', level: Level = 1, subject: SubjectId = 'math'): Question {
  return { id, subject, topicId, level, text: id, options: ['a', 'b', 'c', 'd'], answer: 0, why: '' };
}
function pool(n: number, topicId = 't1', subject: SubjectId = 'math'): Question[] {
  return Array.from({ length: n }, (_, i) => q(`${topicId}-${i}`, topicId, ((i % 3) + 1) as Level, subject));
}
function ans(questionId: string, outcome: Outcome, ts: number): AnswerEvent {
  return { kind: 'answer', id: `e${ts}`, ts, matchId: 'm', mode: 'regular', subject: 'math', topicId: 't1',
    level: 1, questionId, bullit: false, outcome, ms: 1000 };
}

describe('selection', () => {
  it('excludesFlagged', () => {
    const p = pool(20);
    const flagged = new Set(['t1-0', 't1-1', 't1-2']);
    const r = pickQuestions(p, [], flagged, 10, seeded(1));
    expect(r).toHaveLength(10);
    expect(r.some((x) => flagged.has(x.id))).toBe(false);
  });

  it('prefersLastWrong', () => {
    const p = pool(30);
    const hist = [
      ans('t1-5', 'wrong', 1), ans('t1-6', 'timeout', 2), ans('t1-7', 'left', 3),
      ans('t1-8', 'correct', 4), ans('t1-9', 'correct', 5),
    ];
    for (let s = 1; s <= 10; s++) {
      const ids = pickQuestions(p, hist, new Set(), 10, seeded(s)).map((x) => x.id);
      expect(ids).toEqual(expect.arrayContaining(['t1-5', 't1-6', 't1-7']));
    }
  });

  it('noRepeatsWhenPoolLarge', () => {
    const r = pickQuestions(pool(25), [], new Set(), 10, seeded(3));
    expect(new Set(r.map((x) => x.id)).size).toBe(10);
  });

  it('repeatsWhenPoolSmall', () => {
    const p = pool(3);
    const r = pickQuestions(p, [], new Set(), 10, seeded(4));
    expect(r).toHaveLength(10);
    expect(new Set(r.map((x) => x.id))).toEqual(new Set(p.map((x) => x.id)));
  });

  it('emptyPoolReturnsEmpty', () => {
    expect(pickQuestions([], [], new Set(), 10, seeded(1))).toEqual([]);
    const p = pool(2);
    expect(pickQuestions(p, [], new Set(p.map((x) => x.id)), 10, seeded(1))).toEqual([]);
  });

  it('friendlyMixesLevels', () => {
    for (let s = 1; s <= 10; s++) {
      const r = pickFriendly(pool(30), [], new Set(), seeded(s));
      expect(r).toHaveLength(5);
      expect(new Set(r.map((x) => x.level))).toEqual(new Set([1, 2, 3]));
    }
  });

  it('finalCoversAllTopics', () => {
    const topics = ['a', 'b', 'c', 'd', 'e'];
    const pools = topics.map((t) => pool(15, t));
    const r = pickFinal(pools, [], new Set(), seeded(5));
    expect(r).toHaveLength(20);
    for (const t of topics) expect(r.filter((x) => x.topicId === t).length).toBeGreaterThanOrEqual(4);
  });
});
