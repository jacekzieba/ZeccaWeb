-- Expand-only hardening for encrypted key backups.
-- Constraints are NOT VALID so existing rows are not scanned or blocked during
-- deployment. PostgreSQL still enforces them for every new or updated row.
-- Validate each constraint in a later migration only after the staging audit
-- and production preflight report zero legacy violations.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.encrypted_key_backups'::regclass
      and conname = 'encrypted_key_backups_kdf_check'
  ) then
    alter table public.encrypted_key_backups
      add constraint encrypted_key_backups_kdf_check
      check (kdf = 'pbkdf2-sha256') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.encrypted_key_backups'::regclass
      and conname = 'encrypted_key_backups_kdf_iterations_check'
  ) then
    alter table public.encrypted_key_backups
      add constraint encrypted_key_backups_kdf_iterations_check
      check (kdf_iterations between 100000 and 1200000) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.encrypted_key_backups'::regclass
      and conname = 'encrypted_key_backups_salt_format_check'
  ) then
    alter table public.encrypted_key_backups
      add constraint encrypted_key_backups_salt_format_check
      check (salt ~ '^[A-Za-z0-9+/]{22}==$') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.encrypted_key_backups'::regclass
      and conname = 'encrypted_key_backups_nonce_format_check'
  ) then
    alter table public.encrypted_key_backups
      add constraint encrypted_key_backups_nonce_format_check
      check (nonce ~ '^[A-Za-z0-9+/]{16}$') not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.encrypted_key_backups'::regclass
      and conname = 'encrypted_key_backups_ciphertext_format_check'
  ) then
    alter table public.encrypted_key_backups
      add constraint encrypted_key_backups_ciphertext_format_check
      check (encrypted_user_data_key ~ '^[A-Za-z0-9+/]{64}$') not valid;
  end if;
end
$$;
