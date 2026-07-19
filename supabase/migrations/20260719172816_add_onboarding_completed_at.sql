alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Existing accounts have already used Zecca before this onboarding existed.
-- Mark them as complete so only accounts created after this migration see the
-- first-run tour automatically.
update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;
