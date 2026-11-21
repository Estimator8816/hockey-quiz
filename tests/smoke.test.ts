import { expect, test } from 'vitest';
import { APP_NAME } from '../src/config';

test('название приложения', () => {
  expect(APP_NAME).toBe('Контрольный период');
});
