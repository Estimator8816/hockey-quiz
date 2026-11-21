import { useEffect } from 'preact/hooks';
import type { ComponentProps } from 'preact';
import { APP_NAME } from './config';
import { GameProvider, useGame } from './ui/useGame';
import { navigate, useRoute } from './ui/router';
import { Home } from './ui/screens/Home';
import { Subject } from './ui/screens/Subject';
import { Topic } from './ui/screens/Topic';
import { Match } from './ui/screens/Match';
import { MatchResult } from './ui/screens/MatchResult';
import { Trophies } from './ui/screens/Trophies';
import { Rules } from './ui/screens/Rules';
import { Training } from './ui/screens/Training';
import { ParentPage } from './parent/ParentPage';
import { ParentJoin } from './parent/ParentJoin';
import { Join, Placeholder } from './ui/screens/Misc';

export function Routes() {
  const r = useRoute();
  useEffect(() => { document.title = APP_NAME; }, []);
  switch (r.name) {
    case 'home': return <Home />;
    case 'subject': return <Subject subjectId={r.subject} />;
    case 'topic': return <Topic topicId={r.topicId} />;
    case 'play':
      return <Match key={location.hash} mode={r.mode} subjectId={r.subject} topicId={r.topicId} level={r.level} />;
    case 'training': return <Training />;
    case 'result': return <MatchResult matchId={r.matchId} />;
    case 'trophies': return <Trophies />;
    case 'join': return <Join code={r.code} />;
    case 'parent': return <ParentPage />;
    case 'parentJoin': return <ParentJoin code={r.code} />;
    case 'rules': return <Rules />;
    default: return <Placeholder title="Не найдено" text="Такого экрана нет." />;
  }
}

/** Первый запуск: пока не пройдена тренировка, ведём на неё (кроме ссылки подключения и родителей). */
function FirstRun() {
  const { progress, content } = useGame();
  const r = useRoute();
  const exempt = r.name === 'training' || r.name === 'join' || r.name === 'parent' || r.name === 'parentJoin';
  const need = !progress.hintsSeen.has('training_end') && content.training.length > 0 && !exempt;
  useEffect(() => { if (need) navigate('/training'); }, [need]);
  return need ? null : <Routes />;
}

export function App(props: Omit<ComponentProps<typeof GameProvider>, 'children'> = {}) {
  return (
    <GameProvider {...props}>
      <FirstRun />
    </GameProvider>
  );
}
