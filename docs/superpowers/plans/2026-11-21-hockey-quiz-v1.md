# Хоккейная викторина v1 — план работ (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Веб-игра (PWA) для сына: русский, история, математика 5 класса, матчи на голы, кубки, финал учебника, подсказки тренера, родительская страница для папы и мамы, прогресс онлайн.

**Architecture:** Статический Preact-сайт на GitHub Pages. Вся игровая логика — чистые функции над **журналом событий** (ответы, концы матчей, отметки ошибок, увиденные подсказки): прогресс, кубки, голы и звания всегда пересчитываются из журнала. Журнал хранится на телефоне (localStorage) и досылается в Supabase (таблица только на добавление); при старте журнал подтягивается обратно, дубли отсекаются по `id`. Вопросы — JSON-файлы по темам в репозитории, проверяются валидатором.

**Tech Stack:** Node 24, Vite 6, TypeScript 5 (strict), Preact 10, Vitest 3 + jsdom + @testing-library/preact, vite-plugin-pwa, @supabase/supabase-js 2, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-21-hockey-quiz-design.md` (читать вместе с планом). Оглавления учебников: `материалы/учебники-5-класс-оглавления.md`.

**Корень репозитория:** `/Users/stoukin/Claude/Projects/Игра для сына/` (все пути ниже — от него).

## Global Constraints

- Предметы v1: `math` (Виленкин и др., 2023), `russian` (Ладыженская и др., 2023+), `history` (Мединский, Чубарьян, 2025). 20–30 тем на предмет, порядок — как в учебнике; в v1 выпущены (`released: true`) первые 4–5 тем каждого предмета.
- Вопрос: 4 варианта, ровно один верный, объяснение `why` в одну строку. Варианты перемешиваются при каждом показе.
- На каждую выпущенную тему — не меньше 20 вопросов на каждый уровень 1, 2, 3. Буллитов — не меньше 100.
- Матч: 10 атак, победа при пропущенных ≤ 1. 10:0 — сухой матч (звезда вратаря).
- Буллит: 1 за обычный матч, дополнительная атака, ошибка не считается пропущенным голом, верно — +1 гол.
- Тема: три соперника по порядку (уровень 1 → 2 → 3); все три выиграны — кубок.
- Товарищеский: через 7 дней после кубка, 5 атак смешанных уровней, победа при пропущенных ≤ 1; до победы кубок потускнел.
- Финал: открыт, когда все темы предмета выпущены, все с кубками и ни один не потускнел; 20 вопросов по всему учебнику, пропущенных ≤ 2; переигрывать можно. Победа — сезон (реальный приз). Три сезона — супер-приз.
- Голы в карьеру — только из выигранных матчей (обычный, товарищеский, финал), включая гол буллита.
- Звания: 100 — «Новичок», 250 — «Нападающий», 500 — «Капитан», 1000 — «Легенда».
- Таймер: уровень 1 — 20 с, уровень 2 — 30 с, уровень 3 — 60 с, буллит — 30 с. Не успел — пропущенный гол.
- «Ушёл со льда»: игра ушла в фон во время вопроса — пропущенный гол, исход `left` в журнале.
- Кнопка «тут ошибка»: только после ответа; вопрос исключается из будущих матчей; гол не возвращается; вопрос появляется у родителей.
- Если из-за отметок на уровне темы осталось < 12 вопросов — матч собирается с повторами, родители видят предупреждение.
- Тексты подсказок: до 12 слов на строку, без терминов, на «ты».
- Ребёнок не вводит паролей. Родители (папа, мама) — личная ссылка + PIN, права одинаковые.
- Без рекламы, оплаты, чатов. Названия команд и лиг — придуманные (без НХЛ/КХЛ).
- Рабочее имя «Хоккейная викторина»; название и оформление меню придут позже из отдельного шага — весь видимый текст названия держать в одном месте (`src/config.ts`).
- Ограничения дат: «день» = локальная дата устройства.

## Review Focus

1. **Финал при неполном учебнике.** В v1 выпущено 4–5 тем из 20–30; взяв их все, ребёнок НЕ должен получить финал и приз. → тест в Task 6 (`finalStaysLockedWhileTopicsUnreleased`).
2. **iOS выгрузил игру посреди матча** (или перезагрузка). Ответы без `match_end` не дают ни голов, ни побед, ни поражений; игра не падает. → тест в Task 6 (`ignoresUnfinishedMatch`).
3. **Одно событие пришло дважды** (повторная отправка, два устройства) — голы не удваиваются. → тесты в Task 6 (`dedupesById`) и Task 7 (`mergeSkipsKnownIds`).
4. **Полночь и серия дней.** Матч в 23:59 и в 00:01 — два разных дня подряд по локальной дате. → тест в Task 6 (`streakAcrossLocalMidnight`).
5. **Отметки съели пул вопросов** (на уровне осталось 3 вопроса) — матч из 10 всё равно собирается, без падения. → тест в Task 5 (`repeatsWhenPoolSmall`).

---

### Task 1: Каркас проекта

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` (или секция `test` в vite.config), `index.html`, `src/main.tsx`, `src/config.ts`, `src/app.tsx`, `public/icon-180.png`, `public/icon-512.png`, `.gitignore`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `src/config.ts` → `export const APP_NAME = 'Хоккейная викторина'; export const PLAYER_TEAM = 'Данила'; export const BASE = '/hockey-quiz/'; export const SUPABASE_URL: string; export const SUPABASE_ANON_KEY: string;` (два последних пока пустые строки, заполняются в Task 8). Скрипты npm: `dev`, `build`, `test`, `validate` (Task 2).

