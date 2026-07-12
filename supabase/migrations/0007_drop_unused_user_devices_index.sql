-- Drop the redundant single-column index on user_devices.user_id.
-- The unique constraint user_devices_user_id_device_id_key (user_id, device_id)
-- already indexes user_id as its leading column, so every ownership predicate is
-- served without this extra index. The database linter flagged it as unused.
drop index if exists public.user_devices_user_id_idx;
