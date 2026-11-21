import { useState } from 'preact/hooks';
import { newEvent, type HintSeenEvent } from '../engine/events';
import { useGame } from './useGame';
import { HINTS, type HintId } from './hints';

/** Показывает подсказку один раз; по тапу пишет HintSeenEvent. */
export function useCoach(hintId: HintId | null, active = true) {
  const { store, progress } = useGame();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const visible = !!hintId && active && !progress.hintsSeen.has(hintId) && !closed.has(hintId);
  const close = () => {
    if (!hintId) return;
    setClosed((s) => new Set(s).add(hintId));
    store.append(newEvent<HintSeenEvent>({ kind: 'hint_seen', hintId }));
  };
  return { visible, lines: hintId ? HINTS[hintId] : [], close };
}

export function CoachBubble(props: { hintId: HintId | null; active?: boolean; onClose?: () => void }) {
  const c = useCoach(props.hintId, props.active ?? true);
  if (!c.visible) return null;
  return (
    <div class="coach" role="note" onClick={() => { c.close(); props.onClose?.(); }}>
      <span class="coach-ico">🏒</span>
      <div>{c.lines.map((l) => <p key={l}>{l}</p>)}<small>Нажми, чтобы закрыть</small></div>
    </div>
  );
}

/** Первая неувиденная подсказка из списка (по одной за раз). */
export function useFirstUnseen(ids: (HintId | null)[]): HintId | null {
  const { progress } = useGame();
  return ids.find((id): id is HintId => !!id && !progress.hintsSeen.has(id)) ?? null;
}