- [ ] **Step 1:** `git init`; `.gitignore`: `node_modules/`, `dist/`, `.superpowers/`, `.DS_Store`.
- [ ] **Step 2:** Поставить зависимости из Tech Stack; `vite.config.ts` с `base: BASE`, `@preact/preset-vite`, `VitePWA({ registerType: 'autoUpdate', manifest: { name: APP_NAME, short_name: APP_NAME, display: 'standalone', lang: 'ru', start_url: BASE, icons: [180, 512] } })`. В `index.html`: `<meta name="apple-mobile-web-app-capable" content="yes">`, `apple-touch-icon` → `icon-180.png`, `viewport` с `viewport-fit=cover`. Иконки — простая шайба и клюшка (временные).
- [ ] **Step 3:** Тест `tests/smoke.test.ts`: `expect(APP_NAME).toBe('Хоккейная викторина')`.
- [ ] **Step 4:** Run: `npm test` → PASS; `npm run build` → создан `dist/index.html` и `dist/manifest.webmanifest`.
- [ ] **Step 5:** Commit `chore: каркас проекта (Vite, Preact, PWA)`.

---

### Task 2: Формат контента и валидатор

**Files:**
- Create: `src/content/types.ts`, `src/content/load.ts`, `tools/validate-content.ts`, `tests/content/validate.test.ts`, `tests/fixtures/` (мини-набор)

**Interfaces:**
- Produces (`src/content/types.ts`):
```ts
export type SubjectId = 'math' | 'russian' | 'history';
export type Level = 1 | 2 | 3;
export interface Topic { id: string; title: string; paragraphs: string; released: boolean }   // id вида 'math-03'
export interface Subject { id: SubjectId; title: string; book: string; topics: Topic[] }
export interface Question { id: string; subject: SubjectId; topicId: string; level: Level;
  text: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3; why: string }  // id вида 'math-03-2-017'
export interface Bullit { id: string; category: 'logic' | 'subject' | 'life' | 'hockey';
  text: string; options: [string, string, string, string]; answer: 0 | 1 | 2 | 3; why: string }
```
- Produces (`src/content/load.ts`): `subjects: Subject[]` (из `content/subjects.json`), `questionsByTopic: Map<string, Question[]>` (через `import.meta.glob('/content/questions/*/*.json', { eager: true })`), `questionsById: Map<string, Question>`, `bullits: Bullit[]` (из `content/bullits.json`), `training: Question[]` (из `content/training.json`).
- Produces (`tools/validate-content.ts`): `validateContent(dir: string): string[]` — список ошибок (пусто = ок); CLI `npm run validate` печатает ошибки и выходит с кодом 1, если они есть.

Правила валидатора: уникальные `id` везде; `topicId` и `subject` вопроса существуют; у вопроса ровно 4 непустых попарно разных варианта; `answer` в 0..3; `text` ≤ 220 символов, вариант ≤ 70, `why` ≤ 140 и без перевода строки; для каждой `released`-темы ≥ 20 вопросов на каждый уровень; буллитов ≥ 100; в `training.json` ровно 3 вопроса уровня 1; файл вопросов темы лежит в `content/questions/<subject>/<topicId>.json`.

