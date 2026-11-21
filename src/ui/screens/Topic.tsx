import type { Level } from '../../content/types';
import { CoachBubble } from '../CoachBubble';
import { useGame } from '../useGame';
import { LEVEL_NAME, Screen } from './Layout';

export function Topic({ topicId }: { topicId: string }) {
  const { content, progress } = useGame();
  const subject = content.subjects.find((s) => s.topics.some((t) => t.id === topicId));
  const topic = subject?.topics.find((t) => t.id === topicId);
  const tp = progress.topics[topicId];
  if (!subject || !topic || !tp) return <Screen title="Не найдено" back="#/" />;
  return (
    <Screen title={topic.title} back={`#/s/${subject.id}`} help="topic">
      <CoachBubble hintId={tp.cup ? 'first_cup' : null} />
      {([1, 2, 3] as Level[]).map((lvl) => {
        const won = tp.levelsWon.includes(lvl);
        const open = tp.cup || (tp.nextLevel !== null && lvl <= tp.nextLevel);
        const label = `${subject.title} — ${LEVEL_NAME[lvl]} состав`;
        const status = won ? 'ПОБЕДА' : open ? 'ТВОЙ МАТЧ' : 'ЗАКРЫТО';
        if (!open) {
          return (
            <button key={lvl} class="opp locked" disabled aria-disabled="true" data-level={lvl}>
              <span class="lock">🔒</span><b>{label}</b><span class="st">{status}</span>
            </button>
          );
        }
        return (
          <a key={lvl} class={`opp${won ? ' won' : ' next'}`} data-level={lvl}
            href={`#/play/regular/${subject.id}/${topic.id}/${lvl}`}>
            <span class="lock">{won ? '✔' : '⛸'}</span><b>{label}</b><span class="st">{status}</span>
          </a>
        );
      })}
      {tp.friendlyDue && (
        <a class="big" href={`#/play/friendly/${subject.id}/${topic.id}`}>Товарищеский матч</a>
      )}
    </Screen>
  );
}
