import { useEffect, useRef, useState } from 'preact/hooks';
import type { Level, Question, SubjectId } from '../../content/types';
import { PLAYER_TEAM } from '../../config';
import {
  answer, concededLeft, createMatch, currentItem, type MatchItem, type MatchState, type Mode, type Outcome,
} from '../../engine/match';
import { newEvent, type AnswerEvent, type FlagEvent, type MatchEndEvent } from '../../engine/events';
import { pickBullit, pickFinal, pickFriendly, pickQuestions } from '../../engine/selection';
import { navigate } from '../router';
import { useGame, type Game } from '../useGame';
import { LEVEL_SQUAD, Screen } from './Layout';

const MODES: Mode[] = ['regular', 'friendly', 'final', 'training'];

function build(g: Game, mode: Mode, subjectId: string, topicId: string | null, level: number | null) {
  const { content, store, progress } = g;
  const subject = content.subjects.find((s) => s.id === subjectId);
  if (!subject) return null;
  const history = store.all().filter((e): e is AnswerEvent => e.kind === 'answer');
  const flagged = progress.flagged;
  const rng = Math.random;
  const topicPool = (id: string | null) => (id ? content.questionsByTopic.get(id) ?? [] : []);
  let questions: Question[] = [];
  let lvl: Level | null = null;
  if (mode === 'regular') {
    if (level !== 1 && level !== 2 && level !== 3) return null;
    lvl = level;
    questions = pickQuestions(topicPool(topicId).filter((q) => q.level === level), history, flagged, 10, rng);
  } else if (mode === 'friendly') {
    questions = pickFriendly(topicPool(topicId), history, flagged, rng);
  } else if (mode === 'final') {
    questions = pickFinal(subject.topics.map((t) => topicPool(t.id)), history, flagged, rng);
  } else {
    questions = pickQuestions(content.training, history, flagged, 3, rng);
  }
  if (questions.length === 0) return null;
  const bullit = mode === 'regular' ? pickBullit(content.bullits, history, flagged, rng) : null;
  const state = createMatch({
    mode, subject: subject.id, topicId: mode === 'final' || mode === 'training' ? null : topicId,
    level: lvl, questions, bullit, rng,
  });
  return { state, matchId: crypto.randomUUID() };
}

interface Feedback { outcome: Outcome; item: MatchItem; chosen: number | null; flagged: boolean }

