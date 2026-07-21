-- Reconcile encrypted_records so the app's upsert (onConflict: "id") has a
-- matching constraint in EVERY environment, not only in the drifted production DB.
--
-- Drift background:
--   * 0001_initial_sync.sql declares  primary key (user_id, record_type, id).
--   * src/sync/records/supabase-sync-store.ts upserts encrypted_records with
--     { onConflict: "id" }. Postgres only accepts that ON CONFLICT target when a
--     UNIQUE or PRIMARY KEY constraint covers exactly (id).
--   * Production has drifted so its live key satisfies (id) alone, so writes work
--     there. A database freshly provisioned from these migrations instead raises
--     42P10 ("no unique or exclusion constraint matching the ON CONFLICT
--     specification") on every sync write — breaking DR, staging rebuilds and new
--     regions. See audit/FINDINGS.json → SYNC-SCHEMA-DRIFT.
--
-- What this migration does:
--   Adds a UNIQUE (id) constraint ONLY when no single-column unique/primary-key
--   constraint on `id` already exists. It is additive and idempotent — a no-op on
--   any database that is already reconciled (including production, whose live key
--   already covers id). It intentionally does NOT drop or alter the existing
--   primary key; choosing the long-term key shape (id-only vs composite) is a
--   deliberate decision left to a human.
--
-- Why it is safe:
--   Global uniqueness of `id` is already assumed by the onConflict:"id" upsert and
--   already enforced by production's live key, so declaring UNIQUE (id) does not
--   change runtime behavior. Fresh environments are empty when migrations run, so
--   the constraint cannot fail on pre-existing duplicate ids.
--
-- REQUIRES HUMAN REVIEW BEFORE APPLYING: this migration was authored without
-- access to the live schema. Verify against production with `supabase db diff`,
-- apply on staging first, and confirm sync writes succeed end-to-end. Consider
-- adding `supabase db diff` to CI so schema drift is caught automatically.

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.encrypted_records'::regclass
      and constraint_definition.contype in ('p', 'u')
      and constraint_definition.conkey = array[
        (
          select attribute.attnum
          from pg_attribute attribute
          where attribute.attrelid = 'public.encrypted_records'::regclass
            and attribute.attname = 'id'
        )
      ]::smallint[]
  ) then
    alter table public.encrypted_records
      add constraint encrypted_records_id_key unique (id);
  end if;
end
$$;