- [ ] **Step 1:** Тесты: `acceptsValidFixture` (пусто ошибок), `rejectsDuplicateId`, `rejectsDuplicateOptions`, `rejectsAnswerOutOfRange`, `rejectsTooFewPerLevelForReleasedTopic` (19 вопросов уровня 2 → ошибка с id темы и уровнем), `ignoresUnreleasedTopicCounts`, `rejectsMultilineWhy`.
- [ ] **Step 2:** Run `npx vitest run tests/content` → FAIL.
- [ ] **Step 3:** Реализовать типы, `validateContent`, `load.ts`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: формат вопросов и валидатор`.

---

### Task 3: Темы трёх учебников

**Files:**
- Create: `content/subjects.json`, `content/training.json`, пустые `content/bullits.json` (`[]`), `content/questions/{math,russian,history}/`

**Interfaces:**
- Consumes: типы из Task 2.
- Produces: полный список тем каждого предмета с `id`, `title` (детским языком, до 40 символов), `paragraphs` (например «п. 1–2» или «§ 3–5»), `released`.

Правила: группировать соседние пункты/параграфы по смыслу из `материалы/учебники-5-класс-оглавления.md`, 20–30 тем на предмет, уроки «Применяем математику» / «Учимся с …» / повторение — не отдельные темы. `released: true` — первые 4–5 тем каждого предмета. Для математики первые темы фиксированы: `math-01` п. 1–2, `math-02` п. 3–4, `math-03` п. 5–7, `math-04` п. 8–9, `math-05` п. 10–11. `training.json` — 3 очень лёгких вопроса уровня 1 не по учебнику (про хоккей и счёт).

- [ ] **Step 1:** Составить `subjects.json` и `training.json`.
- [ ] **Step 2:** Run `npm run validate` → ошибки только «мало вопросов» для выпущенных тем (вопросов ещё нет) и «буллитов < 100»; ошибок формата нет.
- [ ] **Step 3:** Показать Максиму список тем трёх предметов одним сообщением (таблицей), поправить по его словам.
- [ ] **Step 4:** Commit `content: темы трёх учебников`.

---

### Task 4: Движок матча

**Files:**
- Create: `src/engine/rng.ts`, `src/engine/match.ts`, `tests/engine/match.test.ts`

**Interfaces:**
- Consumes: `Question`, `Bullit`, `Level`, `SubjectId`.
- Produces:
```ts
// rng.ts
export type Rng = () => number;                  // [0,1)
export function seeded(seed: number): Rng;       // для тестов
export function shuffle<T>(a: readonly T[], rng: Rng): T[];
// match.ts
export type Mode = 'regular' | 'friendly' | 'final' | 'training';
export type Outcome = 'correct' | 'wrong' | 'timeout' | 'left';
export const MATCH_CONFIG: Record<Mode, { attacks: number; maxConceded: number; bullit: boolean }>;
//   regular {10,1,true}, friendly {5,1,false}, final {20,2,false}, training {3,Infinity,false}
export const TIMER_SEC: Record<Level, number>;   // {1:20, 2:30, 3:60}
export const BULLIT_SEC = 30;
export interface MatchItem { question: Question | Bullit; isBullit: boolean; level: Level;
  options: string[]; correctIndex: number; timerSec: number }   // options уже перемешаны
export interface MatchState { /* непрозрачно для UI, кроме полей ниже */
  mode: Mode; subject: SubjectId; topicId: string | null; level: Level | null;
  goalsFor: number; goalsAgainst: number; bullitGoal: boolean; attackNo: number; over: boolean; won: boolean | null }
export function createMatch(p: { mode: Mode; subject: SubjectId; topicId: string | null; level: Level | null;
  questions: Question[]; bullit: Bullit | null; rng: Rng }): MatchState;
export function currentItem(s: MatchState): MatchItem | null;   // null, если матч окончен
export function answer(s: MatchState, outcome: Outcome): MatchState;   // чистая, возвращает новое состояние
export function concededLeft(s: MatchState): number;            // сколько ещё можно пропустить (для табло)
``` Правила: буллит вставляется после случайной атаки 1..attacks−1 (через `rng`), исход буллита меняет только `bullitGoal`; `wrong`/`timeout`/`left` на обычной атаке → `goalsAgainst+1`; матч окончен сразу, как `goalsAgainst > maxConceded` (`won=false`), или когда сыграны все атаки (`won=true`), при этом если буллит ещё не сыгран к последней атаке — он идёт сразу после неё, до окончания. `timerSec` = `BULLIT_SEC` для буллита, иначе `TIMER_SEC[question.level]`.

- [ ] **Step 1:** Тесты: `tenCorrectIsShutoutWin` (10:0, won), `oneMissStillWins` (9:1), `secondMissEndsMatchImmediately` (после 2-го пропуска `over`, `won=false`, `currentItem=null`, сыграно ≤ 10), `timeoutAndLeftCountAsConceded`, `bullitWrongDoesNotConcede`, `bullitCorrectSetsBullitGoal`, `bullitAppearsExactlyOnceInRegular`, `noBullitInFriendlyAndFinal`, `finalAllowsTwoMisses` (18:2 won, 3-й пропуск — проигрыш), `optionsAreShuffledButCorrectIndexTracks` (текст `options[correctIndex]` = верный вариант исходного вопроса; при разных seed порядок различается), `timerByLevelAndBullit`.
- [ ] **Step 2:** Run `npx vitest run tests/engine/match.test.ts` → FAIL.
- [ ] **Step 3:** Реализовать.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: движок матча`.

---

### Task 5: Подбор вопросов

**Files:**
- Create: `src/engine/selection.ts`, `tests/engine/selection.test.ts`

