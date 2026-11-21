import { describe, it, expect } from 'vitest';
import { dedupe, deriveProgress, FRIENDLY_AFTER_MS } from '../../src/engine/progress';
import type { GameEvent, MatchEndEvent } from '../../src/engine/events';
import type { Subject, Level, SubjectId } from '../../src/content/types';
import type { Mode } from '../../src/engine/match';

const DAY = 24 * 3600 * 1000;
let n = 0;
function me(o: Partial<MatchEndEvent> & { ts: number }): MatchEndEvent {
  return { id: `e${n++}`, kind: 'match_end', matchId: `m${n}`, mode: 'regular', subject: 'math', topicId: 'math-01',
    level: 1, goalsFor: 5, goalsAgainst: 2, bullitGoal: false, won: true, ...o };
}
function subj(id: SubjectId, topics: [string, boolean][]): Subject {
  return { id, title: id, book: 'b', topics: topics.map(([t, released]) => ({ id: t, title: t, paragraphs: '', released })) };
}
const math = () => subj('math', [['math-01', true]]);
const none = (): Subject[] => [math(), subj('russian', []), subj('history', [])];
const win = (level: Level, ts: number, o: Partial<MatchEndEvent> = {}) => me({ level, ts, ...o });
const cupEvents = (topicId = 'math-01', t0 = 1000): GameEvent[] =>
  ([1, 2, 3] as Level[]).map((l, i) => win(l, t0 + i, { topicId }));

