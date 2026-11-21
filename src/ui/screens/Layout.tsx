import type { ComponentChildren } from 'preact';
import { APP_NAME } from '../../config';
import { HelpButton } from '../HelpButton';
import type { ScreenId } from '../hints';

export function Screen(props: { title?: string; back?: string; help?: ScreenId; children?: ComponentChildren }) {
  return (
    <main class="screen">
      <header class="top">
        {props.back ? <a class="back" href={props.back} aria-label="Назад"></a> : <span class="back-gap" />}
        {props.title === '' ? <span class="ttl" /> : <h1 class="ttl">{props.title ?? APP_NAME}</h1>}
        {props.help ? <HelpButton screen={props.help} /> : <span class="back-gap" />}
      </header>
      {props.children}
    </main>
  );
}

export const LEVEL_NAME = { 1: 'лёгкий', 2: 'средний', 3: 'сильный' } as const;
export const LEVEL_SQUAD = { 1: 'Лёгкий состав', 2: 'Средний состав', 3: 'Сильный состав' } as const;
