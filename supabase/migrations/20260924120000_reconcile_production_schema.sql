-- Reconciles production (nfevwalgjfdsqdepfzin) and the repo lineage into one
-- schema (audit 2026-09-24, BACKEND-002). Production was built by migrations
-- that never lived in this repo (archived in supabase/production-history/) and
-- none of the repo migrations up to 20260722100000 were applied there. Every
-- step is idempotent, so the file is a no-op where the state already matches.
--
-- Deliberately NOT covered: 20260721143000_expand_encrypted_record_logical_identity
-- stays pending on production until the rollout in
-- audit/decisions/SYNC-IDENTITY-STAGING-REHEARSAL.md.

-- 1. RLS policies: one owner-scoped policy per operation, repo names.
--    Production named them after the table (encrypted_records_select_own, ...).
do $$
declare
  mapping record;
begin
  for mapping in
    select * from (values
      ('public.encrypted_records', 'encrypted_records_select_own', 'records_select_own'),
      ('public.encrypted_records', 'encrypted_records_insert_own', 'records_insert_own'),
      ('public.encrypted_records', 'encrypted_records_update_own', 'records_update_own'),
      ('public.encrypted_records', 'encrypted_records_delete_own', 'records_delete_own'),
      ('public.user_devices', 'user_devices_select_own', 'devices_select_own'),
      ('public.user_devices', 'user_devices_insert_own', 'devices_insert_own'),
      ('public.user_devices', 'user_devices_update_own', 'devices_update_own'),
      ('public.user_devices', 'user_devices_delete_own', 'devices_delete_own'),
      ('public.encrypted_key_backups', 'encrypted_key_backups_select_own', 'key_backups_select_own'),
      ('public.encrypted_key_backups', 'encrypted_key_backups_insert_own', 'key_backups_insert_own'),
      ('public.encrypted_key_backups', 'encrypted_key_backups_update_own', 'key_backups_update_own'),
      ('public.encrypted_key_backups', 'encrypted_key_backups_delete_own', 'key_backups_delete_own')
    ) as t(table_name, old_name, new_name)
  loop
    if exists (select 1 from pg_policy where polrelid = mapping.table_name::regclass and polname = mapping.old_name) then
      if exists (select 1 from pg_policy where polrelid = mapping.table_name::regclass and polname = mapping.new_name) then
        execute format('drop policy %I on %s', mapping.old_name, mapping.table_name);
      else
        execute format('alter policy %I on %s rename to %I', mapping.old_name, mapping.table_name, mapping.new_name);
      end if;
    end if;
  end loop;
end
$$;

-- Canonical predicates (auth.uid() evaluated once per statement).
alter policy "profiles_select_own" on public.profiles using ((select auth.uid()) = id);
alter policy "profiles_insert_own" on public.profiles with check ((select auth.uid()) = id);
alter policy "profiles_update_own" on public.profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

alter policy "devices_select_own" on public.user_devices using ((select auth.uid()) = user_id);
alter policy "devices_insert_own" on public.user_devices with check ((select auth.uid()) = user_id);
alter policy "devices_update_own" on public.user_devices
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "devices_delete_own" on public.user_devices using ((select auth.uid()) = user_id);

alter policy "key_backups_select_own" on public.encrypted_key_backups using ((select auth.uid()) = user_id);
alter policy "key_backups_insert_own" on public.encrypted_key_backups with check ((select auth.uid()) = user_id);
alter policy "key_backups_update_own" on public.encrypted_key_backups
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "key_backups_delete_own" on public.encrypted_key_backups using ((select auth.uid()) = user_id);

alter policy "records_select_own" on public.encrypted_records using ((select auth.uid()) = user_id);
alter policy "records_insert_own" on public.encrypted_records with check ((select auth.uid()) = user_id);
alter policy "records_update_own" on public.encrypted_records
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "records_delete_own" on public.encrypted_records using ((select auth.uid()) = user_id);

-- 2. Least privilege (20260722073110 + 20260722100000): anon/PUBLIC get
--    nothing, authenticated gets exactly the four Data API operations.
--    TRUNCATE must never be granted: RLS does not apply to it.
revoke all privileges on table
  public.profiles, public.user_devices, public.encrypted_key_backups, public.encrypted_records
  from public, anon, authenticated;
grant select, insert, update, delete on table
  public.profiles, public.user_devices, public.encrypted_key_backups, public.encrypted_records
  to authenticated;

-- One-off migration copies are server-side only.
do $$
begin
  if to_regclass('public.encrypted_records_backup_20260715') is not null then
    execute 'revoke all privileges on table public.encrypted_records_backup_20260715 from public, anon, authenticated';
  end if;
end
$$;

-- 3. Key-backup KDF constraints (20260722090000), validated: the production
--    preflight on 2026-09-24 found 0 violations in 11 rows.
do $$
declare
  definition record;
begin
  for definition in
    select * from (values
      ('encrypted_key_backups_kdf_check', $c$check (kdf = 'pbkdf2-sha256')$c$),
      ('encrypted_key_backups_kdf_iterations_check', $c$check (kdf_iterations between 100000 and 1200000)$c$),
      ('encrypted_key_backups_salt_format_check', $c$check (salt ~ '^[A-Za-z0-9+/]{22}==$')$c$),
      ('encrypted_key_backups_nonce_format_check', $c$check (nonce ~ '^[A-Za-z0-9+/]{16}$')$c$),
      ('encrypted_key_backups_ciphertext_format_check', $c$check (encrypted_user_data_key ~ '^[A-Za-z0-9+/]{64}$')$c$)
    ) as t(name, body)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.encrypted_key_backups'::regclass and conname = definition.name
    ) then
      execute format('alter table public.encrypted_key_backups add constraint %I %s not valid', definition.name, definition.body);
    end if;
    execute format('alter table public.encrypted_key_backups validate constraint %I', definition.name);
  end loop;
end
$$;

-- 4. Profile row for every new auth user (production 0004 +
--    lock_down_handle_new_user), so the repo reproduces it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- 5. Indexes as on production; the repo's (user_id, updated_at) index is
--    superseded by the descending one production already uses.
create index if not exists encrypted_records_user_id_updated_at_idx
  on public.encrypted_records (user_id, updated_at desc);
create index if not exists encrypted_records_user_id_record_type_idx
  on public.encrypted_records (user_id, record_type);
create index if not exists encrypted_records_user_id_deleted_at_idx
  on public.encrypted_records (user_id, deleted_at);
drop index if exists public.encrypted_records_user_updated_idx;
drop index if exists public.user_devices_user_id_idx;
