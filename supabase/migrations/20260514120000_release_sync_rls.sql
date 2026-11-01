-- Release sync schema for Zecca private sync.
-- This file mirrors the schema actually deployed in production
-- (project nfevwalgjfdsqdepfzin): surrogate `id` primary keys with a
-- `user_id` owner column used by RLS. `if not exists` makes it safe to
-- re-run; it is non-destructive and does NOT alter the live tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  platform text not null default 'ios',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.encrypted_key_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  encrypted_user_data_key text not null,
  salt text not null,
  nonce text not null,
  kdf text not null,
  kdf_iterations integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.encrypted_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type = any (array[
    'account', 'asset', 'transaction', 'manualValuation',
    'income', 'settings', 'marketQuote'
  ])),
  encrypted_payload text not null,
  nonce text not null,
  payload_version integer not null default 1,
  schema_version integer not null default 1,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz
);

create index if not exists encrypted_records_user_updated_idx
  on public.encrypted_records (user_id, updated_at);

alter table public.profiles enable row level security;
alter table public.user_devices enable row level security;
alter table public.encrypted_key_backups enable row level security;
alter table public.encrypted_records enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "devices_select_own" on public.user_devices;
drop policy if exists "devices_upsert_own" on public.user_devices;
drop policy if exists "key_backups_select_own" on public.encrypted_key_backups;
drop policy if exists "key_backups_upsert_own" on public.encrypted_key_backups;
drop policy if exists "records_select_own" on public.encrypted_records;
drop policy if exists "records_upsert_own" on public.encrypted_records;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "devices_select_own"
  on public.user_devices for select
  using (auth.uid() = user_id);

create policy "devices_upsert_own"
  on public.user_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "key_backups_select_own"
  on public.encrypted_key_backups for select
  using (auth.uid() = user_id);

create policy "key_backups_upsert_own"
  on public.encrypted_key_backups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "records_select_own"
  on public.encrypted_records for select
  using (auth.uid() = user_id);

create policy "records_upsert_own"
  on public.encrypted_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
