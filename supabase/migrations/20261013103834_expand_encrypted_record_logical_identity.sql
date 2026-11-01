-- Expand encrypted_records with tenant-aware logical identity.
--
-- This migration is intentionally non-destructive:
--   * the existing `id` primary key and every existing row stay unchanged;
--   * `logical_id` remains nullable while legacy clients still write only `id`;
--   * no backfill and no NOT NULL contract run in this release.
--
-- During the compatibility window clients MUST keep treating `id` as the
-- legacy logical identifier. A client may switch to the tenant-aware upsert
-- target only after the documented backfill has completed and been verified.

alter table public.encrypted_records
  add column if not exists logical_id uuid;

comment on column public.encrypted_records.logical_id is
  'Stable record identifier inside (user_id, record_type). Nullable only during the legacy expand/backfill window; do not derive it from encrypted_payload.';

-- PostgreSQL unique indexes treat NULL values as distinct. Consequently this
-- index can coexist with any number of rows written by the old client (where
-- logical_id is NULL), while enforcing tenant-aware identity for populated
-- rows. Unlike a partial unique index, it can be inferred by the explicit
-- PostgREST conflict target:
--
--   on_conflict=user_id,record_type,logical_id
--
-- Swift/Supabase equivalent after backfill verification:
--   .upsert(rows, onConflict: "user_id,record_type,logical_id")
--
-- Do not enable that client target before all legacy rows have logical_id,
-- otherwise an existing primary-key row could be inserted through the new
-- target instead of updated.
create unique index if not exists encrypted_records_owner_type_logical_id_uidx
  on public.encrypted_records (user_id, record_type, logical_id);

comment on index public.encrypted_records_owner_type_logical_id_uidx is
  'Tenant-aware logical identity and PostgREST on_conflict target; NULL is allowed only during expand/backfill.';

-- VERIFY (read-only; expect one row and the index above):
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name = 'encrypted_records'
--     and column_name = 'logical_id';
--
--   select indexdef
--   from pg_indexes
--   where schemaname = 'public'
--     and indexname = 'encrypted_records_owner_type_logical_id_uidx';
--
-- ROLLBACK (only before any client depends on logical_id):
--   drop index if exists public.encrypted_records_owner_type_logical_id_uidx;
--   alter table public.encrypted_records drop column if exists logical_id;
--
-- Once a client can write an `id` different from `logical_id`, rollback is
-- forward-only: retain both column and index and roll back the client. Dropping
-- logical_id after that point would destroy the only stable logical identity.
