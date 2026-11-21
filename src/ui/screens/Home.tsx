import { APP_NAME, FEATURE_DUEL, PLAYER_TEAM } from '../../config';
import { ART } from '../art';
import { useGame } from '../useGame';
import { Screen } from './Layout';

const SUBJ_ICON: Record<string, string> = { math: '🧮', russian: '📖', history: '🏛' };

export function Home() {
  const { content, progress } = useGame();
  return (
    <Screen title="" help="home">
      <h1 class="logo"><img src={ART.logo} alt={APP_NAME} /></h1>
      <p class="tagline">Школьная викторина в формате хоккейного матча</p>
      <div class="player">
        <img class="puck" src={ART.puck} alt="" />
        <div>
          <b>{PLAYER_TEAM}</b>
          <span>{progress.rank ?? 'Без звания'} · голов: {progress.careerGoals}</span>
        </div>
      </div>
      <a class={progress.hintsSeen.has('training_end') ? 'card' : 'card card-start'} href="#/training">
        Тренировка{!progress.hintsSeen.has('training_end') && <small> · начни отсюда</small>}
      </a>
      {content.subjects.map((s) => {
        const sp = progress.subjects[s.id];
        return (
          <a key={s.id} class={`subj subj-${s.id}`} href={`#/s/${s.id}`}>
            <span class="ico" aria-hidden="true">{SUBJ_ICON[s.id] ?? '🏒'}</span>
            <b>{s.title}</b>
            <span class="cups"><img src={ART.cup} alt="кубков" /> {sp.cups} из {sp.released}</span>
          </a>
        );
      })}
      <div class="bottom">
        <a class="navbtn" href="#/trophies"><img src={ART.cup} alt="" />Шкаф с кубками</a>
        <a class="navbtn" href="#/rules"><span aria-hidden="true">📖</span>Правила</a>
      </div>
      {FEATURE_DUEL && <div class="soon">Матч с родителями — скоро</div>}
    </Screen>
  );
}
