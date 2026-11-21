import type { Level, SubjectId } from '../content/types';
import type { Mode, Outcome } from './match';

interface Base { id: string; ts: number } // id = crypto.randomUUID(), ts = Date.now()

export interface AnswerEvent extends Base {
  kind: 'answer'; matchId: string; mode: Mode; subject: SubjectId;
  topicId: string | null; level: Level; questionId: string; bullit: boolean; outcome: Outcome; ms: number;
}
export interface MatchEndEvent extends Base {
  kind: 'match_end'; matchId: string; mode: Mode; subject: SubjectId;
  topicId: string | null; level: Level | null; goalsFor: number; goalsAgainst: number; bullitGoal: boolean; won: boolean;
}
export interface FlagEvent extends Base { kind: 'flag'; questionId: string }
export interface HintSeenEvent extends Base { kind: 'hint_seen'; hintId: string }
export type GameEvent = AnswerEvent | MatchEndEvent | FlagEvent | HintSeenEvent;