**Interfaces:**
- Consumes: `Question`, `Bullit`, `Rng`, `AnswerEvent` (тип из Task 6 — объявить тип в `src/engine/events.ts` в этой задаче, см. Task 6).
- Produces:
```ts
export function pickQuestions(pool: Question[], history: AnswerEvent[], flagged: Set<string>, n: number, rng: Rng): Question[];
export function pickFriendly(topicPool: Question[], history: AnswerEvent[], flagged: Set<string>, rng: Rng): Question[]; // 5 шт., уровни 1,2,3 смешаны (минимум по одному каждого, если есть)
export function pickFinal(subjectPools: Question[][], history: AnswerEvent[], flagged: Set<string>, rng: Rng): Question[]; // 20 шт., по кругу по темам
export function pickBullit(bullits: Bullit[], history: AnswerEvent[], flagged: Set<string>, rng: Rng): Bullit | null;
```
Приоритет внутри `pickQuestions`: 1) вопросы, чей последний исход в истории не `correct`; 2) ни разу не показанные; 3) остальные — давно показанные раньше. Внутри группы — случайно. Отмеченные (`flagged`) исключаются. Без повторов внутри матча, пока пул ≥ n; если пул < n — добираем повторами. Буллит — давно не показанный, не отмеченный.

- [ ] **Step 1:** Тесты: `excludesFlagged`, `prefersLastWrong` (3 вопроса с последним `wrong` всегда попадают в 10), `noRepeatsWhenPoolLarge`, `repeatsWhenPoolSmall` (пул 3 → вернулось 10, только эти 3 id), `emptyPoolReturnsEmpty`, `friendlyMixesLevels`, `finalCoversAllTopics` (5 тем → в 20 вопросах каждая тема ≥ 4 раз).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Реализовать. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: подбор вопросов`.

---

### Task 6: Прогресс из журнала

**Files:**
- Create: `src/engine/events.ts`, `src/engine/progress.ts`, `tests/engine/progress.test.ts`

**Interfaces:**
- Produces (`events.ts`):
```ts
interface Base { id: string; ts: number }                       // id = crypto.randomUUID(), ts = Date.now()
export interface AnswerEvent extends Base { kind: 'answer'; matchId: string; mode: Mode; subject: SubjectId;
  topicId: string | null; level: Level; questionId: string; bullit: boolean; outcome: Outcome; ms: number }
export interface MatchEndEvent extends Base { kind: 'match_end'; matchId: string; mode: Mode; subject: SubjectId;
  topicId: string | null; level: Level | null; goalsFor: number; goalsAgainst: number; bullitGoal: boolean; won: boolean }
export interface FlagEvent extends Base { kind: 'flag'; questionId: string }
export interface HintSeenEvent extends Base { kind: 'hint_seen'; hintId: string }
export type GameEvent = AnswerEvent | MatchEndEvent | FlagEvent | HintSeenEvent;
export function newEvent<T extends GameEvent>(e: Omit<T, 'id' | 'ts'>): T;
```
- Produces (`progress.ts`):
```ts
export const RANKS = [{ goals: 100, title: 'Новичок' }, { goals: 250, title: 'Нападающий' },
  { goals: 500, title: 'Капитан' }, { goals: 1000, title: 'Легенда' }] as const;
export const FRIENDLY_AFTER_MS = 7 * 24 * 3600 * 1000;
export interface TopicProgress { levelsWon: Level[]; nextLevel: Level | null; cup: boolean; cupAt: number | null;
  friendlyDue: boolean; tarnished: boolean }
export interface SubjectProgress { cups: number; released: number; total: number; finalUnlocked: boolean; seasonWon: boolean }
export interface Progress { topics: Record<string, TopicProgress>; subjects: Record<SubjectId, SubjectProgress>;
  superPrize: boolean; careerGoals: number; rank: string | null; nextRank: { title: string; goalsLeft: number } | null;
  shutouts: number; bullitGoals: number; streakDays: number; flagged: Set<string>; hintsSeen: Set<string> }
