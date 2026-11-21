import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Subject } from '../src/content/types';

const MAX_TEXT = 220;
const MAX_OPTION = 70;
const MAX_WHY = 140;
const MIN_PER_LEVEL = 20;
const MIN_BULLITS = 100;
const TRAINING_COUNT = 3;
const LEVELS = [1, 2, 3];
const SUBJECT_IDS = ['math', 'russian', 'history'];

type Raw = Record<string, any>;

function readJson(path: string, errors: string[]): any {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    errors.push(`${path}: не читается (${(e as Error).message})`);
    return undefined;
  }
}

function checkQuiz(item: Raw, errors: string[]): void {
  const id = String(item.id);
  const err = (m: string) => errors.push(`${id}: ${m}`);
  if (typeof item.text !== 'string' || item.text.trim() === '') err('пустой text');
  else if (item.text.length > MAX_TEXT) err(`text длиннее ${MAX_TEXT} символов`);

  const opts = item.options;
  if (!Array.isArray(opts) || opts.length !== 4) err('нужно ровно 4 варианта');
  else {
    if (opts.some((o: unknown) => typeof o !== 'string' || o.trim() === '')) err('пустой вариант');
    if (new Set(opts.map((o: unknown) => String(o).trim())).size !== 4) err('варианты ответа повторяются');
    if (opts.some((o: unknown) => typeof o === 'string' && o.length > MAX_OPTION)) err(`вариант длиннее ${MAX_OPTION} символов`);
  }
  if (![0, 1, 2, 3].includes(item.answer)) err('answer вне 0..3');

  if (typeof item.why !== 'string' || item.why.trim() === '') err('пустой why');
  else {
    if (/[\r\n]/.test(item.why)) err('why содержит перевод строки');
    if (item.why.length > MAX_WHY) err(`why длиннее ${MAX_WHY} символов`);
  }
}

export function validateContent(dir: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const uniq = (id: unknown, where: string) => {
    if (typeof id !== 'string' || id === '') {
      errors.push(`${where}: нет id`);
      return;
    }
    if (seen.has(id)) errors.push(`${id}: дублируется id (${where})`);
    seen.add(id);
  };

  const subjectsPath = join(dir, 'subjects.json');
  if (!existsSync(subjectsPath)) return [`${subjectsPath}: файл не найден`];
  const subjects: Subject[] = readJson(subjectsPath, errors) ?? [];

  const topics = new Map<string, { subject: string; released: boolean }>();
  for (const s of subjects) {
    if (!SUBJECT_IDS.includes(s.id)) errors.push(`${s.id}: неизвестный предмет`);
    for (const t of s.topics ?? []) {
      uniq(t.id, 'тема');
      topics.set(t.id, { subject: s.id, released: t.released });
    }
  }

  // вопросы тем
  const counts = new Map<string, number>(); // `${topicId}|${level}`
  const questionsDir = join(dir, 'questions');
  if (existsSync(questionsDir)) {
    for (const subj of readdirSync(questionsDir)) {
      const sdir = join(questionsDir, subj);
      for (const file of readdirSync(sdir).filter((f) => f.endsWith('.json'))) {
        const list: Raw[] = readJson(join(sdir, file), errors) ?? [];
        const fileTopic = file.replace(/\.json$/, '');
        for (const q of list) {
          uniq(q.id, `вопрос в ${subj}/${file}`);
          checkQuiz(q, errors);
          const id = String(q.id);
          if (!topics.has(q.topicId)) errors.push(`${id}: тема ${q.topicId} не существует`);
          else if (topics.get(q.topicId)!.subject !== q.subject) errors.push(`${id}: subject ${q.subject} не совпадает с предметом темы ${q.topicId}`);
          if (!SUBJECT_IDS.includes(q.subject)) errors.push(`${id}: неизвестный subject ${q.subject}`);
          if (!LEVELS.includes(q.level)) errors.push(`${id}: level вне 1..3`);
          if (q.subject !== subj || q.topicId !== fileTopic) errors.push(`${id}: лежит в ${subj}/${file}, ожидается questions/${q.subject}/${q.topicId}.json`);
          const key = `${q.topicId}|${q.level}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
  }

  for (const [topicId, t] of topics) {
    if (!t.released) continue;
    for (const level of LEVELS) {
      const n = counts.get(`${topicId}|${level}`) ?? 0;
      if (n < MIN_PER_LEVEL) errors.push(`${topicId}: уровень ${level} — ${n} вопросов, нужно не меньше ${MIN_PER_LEVEL}`);
    }
  }

  // тренировочные
  const training: Raw[] = existsSync(join(dir, 'training.json')) ? readJson(join(dir, 'training.json'), errors) ?? [] : [];
  if (training.length !== TRAINING_COUNT) errors.push(`training: должно быть ровно ${TRAINING_COUNT} вопроса, сейчас ${training.length}`);
  for (const q of training) {
    uniq(q.id, 'training');
    checkQuiz(q, errors);
    if (q.level !== 1) errors.push(`${q.id}: тренировочный вопрос должен быть уровня 1`);
  }

  // буллиты
  const bullits: Raw[] = existsSync(join(dir, 'bullits.json')) ? readJson(join(dir, 'bullits.json'), errors) ?? [] : [];
  if (bullits.length < MIN_BULLITS) errors.push(`bullits: ${bullits.length} < ${MIN_BULLITS}`);
  for (const b of bullits) {
    uniq(b.id, 'bullit');
    checkQuiz(b, errors);
  }

  return errors;
}

// CLI: vite-node не передаёт путь скрипта в argv, поэтому просто не запускаем под vitest.
if (!process.env.VITEST) {
  const errors = validateContent(process.argv[2] ?? 'content');
  if (errors.length) {
    console.error(errors.join('\n'));
    console.error(`\nОшибок: ${errors.length}`);
    process.exit(1);
  }
  console.log('Контент в порядке.');
}
