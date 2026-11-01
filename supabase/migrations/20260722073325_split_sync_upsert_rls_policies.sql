-- Replace broad FOR ALL policies with one owner-scoped policy per operation.
-- This avoids evaluating two permissive policies for SELECT while preserving
-- the same authorization contract.

drop policy if exists "devices_upsert_own" on public.user_devices;
drop policy if exists "key_backups_upsert_own" on public.encrypted_key_backups;
drop policy if exists "records_upsert_own" on public.encrypted_records;

create policy "devices_insert_own"
  on public.user_devices for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "devices_update_own"
  on public.user_devices for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "devices_delete_own"
  on public.user_devices for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "key_backups_insert_own"
  on public.encrypted_key_backups for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "key_backups_update_own"
  on public.encrypted_key_backups for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "key_backups_delete_own"
  on public.encrypted_key_backups for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "records_insert_own"
  on public.encrypted_records for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "records_update_own"
  on public.encrypted_records for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "records_delete_own"
  on public.encrypted_records for delete
  to authenticated
  using ((select auth.uid()) = user_id);
