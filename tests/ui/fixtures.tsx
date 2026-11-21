import { render } from '@testing-library/preact';
import type { Bullit, Level, Question, Subject } from '../../src/content/types';
import { createLocalStore, type EventStore } from '../../src/storage/store';
import { GameProvider, type Content } from '../../src/ui/useGame';
import { Routes } from '../../src/app';

export function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k), clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; },
  } as Storage;
}

const mkQ = (i: number, level: Level): Question => ({
  id: `math-01-${level}-${String(i).padStart(3, '0')}`, subject: 'math', topicId: 'math-01', level,
  text: `Вопрос ${level}-${i}`, options: ['ПРАВИЛЬНО', 'икс1', 'икс2', 'икс3'], answer: 0, why: 'ПОЯСНЕНИЕ',
});
const many = (level: Level) => Array.from({ length: 25 }, (_, i) => mkQ(i, level));

export const subjects: Subject[] = [
  { id: 'math', title: 'Математика', book: 'b', topics: [
    { id: 'math-01', title: 'Тема один', paragraphs: 'п. 1', released: true },
    { id: 'math-02', title: 'Тема два', paragraphs: 'п. 2', released: false },
  ] },
  { id: 'russian', title: 'Русский язык', book: 'b', topics: [] },
  { id: 'history', title: 'История', book: 'b', topics: [] },
];
const bullits: Bullit[] = Array.from({ length: 5 }, (_, i) => ({
  id: `b${i}`, category: 'logic' as const, text: `Буллит ${i}`, options: ['ПРАВИЛЬНО', 'икс1', 'икс2', 'икс3'] as [string, string, string, string], answer: 0 as const, why: 'ПОЯСНЕНИЕ',
}));
export const content: Content = {
  subjects, bullits,
  training: Array.from({ length: 3 }, (_, i) => mkQ(100 + i, 1)),
  questionsByTopic: new Map([['math-01', [...many(1), ...many(2), ...many(3)]]]),
};

export function mount(hash: string, store: EventStore = createLocalStore(memStorage())) {
  location.hash = hash;
  const r = render(<GameProvider store={store} client={null} content={content}><Routes /></GameProvider>);
  return { ...r, store };
}
