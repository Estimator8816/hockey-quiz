create extension if not exists pgcrypto;

create table if not exists family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('child','parent')),
  name text
);

create table if not exists invites (
  code text primary key,
  role text not null check (role in ('child','parent')),
  name text,
  pin_hash text
);

create table if not exists events (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  ts bigint not null,
  kind text not null,
  body jsonb not null,
  created_at timestamptz default now()
);

alter table family_members enable row level security;
alter table invites enable row level security;
alter table events enable row level security;

drop policy if exists events_insert_child on events;
create policy events_insert_child on events for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from family_members m where m.user_id = auth.uid() and m.role = 'child'));

drop policy if exists events_select_family on events;
create policy events_select_family on events for select to authenticated
  using (exists (select 1 from family_members m where m.user_id = auth.uid()));

drop policy if exists family_select_own on family_members;
create policy family_select_own on family_members for select to authenticated
  using (user_id = auth.uid());

-- invites: политик нет, прямого доступа нет

-- Права таблиц явно: новые проекты Supabase могут не выдавать их автоматически. Строки по-прежнему режет RLS.
grant select, insert on events to authenticated;
grant select on family_members to authenticated;
revoke all on invites from anon, authenticated;

create or replace function join_family(p_code text, p_pin text default null)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select * into inv from invites where code = p_code;
  if not found then
    raise exception 'unknown invite';
  end if;
  if inv.role = 'parent' then
    if p_pin is null or inv.pin_hash is null or crypt(p_pin, inv.pin_hash) <> inv.pin_hash then
      raise exception 'wrong pin';
    end if;
  end if;
  insert into family_members (user_id, role, name)
    values (auth.uid(), inv.role, inv.name)
    on conflict (user_id) do update set role = excluded.role, name = excluded.name;
  return inv.role;
end;
$$;

revoke all on function join_family(text, text) from public;
grant execute on function join_family(text, text) to authenticated, anon;
