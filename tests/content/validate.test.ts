import { afterEach, describe, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateContent } from '../../tools/validate-content';

type Q = Record<string, unknown>;

function question(topic: string, level: number, n: number): Q {
  return {
    id: `${topic}-${level}-${String(n).padStart(3, '0')}`,
    subject: 'math',
    topicId: topic,
    level,
    text: `Вопрос ${n}?`,
    options: ['а', 'б', 'в', 'г'],
    answer: 0,
    why: 'Потому что так.',
  };
}

function bullit(n: number): Q {
  return {
    id: `b-${n}`,
    category: 'logic',
    text: `Буллит ${n}?`,
    options: ['а', 'б', 'в', 'г'],
    answer: 1,
    why: 'Так.',
  };
}

interface Content {
  subjects: unknown[];
  training: Q[];
  bullits: Q[];
  questions: Record<string, Q[]>; // topicId -> вопросы (предмет math)
}

/** Минимальный валидный набор: math-01 выпущена (по 20 на уровень), math-02 нет. */
function validContent(): Content {
  const q01: Q[] = [];
  for (const level of [1, 2, 3]) for (let n = 1; n <= 20; n++) q01.push(question('math-01', level, n));
  return {
    subjects: [
      {
        id: 'math',
        title: 'Математика',
        book: 'Учебник',
        topics: [
          { id: 'math-01', title: 'Числа', paragraphs: '1-2', released: true },
          { id: 'math-02', title: 'Дроби', paragraphs: '3-4', released: false },
        ],
      },
    ],
    training: [1, 2, 3].map((n) => question('math-01', 1, 900 + n)),
    bullits: Array.from({ length: 100 }, (_, i) => bullit(i + 1)),
    questions: { 'math-01': q01, 'math-02': [question('math-02', 1, 1)] },
  };
}

const dirs: string[] = [];
function write(c: Content): string {
  const dir = mkdtempSync(join(tmpdir(), 'hq-content-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'subjects.json'), JSON.stringify(c.subjects));
  writeFileSync(join(dir, 'training.json'), JSON.stringify(c.training));
  writeFileSync(join(dir, 'bullits.json'), JSON.stringify(c.bullits));
  mkdirSync(join(dir, 'questions', 'math'), { recursive: true });
  for (const [topic, qs] of Object.entries(c.questions)) {
    writeFileSync(join(dir, 'questions', 'math', `${topic}.json`), JSON.stringify(qs));
  }
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('validateContent', () => {
  test('acceptsValidFixture', () => {
    expect(validateContent(write(validContent()))).toEqual([]);
  });

  test('rejectsDuplicateId', () => {
    const c = validContent();
    c.questions['math-01'][1].id = c.questions['math-01'][0].id;
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('math-01-1-001'))).toBe(true);
  });

  test('rejectsDuplicateOptions', () => {
    const c = validContent();
    c.questions['math-01'][0].options = ['а', 'а', 'в', 'г'];
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('math-01-1-001'))).toBe(true);
  });

  test('rejectsAnswerOutOfRange', () => {
    const c = validContent();
    c.questions['math-01'][0].answer = 4;
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('math-01-1-001'))).toBe(true);
  });

  test('rejectsTooFewPerLevelForReleasedTopic', () => {
    const c = validContent();
    c.questions['math-01'] = c.questions['math-01'].filter((q) => !(q.level === 2 && q.id === 'math-01-2-020'));
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('math-01') && e.includes('2') && e.includes('19'))).toBe(true);
  });

  test('ignoresUnreleasedTopicCounts', () => {
    const errors = validateContent(write(validContent()));
    expect(errors.filter((e) => e.includes('math-02'))).toEqual([]);
  });

  test('rejectsMultilineWhy', () => {
    const c = validContent();
    c.questions['math-01'][0].why = 'первая строка\nвторая строка';
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('math-01-1-001'))).toBe(true);
  });

  test('rejectsUnknownBullitCategory', () => {
    const c = validContent();
    c.bullits[0].category = 'cooking';
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('b-1') && e.includes('category'))).toBe(true);
  });

  test('rejectsDuplicateBullitText', () => {
    const c = validContent();
    c.bullits[1].text = c.bullits[0].text;
    const errors = validateContent(write(c));
    expect(errors.some((e) => e.includes('b-2') && e.includes('text'))).toBe(true);
  });
});
