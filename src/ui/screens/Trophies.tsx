import { useGame } from '../useGame';
import { Screen } from './Layout';

export function Trophies() {
  const { content, progress: p } = useGame();
  return (
    <Screen title="Шкаф с кубками" back="#/">
      <div class="player">
        <div>
          <b>{p.rank ?? 'Без звания'}</b>
          <span>
            Голов: {p.careerGoals}
            {p.nextRank ? ` · до звания «${p.nextRank.title}»: ${p.nextRank.goalsLeft}` : ''}
          </span>
        </div>
      </div>
      <ul class="list">
        {content.subjects.map((s) => (
          <li key={s.id} class="row"><span class="lock">🏆</span>
            <div><b>{s.title}</b></div>
            <span class="st">{p.subjects[s.id].cups} из {p.subjects[s.id].total}</span>
          </li>
        ))}
      </ul>
      <div class="stats">
        <div><b>{p.shutouts}</b>сухие матчи</div>
        <div><b>{p.bullitGoals}</b>буллиты</div>
        <div><b>{p.streakDays}</b>дней подряд</div>
      </div>
    </Screen>
  );
}
