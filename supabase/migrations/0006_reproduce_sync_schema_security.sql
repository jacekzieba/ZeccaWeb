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

-- The primary/unique keys on user_devices and encrypted_key_backups, plus the
-- encrypted_records primary key, index every ownership predicate with user_id
-- as the leading column without adding redundant indexes.

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_devices to authenticated;
grant select, insert, update, delete on table public.encrypted_records to authenticated;
grant select, insert, update, delete on table public.encrypted_key_backups to authenticated;

alter policy "Users can read their profile" on public.profiles
  to authenticated
  using ((select auth.uid()) = id);

alter policy "Users can update their profile" on public.profiles
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users can read their devices" on public.user_devices
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users can upsert their devices" on public.user_devices
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "Users can update their devices" on public.user_devices
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can read their encrypted records" on public.encrypted_records
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users can insert their encrypted records" on public.encrypted_records
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "Users can update their encrypted records" on public.encrypted_records
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can read their key backup" on public.encrypted_key_backups
  to authenticated
  using ((select auth.uid()) = user_id);

alter policy "Users can insert their key backup" on public.encrypted_key_backups
  to authenticated
  with check ((select auth.uid()) = user_id);

alter policy "Users can update their key backup" on public.encrypted_key_backups
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
