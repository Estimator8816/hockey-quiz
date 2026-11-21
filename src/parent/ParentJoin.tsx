import { useState } from 'preact/hooks';
import { ensureSession, joinFamily } from '../storage/auth';
import { navigate } from '../ui/router';
import { getDeviceRole, setDeviceRole } from '../storage/deviceRole';
import { useEffect } from 'preact/hooks';
import { inviteHref, parseInvite, rememberInviteLink, savedInviteLink } from '../ui/install';
import { useGame } from '../ui/useGame';
import { Screen } from '../ui/screens/Layout';

export function ParentJoin({ code: initial = '', onJoined }: { code?: string; onJoined?: () => void }) {
  const { client } = useGame();
  // Код из ссылки, иначе тот, что телефон запомнил (иконка открывается без кода в адресе).
  const [code, setCode] = useState(() => {
    if (initial) return initial;
    const saved = parseInvite(savedInviteLink() ?? '');
    return saved?.kind === 'parent' ? saved.code : '';
  });
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');

  // Иконка родителя открывает ту же ссылку: если телефон уже вошёл — сразу статистика, PIN не спрашиваем.
  useEffect(() => {
    if (initial) rememberInviteLink(inviteHref({ kind: 'parent', code: initial }));
    if (!onJoined && getDeviceRole() === 'parent') navigate('/parent');
  }, [onJoined, initial]);

  const submit = async () => {
    if (!client) return;
    setMsg('Проверяем…');
    try {
      await ensureSession(client);
      const role = await joinFamily(client, code.trim(), pin.trim() || undefined);
      if (role === 'parent') { setDeviceRole('parent'); if (onJoined) onJoined(); else navigate('/parent'); }
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