export function Match(props: {
  mode: string; subjectId: string; topicId: string | null; level: number | null;
}) {
  const game = useGame();
  const mode = props.mode as Mode;
  const subject = game.content.subjects.find((s) => s.id === props.subjectId);
  const locked = (() => {
    if (mode !== 'regular' || !props.topicId) return false;
    const tp = game.progress.topics[props.topicId];
    const lvl = props.level ?? 0;
    return !tp || !(tp.cup || (tp.nextLevel !== null && lvl <= tp.nextLevel));
  })();
  const valid = MODES.includes(mode) && !!subject;
  const [init] = useState(() => (valid && !locked ? build(game, mode, props.subjectId, props.topicId, props.level) : null));
  const [state, setState] = useState<MatchState | null>(init?.state ?? null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [, setTick] = useState(0);
  const shownAt = useRef(Date.now());
  const ref = useRef<{ state: MatchState | null; fb: Feedback | null }>({ state, fb });

  const resolve = (outcome: Outcome, chosen: number | null) => {
    const cur = ref.current;
    if (!init || cur.fb || !cur.state) return;
    const item = currentItem(cur.state);
    if (!item) return;
    const q = item.question;
    game.store.append(newEvent<AnswerEvent>({
      kind: 'answer', matchId: init.matchId, mode: cur.state.mode,
      subject: 'subject' in q ? q.subject : (cur.state.subject as SubjectId),
      topicId: 'topicId' in q ? q.topicId : cur.state.topicId,
      level: item.level, questionId: q.id, bullit: item.isBullit, outcome,
      ms: Math.max(0, Date.now() - shownAt.current),
    }));
    const next = answer(cur.state, outcome);
    if (next.over) {
      game.store.append(newEvent<MatchEndEvent>({
        kind: 'match_end', matchId: init.matchId, mode: next.mode, subject: next.subject,
        topicId: next.topicId, level: next.level, goalsFor: next.goalsFor, goalsAgainst: next.goalsAgainst,
        bullitGoal: next.bullitGoal, won: next.won === true,
      }));
    }
    const f: Feedback = { outcome, item, chosen, flagged: false };
    ref.current = { state: next, fb: f };
    setState(next);
    setFb(f);
  };
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  const idx = state?.index;
  useEffect(() => {
    if (!init || fb || !ref.current.state) return;
    const item = currentItem(ref.current.state);
    if (!item) return;
    const id = setInterval(() => {
      if (Date.now() - shownAt.current >= item.timerSec * 1000) resolveRef.current('timeout', null);
      else setTick((t) => t + 1);
    }, 200);
    return () => clearInterval(id);
  }, [idx, fb]);

  useEffect(() => {
    const on = () => {
      if (document.visibilityState === 'hidden') resolveRef.current('left', null);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  if (!valid) return <Screen title="Не найдено" back="#/" />;
  const backTo = props.topicId ? `#/t/${props.topicId}` : `#/s/${props.subjectId}`;
  if (locked) {
    return <Screen title="Закрыто" back={backTo}><p class="msg">Сначала победи соперника полегче.</p></Screen>;
  }
  if (!init || !state) {
    return <Screen title="Скоро" back={backTo}><p class="msg">Вопросы скоро появятся.</p></Screen>;
  }

  const item = fb ? fb.item : currentItem(state);
  const lvl = state.level;
  const opp = mode === 'final' ? 'Сборная учебника' : mode === 'training' ? 'Тренер' : subject!.title;
  const squad = mode === 'final' ? '' : mode === 'regular' && lvl ? LEVEL_SQUAD[lvl]
    : mode === 'friendly' ? 'Товарищеский' : mode === 'training' ? 'Тренировка' : '';
  const left = concededLeft(state);
  const elapsed = (Date.now() - shownAt.current) / 1000;
  const frac = item && !fb ? Math.max(0, 1 - elapsed / item.timerSec) : 0;

  const next = () => {
    if (state.over) { navigate(`/result/${init.matchId}`); return; }
    shownAt.current = Date.now();
    ref.current = { state, fb: null };
    setFb(null);
  };
  const flag = () => {
    if (!fb || fb.flagged) return;
    game.store.append(newEvent<FlagEvent>({ kind: 'flag', questionId: fb.item.question.id }));
    const f = { ...fb, flagged: true };
    ref.current = { state, fb: f };
    setFb(f);
  };

  return (
    <Screen title={opp} back={backTo}>
      <section class="board" aria-label="Табло">
        <div class="teams"><span>{PLAYER_TEAM}</span><span>{opp}</span></div>
        <div class="score" data-testid="score">{state.goalsFor} : {state.goalsAgainst}</div>
        {squad && <div class="squad">{squad}</div>}
      </section>
      <div class="meta">
        {item?.isBullit ? <b class="bullit">Буллит</b> : <span>Атака {Math.max(1, state.attackNo)} из {state.items.filter((i) => !i.isBullit).length}</span>}
        {Number.isFinite(left) && <span>можно пропустить ещё {left}</span>}
      </div>
      <div class="timer"><i style={{ width: `${frac * 100}%` }} /></div>
      {item && (
        <>
          <div class="q">{item.question.text}</div>
          <div class="answers">
            {item.options.map((o, i) => {
              const cls = fb
                ? i === item.correctIndex ? 'ans correct' : i === fb.chosen ? 'ans wrong' : 'ans'
                : 'ans';
              return (
                <button key={i} class={cls} disabled={!!fb} data-correct={fb && i === item.correctIndex ? 'true' : undefined}
                  onClick={() => resolve(i === item.correctIndex ? 'correct' : 'wrong', i)}>
                  <em>{'АБВГ'[i]}</em>{o}
                </button>
              );
            })}
          </div>
        </>
      )}
      {fb && item && (
        <div class="feedback">
          <div class={fb.outcome === 'correct' ? 'goal' : 'miss'}>
            {fb.outcome === 'correct' ? 'ГОЛ!' : 'Пропустил…'}
          </div>
          {fb.outcome === 'timeout' && <p>Время вышло.</p>}
          {fb.outcome === 'left' && <p>Ушёл со льда.</p>}
          {fb.item.isBullit && fb.outcome !== 'correct' && <p>Буллит не засчитан, но гол не пропущен.</p>}
          <p class="why">{item.question.why}</p>
          <button class="big" onClick={next}>Дальше</button>
          <button class="flag" onClick={flag} disabled={fb.flagged}>{fb.flagged ? 'Отмечено' : 'тут ошибка'}</button>
        </div>
      )}
    </Screen>
  );
}
