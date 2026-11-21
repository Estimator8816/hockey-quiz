import { useEffect, useState } from 'preact/hooks';

export type Route =
  | { name: 'home' }
  | { name: 'subject'; subject: string }
  | { name: 'topic'; topicId: string }
  | { name: 'play'; mode: string; subject: string; topicId: string | null; level: number | null }
  | { name: 'result'; matchId: string }
  | { name: 'trophies' }
  | { name: 'join'; code: string }
  | { name: 'parent' }
  | { name: 'parentJoin'; code: string }
  | { name: 'rules' }
  | { name: 'training' }
  | { name: 'notFound' };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0];
  const p = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (p.length === 0) return { name: 'home' };
  switch (p[0]) {
    case 's': return p[1] ? { name: 'subject', subject: p[1] } : { name: 'notFound' };
    case 't': return p[1] ? { name: 'topic', topicId: p[1] } : { name: 'notFound' };
    case 'play': {
      if (!p[1] || !p[2]) return { name: 'notFound' };
      const lvl = p[4] ? Number(p[4]) : null;
      return { name: 'play', mode: p[1], subject: p[2], topicId: p[3] ?? null, level: lvl };
    }
    case 'result': return p[1] ? { name: 'result', matchId: p[1] } : { name: 'notFound' };
    case 'trophies': return { name: 'trophies' };
    case 'join': return p[1] ? { name: 'join', code: p[1] } : { name: 'notFound' };
    case 'parent':
      if (p[1] === 'join' && p[2]) return { name: 'parentJoin', code: p[2] };
      return { name: 'parent' };
    case 'rules': return { name: 'rules' };
    case 'training': return { name: 'training' };
    default: return { name: 'notFound' };
  }
}

export function navigate(path: string): void {
  location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    on();
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parseRoute(hash);
}
