import { deriveProgress } from '../../engine/progress';
import type { MatchEndEvent } from '../../engine/events';
import { CoachBubble, useFirstUnseen } from '../CoachBubble';
import { ART } from '../art';
import { useGame } from '../useGame';
import { Screen } from './Layout';

export function MatchResult({ matchId }: { matchId: string }) {
  const { store, content, progress } = useGame();
  const all = store.all();
  const found = all.find((e): e is MatchEndEvent => e.kind === 'match_end' && e.matchId === matchId);
  const coach = useFirstUnseen(found ? [
    found.won ? 'first_win' : 'first_loss',
    found.won && found.topicId && progress.topics[found.topicId]?.cup ? 'first_cup' : null,
  ] : []);
  const end = all.find((e): e is MatchEndEvent => e.kind === 'match_end' && e.matchId === matchId);
  if (!end) return <Screen title="Итог" back="#/"><p class="msg">Такого матча нет.</p></Screen>;
  const before = deriveProgress(all.filter((e) => e !== end), content.subjects, Date.now());
  const newRank = end.won && progress.rank && progress.rank !== before.rank ? progress.rank : null;
  const shutout = end.won && end.mode === 'regular' && end.goalsAgainst === 0;
  const back = end.topicId ? `#/t/${end.topicId}` : `#/s/${end.subject}`;
  return (
    <Screen title="Итог матча">
      <CoachBubble hintId={coach} />
      <div class="fin">
        <div class="score">{end.goalsFor} : {end.goalsAgainst}</div>
        <h2>{end.won ? 'Победа!' : 'Поражение'}</h2>
        {end.bullitGoal && <p>Гол в буллите!</p>}
        {!end.won && <p class="burn">Голы сгорели: {end.goalsFor}</p>}
        {shutout && <div class="star"><img src={ART.star} alt="" /><p>Звезда вратаря</p><small>Сухой матч</small></div>}
        {newRank && <p class="rank">Новое звание: {newRank}</p>}
      </div>
      <a class="big" href={back}>Дальше</a>
      <a class="card" href="#/">В меню</a>
    </Screen>
  );
}
