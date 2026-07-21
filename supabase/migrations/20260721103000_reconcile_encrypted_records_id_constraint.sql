-- Reconcile public.encrypted_records to PRODUCTION's actual shape, so a database
-- provisioned from these migration files matches prod and the app's sync works.
--
-- CONFIRMED live on 2026-07-21 (project "Investor", nfevwalgjfdsqdepfzin):
--   * PRIMARY KEY is on (id) alone  → encrypted_records_pkey UNIQUE (id)
--   * plus three user_id-leading indexes that back RLS ownership + the bootstrap
--     query (deleted_at IS NULL, ORDER BY updated_at DESC):
--       encrypted_records_user_id_deleted_at_idx   (user_id, deleted_at)
--       encrypted_records_user_id_record_type_idx  (user_id, record_type)
--       encrypted_records_user_id_updated_at_idx    (user_id, updated_at DESC)
--
-- None of the above is declared by the migrations: 0001 declares a COMPOSITE
-- primary key (user_id, record_type, id) and no extra indexes. Consequences for
-- any environment built purely from these migrations (staging rebuild, DR, new
-- region):
--   * every `onConflict: "id"` upsert (src/sync/records/supabase-sync-store.ts)
--     fails with 42P10 ("no unique or exclusion constraint matching the ON
--     CONFLICT specification"), so sync writes break; and
--   * RLS/bootstrap queries run unindexed (full scans).
--
-- Every statement below is idempotent and a guaranteed NO-OP on production
-- (the PK is already (id) and all three indexes already exist). It is only
-- effective on a fresh/drifted environment. See audit/RUNBOOK_SYNC_SCHEMA_DRIFT.md.
--
-- Safe because: the app already assumes global id-uniqueness (onConflict:"id")
-- and production already enforces it; fresh environments are empty when this
-- runs, so recreating the PK cannot fail on duplicate ids; encrypted_records has
-- no incoming foreign keys referencing its primary key.

-- 1) Primary key on (id). Replaces the composite PK on a fresh env; no-op on prod.
do $$
declare
  pk_cols text[];
begin
  select array_agg(att.attname order by att.attnum)
  into pk_cols
  from pg_constraint con
  join lateral unnest(con.conkey) as k(attnum) on true
  join pg_attribute att
    on att.attrelid = con.conrelid and att.attnum = k.attnum
  where con.conrelid = 'public.encrypted_records'::regclass
    and con.contype = 'p';

  if pk_cols is distinct from array['id']::text[] then
    alter table public.encrypted_records
      drop constraint if exists encrypted_records_pkey;
    alter table public.encrypted_records
      add constraint encrypted_records_pkey primary key (id);
  end if;
end
$$;

-- 2) user_id-leading indexes backing RLS ownership + the bootstrap query.
create index if not exists encrypted_records_user_id_deleted_at_idx
  on public.encrypted_records (user_id, deleted_at);
create index if not exists encrypted_records_user_id_record_type_idx
  on public.encrypted_records (user_id, record_type);
create index if not exists encrypted_records_user_id_updated_at_idx
  on public.encrypted_records (user_id, updated_at desc);
