import { ART } from '../art';
import { useGame } from '../useGame';
import { Screen } from './Layout';

export function Trophies() {
  const { content, progress: p } = useGame();
  return (
    <Screen title="Шкаф с кубками" back="#/" help="trophies">
      <div class="rankcard">
        <div class="jersey">
          <img src={ART.jersey} alt="" />
          {p.rank && <b aria-hidden="true">{p.rank[0]}</b>}
        </div>
        <div>
          <span>Звание игрока</span>
          <b class="rankname">{p.rank ?? 'Без звания'}</b>
        </div>
      </div>
      <div class="goalscard">
        <img class="puck" src={ART.puck} alt="" />
        <div><span>Голы в карьере</span><b>{p.careerGoals}</b></div>
        {p.nextRank && <div><span>До звания «{p.nextRank.title}»</span><b>{p.nextRank.goalsLeft}</b></div>}
      </div>
      <div class="shelf" style={{ backgroundImage: `url(${ART.shelf})` }}>
        {content.subjects.map((s) => {
          const sp = p.subjects[s.id];
          return (
            <div key={s.id} class={sp.cups > 0 ? 'niche won' : 'niche'}>
              <img src={ART.cup} alt="" />
              <span class="plate">{s.title}<i>{sp.cups} из {sp.total}</i></span>
            </div>
          );
        })}
      </div>
      <div class="stats">
        <div><b>{p.shutouts}</b>сухие матчи</div>
        <div><b>{p.bullitGoals}</b>буллиты</div>
        <div><b>{p.streakDays}</b>дней подряд</div>
      </div>
    </Screen>
  );
}