export function dedupe(events: GameEvent[]): GameEvent[];
export function deriveProgress(events: GameEvent[], subjects: Subject[], now: number): Progress;
```
Правила: учитываются только `match_end` (ответы без `match_end` — незаконченный матч, игнор для прогресса); `training` не идёт никуда. Уровень темы засчитан победой `regular` этого уровня; играть уровень N можно после победы N−1 (`nextLevel`). Кубок — все три уровня; `cupAt` — ts победы, взявшей третий уровень. `tarnished = cup && now ≥ cupAt + FRIENDLY_AFTER_MS && нет победы friendly по теме с ts ≥ cupAt + FRIENDLY_AFTER_MS`; `friendlyDue = tarnished`. Товарищеский по теме один (после победы больше не зовёт). `finalUnlocked` = все темы предмета `released`, у всех кубок, ни один не потускнел. `seasonWon` = есть победа `final` по предмету (раз выиграл — навсегда). `superPrize` = три сезона. `careerGoals` = Σ по выигранным regular/friendly/final (`goalsFor + (bullitGoal?1:0)`). `shutouts` = выигранные regular с `goalsAgainst = 0`. `bullitGoals` = число `bullitGoal` в выигранных матчах. `streakDays` = подряд идущие локальные даты с ≥ 1 не-training `match_end`, заканчивая сегодня или вчера; иначе 0.

- [ ] **Step 1:** Тесты: `levelsUnlockInOrder`, `cupAfterThreeLevels`, `lostMatchGivesNoGoals`, `bullitGoalCountsOnlyInWonMatch`, `tarnishesAfterSevenDays` и `friendlyWinRestoresCup`, `friendlyBeforeSevenDaysDoesNotCount`, `finalStaysLockedWhileTopicsUnreleased` (все выпущенные темы с кубками, но есть `released:false` → `finalUnlocked=false`), `finalLockedWhileCupTarnished`, `seasonAndSuperPrize`, `ranksAndNextRank` (99 → null/«Новичок» осталось 1; 250 → «Нападающий»), `ignoresUnfinishedMatch`, `dedupesById` (одно событие дважды → голы не удвоены), `trainingIgnored`, `streakAcrossLocalMidnight` (23:59 и 00:01 локально → 2), `streakBrokenByGapDay`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Реализовать. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: прогресс, кубки, звания из журнала`.

---

### Task 7: Журнал на телефоне

**Files:**
- Create: `src/storage/store.ts`, `tests/storage/store.test.ts`

**Interfaces:**
- Consumes: `GameEvent`, `dedupe`.
- Produces:
```ts
export interface EventStore { all(): GameEvent[]; append(e: GameEvent): void; pending(): GameEvent[];
  markSynced(ids: string[]): void; merge(remote: GameEvent[]): void; subscribe(fn: () => void): () => void }
export function createLocalStore(storage?: Storage): EventStore;   // ключи 'hq.events.v1', 'hq.pending.v1'
export function requestPersistence(): Promise<boolean>;          // navigator.storage?.persist()
```
- [ ] **Step 1:** Тесты (поддельный `Storage` в памяти): `appendGoesToAllAndPending`, `markSyncedClearsPending`, `mergeSkipsKnownIds`, `survivesReload` (новый store на том же storage видит события), `corruptJsonStartsEmpty` (битый JSON → пустой журнал, без исключения), `subscribersNotified`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Реализовать. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: журнал событий на устройстве`.

---

### Task 8: Онлайн-хранилище Supabase и входы

**Files:**
- Create: `supabase/schema.sql`, `src/storage/sync.ts`, `src/storage/auth.ts`, `tests/storage/sync.test.ts`, `tools/make-invites.ts`
- Modify: `src/config.ts` (URL и anon-ключ)

**Interfaces:**
- Consumes: `EventStore`.
- Produces:
```ts
// auth.ts
export type Role = 'child' | 'parent';
export async function ensureSession(client: SupabaseClient): Promise<string>;          // анонимный вход, возвращает user id
export async function joinFamily(client: SupabaseClient, code: string, pin?: string): Promise<Role>; // RPC join_family
export async function myRole(client: SupabaseClient): Promise<Role | null>;
// sync.ts
export async function syncNow(store: EventStore, client: SupabaseClient): Promise<{ pushed: number; pulled: number }>;
export function startAutoSync(store: EventStore, client: SupabaseClient): () => void;  // при старте, после match_end, на 'online'
```
`schema.sql`: расширение `pgcrypto`; таблицы `family_members(user_id uuid pk → auth.users, role text check in ('child','parent'), name text)`, `invites(code text pk, role text, name text, pin_hash text null)`, `events(id uuid pk, user_id uuid not null default auth.uid(), ts bigint not null, kind text not null, body jsonb not null, created_at timestamptz default now())`. RLS включён везде: `events` — insert только если вызывающий в `family_members` с ролью `child`; select — любой член семьи. `family_members` — select своей строки. `invites` — без прямого доступа. RPC `join_family(p_code text, p_pin text default null) returns text` (security definer): код существует; для `parent` — `crypt(p_pin, pin_hash) = pin_hash`; upsert в `family_members`; возвращает роль. Ссылки многоразовые (новый телефон = новый анонимный пользователь, входит той же ссылкой). `syncNow`: upsert pending по `id` с `ignoreDuplicates`, потом select всех событий → `store.merge`. Ошибки сети не бросаются наружу — pending остаётся.
`tools/make-invites.ts`: печатает SQL для трёх приглашений (сын — без PIN; папа, мама — PIN из аргументов) со случайными кодами по 24 символа и ссылки: сын — `https://<user>.github.io/hockey-quiz/#/join/<code>`, папа и мама — `https://<user>.github.io/hockey-quiz/#/parent/join/<code>` (экран с PIN).

