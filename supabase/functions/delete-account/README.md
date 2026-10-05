# `delete-account` — źródło w repozytorium Zecca

Kod tej funkcji Edge i wersja wdrożona w Supabase żyją w repozytorium
aplikacji iOS/macOS: `Zecca/supabase/functions/delete-account`
(`handler.ts`, `index.ts`, testy i README z kontraktem wdrożenia).
Tam wprowadzaj zmiany i stamtąd wdrażaj funkcję.

Dawna, uproszczona kopia z tego repozytorium nie była tym, co działa na
produkcji, więc została usunięta.

Kontrakt, który obsługuje web (`src/features/settings/account-deletion.ts`):

- `403 reauthentication_required` — logowanie starsze niż 5 minut; użytkownik
  loguje się ponownie i ponawia usunięcie,
- `403 apple_reauthentication_required` — konto Apple wymaga świeżego kodu
  autoryzacji Apple, który zdobędzie tylko aplikacja iOS/macOS,
- `503 apple_revocation_not_configured` — serwerowi brakuje sekretów Apple.
