import { useEffect, useState } from 'preact/hooks';
import { ensureSession, joinFamily } from '../../storage/auth';
import { navigate } from '../router';
import { useGame } from '../useGame';
import { Screen } from './Layout';

export function Placeholder(props: { title: string; text: string }) {
  return <Screen title={props.title} back="#/"><p class="msg">{props.text}</p></Screen>;
}

export function Join({ code }: { code: string }) {
  const { client } = useGame();
  const [msg, setMsg] = useState(client ? 'Подключаемся…' : 'Нужен интернет, чтобы подключиться. Попробуй позже.');
  useEffect(() => {
    if (!client) return;
    let dead = false;
    ensureSession(client)
      .then(() => joinFamily(client, code))
      .then(() => { if (!dead) navigate('/'); })
      .catch(() => { if (!dead) setMsg('Не получилось подключиться. Проверь ссылку и интернет.'); });
    return () => { dead = true; };
  }, [client, code]);
  return <Screen title="Подключение" back="#/"><p class="msg">{msg}</p></Screen>;
}
