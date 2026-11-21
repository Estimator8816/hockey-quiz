import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

let cached: SupabaseClient | null = null;

/** null, пока в config.ts пусто: приложение работает офлайн и клиент не создаётся. */
export function getClient(url: string = SUPABASE_URL, key: string = SUPABASE_ANON_KEY): SupabaseClient | null {
  if (!url || !key) return null;
  cached ??= createClient(url, key);
  return cached;
}
