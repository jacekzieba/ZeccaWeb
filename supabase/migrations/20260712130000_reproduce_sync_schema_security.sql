-- Keep the sync schema reproducible when Supabase does not expose new tables
-- to the Data API automatically. RLS remains the row-authorization layer.

do $$
begin
  if not exists (
    select 1
    from pg_constraint constraint_definition
    where constraint_definition.conrelid = 'public.user_devices'::regclass
      and constraint_definition.contype in ('p', 'u')
      and constraint_definition.conkey = array[
        (
          select attribute.attnum
          from pg_attribute attribute
          where attribute.attrelid = 'public.user_devices'::regclass
            and attribute.attname = 'user_id'
        ),
        (
          select attribute.attnum
          from pg_attribute attribute
          where attribute.attrelid = 'public.user_devices'::regclass
            and attribute.attname = 'device_id'
        )
      ]::smallint[]
  ) then
    alter table public.user_devices
      add constraint user_devices_user_id_device_id_key unique (user_id, device_id);
  end if;
end
$$;

-- The unique key above indexes user_devices.user_id. The existing unique key
-- on encrypted_key_backups.user_id and encrypted_records_user_updated_idx
-- likewise give each ownership predicate an index with user_id first.

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_devices to authenticated;
grant select, insert, update, delete on table public.encrypted_key_backups to authenticated;
grant select, insert, update, delete on table public.encrypted_records to authenticated;

alter policy "profiles_select_own" on public.profiles
  to authenticated
  using ((select auth.uid()) = id);

alter policy "profiles_insert_own" on public.profiles
  to authenticated
  with check ((select auth.uid()) = id);

alter policy "profiles_update_own" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "devices_select_own" on public.user_devices
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "devices_upsert_own" on public.user_devices
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "key_backups_select_own" on public.encrypted_key_backups
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "key_backups_upsert_own" on public.encrypted_key_backups
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "records_select_own" on public.encrypted_records
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "records_upsert_own" on public.encrypted_records
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
