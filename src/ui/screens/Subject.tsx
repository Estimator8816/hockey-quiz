import { useGame } from '../useGame';
import { Screen } from './Layout';

export function Subject({ subjectId }: { subjectId: string }) {
  const { content, progress } = useGame();
  const s = content.subjects.find((x) => x.id === subjectId);
  if (!s) return <Screen title="Не найдено" back="#/" />;
  const sp = progress.subjects[s.id];
  return (
    <Screen title={s.title} back="#/">
      {sp.finalUnlocked && (
        <a class="big" href={`#/play/final/${s.id}`}>Финал</a>
      )}
      <ul class="list">
        {s.topics.map((t) => {
          if (!t.released) {
            return (
              <li key={t.id} class="row locked" aria-disabled="true">
                <span class="lock">🔒</span>
                <div><b>{t.title}</b><span>{t.paragraphs}</span></div>
                <span class="st">скоро</span>
              </li>
            );
          }
          const tp = progress.topics[t.id];
          return (
            <li key={t.id}>
              <a class={`row${tp.tarnished ? ' tarnished' : ''}`} href={`#/t/${t.id}`}>
                <span class="lock">{tp.cup ? '🏆' : '⛸'}</span>
                <div><b>{t.title}</b><span>{t.paragraphs}</span></div>
                <span class="st">{tp.cup ? (tp.tarnished ? 'кубок потускнел' : 'кубок') : `${tp.levelsWon.length} из 3`}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </Screen>
  );
}
