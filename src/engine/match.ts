import type { Bullit, Level, Question, SubjectId } from '../content/types';
import { shuffle, type Rng } from './rng';

export type Mode = 'regular' | 'friendly' | 'final' | 'training';
export type Outcome = 'correct' | 'wrong' | 'timeout' | 'left';

export const MATCH_CONFIG: Record<Mode, { attacks: number; maxConceded: number; bullit: boolean }> = {
  regular: { attacks: 10, maxConceded: 1, bullit: true },
  friendly: { attacks: 5, maxConceded: 1, bullit: false },
  final: { attacks: 20, maxConceded: 2, bullit: false },
  training: { attacks: 3, maxConceded: Infinity, bullit: false },
};
export const TIMER_SEC: Record<Level, number> = { 1: 20, 2: 30, 3: 60 };
export const BULLIT_SEC = 30;

export interface MatchItem {
  question: Question | Bullit;
  isBullit: boolean;
  level: Level;
  options: string[]; // уже перемешаны
  correctIndex: number;
  timerSec: number;
}

export interface MatchState {
  mode: Mode;
  subject: SubjectId;
  topicId: string | null;
  level: Level | null;
  goalsFor: number;
  goalsAgainst: number;
  bullitGoal: boolean;
  attackNo: number; // 1-based номер показанной обычной атаки; на буллите и после конца — число сыгранных обычных
  over: boolean;
  won: boolean | null;
  // внутреннее: очередь и позиция
  readonly items: readonly MatchItem[];
  readonly index: number;
  readonly played: number; // сыграно обычных атак
}

function makeItem(q: Question | Bullit, isBullit: boolean, level: Level, rng: Rng): MatchItem {
  const order = shuffle([0, 1, 2, 3], rng);
  return {
    question: q,
    isBullit,
    level,
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.answer),
    timerSec: isBullit ? BULLIT_SEC : TIMER_SEC[level],
  };
}

function withAttackNo(s: Omit<MatchState, 'attackNo'>): MatchState {
  const cur = s.over ? null : s.items[s.index];
  return { ...s, attackNo: cur && !cur.isBullit ? s.played + 1 : s.played };
}

export function createMatch(p: {
  mode: Mode; subject: SubjectId; topicId: string | null; level: Level | null;
  questions: Question[]; bullit: Bullit | null; rng: Rng;
}): MatchState {
  const cfg = MATCH_CONFIG[p.mode];
  const regular = p.questions.slice(0, cfg.attacks).map((q) => makeItem(q, false, q.level, p.rng));
  const items: MatchItem[] = [...regular];
  if (cfg.bullit && p.bullit && regular.length > 0) {
    const pos = regular.length > 1 ? 1 + Math.floor(p.rng() * (regular.length - 1)) : 1;
    items.splice(pos, 0, makeItem(p.bullit, true, p.level ?? 1, p.rng));
  }
  return withAttackNo({
    mode: p.mode, subject: p.subject, topicId: p.topicId, level: p.level,
    goalsFor: 0, goalsAgainst: 0, bullitGoal: false, over: items.length === 0,
    won: items.length === 0 ? true : null, items, index: 0, played: 0,
  });
}

export function currentItem(s: MatchState): MatchItem | null {
  return s.over ? null : s.items[s.index] ?? null;
}

export function answer(s: MatchState, outcome: Outcome): MatchState {
  const item = currentItem(s);
  if (!item) return s;
  let { goalsFor, goalsAgainst, bullitGoal, played } = s;
  if (item.isBullit) {
    bullitGoal = outcome === 'correct';
  } else {
    played += 1;
    if (outcome === 'correct') goalsFor += 1;
    else goalsAgainst += 1;
  }
  const index = s.index + 1;
  const lost = goalsAgainst > MATCH_CONFIG[s.mode].maxConceded;
  const over = lost || index >= s.items.length;
  return withAttackNo({
    ...s, goalsFor, goalsAgainst, bullitGoal, played, index, over, won: over ? !lost : null,
  });
}

export function concededLeft(s: MatchState): number {
  return Math.max(0, MATCH_CONFIG[s.mode].maxConceded - s.goalsAgainst);
}
