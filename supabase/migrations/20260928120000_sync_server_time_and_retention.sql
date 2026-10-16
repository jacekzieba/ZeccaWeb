-- SYNC-004 / ADR-0010: server time for the pull cursor, server-side tombstone
-- time, a client protocol gate and a guarded tombstone purge.
--
-- Neutral for clients already in the field: the protocol minimum starts at 1
-- (a missing header counts as 1) and the purge refuses to delete anything
-- until the minimum is raised to 2. Idempotent.

-- 1. Server-owned timestamps. `updated_at`/`deleted_at` come from client
--    clocks; these two never do.
alter table public.encrypted_records
  add column if not exists server_updated_at timestamptz not null default now(),
  add column if not exists tombstoned_at timestamptz;

-- Existing tombstones start their retention clock at deployment, never earlier.
update public.encrypted_records
   set tombstoned_at = now()
 where deleted_at is not null
   and tombstoned_at is null;

create or replace function public.encrypted_records_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  if new.deleted_at is null then
    new.tombstoned_at := null;                      -- live or restored
  elsif tg_op = 'INSERT' or old.deleted_at is null then
    new.tombstoned_at := clock_timestamp();         -- tombstone written now
  else
    new.tombstoned_at := old.tombstoned_at;         -- tombstone rewritten
  end if;
  return new;
end;
$$;

revoke all on function public.encrypted_records_server_time() from public, anon, authenticated;

drop trigger if exists encrypted_records_server_time on public.encrypted_records;
create trigger encrypted_records_server_time
  before insert or update on public.encrypted_records
  for each row execute function public.encrypted_records_server_time();

create index if not exists encrypted_records_user_id_server_updated_at_idx
  on public.encrypted_records (user_id, server_updated_at, id);

-- 2. Client protocol gate. Clients send `x-zecca-sync-protocol`; writes need at
--    least `min_client_protocol`. Raising it to 2 stops clients that predate
--    the retention rule from writing (and so from resurrecting purged rows).
create table if not exists public.sync_protocol (
  id boolean primary key default true check (id),
  min_client_protocol integer not null default 1 check (min_client_protocol >= 1),
  updated_at timestamptz not null default now()
);

insert into public.sync_protocol (id) values (true) on conflict (id) do nothing;

alter table public.sync_protocol enable row level security;
drop policy if exists "sync_protocol_read" on public.sync_protocol;
create policy "sync_protocol_read"
  on public.sync_protocol for select
  to authenticated
  using (true);

revoke all privileges on table public.sync_protocol from public, anon, authenticated;
grant select on table public.sync_protocol to authenticated;

create or replace function public.request_sync_protocol()
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when value ~ '^[0-9]{1,4}$' then value::integer
    else 1
  end
  from (
    select coalesce(
      nullif(current_setting('request.headers', true), '')::json ->> 'x-zecca-sync-protocol',
      '1'
    ) as value
  ) header;
$$;

create or replace function public.sync_protocol_allows_write()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.request_sync_protocol() >= coalesce(
    (select min_client_protocol from public.sync_protocol where id),
    1
  );
$$;

revoke all on function public.request_sync_protocol() from public, anon;
revoke all on function public.sync_protocol_allows_write() from public, anon;
grant execute on function public.request_sync_protocol() to authenticated;
grant execute on function public.sync_protocol_allows_write() to authenticated;

alter policy "records_insert_own" on public.encrypted_records
  with check (
    (select auth.uid()) = user_id
    and (select public.sync_protocol_allows_write())
  );
alter policy "records_update_own" on public.encrypted_records
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (select public.sync_protocol_allows_write())
  );

-- 3. Tombstone purge. Deletes tombstones older than 180 days by server time,
--    and only once every writing client applies the retention rule (protocol
--    >= 2); before that it deletes nothing. Scheduling (pg_cron) is rollout
--    step 4 in ADR-0010, not part of this migration.
create or replace function public.purge_expired_tombstones()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  purged bigint;
begin
  if coalesce((select min_client_protocol from public.sync_protocol where id), 1) < 2 then
    return 0;
  end if;
  delete from public.encrypted_records
   where tombstoned_at is not null
     and tombstoned_at < now() - interval '180 days';
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.purge_expired_tombstones() from public, anon, authenticated;

notify pgrst, 'reload schema';
