import { APP_NAME, FEATURE_DUEL, PLAYER_TEAM } from '../../config';
import { useGame } from '../useGame';
import { Screen } from './Layout';

export function Home() {
  const { content, progress } = useGame();
  return (
    <Screen title={APP_NAME}>
      <div class="player">
        <div>
          <b>{PLAYER_TEAM}</b>
          <span>{progress.rank ?? 'Без звания'} · голов: {progress.careerGoals}</span>
        </div>
        <a class="chip" href="#/trophies">Шкаф</a>
      </div>
      <a class="card" href="#/play/training/math">Тренировка</a>
      {content.subjects.map((s) => {
        const sp = progress.subjects[s.id];
        return (
          <a key={s.id} class={`subj subj-${s.id}`} href={`#/s/${s.id}`}>
            <b>{s.title}</b>
            <span class="cups">🏆 {sp.cups} из {sp.released}</span>
          </a>
        );
      })}
      {FEATURE_DUEL && <div class="soon">Матч с родителями — скоро</div>}
    </Screen>
  );
}