- [ ] **Step 1 (с Максимом):** Максим входит на supabase.com через GitHub, создаёт проект `hockey-quiz` (регион Frankfurt), в Authentication → Sign In Methods включает Anonymous; присылает Project URL и anon public key. Записать в `src/config.ts`.
- [ ] **Step 2 (с Максимом):** Максим вставляет `supabase/schema.sql` в SQL Editor и жмёт Run; потом — вывод `tools/make-invites.ts` (PIN папы и мамы — выбирают сами). Ссылки сохранить в `docs/ссылки.md` (не коммитить: добавить в `.gitignore`).
- [ ] **Step 3:** Тесты `sync.test.ts` с поддельным клиентом: `pushesPendingThenPulls`, `networkErrorKeepsPending`, `pullMergesRemoteFromOtherDevice`.
- [ ] **Step 4:** Run → FAIL. **Step 5:** Реализовать. **Step 6:** Run → PASS.
- [ ] **Step 7:** Ручная проверка на живой базе: `npm run dev`, открыть ссылку сына → сыграть тренировку → в Supabase Table Editor в `events` появились строки; открыть ссылку папы в другом браузере с PIN → роль `parent`; неверный PIN → отказ.
- [ ] **Step 8:** Commit `feat: онлайн-журнал Supabase и входы по ссылке`.

---

### Task 9: Экраны игрока

**Files:**
- Create: `src/ui/router.ts`, `src/ui/screens/Home.tsx`, `Subject.tsx`, `Topic.tsx`, `Match.tsx`, `MatchResult.tsx`, `Trophies.tsx`, `src/ui/useGame.ts`, `src/ui/styles.css`, `tests/ui/match.test.tsx`, `tests/ui/navigation.test.tsx`
- Modify: `src/app.tsx`

**Interfaces:**
- Consumes: всё из Tasks 2, 4–8.
- Produces: маршруты `#/` (предметы), `#/s/:subject`, `#/t/:topicId`, `#/play/:mode/:subject/:topicId?/:level?`, `#/result/:matchId`, `#/trophies`, `#/join/:code`, `#/parent`, `#/parent/join/:code`, `#/rules`. `useGame()` → `{ store, progress, client }` (прогресс пересчитывается при изменении журнала).

Содержание экранов — раздел 6 спеки. Предмет: темы списком, кубок/потускневший кубок/прогресс «2 из 3», невыпущенные темы — замок с подписью «скоро». Тема: три соперника (Лёгкий, Средний, Сильный) с замками по `nextLevel`, кнопка товарищеского при `friendlyDue`; на предмете кнопка «Финал» при `finalUnlocked`. Матч: табло `{PLAYER_TEAM} {goalsFor} : {goalsAgainst} {команда соперника}` — команда соперника называется по предмету: «Математика», «Русский язык», «История», с подписью состава «Лёгкий / Средний / Сильный состав» (в финале — «Сборная учебника»); на экране темы соперники тоже подписаны «Математика — лёгкий состав» и т. п., «Атака N из M», «можно пропустить ещё {concededLeft}», полоска таймера, вопрос, 4 кнопки не меньше 56 px высотой. После ответа: верно — «ГОЛ!»; неверно/таймаут — «Пропустил…», верный вариант и `why`, кнопка «Дальше» и маленькая «тут ошибка» (пишет `FlagEvent`). Каждый ответ пишет `AnswerEvent` (`ms` — от показа до ответа); конец — `MatchEndEvent`. Во время вопроса `document.visibilitychange` → `hidden` = исход `left`. Итог: счёт, победа/поражение, «голы сгорели» при поражении, звезда за 10:0, новое звание. Шкаф: звание, голы, до следующего звания, кубки по предметам x из total, сухие матчи, буллиты, дней подряд. Видимое название игры — только из `APP_NAME`. Место под будущий второй режим: на главном экране зарезервирован блок «Матч с родителями — скоро» (скрыт флагом `FEATURE_DUEL = false` в `config.ts`).

- [ ] **Step 1:** Тесты (`@testing-library/preact`, поддельные таймеры): `timeoutConcedesGoal` (60 с без ответа на уровне 3 → счёт 0:1), `hiddenTabConcedesAsLeft` (dispatch `visibilitychange` при `document.visibilityState='hidden'` → в журнале outcome `left`), `wrongAnswerShowsCorrectAndWhy`, `flagButtonOnlyAfterAnswer`, `lostMatchShowsBurnedGoals`, `lockedLevelNotPlayable`, `finalButtonHiddenWhenLocked`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Реализовать. **Step 4:** Run → PASS.
- [ ] **Step 5:** Ручная проверка в `npm run dev` на ширине 390 px: пройти матч до победы и до поражения.
- [ ] **Step 6:** Commit `feat: экраны игрока`.

---

### Task 10: Подсказки тренера

