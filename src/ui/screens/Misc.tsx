import { useEffect, useState } from 'preact/hooks';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSession, joinFamily, type Role } from '../../storage/auth';
import { syncNow } from '../../storage/sync';
import type { EventStore } from '../../storage/store';
import { navigate } from '../router';
import { useGame } from '../useGame';
import { Screen } from './Layout';

export function Placeholder(props: { title: string; text: string }) {
  return <Screen title={props.title} back="#/"><p class="msg">{props.text}</p></Screen>;
}

const isWrongPin = (e: unknown) => /wrong pin/i.test(String((e as { message?: string } | null)?.message ?? e));

/** Подключение по коду: вход, вступление в семью, сразу синхронизация. Нужен PIN (родительский код) — уводим на экран с PIN. */
export async function connectByCode(client: SupabaseClient, store: EventStore, code: string): Promise<Role | 'pin'> {
  try {
    await ensureSession(client);
    const role = await joinFamily(client, code);
    await syncNow(store, client);
    return role;
  } catch (e) {
    if (isWrongPin(e)) { navigate(`/parent/join/${encodeURIComponent(code)}`); return 'pin'; }
    throw e;
  }
}

export function Join({ code }: { code: string }) {
  const { client, store } = useGame();
  const [msg, setMsg] = useState(client ? 'Подключаемся…' : 'Нужен интернет, чтобы подключиться. Попробуй позже.');
  useEffect(() => {
    if (!client) return;
    let dead = false;
    connectByCode(client, store, code)
      .then((r) => { if (!dead && r !== 'pin') navigate('/'); })
      .catch(() => { if (!dead) setMsg('Не получилось подключиться. Проверь ссылку и интернет.'); });
    return () => { dead = true; };
  }, [client, store, code]);
  return <Screen title="Подключение" back="#/"><p class="msg">{msg}</p></Screen>;
}
