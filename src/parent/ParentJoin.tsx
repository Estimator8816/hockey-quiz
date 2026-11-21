import { useState } from 'preact/hooks';
import { ensureSession, joinFamily } from '../storage/auth';
import { navigate } from '../ui/router';
import { useGame } from '../ui/useGame';
import { Screen } from '../ui/screens/Layout';

export function ParentJoin({ code: initial = '', onJoined }: { code?: string; onJoined?: () => void }) {
  const { client } = useGame();
  const [code, setCode] = useState(initial);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!client) return;
    setMsg('Проверяем…');
    try {
      await ensureSession(client);
      const role = await joinFamily(client, code.trim(), pin.trim() || undefined);
      if (role === 'parent') { if (onJoined) onJoined(); else navigate('/parent'); }
      else setMsg('Эта ссылка не даёт доступ родителя.');
    } catch {
      setMsg('Не получилось. Проверьте ссылку, код и интернет.');
    }
  };

  return (
    <Screen title="Родителям" back="#/">
      <div class="parent">
      <p class="msg">Для этой страницы нужна родительская ссылка. Откройте её на этом устройстве или введите код.</p>
      {!client && <p class="msg">Сейчас нет связи с сервером, вход временно недоступен.</p>}
      <label>Код <input value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} disabled={!client} /></label>
      <label>PIN <input value={pin} type="password" onInput={(e) => setPin((e.target as HTMLInputElement).value)} disabled={!client} /></label>
      <button class="big" type="button" disabled={!client || !code.trim()} onClick={() => void submit()}>Войти</button>
      {msg && <p class="msg">{msg}</p>}
      </div>
    </Screen>
  );
}
