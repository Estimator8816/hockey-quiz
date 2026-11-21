import { useEffect } from 'preact/hooks';
import type { ComponentProps } from 'preact';
import { APP_NAME } from './config';
import { GameProvider } from './ui/useGame';
import { navigate, useRoute } from './ui/router';
import { getDeviceRole } from './storage/deviceRole';
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

/** Запуск всегда на главный экран с кнопками: игра сама не начинается (решение Максима 22.11).
 *  Телефон родителя: главная — это статистика, игру не показываем. */
function FirstRun() {
  const r = useRoute();
  const parentHome = r.name === 'home' && getDeviceRole() === 'parent';
  useEffect(() => { if (parentHome) navigate('/parent'); }, [parentHome]);
  return parentHome ? null : <Routes />;
}

export function App(props: Omit<ComponentProps<typeof GameProvider>, 'children'> = {}) {
  return (
    <GameProvider {...props}>
      <FirstRun />
    </GameProvider>
  );
}
