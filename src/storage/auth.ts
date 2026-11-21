import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'child' | 'parent';

const inFlight = new WeakMap<SupabaseClient, Promise<string>>();

async function openSession(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await client.auth.signInAnonymously();
  if (res.error || !res.data.user) throw res.error ?? new Error('anonymous sign-in failed');
  return res.data.user.id;
}

/** Однократный вход: параллельные вызовы ждут один общий промис, поэтому анонимный вход ровно один. */
export function ensureSession(client: SupabaseClient): Promise<string> {
  let p = inFlight.get(client);
  if (!p) {
    p = openSession(client).finally(() => { inFlight.delete(client); });
    inFlight.set(client, p);
  }
  return p;
}

export async function joinFamily(client: SupabaseClient, code: string, pin?: string): Promise<Role> {
  const { data, error } = await client.rpc('join_family', { p_code: code, p_pin: pin ?? null });
  if (error) throw error;
  return data as Role;
}

export async function myRole(client: SupabaseClient): Promise<Role | null> {
  const { data, error } = await client.from('family_members').select('role').maybeSingle();
  if (error || !data) return null;
  return data.role as Role;
}