**Files:**
- Create: `src/ui/hints.ts`, `src/ui/CoachBubble.tsx`, `src/ui/screens/Training.tsx`, `src/ui/screens/Rules.tsx`, `src/ui/HelpButton.tsx`, `tests/ui/hints.test.tsx`

**Interfaces:**
- Consumes: `HintSeenEvent`, `progress.hintsSeen`, `training`.
- Produces: `export const HINTS: Record<HintId, string[]>`; `export const SCREEN_HELP: Record<ScreenId, string[]>`; `useCoach(hintId)` — показывает пузырь один раз, по тапу пишет `HintSeenEvent`.

Тексты (точные; правила — до 12 слов на строку, на «ты»):
```ts
HINTS = {
  training_correct: ['Ответил верно — ты забил гол!'],
  training_wrong:   ['Ошибся — пропустил гол.', 'Пропустишь два — матч проигран.'],
  training_end:     ['Матч — это 10 вопросов.', 'Обыграй трёх соперников — получишь кубок.'],
  first_bullit:     ['Буллит! Забьёшь — плюс гол.', 'Промажешь — ничего не теряешь.'],
  first_timer:      ['Полоска — это время.', 'Не успел — пропустил гол.'],
  first_left:       ['Ушёл из игры во время вопроса.', 'Это пропущенный гол.'],
  first_win:        ['Победа! Голы ушли в твою карьеру.'],
  first_loss:       ['Проиграл — голы этого матча сгорели.', 'Попробуй ещё раз!'],
  first_cup:        ['Кубок твой! Он стоит в шкафу.'],
  first_tarnished:  ['Кубок потускнел.', 'Выиграй товарищеский матч — он снова заблестит.'],
  first_final:      ['Финал учебника! 20 вопросов обо всём.', 'Победишь — тебя ждёт приз.'],
}
SCREEN_HELP = {
  home:     ['Выбери предмет.', 'Кубки собираются в шкафу.'],
  subject:  ['Выбери тему.', 'Замок — тема откроется позже.'],
  topic:    ['Обыграй соперников по порядку.', 'Всех трёх — кубок.'],
  match:    ['Верно — гол. Ошибся — пропустил.', 'Пропустишь два — проиграл.', 'Не уходи из игры во время вопроса.'],
  trophies: ['Здесь твои кубки, голы и звание.'],
}
```
Первый запуск (нет `hint_seen` с `training_end`) — сразу экран тренировки: 3 вопроса из `training.json`, режим `training`, пузыри `training_correct`/`training_wrong` после ответов и `training_end` в конце, затем главное меню. Кнопка «?» в правом верхнем углу каждого экрана открывает `SCREEN_HELP` экрана и ссылку «Все правила» → `#/rules` (вся механика на одном экране, крупно, с иконками 🏒 🥅 🏆 ⏱).

