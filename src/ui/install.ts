/** Установка на iPhone: иконка на экране «Домой» может открыться без кода приглашения и со своим хранилищем.
 *  Поэтому ссылку переносим через буфер обмена: в Safari «Скопировать», в иконке «Вставить». */
const LINK_KEY = 'hq.inviteLink';

export function isIOS(): boolean {
  try { return /iPhone|iPad|iPod/.test(navigator.userAgent); } catch { return false; }
}

/** Полная ссылка на приглашение для этого сайта. */
export function inviteHref(inv: Invite): string {
  return `${location.origin}${location.pathname}#${invitePath(inv)}`;
}

export function isStandalone(): boolean {
  try {
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
      || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
  } catch { return false; }
}

export function rememberInviteLink(href: string): void {
  try { localStorage.setItem(LINK_KEY, href); } catch { /* нет хранилища */ }
}

export function savedInviteLink(): string | null {
  try { return localStorage.getItem(LINK_KEY); } catch { return null; }
}

export type Invite = { kind: 'child' | 'parent'; code: string };

/** Из вставленного текста: полная ссылка «…#/join/КОД», «…#/parent/join/КОД» или просто код. */
export function parseInvite(text: string): Invite | null {
  const t = text.trim();
  const m = t.match(/#\/(parent\/join|join)\/([A-Za-z0-9_-]{6,})/);
  if (m) return { kind: m[1] === 'join' ? 'child' : 'parent', code: m[2] };
  if (/^[A-Za-z0-9_-]{6,}$/.test(t)) return { kind: 'child', code: t };
  return null;
}

export function invitePath(inv: Invite): string {
  return inv.kind === 'parent' ? `/parent/join/${inv.code}` : `/join/${inv.code}`;
}