describe('progress', () => {
  it('levelsUnlockInOrder', () => {
    const p = deriveProgress([win(1, 1)], none(), 10);
    expect(p.topics['math-01'].levelsWon).toEqual([1]);
    expect(p.topics['math-01'].nextLevel).toBe(2);
    expect(p.topics['math-01'].cup).toBe(false);
  });
  it('cupAfterThreeLevels', () => {
    const p = deriveProgress(cupEvents(), none(), 5000);
    const t = p.topics['math-01'];
    expect(t.levelsWon).toEqual([1, 2, 3]);
    expect(t.nextLevel).toBeNull();
    expect(t.cup).toBe(true);
    expect(t.cupAt).toBe(1002);
    expect(p.subjects.math.cups).toBe(1);
  });
  it('lostMatchGivesNoGoals', () => {
    const p = deriveProgress([win(1, 1, { won: false, goalsFor: 4, bullitGoal: true })], none(), 10);
    expect(p.careerGoals).toBe(0);
    expect(p.bullitGoals).toBe(0);
    expect(p.topics['math-01'].levelsWon).toEqual([]);
  });
  it('bullitGoalCountsOnlyInWonMatch', () => {
    const p = deriveProgress([win(1, 1, { goalsFor: 5, bullitGoal: true }),
      win(2, 2, { won: false, bullitGoal: true })], none(), 10);
    expect(p.bullitGoals).toBe(1);
    expect(p.careerGoals).toBe(6);
    expect(p.shutouts).toBe(0);
  });
  it('tarnishesAfterSevenDays', () => {
    const ev = cupEvents();
    const before = deriveProgress(ev, none(), 1002 + FRIENDLY_AFTER_MS - 1).topics['math-01'];
    expect(before.tarnished).toBe(false);
    const after = deriveProgress(ev, none(), 1002 + FRIENDLY_AFTER_MS).topics['math-01'];
    expect(after.tarnished).toBe(true);
    expect(after.friendlyDue).toBe(true);
  });
  it('friendlyWinRestoresCup', () => {
    const ev = [...cupEvents(), me({ mode: 'friendly', level: null, ts: 1002 + FRIENDLY_AFTER_MS + 5 })];
    const t = deriveProgress(ev, none(), 1002 + FRIENDLY_AFTER_MS + 10).topics['math-01'];
    expect(t.tarnished).toBe(false);
    expect(t.friendlyDue).toBe(false);
  });
  it('friendlyBeforeSevenDaysDoesNotCount', () => {
    const ev = [...cupEvents(), me({ mode: 'friendly', level: null, ts: 1002 + DAY })];
    const t = deriveProgress(ev, none(), 1002 + FRIENDLY_AFTER_MS + 10).topics['math-01'];
    expect(t.tarnished).toBe(true);
  });
  it('finalStaysLockedWhileTopicsUnreleased', () => {
    const s = [subj('math', [['math-01', true], ['math-02', false]]), subj('russian', []), subj('history', [])];
    const p = deriveProgress([...cupEvents('math-01'), ...cupEvents('math-02')], s, 2000);
    expect(p.subjects.math.released).toBe(1);
    expect(p.subjects.math.total).toBe(2);
    expect(p.subjects.math.finalUnlocked).toBe(false);
    const ok = deriveProgress(cupEvents('math-01'), none(), 2000);
    expect(ok.subjects.math.finalUnlocked).toBe(true);
  });
  it('finalLockedWhileCupTarnished', () => {
    const p = deriveProgress(cupEvents(), none(), 1002 + FRIENDLY_AFTER_MS + 1);
    expect(p.subjects.math.finalUnlocked).toBe(false);
  });
  it('seasonAndSuperPrize', () => {
    const subjects = [math(), subj('russian', []), subj('history', [])];
    const f = (s: SubjectId, ts: number) => me({ mode: 'final', subject: s, topicId: null, level: null, ts });
    expect(deriveProgress([f('math', 1)], subjects, 10).subjects.math.seasonWon).toBe(true);
    expect(deriveProgress([f('math', 1)], subjects, 10).superPrize).toBe(false);
    const all = deriveProgress([f('math', 1), f('russian', 2), f('history', 3)], subjects, 10);
    expect(all.superPrize).toBe(true);
  });
  it('ranksAndNextRank', () => {
    const g = (goals: number) => deriveProgress([win(1, 1, { goalsFor: goals })], none(), 10);
    const a = g(99);
    expect(a.rank).toBeNull();
    expect(a.nextRank).toEqual({ title: 'Новичок', goalsLeft: 1 });
    const b = g(250);
    expect(b.rank).toBe('Нападающий');
    expect(b.nextRank).toEqual({ title: 'Капитан', goalsLeft: 250 });
    expect(g(1000).nextRank).toBeNull();
  });
  it('ignoresUnfinishedMatch', () => {
    const ans: GameEvent = { id: 'a1', ts: 1, kind: 'answer', matchId: 'x', mode: 'regular', subject: 'math',
      topicId: 'math-01', level: 1, questionId: 'q', bullit: false, outcome: 'correct', ms: 100 };
    const p = deriveProgress([ans], none(), 10);
    expect(p.careerGoals).toBe(0);
    expect(p.topics['math-01'].levelsWon).toEqual([]);
  });
  it('dedupesById', () => {
    const e = win(1, 1, { goalsFor: 5 });
    expect(dedupe([e, e]).length).toBe(1);
    const p = deriveProgress([e, e], none(), 10);
    expect(p.careerGoals).toBe(5);
  });
  it('trainingIgnored', () => {
    const p = deriveProgress([me({ mode: 'training' as Mode, ts: 1, topicId: null, level: null })], none(), 10);
    expect(p.careerGoals).toBe(0);
    expect(p.streakDays).toBe(0);
    expect(p.shutouts).toBe(0);
  });
  it('streakAcrossLocalMidnight', () => {
    const t1 = new Date(2026, 10, 19, 23, 59).getTime();
    const t2 = new Date(2026, 10, 20, 0, 1).getTime();
    const now = new Date(2026, 10, 20, 12, 0).getTime();
    const p = deriveProgress([win(1, t1), win(2, t2)], none(), now);
    expect(p.streakDays).toBe(2);
  });
  it('streakBrokenByGapDay', () => {
    const d = (day: number) => new Date(2026, 10, day, 12, 0).getTime();
    const p = deriveProgress([win(1, d(15)), win(2, d(17)), win(3, d(18))], none(), d(18));
    expect(p.streakDays).toBe(2);
    expect(deriveProgress([win(1, d(15))], none(), d(18)).streakDays).toBe(0);
  });
  it('streakStartingYesterdayStillCounts', () => {
    const d = (day: number) => new Date(2026, 10, day, 12, 0).getTime();
    expect(deriveProgress([win(1, d(16)), win(2, d(17), { goalsAgainst: 0 })], none(), d(18)).streakDays).toBe(2);
    expect(deriveProgress([win(1, d(17), { goalsAgainst: 0 })], none(), d(18)).shutouts).toBe(1);
  });
});
