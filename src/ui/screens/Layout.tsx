import type { ComponentChildren } from 'preact';
import { APP_NAME } from '../../config';

export function Screen(props: { title?: string; back?: string; children?: ComponentChildren }) {
  return (
    <main class="screen">
      <header class="top">
        {props.back ? <a class="back" href={props.back} aria-label="Назад">‹</a> : <span class="back-gap" />}
        <h1 class="ttl">{props.title ?? APP_NAME}</h1>
        <a class="help" href="#/rules" aria-label="Правила">?</a>
      </header>
      {props.children}
    </main>
  );
}

export const LEVEL_NAME = { 1: 'лёгкий', 2: 'средний', 3: 'сильный' } as const;
export const LEVEL_SQUAD = { 1: 'Лёгкий состав', 2: 'Средний состав', 3: 'Сильный состав' } as const;
