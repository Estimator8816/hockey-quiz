import type { Level, Subject, SubjectId } from '../content/types';
import type { GameEvent, MatchEndEvent } from './events';

export const RANKS = [{ goals: 100, title: 'Новичок' }, { goals: 250, title: 'Нападающий' },
  { goals: 500, title: 'Капитан' }, { goals: 1000, title: 'Легенда' }] as const;
export const FRIENDLY_AFTER_MS = 7 * 24 * 3600 * 1000;

export interface TopicProgress { levelsWon: Level[]; nextLevel: Level | null; cup: boolean; cupAt: number | null;
  friendlyDue: boolean; tarnished: boolean }
export interface SubjectProgress { cups: number; released: number; total: number; finalUnlocked: boolean; seasonWon: boolean }
export interface Progress { topics: Record<string, TopicProgress>; subjects: Record<SubjectId, SubjectProgress>;
  superPrize: boolean; careerGoals: number; rank: string | null; nextRank: { title: string; goalsLeft: number } | null;
  shutouts: number; bullitGoals: number; streakDays: number; flagged: Set<string>; hintsSeen: Set<string> }

export function dedupe(events: GameEvent[]): GameEvent[] {
  const seen = new Set<string>();
  const out: GameEvent[] = [];
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

const dayKey = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
const prevDay = (key: number) => {
  const d = new Date(key);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime();
};

function streak(days: Set<number>, now: number): number {
  let cur = dayKey(now);
  if (!days.has(cur)) cur = prevDay(cur);
  let n = 0;
  while (days.has(cur)) { n++; cur = prevDay(cur); }
  return n;
}

export function deriveProgress(events: GameEvent[], subjects: Subject[], now: number): Progress {
  const evs = dedupe(events).sort((a, b) => a.ts - b.ts);
  const ends = evs.filter((e): e is MatchEndEvent => e.kind === 'match_end' && e.mode !== 'training');
  const wins = ends.filter((e) => e.won);

  let careerGoals = 0, shutouts = 0, bullitGoals = 0;
  for (const w of wins) {
    careerGoals += w.goalsFor + (w.bullitGoal ? 1 : 0);
    if (w.mode === 'regular' && w.goalsAgainst === 0) shutouts++;
    if (w.bullitGoal) bullitGoals++;
  }

  const topics: Record<string, TopicProgress> = {};
  for (const s of subjects) {
    for (const t of s.topics) {
      const won = new Map<Level, number>(); // level -> ts of first win
      const topicWins = wins.filter((e) => e.topicId === t.id);
      for (const w of topicWins) {
        if (w.mode === 'regular' && w.level !== null && !won.has(w.level)) won.set(w.level, w.ts);
      }
      const levelsWon = ([1, 2, 3] as Level[]).filter((l) => won.has(l));
      const cup = levelsWon.length === 3;
      const cupAt = cup ? Math.max(...won.values()) : null;
      const tarnished = cup && cupAt !== null && now >= cupAt + FRIENDLY_AFTER_MS &&
        !topicWins.some((w) => w.mode === 'friendly' && w.ts >= cupAt + FRIENDLY_AFTER_MS);
      topics[t.id] = {
        levelsWon, nextLevel: ([1, 2, 3] as Level[]).find((l) => !won.has(l)) ?? null,
        cup, cupAt, friendlyDue: tarnished, tarnished,
      };
    }
  }

  const subjectsOut = {} as Record<SubjectId, SubjectProgress>;
  for (const s of subjects) {
    const ts = s.topics.map((t) => topics[t.id]);
    const released = s.topics.filter((t) => t.released).length;
    subjectsOut[s.id] = {
      cups: ts.filter((t) => t.cup).length, released, total: s.topics.length,
      finalUnlocked: s.topics.length > 0 && released === s.topics.length && ts.every((t) => t.cup && !t.tarnished),
      seasonWon: wins.some((w) => w.mode === 'final' && w.subject === s.id),
    };
  }

  const reached = RANKS.filter((r) => careerGoals >= r.goals);
  const nxt = RANKS.find((r) => careerGoals < r.goals);

  return {
    topics, subjects: subjectsOut,
    superPrize: Object.values(subjectsOut).filter((s) => s.seasonWon).length >= 3,
    careerGoals,
    rank: reached.length ? reached[reached.length - 1].title : null,
    nextRank: nxt ? { title: nxt.title, goalsLeft: nxt.goals - careerGoals } : null,
    shutouts, bullitGoals,
    streakDays: streak(new Set(ends.map((e) => dayKey(e.ts))), now),
    flagged: new Set(evs.flatMap((e) => (e.kind === 'flag' ? [e.questionId] : []))),
    hintsSeen: new Set(evs.flatMap((e) => (e.kind === 'hint_seen' ? [e.hintId] : []))),
  };
}
