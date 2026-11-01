-- The Data API contract is explicit: anonymous callers have no table
-- privileges, authenticated callers still pass through owner-scoped RLS, and
-- service_role remains reserved for server-side account deletion.

revoke all privileges on table public.profiles from public, anon;
revoke all privileges on table public.user_devices from public, anon;
revoke all privileges on table public.encrypted_key_backups from public, anon;
revoke all privileges on table public.encrypted_records from public, anon;

-- Verification query for staging (expect no rows):
-- select table_name, privilege_type
-- from information_schema.role_table_grants
-- where table_schema = 'public'
--   and table_name in ('profiles', 'user_devices', 'encrypted_key_backups', 'encrypted_records')
--   and grantee in ('PUBLIC', 'anon');
