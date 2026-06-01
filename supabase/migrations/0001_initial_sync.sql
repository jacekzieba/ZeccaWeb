create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  platform text not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table if not exists public.encrypted_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (
    record_type in (
      'account',
      'asset',
      'transaction',
      'manualValuation',
      'income',
      'settings',
      'marketQuote'
    )
  ),
  id uuid not null,
  encrypted_payload text not null,
  nonce text not null,
  payload_version integer not null default 1,
  schema_version integer not null default 1,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  deleted_at timestamptz,
  primary key (user_id, record_type, id)
);

create table if not exists public.encrypted_key_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_user_data_key text not null,
  salt text not null,
  nonce text not null,
  kdf text not null,
  kdf_iterations integer not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_devices enable row level security;
alter table public.encrypted_records enable row level security;
alter table public.encrypted_key_backups enable row level security;

create policy "Users can read their profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read their devices"
  on public.user_devices for select
  using (auth.uid() = user_id);

create policy "Users can upsert their devices"
  on public.user_devices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their devices"
  on public.user_devices for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their encrypted records"
  on public.encrypted_records for select
  using (auth.uid() = user_id);

create policy "Users can insert their encrypted records"
  on public.encrypted_records for insert
  with check (auth.uid() = user_id);

create policy "Users can update their encrypted records"
  on public.encrypted_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read their key backup"
  on public.encrypted_key_backups for select
  using (auth.uid() = user_id);

create policy "Users can insert their key backup"
  on public.encrypted_key_backups for insert
  with check (auth.uid() = user_id);

create policy "Users can update their key backup"
  on public.encrypted_key_backups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
