import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

let cached: SupabaseClient | null = null;

/** null, пока в config.ts пусто: приложение работает офлайн и клиент не создаётся. */
export function getClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  cached ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
