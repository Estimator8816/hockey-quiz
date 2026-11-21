import { questionsById as defaultById, questionsByTopic as defaultByTopic, subjects as defaultSubjects } from '../content/load';
import type { Level, Question, Subject, SubjectId } from '../content/types';
import type { AnswerEvent, GameEvent, MatchEndEvent } from '../engine/events';
import type { Mode } from '../engine/match';
import { dedupe, deriveProgress } from '../engine/progress';

export interface Window { matches: number; minutes: number; goals: number }
export interface ParentStats {
  today: Window; week: Window;
  subjects: { id: SubjectId; title: string; cups: number; total: number; released: number; finalUnlocked: boolean; seasonWon: boolean }[];
  superPrize: boolean; streakDays: number;
  hardTopics: { topicId: string; title: string; played: number; lost: number }[];
  flags: { questionId: string; text: string; ts: number }[];
  lowPool: { topicId: string; level: Level; left: number }[];
  recentMatches: { ts: number; subject: SubjectId; topicTitle: string; mode: Mode; score: string; won: boolean; answersSec: number[] }[];
}
export interface ParentContent {
  subjects: Subject[]; questionsByTopic: Map<string, Question[]>; questionsById: Map<string, Question>;
}

const defaultContent: ParentContent = { subjects: defaultSubjects, questionsByTopic: defaultByTopic, questionsById: defaultById };
export const POOL_MIN = 12;

const dayStart = (ts: number) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

export function parentStats(events: GameEvent[], now: number, content: ParentContent = defaultContent): ParentStats {
  const evs = dedupe(events).sort((a, b) => a.ts - b.ts);
  const p = deriveProgress(evs, content.subjects, now);
  const answers = evs.filter((e): e is AnswerEvent => e.kind === 'answer');
  const ends = evs.filter((e): e is MatchEndEvent => e.kind === 'match_end' && e.mode !== 'training');

  const today0 = dayStart(now);
  const week0 = new Date(new Date(today0).getFullYear(), new Date(today0).getMonth(), new Date(today0).getDate() - 6).getTime();
  const windowOf = (from: number): Window => {
    const m = ends.filter((e) => e.ts >= from);
    const ms = answers.filter((a) => a.ts >= from).reduce((s, a) => s + a.ms, 0);
    return {
      matches: m.length, minutes: Math.round(ms / 60000),
      goals: m.filter((e) => e.won).reduce((s, e) => s + e.goalsFor + (e.bullitGoal ? 1 : 0), 0),
    };
  };

  const topicTitle = new Map<string, string>();
  for (const s of content.subjects) for (const t of s.topics) topicTitle.set(t.id, t.title);

  const byTopic = new Map<string, { played: number; lost: number }>();
  for (const e of ends) {
    if (e.mode !== 'regular' || !e.topicId) continue;
    const c = byTopic.get(e.topicId) ?? { played: 0, lost: 0 };
    c.played++;
    if (!e.won) c.lost++;
    byTopic.set(e.topicId, c);
  }
  const hardTopics = [...byTopic.entries()]
    .filter(([, c]) => c.played >= 3 && c.lost > 0)
    .map(([topicId, c]) => ({ topicId, title: topicTitle.get(topicId) ?? topicId, ...c }))
    .sort((a, b) => b.lost / b.played - a.lost / a.played || b.played - a.played)
    .slice(0, 3);

  const flags = evs.flatMap((e) => (e.kind === 'flag'
    ? [{ questionId: e.questionId, text: content.questionsById.get(e.questionId)?.text ?? e.questionId, ts: e.ts }] : []))
    .reverse();

  const lowPool: ParentStats['lowPool'] = [];
  for (const s of content.subjects) {
    for (const t of s.topics) {
      if (!t.released) continue;
      for (const level of [1, 2, 3] as Level[]) {
        const left = (content.questionsByTopic.get(t.id) ?? []).filter((q) => q.level === level && !p.flagged.has(q.id)).length;
        if (left < POOL_MIN) lowPool.push({ topicId: t.id, level, left });
      }
    }
  }

  const recentMatches = ends.slice(-10).reverse().map((e) => ({
    ts: e.ts, subject: e.subject, topicTitle: e.topicId ? topicTitle.get(e.topicId) ?? e.topicId : '—', mode: e.mode,
    score: `${e.goalsFor} : ${e.goalsAgainst}`, won: e.won,
    answersSec: answers.filter((a) => a.matchId === e.matchId).map((a) => Math.round(a.ms / 1000)),
  }));

  return {
    today: windowOf(today0), week: windowOf(week0),
    subjects: content.subjects.map((s) => ({ id: s.id, title: s.title, ...p.subjects[s.id] })),
    superPrize: p.superPrize, streakDays: p.streakDays,
    hardTopics, flags, lowPool, recentMatches,
  };
}

export function flagsForClaude(stats: ParentStats, content: ParentContent = defaultContent): string {
  if (stats.flags.length === 0) return 'Отметки «неправильный вопрос»: нет отметок.';
  const subjTitle = new Map(content.subjects.map((s) => [s.id, s.title]));
  const lines = stats.flags.map((f) => {
    const q = content.questionsById.get(f.questionId);
    const subject = q ? subjTitle.get(q.subject) ?? q.subject : '?';
    const topic = q ? (content.subjects.flatMap((s) => s.topics).find((t) => t.id === q.topicId)?.title ?? q.topicId) : '?';
    return `${f.questionId} | ${subject} | ${topic} | ${f.text}`;
  });
  return `Отмеченные вопросы (id | предмет | тема | вопрос), проверь их:\n${lines.join('\n')}`;
}
