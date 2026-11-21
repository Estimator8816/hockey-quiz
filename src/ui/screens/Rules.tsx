import { useEffect, useState } from 'preact/hooks';
import { myRole } from '../../storage/auth';
import { RULES } from '../hints';
import { useGame } from '../useGame';
import { Screen } from './Layout';
import { connectByCode } from './Misc';

function Connection() {
  const { client, store } = useGame();
  const [state, setState] = useState<'checking' | 'yes' | 'no'>(client ? 'checking' : 'no');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const refresh = () => {
    if (!client) return;
    myRole(client).then((r) => setState(r ? 'yes' : 'no'), () => setState('no'));
  };
  useEffect(refresh, [client]);
  const submit = async () => {
    if (!client) return;
    setMsg('Подключаемся…');
    try {
      const r = await connectByCode(client, store, code.trim());
      if (r !== 'pin') { setMsg(''); setCode(''); refresh(); }
    } catch {
      setMsg('Не получилось подключиться. Проверь код и интернет.');
    }
  };
  const label = state === 'yes' ? 'Подключено к семье' : state === 'checking' ? 'Проверяем…' : 'Не подключено';
  return (
    <div class="parent">
      <p class="msg" data-testid="conn-status">{label}</p>
      {state !== 'yes' && (
        <>
          <label>Код приглашения <input value={code} disabled={!client} onInput={(e) => setCode((e.target as HTMLInputElement).value)} /></label>
          <button class="big" type="button" disabled={!client || !code.trim()} onClick={() => void submit()}>Подключиться</button>
        </>
      )}
      {!client && <p class="msg">Нужен интернет, чтобы подключиться.</p>}
      {msg && <p class="msg">{msg}</p>}
    </div>
  );
}

export function Rules() {
  return (
    <Screen title="Правила" back="#/">
      <ul class="rules">{RULES.map((l) => <li key={l}>{l}</li>)}</ul>
      <Connection />
    </Screen>
  );
}
