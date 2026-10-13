-- Contract step 1 of the tenant-aware identity rollout (non-destructive).
-- Applied to production (nfevwalgjfdsqdepfzin) on 2026-10-13.
--
--  1) rows written by legacy clients get logical_id = id automatically, so the
--     tenant-aware conflict target (user_id, record_type, logical_id) always
--     matches the legacy row instead of inserting a duplicate;
--  2) existing rows are backfilled with logical_id = id.
-- No row is deleted or re-keyed; `id` and the primary key stay unchanged. The
-- backfill bumps server_updated_at (trigger), so each client re-pulls once.
create or replace function public.encrypted_records_server_time()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  new.server_updated_at := clock_timestamp();
  -- Legacy clients write only `id`; its logical identity is that same id.
  new.logical_id := coalesce(new.logical_id, new.id);
  if new.deleted_at is null then
    new.tombstoned_at := null;
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.tombstoned_at := clock_timestamp();
  else
    new.tombstoned_at := old.tombstoned_at;
  end if;
  return new;
end;
$function$;

update public.encrypted_records
set logical_id = id
where logical_id is null;
