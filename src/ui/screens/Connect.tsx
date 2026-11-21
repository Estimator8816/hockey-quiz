import { useState } from 'preact/hooks';
import { navigate } from '../router';
import { invitePath, isIOS, isStandalone, parseInvite, savedInviteLink } from '../install';
import { Screen } from './Layout';

/** Первый запуск с иконки, когда телефон ещё не подключён: вставить ссылку-приглашение. */
export function Connect() {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const go = (t: string) => {
    const inv = parseInvite(t);
    if (!inv) { setMsg('Это не ссылка-приглашение. Скопируйте ссылку ещё раз.'); return; }
    navigate(invitePath(inv));
  };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); setText(t); go(t); }
    catch { setMsg('Не получилось прочитать. Нажмите в поле и выберите «Вставить».'); }
  };
  return (
    <Screen title="Подключение">
      <div class="parent">
        <p class="msg">Первый запуск. Скопируйте свою ссылку-приглашение и нажмите «Вставить ссылку».</p>
        <button class="big" type="button" onClick={() => void paste()}>Вставить ссылку</button>
        <label>Или вставьте сюда <input value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} /></label>
        <button class="big" type="button" disabled={!text.trim()} onClick={() => go(text)}>Подключиться</button>
        {msg && <p class="msg">{msg}</p>}
      </div>
    </Screen>
  );
}

/** В Safari (не с иконки): как поставить на экран «Домой». */
export function InstallCard() {
  const [done, setDone] = useState<'ok' | 'fail' | null>(null);
  const link = savedInviteLink();
  if (!link || isStandalone() || !isIOS()) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setDone('ok'); } catch { setDone('fail'); }
  };
  return (
    <div class="install" data-testid="install-card">
      <b>Установить на экран «Домой»</b>
      <ol>
        <li><button type="button" onClick={() => void copy()}>Скопировать ссылку</button>{done === 'ok' ? ' ✓' : ''}</li>
        <li>«Поделиться» → «На экран „Домой“» → «Добавить»</li>
        <li>Открыть иконку → «Вставить ссылку»</li>
      </ol>
      {done === 'fail' && <p>Не скопировалось. Скопируйте адрес страницы вручную: {link}</p>}
    </div>
  );
}
