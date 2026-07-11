-- Wrap auth.uid() in a scalar subselect so it is evaluated once per query
-- instead of once per row (fixes the auth_rls_initplan advisor). Semantics
-- are unchanged: a row is still only visible to its owner.

-- profiles
alter policy "Users can read their profile" on public.profiles using ((select auth.uid()) = id);
alter policy "Users can update their profile" on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- user_devices
alter policy "Users can read their devices" on public.user_devices using ((select auth.uid()) = user_id);
alter policy "Users can upsert their devices" on public.user_devices with check ((select auth.uid()) = user_id);
alter policy "Users can update their devices" on public.user_devices using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- encrypted_records
alter policy "Users can read their encrypted records" on public.encrypted_records using ((select auth.uid()) = user_id);
alter policy "Users can insert their encrypted records" on public.encrypted_records with check ((select auth.uid()) = user_id);
alter policy "Users can update their encrypted records" on public.encrypted_records using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- encrypted_key_backups
alter policy "Users can read their key backup" on public.encrypted_key_backups using ((select auth.uid()) = user_id);
alter policy "Users can insert their key backup" on public.encrypted_key_backups with check ((select auth.uid()) = user_id);
alter policy "Users can update their key backup" on public.encrypted_key_backups using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
