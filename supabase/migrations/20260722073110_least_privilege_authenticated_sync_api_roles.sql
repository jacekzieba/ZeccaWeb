-- Restrict signed-in clients to the four Data API operations used by the app.
-- TRUNCATE is intentionally revoked because PostgreSQL RLS does not apply to it.

revoke all privileges on table public.profiles from authenticated;
revoke all privileges on table public.user_devices from authenticated;
revoke all privileges on table public.encrypted_key_backups from authenticated;
revoke all privileges on table public.encrypted_records from authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_devices to authenticated;
grant select, insert, update, delete on table public.encrypted_key_backups to authenticated;
grant select, insert, update, delete on table public.encrypted_records to authenticated;
