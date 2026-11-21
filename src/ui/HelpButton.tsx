import { useState } from 'preact/hooks';
import { SCREEN_HELP, type ScreenId } from './hints';

export function HelpButton({ screen }: { screen: ScreenId }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button class="help" aria-label="Помощь" aria-expanded={open} onClick={() => setOpen(!open)}>?</button>
      {open && (
        <div class="helpbox" role="dialog">
          {SCREEN_HELP[screen].map((l) => <p key={l}>{l}</p>)}
          <a href="#/rules">Все правила</a>
        </div>
      )}
    </>
  );
}
