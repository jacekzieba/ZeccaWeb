# Mail potwierdzający rejestrację (Supabase Auth)

Domyślny mail Supabase był po angielsku, z nadawcą „Supabase Auth", bez wzmianki o Zecca.
Ta zmiana wprowadza polski, brandowany szablon i przygotowuje własnego nadawcę.

## Co jest w repo (kod)
- `supabase/templates/confirmation.html` — polski szablon „Potwierdź adres e-mail".
- `supabase/config.toml`:
  - `[auth.email.template.confirmation]` → wskazuje szablon, temat „Potwierdź swój adres e-mail w Zecca".
  - `additional_redirect_urls` uzupełnione o `com.jacek.zecca://login-callback` (deep-link iOS).
  - zakomentowany blok `[auth.email.smtp]` gotowy do uzupełnienia (nadawca „Zecca").
- Link w mailu prowadzi do `{{ .SiteURL }}/auth/confirm?token_hash=…&type=signup`,
  obsługiwanego przez `app/auth/confirm/route.ts` (działa też w innej przeglądarce niż rejestracja).

## Co trzeba zrobić ręcznie (dashboard / sekrety — nie w repo)
Projekt: `nfevwalgjfdsqdepfzin`. Bo produkcja jest zarządzana z dashboardu, zastosuj tam:

1. **Własny SMTP** (Authentication → Emails → SMTP Settings): host/port/login dostawcy,
   `sender_name = Zecca`, „from" na zweryfikowanej domenie. Hasło/API key ustaw jako sekret
   (`ZECCA_SMTP_PASSWORD`), następnie odkomentuj `[auth.email.smtp]` w config.toml.
   Bez własnego SMTP nadawcą zostaje „Supabase".
2. **Szablon**: wgraj treść `confirmation.html` w Authentication → Emails → Templates → „Confirm signup"
   (albo `supabase config push`, jeśli config jest źródłem prawdy).
3. **URL Configuration**: ustaw produkcyjny Site URL i dodaj do Redirect URLs adres web callback
   oraz `com.jacek.zecca://login-callback`.
4. Po podłączeniu SMTP możesz podnieść `[auth.rate_limit] email_sent` (dziś 2/h).

## Weryfikacja
Testowa rejestracja → mail po polsku, nadawca „Zecca", link prowadzi na `/auth/confirm`
(potwierdza konto i loguje w przeglądarce). Z iOS: po potwierdzeniu wróć do aplikacji i zaloguj się.
