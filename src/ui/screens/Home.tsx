import { APP_NAME, FEATURE_DUEL, PLAYER_TEAM } from '../../config';
import { useGame } from '../useGame';
import { Screen } from './Layout';

const SUBJ_ICON: Record<string, string> = { math: '🧮', russian: '📖', history: '🏛' };

export function Home() {
  const { content, progress } = useGame();
  return (
    <Screen title="" help="home">
      <div class="logo" role="heading" aria-level={1} aria-label={APP_NAME}>
        {APP_NAME.split(' ').map((w) => <span key={w}>{w}</span>)}
      </div>
      <p class="tagline">Школьная викторина в формате хоккейного матча</p>
      <div class="player">
        <div>
          <b>{PLAYER_TEAM}</b>
          <span>{progress.rank ?? 'Без звания'} · голов: {progress.careerGoals}</span>
        </div>
      </div>
      <a class="card" href="#/training">Тренировка</a>
      {content.subjects.map((s) => {
        const sp = progress.subjects[s.id];
        return (
          <a key={s.id} class={`subj subj-${s.id}`} href={`#/s/${s.id}`}>
            <span class="ico" aria-hidden="true">{SUBJ_ICON[s.id] ?? '🏒'}</span>
            <b>{s.title}</b>
            <span class="cups">🏆 {sp.cups} из {sp.released}</span>
          </a>
        );
      })}
      <div class="bottom">
        <a class="navbtn" href="#/trophies"><span aria-hidden="true">🏆</span>Шкаф с кубками</a>
        <a class="navbtn" href="#/rules"><span aria-hidden="true">📖</span>Правила</a>
      </div>
      {FEATURE_DUEL && <div class="soon">Матч с родителями — скоро</div>}
    </Screen>
  );
}
