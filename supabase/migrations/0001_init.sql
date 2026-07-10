-- Supabase auth/profiles/audit scaffolding
-- This schema is independent from the app's existing Drizzle/Postgres database.
-- It only powers: authentication, roles, profiles, activity logs, soft delete, and
-- placeholder banks/documents/meetings tables for future use.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('super_admin', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users, holds role + soft-delete
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- activity_logs: audit trail, append-only
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,              -- e.g. INSERT / UPDATE / DELETE / SOFT_DELETE / RESTORE
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Scaffolding tables (not linked to the running app yet)
-- ---------------------------------------------------------------------------
create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references public.banks(id) on delete set null,
  title text not null,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references public.banks(id) on delete set null,
  title text not null,
  meeting_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_banks_updated_at on public.banks;
create trigger trg_banks_updated_at before update on public.banks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_meetings_updated_at on public.meetings;
create trigger trg_meetings_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit logging trigger: logs INSERT/UPDATE/DELETE, and flags soft-delete
-- (an UPDATE that sets deleted_at from null -> not null) as SOFT_DELETE,
-- and the reverse as RESTORE.
-- ---------------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger as $$
declare
  v_action text;
  v_record_id text;
  v_actor uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;

  if (tg_op = 'INSERT') then
    v_record_id := (new.id)::text;
    insert into public.activity_logs(actor_id, action, table_name, record_id, old_data, new_data)
    values (v_actor, 'INSERT', tg_table_name, v_record_id, null, to_jsonb(new));
    return new;
  elsif (tg_op = 'UPDATE') then
    v_record_id := (new.id)::text;
    if (old.deleted_at is null and new.deleted_at is not null) then
      v_action := 'SOFT_DELETE';
    elsif (old.deleted_at is not null and new.deleted_at is null) then
      v_action := 'RESTORE';
    else
      v_action := 'UPDATE';
    end if;
    insert into public.activity_logs(actor_id, action, table_name, record_id, old_data, new_data)
    values (v_actor, v_action, tg_table_name, v_record_id, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'DELETE') then
    v_record_id := (old.id)::text;
    insert into public.activity_logs(actor_id, action, table_name, record_id, old_data, new_data)
    values (v_actor, 'DELETE', tg_table_name, v_record_id, to_jsonb(old), null);
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_profiles_audit on public.profiles;
create trigger trg_profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.log_activity();

drop trigger if exists trg_banks_audit on public.banks;
create trigger trg_banks_audit after insert or update or delete on public.banks
  for each row execute function public.log_activity();

drop trigger if exists trg_documents_audit on public.documents;
create trigger trg_documents_audit after insert or update or delete on public.documents
  for each row execute function public.log_activity();

drop trigger if exists trg_meetings_audit on public.meetings;
create trigger trg_meetings_audit after insert or update or delete on public.meetings
  for each row execute function public.log_activity();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.activity_logs enable row level security;
alter table public.banks enable row level security;
alter table public.documents enable row level security;
alter table public.meetings enable row level security;

create or replace function public.is_admin_or_super()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and role in ('admin', 'super_admin')
  );
$$ language sql security definer stable;

create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and deleted_at is null
      and role = 'super_admin'
  );
$$ language sql security definer stable;

-- profiles: users can read their own profile; admins/super_admins can read all.
-- only super_admins can insert/update/delete profiles (normal provisioning goes
-- through the service-role key from the server, which bypasses RLS anyway).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin_or_super());

-- No client-side (anon-key) updates are permitted on profiles at all — not even
-- self-updates — because `role`/`deleted_at` live on this same row and a
-- same-row `USING (id = auth.uid())` policy without a column-aware `WITH CHECK`
-- would let a user silently promote themselves to super_admin. All profile
-- writes (including by super_admins, via the Admin Panel) go through the
-- backend's service-role client, which bypasses RLS entirely. Intentionally no
-- update policy is created here.

-- activity_logs: readable by admins/super_admins only; no direct client writes
-- (writes happen via the trigger, which runs as security definer).
drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select using (public.is_admin_or_super());

-- banks/documents/meetings scaffolding: readable/writable by any authenticated
-- admin or super_admin; soft-deleted rows still visible to admins for restore.
drop policy if exists banks_all on public.banks;
create policy banks_all on public.banks
  for all using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents
  for all using (public.is_admin_or_super()) with check (public.is_admin_or_super());

drop policy if exists meetings_all on public.meetings;
create policy meetings_all on public.meetings
  for all using (public.is_admin_or_super()) with check (public.is_admin_or_super());
