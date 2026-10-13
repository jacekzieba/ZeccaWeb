-- Expand encrypted_records with tenant-aware logical identity (non-destructive).
-- Applied to production (nfevwalgjfdsqdepfzin) on 2026-10-13; source of truth is
-- Zecca/supabase/migrations/20260721143000_expand_encrypted_record_logical_identity.sql.
--
-- Existing `id` primary key and every existing row stay unchanged; logical_id is
-- nullable while legacy clients write only `id`.
alter table public.encrypted_records
  add column if not exists logical_id uuid;

comment on column public.encrypted_records.logical_id is
  'Stable record identifier inside (user_id, record_type). Nullable only during the legacy expand/backfill window; do not derive it from encrypted_payload.';

-- NULLs are distinct in a unique index, so rows written by legacy clients
-- (logical_id NULL) coexist with tenant-aware rows.
create unique index if not exists encrypted_records_owner_type_logical_id_uidx
  on public.encrypted_records (user_id, record_type, logical_id);

comment on index public.encrypted_records_owner_type_logical_id_uidx is
  'Tenant-aware logical identity and PostgREST on_conflict target; NULL is allowed only during expand/backfill.';

-- ROLLBACK (only before any client depends on logical_id):
--   drop index if exists public.encrypted_records_owner_type_logical_id_uidx;
--   alter table public.encrypted_records drop column if exists logical_id;
