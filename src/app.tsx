import { useEffect } from 'preact/hooks';
import { APP_NAME } from './config';
import { GameProvider } from './ui/useGame';
import { useRoute } from './ui/router';
import { Home } from './ui/screens/Home';
import { Subject } from './ui/screens/Subject';
import { Topic } from './ui/screens/Topic';
import { Match } from './ui/screens/Match';
import { MatchResult } from './ui/screens/MatchResult';
import { Trophies } from './ui/screens/Trophies';
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
    case 'result': return <MatchResult matchId={r.matchId} />;
    case 'trophies': return <Trophies />;
    case 'join': return <Join code={r.code} />;
    case 'parent': return <Placeholder title="Родителям" text="Страница для родителей скоро появится." />;
    case 'parentJoin': return <Placeholder title="Родителям" text="Вход для родителей скоро появится." />;
    case 'rules': return <Placeholder title="Правила" text="Правила игры скоро появятся здесь." />;
    default: return <Placeholder title="Не найдено" text="Такого экрана нет." />;
  }
}

export function App() {
  return (
    <GameProvider>
      <Routes />
    </GameProvider>
  );
}
