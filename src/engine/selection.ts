import type { Bullit, Question } from '../content/types';
import type { AnswerEvent } from './events';
import { shuffle, type Rng } from './rng';

/** Последний показ и последний исход по id (по ts, порядок массива не важен). */
function lastByItem(history: readonly AnswerEvent[], bullit: boolean): Map<string, AnswerEvent> {
  const last = new Map<string, AnswerEvent>();
  for (const e of history) {
    if (e.kind !== 'answer' || e.bullit !== bullit) continue;
    const prev = last.get(e.questionId);
    if (!prev || e.ts >= prev.ts) last.set(e.questionId, e);
  }
  return last;
}

/** Приоритетный порядок: 1) последний исход не correct, 2) не показывались, 3) давно показанные раньше. */
function prioritized<T extends { id: string }>(
  items: readonly T[], last: Map<string, AnswerEvent>, rng: Rng,
): T[] {
  const wrong: T[] = [];
  const fresh: T[] = [];
  const seen: T[] = [];
  for (const it of items) {
    const e = last.get(it.id);
    if (!e) fresh.push(it);
    else if (e.outcome !== 'correct') wrong.push(it);
    else seen.push(it);
  }
  const oldestFirst = shuffle(seen, rng).sort((a, b) => last.get(a.id)!.ts - last.get(b.id)!.ts);
  return [...shuffle(wrong, rng), ...shuffle(fresh, rng), ...oldestFirst];
}

export function pickQuestions(
  pool: Question[], history: AnswerEvent[], flagged: Set<string>, n: number, rng: Rng,
): Question[] {
  const available = pool.filter((q) => !flagged.has(q.id));
  if (available.length === 0 || n <= 0) return [];
  const order = prioritized(available, lastByItem(history, false), rng);
  return Array.from({ length: n }, (_, i) => order[i % order.length]);
}

export function pickFriendly(
  topicPool: Question[], history: AnswerEvent[], flagged: Set<string>, rng: Rng,
): Question[] {
  const available = topicPool.filter((q) => !flagged.has(q.id));
  const chosen: Question[] = [];
  for (const level of [1, 2, 3] as const) {
    chosen.push(...pickQuestions(available.filter((q) => q.level === level), history, flagged, 1, rng));
  }
  const need = 5 - chosen.length;
  if (need > 0) {
    const ids = new Set(chosen.map((q) => q.id));
    const rest = available.filter((q) => !ids.has(q.id));
    chosen.push(...pickQuestions(rest.length > 0 ? rest : available, history, flagged, need, rng));
  }
  return shuffle(chosen, rng);
}

export function pickFinal(
  subjectPools: Question[][], history: AnswerEvent[], flagged: Set<string>, rng: Rng,
): Question[] {
  const lists = subjectPools
    .map((p) => pickQuestions(p, history, flagged, 20, rng))
    .filter((l) => l.length > 0);
  if (lists.length === 0) return [];
  return Array.from({ length: 20 }, (_, i) => lists[i % lists.length][Math.floor(i / lists.length)]);
}

export function pickBullit(
  bullits: Bullit[], history: AnswerEvent[], flagged: Set<string>, rng: Rng,
): Bullit | null {
  const available = bullits.filter((b) => !flagged.has(b.id));
  if (available.length === 0) return null;
  const last = lastByItem(history, true);
  const never = available.filter((b) => !last.has(b.id));
  if (never.length > 0) return shuffle(never, rng)[0];
  return prioritized(available, new Map([...last].map(([k, e]) => [k, { ...e, outcome: 'correct' as const }])), rng)[0];
}
