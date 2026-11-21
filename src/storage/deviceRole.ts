import type { Role } from './auth';

/** Чей это телефон: запоминается после входа по ссылке. Иконка на экране «Домой» открывает ту же ссылку —
 *  повторный запуск идёт сразу к игре (сын) или к статистике (родитель), без сети и без PIN. */
const KEY = 'hq.deviceRole';

export function getDeviceRole(): Role | null {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return v === 'child' || v === 'parent' ? v : null;
  } catch { return null; }
}

export function setDeviceRole(role: Role): void {
  try { globalThis.localStorage?.setItem(KEY, role); } catch { /* приватный режим: просто не запомним */ }
}

export function clearDeviceRole(): void {
  try { globalThis.localStorage?.removeItem(KEY); } catch { /* нет хранилища */ }
}
