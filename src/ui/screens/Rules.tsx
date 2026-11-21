import { RULES } from '../hints';
import { Screen } from './Layout';

export function Rules() {
  return (
    <Screen title="Правила" back="#/">
      <ul class="rules">{RULES.map((l) => <li key={l}>{l}</li>)}</ul>
    </Screen>
  );
}
