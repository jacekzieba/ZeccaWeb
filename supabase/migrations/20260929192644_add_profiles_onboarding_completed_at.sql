-- Web czyta i zapisuje profiles.onboarding_completed_at (przewodnik po pierwszym
-- logowaniu), ale migracja 20260719172816 z repo ZeccaWeb nigdy nie trafiła na
-- produkcję — każde wejście do aplikacji webowej kończyło się 400 na profiles.
-- Ta sama treść, nowa wersja, żeby nie wstawiać migracji przed już zastosowane.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Istniejące konta używały Zecca przed przewodnikiem — oznaczamy je jako
-- ukończone, żeby przewodnik widziały tylko nowe konta.
update public.profiles
set onboarding_completed_at = now()
where onboarding_completed_at is null;