- [ ] **Step 1:** Тесты: `trainingOnFirstLaunchOnly`, `coachShownOnceThenNever` (после тапа второй рендер без пузыря), `helpButtonShowsScreenText`, `allHintLinesAtMost12Words` (перебор всех строк `HINTS` и `SCREEN_HELP`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Реализовать, вызвать `useCoach` в нужных местах экранов Task 9. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: тренировка, тренер и правила`.

---

### Task 11: Родительская страница

**Files:**
- Create: `src/parent/stats.ts`, `src/parent/ParentPage.tsx`, `src/parent/ParentJoin.tsx`, `tests/parent/stats.test.ts`

**Interfaces:**
- Consumes: `GameEvent`, `deriveProgress`, `subjects`, `questionsById`, `questionsByTopic`, `syncNow`.
- Produces:
```ts
export interface ParentStats {
  today: { matches: number; minutes: number; goals: number }; week: { matches: number; minutes: number; goals: number };
  subjects: { id: SubjectId; title: string; cups: number; total: number; released: number; finalUnlocked: boolean; seasonWon: boolean }[];
  superPrize: boolean; streakDays: number;
  hardTopics: { topicId: string; title: string; played: number; lost: number }[];   // до 3, доля поражений, минимум 3 матча
  flags: { questionId: string; text: string; ts: number }[];
  lowPool: { topicId: string; level: Level; left: number }[];                      // left < 12
  recentMatches: { ts: number; subject: SubjectId; topicTitle: string; mode: Mode; score: string; won: boolean; answersSec: number[] }[]; // последние 10
}
export function parentStats(events: GameEvent[], now: number): ParentStats;
export function flagsForClaude(stats: ParentStats): string;   // текст для копирования: id, предмет, тема, вопрос
```
«Минуты» = Σ `ms` ответов / 60000, округлить. «Неделя» = последние 7 локальных дней включая сегодня. Страница открывается только при роли `parent` (иначе — экран ввода ссылки), перед показом делает `syncNow`. Кнопка «Скопировать для Claude» кладёт `flagsForClaude` в буфер. Если `seasonWon` — крупная плашка «Пора готовить приз: {предмет}»; `superPrize` — «Супер-приз!». Только таблицы и цифры.

- [ ] **Step 1:** Тесты: `todayAndWeekCounts`, `minutesFromAnswerMs`, `hardTopicsNeedThreeMatches`, `flagsListedWithText`, `lowPoolWhenUnder12`, `recentMatchesShowAnswerSeconds`, `flagsForClaudeContainsIds`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Реализовать. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: родительская страница`.

---

### Tasks 12–14: Банк вопросов — математика, русский, история

Одна задача на предмет, одинаковые шаги. Файлы: `content/questions/<subject>/<topicId>.json` для каждой выпущенной темы.

**Правила написания:** по теме и программе 5 класса, в том числе вопросы, которых нет в учебнике. Уровень 1 — вспомнить (правило, определение, дата, факт); 2 — понять (выбрать пример, найти ошибку, сравнить); 3 — применить (задача, разбор слова, причина и следствие). Один бесспорный верный ответ; неверные — правдоподобные типичные ошибки; без «все ответы верны» / «нет верного». Простой язык, текст вопроса ≤ 220 символов. История — только факты, которые есть в школьной программе и общепризнаны. Русский — правила по учебнику Ладыженской; слова-примеры — без спорных норм. Математика — числа такие, чтобы считалось в уме или на черновике за 60 с.

- [ ] **Step 1:** Написать по 20 вопросов каждого уровня на каждую выпущенную тему предмета.
- [ ] **Step 2:** Run `npm run validate` → нет ошибок по этому предмету.
- [ ] **Step 3: Слепая проверка.** Отдельный помощник получает вопросы **без** поля `answer` и `why`, отвечает на каждый и помечает неоднозначные. Математику — пересчитывает. Сравнить с ключом; каждое расхождение и каждую «неоднозначность» исправить или заменить вопрос. Записать итог в `content/verification/<subject>.md` (сколько проверено, сколько исправлено, какие id).
- [ ] **Step 4:** Повторить Step 3 для исправленных вопросов, пока расхождений 0.
- [ ] **Step 5:** Commit `content: вопросы — <предмет>`.

---

### Task 15: Банк буллитов

**Files:** `content/bullits.json`

- [ ] **Step 1:** Не меньше 100 буллитов: по ≥ 25 в каждой категории `logic` (задачки на смекалку), `subject` (из других предметов: география, биология, английский, окружающий мир), `life` (бытовые знания, безопасность, деньги), `hockey` (правила хоккея, счёт, логика на хоккейных примерах, без реальных лиг и клубов). Уровень 10–11 лет, решается за 30 с.
- [ ] **Step 2:** Run `npm run validate` → нет ошибок.
- [ ] **Step 3:** Слепая проверка, как в Tasks 12–14 Step 3–4; итог в `content/verification/bullits.md`.
- [ ] **Step 4:** Commit `content: буллиты`.

---

### Task 16: Выпуск на GitHub Pages и установка на iPhone

**Files:**
- Create: `.github/workflows/deploy.yml`, `docs/как-установить.md`

**Interfaces:**
- Consumes: всё.

- [ ] **Step 1 (с Максимом):** `brew install gh`, затем Максим в терминале: `gh auth login` (GitHub.com → HTTPS → браузер). Создать репозиторий: `gh repo create hockey-quiz --public --source . --push` (публичный нужен для бесплатного Pages; в репозитории нет ни ссылок-приглашений, ни PIN — они в `.gitignore`).
- [ ] **Step 2:** `deploy.yml`: на push в `main` — `npm ci`, `npm run validate`, `npm test`, `npm run build`, `actions/upload-pages-artifact` с `dist`, `actions/deploy-pages`. В настройках репозитория Pages → Source: GitHub Actions (`gh api -X POST repos/{owner}/hockey-quiz/pages -f build_type=workflow`).
- [ ] **Step 3:** Push; дождаться зелёного workflow (`gh run watch`); открыть `https://<user>.github.io/hockey-quiz/` — игра загружается.
- [ ] **Step 4:** `docs/как-установить.md` — 4 шага для телефона сына: открыть ссылку-приглашение в Safari → «Поделиться» → «На экран Домой» → открыть иконку. Для родителей — то же со своей ссылкой и PIN.
- [ ] **Step 5 (с Максимом):** Установка на iPhone сына; проверка: тренировка проходит; выключить интернет — матч играется; включить — на странице папы матч появился. Закрыть игру смахиванием посреди матча, открыть снова — игра не сломана, незаконченный матч не засчитан.
- [ ] **Step 6:** Commit `chore: выпуск на GitHub Pages`.

---

## После v1 (не в этом плане)

Название и меню — промт для GPT и правка `APP_NAME`/стилей; версия 2 (матч с родителями), версия 3 (неучебная игра, отдельный brainstorm с сыном), режим с другом, приложение Apple после теста, остальные темы — партиями через Tasks 12–14.
