import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Question } from '../content/types';
import { myRole } from '../storage/auth';
import { syncNow } from '../storage/sync';
import { useGame } from '../ui/useGame';
import { Screen } from '../ui/screens/Layout';
import { ParentJoin } from './ParentJoin';
import { flagsForClaude, parentStats, type ParentContent } from './stats';

type Gate = 'checking' | 'parent' | 'denied';

const fmtTime = (ts: number) => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function ParentPage({ code }: { code?: string } = {}) {
  const { client, store, content } = useGame();
  const [gate, setGate] = useState<Gate>(client ? 'checking' : 'denied');
  const [events, setEvents] = useState(() => store.all());
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  useEffect(() => store.subscribe(() => setEvents(store.all())), [store]);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!client) { setGate('denied'); return; }
    let dead = false;
    myRole(client)
      .then(async (role) => {
        if (dead) return;
        if (role !== 'parent') { setGate('denied'); return; }
        await syncNow(store, client).catch(() => undefined);
        if (!dead) { setEvents(store.all()); setGate('parent'); }
      })
      .catch(() => { if (!dead) setGate('denied'); });
    return () => { dead = true; };
  }, [client, store, attempt]);

  const pc = useMemo<ParentContent>(() => {
    const byId = new Map<string, Question>();
    for (const list of content.questionsByTopic.values()) for (const q of list) byId.set(q.id, q);
    return { subjects: content.subjects, questionsByTopic: content.questionsByTopic, questionsById: byId };
  }, [content]);
  const stats = useMemo(() => parentStats(events, Date.now(), pc), [events, pc]);

  if (gate === 'checking') return <Screen title="Родителям" back="#/"><p class="msg">Загрузка…</p></Screen>;
  if (gate === 'denied') return <ParentJoin code={code} onJoined={() => { setGate('checking'); setAttempt((n) => n + 1); }} />;

  const copy = async () => {
    try { await navigator.clipboard.writeText(flagsForClaude(stats, pc)); setCopied('ok'); } catch { setCopied('fail'); }
  };
  const won = stats.subjects.filter((s) => s.seasonWon);

  return (
    <Screen title="Родителям" back="#/">
      <div class="parent">
      {stats.superPrize && <div class="big" role="status">Супер-приз!</div>}
      {won.map((s) => <div key={s.id} class="big" role="status">Пора готовить приз: {s.title}</div>)}

      <table>
        <caption>Занятия</caption>
        <thead><tr><th></th><th>Матчи</th><th>Минуты</th><th>Голы</th></tr></thead>
        <tbody>
          <tr><th>Сегодня</th><td>{stats.today.matches}</td><td>{stats.today.minutes}</td><td>{stats.today.goals}</td></tr>
          <tr><th>7 дней</th><td>{stats.week.matches}</td><td>{stats.week.minutes}</td><td>{stats.week.goals}</td></tr>
        </tbody>
      </table>
      <p>Дней подряд: {stats.streakDays}</p>

      <table>
        <caption>Предметы</caption>
        <thead><tr><th>Предмет</th><th>Кубки</th><th>Тем открыто</th><th>Финал</th><th>Сезон</th></tr></thead>
        <tbody>
          {stats.subjects.map((s) => (
            <tr key={s.id}><th>{s.title}</th><td>{s.cups} из {s.total}</td><td>{s.released}</td>
              <td>{s.finalUnlocked ? 'открыт' : 'закрыт'}</td><td>{s.seasonWon ? 'выигран' : '—'}</td></tr>
          ))}
        </tbody>
      </table>

      <table>
        <caption>Трудные темы</caption>
        <thead><tr><th>Тема</th><th>Матчей</th><th>Поражений</th></tr></thead>
        <tbody>
          {stats.hardTopics.length === 0 && <tr><td colSpan={3}>Нет данных</td></tr>}
          {stats.hardTopics.map((t) => <tr key={t.topicId}><th>{t.title}</th><td>{t.played}</td><td>{t.lost}</td></tr>)}
        </tbody>
      </table>

      <table>
        <caption>Отмеченные вопросы</caption>
        <thead><tr><th>Вопрос</th><th>Когда</th></tr></thead>
        <tbody>
          {stats.flags.length === 0 && <tr><td colSpan={2}>Нет отметок</td></tr>}
          {stats.flags.map((f, i) => <tr key={`${f.questionId}-${i}`}><td>{f.text}<br /><small>{f.questionId}</small></td><td>{fmtTime(f.ts)}</td></tr>)}
        </tbody>
      </table>
      <button class="big" type="button" onClick={() => void copy()}>Скопировать для Claude</button>
      {copied && <p role="status">{copied === 'ok' ? 'Скопировано' : 'Не удалось скопировать. Выделите текст вручную.'}</p>}

      <table>
        <caption>Мало вопросов (меньше 12)</caption>
        <thead><tr><th>Тема</th><th>Уровень</th><th>Осталось</th></tr></thead>
        <tbody>
          {stats.lowPool.length === 0 && <tr><td colSpan={3}>Хватает</td></tr>}
          {stats.lowPool.map((l) => <tr key={l.topicId + l.level}><th>{l.title}</th><td>{l.level}</td><td>{l.left}</td></tr>)}
        </tbody>
      </table>

      <table>
        <caption>Последние матчи</caption>
        <thead><tr><th>Когда</th><th>Тема</th><th>Счёт</th><th>Итог</th><th>Секунд на ответ</th></tr></thead>
        <tbody>
          {stats.recentMatches.length === 0 && <tr><td colSpan={5}>Матчей ещё не было</td></tr>}
          {stats.recentMatches.map((m) => (
            <tr key={m.matchId}><td>{fmtTime(m.ts)}</td><td>{m.topicTitle}</td><td>{m.score}</td>
              <td>{m.won ? 'победа' : 'поражение'}</td><td>{m.answersSec.join(', ')}</td></tr>
          ))}
        </tbody>
      </table>
      </div>
    </Screen>
  );
}
