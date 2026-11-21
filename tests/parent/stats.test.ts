import { describe, it, expect } from 'vitest';
import { parentStats, flagsForClaude, type ParentContent } from '../../src/parent/stats';
import type { AnswerEvent, FlagEvent, GameEvent, MatchEndEvent } from '../../src/engine/events';
import type { Level, Question, Subject } from '../../src/content/types';

const NOW = new Date(2026, 10, 21, 15, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;
let n = 0;
const end = (o: Partial<MatchEndEvent> = {}): MatchEndEvent => ({ id: `e${n++}`, ts: NOW, kind: 'match_end', matchId: `m${n}`,
  mode: 'regular', subject: 'math', topicId: 'math-01', level: 1, goalsFor: 5, goalsAgainst: 2, bullitGoal: false, won: true, ...o });
const ans = (o: Partial<AnswerEvent> = {}): AnswerEvent => ({ id: `a${n++}`, ts: NOW, kind: 'answer', matchId: 'm', mode: 'regular',
  subject: 'math', topicId: 'math-01', level: 1, questionId: 'math-01-1-000', bullit: false, outcome: 'correct', ms: 6000, ...o });
const flag = (questionId: string, ts = NOW): FlagEvent => ({ id: `f${n++}`, ts, kind: 'flag', questionId });

const mkQ = (i: number, level: Level, topicId = 'math-01'): Question => ({ id: `${topicId}-${level}-${String(i).padStart(3, '0')}`,
  subject: 'math', topicId, level, text: `Текст ${level}-${i}`, options: ['a', 'b', 'c', 'd'], answer: 0, why: 'w' });
const qs = (level: Level, count: number) => Array.from({ length: count }, (_, i) => mkQ(i, level));
const all = [...qs(1, 20), ...qs(2, 12), ...qs(3, 14)];
const subjects: Subject[] = [
  { id: 'math', title: 'Математика', book: 'b', topics: [
    { id: 'math-01', title: 'Тема один', paragraphs: '', released: true },
    { id: 'math-02', title: 'Тема два', paragraphs: '', released: false }] },
  { id: 'russian', title: 'Русский язык', book: 'b', topics: [] },
  { id: 'history', title: 'История', book: 'b', topics: [] },
];
const content: ParentContent = { subjects, questionsByTopic: new Map([['math-01', all]]),
  questionsById: new Map(all.map((q) => [q.id, q])) };
const stats = (ev: GameEvent[]) => parentStats(ev, NOW, content);

describe('parent stats', () => {
  it('todayAndWeekCounts', () => {
    const s = stats([end(), end({ won: false, goalsFor: 3 }), end({ ts: NOW - 3 * DAY }), end({ ts: NOW - 6 * DAY }),
      end({ ts: NOW - 7 * DAY }), end({ mode: 'training' })]);
    expect(s.today).toMatchObject({ matches: 2, goals: 5 });
    expect(s.week).toMatchObject({ matches: 4, goals: 15 });
  });
  it('minutesFromAnswerMs', () => {
    const s = stats([ans({ ms: 60000 }), ans({ ms: 30000, matchId: 'abandoned' }), ans({ ms: 600000, ts: NOW - 2 * DAY })]);
    expect(s.today.minutes).toBe(2);
    expect(s.week.minutes).toBe(12);
    expect(s.today.matches).toBe(0);
    expect(s.today.goals).toBe(0);
  });
  it('hardTopicsNeedThreeMatches', () => {
    const lose = (t: string, k: number) => Array.from({ length: k }, () => end({ topicId: t, won: false }));
    const win = (t: string, k: number) => Array.from({ length: k }, () => end({ topicId: t }));
    const s = stats([...lose('math-01', 2), ...lose('math-02', 2), ...win('math-02', 1), ...win('math-03', 5)]);
    expect(s.hardTopics).toEqual([{ topicId: 'math-02', title: 'Тема два', played: 3, lost: 2 }]);
    expect(stats([...lose('math-01', 2)]).hardTopics).toEqual([]);
    const t = stats([...lose('math-01', 3), ...win('math-01', 1)]).hardTopics;
    expect(t[0]).toMatchObject({ topicId: 'math-01', title: 'Тема один', played: 4, lost: 3 });
  });
  it('flagsListedWithText', () => {
    const s = stats([flag('math-01-1-001', 100), flag('unknown-id', 200)]);
    expect(s.flags).toEqual([{ questionId: 'unknown-id', text: 'unknown-id', ts: 200 },
      { questionId: 'math-01-1-001', text: 'Текст 1-1', ts: 100 }]);
  });
  it('lowPoolWhenUnder12', () => {
    expect(stats([]).lowPool).toEqual([]);
    const s = stats([flag('math-01-2-000'), flag('math-01-2-001'), flag('math-01-1-000')]);
    expect(s.lowPool).toEqual([{ topicId: 'math-01', level: 2, left: 10 }]);
  });
  it('recentMatchesShowAnswerSeconds', () => {
    const m = end({ matchId: 'mm', goalsFor: 4, goalsAgainst: 3, ts: NOW });
    const s = stats([m, ans({ matchId: 'mm', ms: 4400, ts: NOW - 2 }), ans({ matchId: 'mm', ms: 9000, ts: NOW - 1 }),
      ...Array.from({ length: 11 }, (_, i) => end({ ts: NOW - (i + 1) * 1000 }))]);
    expect(s.recentMatches).toHaveLength(10);
    expect(s.recentMatches[0]).toMatchObject({ subject: 'math', topicTitle: 'Тема один', mode: 'regular', score: '4 : 3',
      won: true, answersSec: [4, 9] });
  });
  it('flagsForClaudeContainsIds', () => {
    const text = flagsForClaude(stats([flag('math-01-1-001')]), content);
    expect(text).toContain('math-01-1-001');
    expect(text).toContain('Математика');
    expect(text).toContain('Тема один');
    expect(text).toContain('Текст 1-1');
    expect(flagsForClaude(stats([]), content)).toMatch(/нет отметок/);
  });
});
