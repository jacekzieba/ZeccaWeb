# Zecca Web — Przepływ danych i prywatność

## Model prywatności (mocny)
Zero-knowledge: rekordy portfela szyfrowane na kliencie (AES-256-GCM, nonce 96-bit) kluczem `userDataKey` (256-bit CSPRNG), którego kopia zapasowa jest szyfrowana kluczem wyprowadzonym z **osobnej frazy synchronizacji** (PBKDF2-SHA256, 600 000 iteracji, sól 16B). Serwer/baza widzą **wyłącznie szyfrogram + metadane**. Bez frazy danych nie da się odczytać. Dowód: `aes-gcm.ts`, `key-backup.ts`, `key-cache.ts`, `app/api/sync/bootstrap/route.ts`.

## Mapa danych

| Dane | Źródło | Cel | Przetwarzanie | Przechowywanie | Odbiorcy | Retencja | Usuwanie |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E-mail konta | użytkownik | logowanie/konto | Supabase Auth | Supabase (auth.users, profiles.email) | Supabase | do usunięcia konta | cascade delete (Edge Function) |
| Hasło | użytkownik | logowanie | Supabase Auth (hash po stronie Supabase) | Supabase | Supabase | — | — |
| Fraza sync (passphrase) | użytkownik | odblokowanie klucza | tylko w pamięci klienta; PBKDF2 | **nigdzie na serwerze** | nikt | — | — |
| userDataKey | klient (CSPRNG) | szyfrowanie rekordów | CryptoKey nieeksportowalny | IndexedDB (opcjonalnie), pamięć karty | nikt | do wylogowania | `clearCachedUserDataKey` przy wylogowaniu |
| Rekordy portfela | użytkownik | funkcja produktu | szyfrowane na kliencie | Supabase `encrypted_records` (szyfrogram) | Supabase | do usunięcia | soft-delete + cascade |
| Kopia klucza | klient | odzysk na nowym urządzeniu | szyfrowana passphrase | Supabase `encrypted_key_backups` | Supabase | do usunięcia | cascade |
| Etykieta/ID urządzenia | klient | zarządzanie sync | jawne (neutralne) | Supabase `user_devices`, localStorage | Supabase | do usunięcia | cascade |
| Preferencje UI/profil web | użytkownik | UX | jawne | localStorage | brak | lokalnie | ręcznie/wylogowanie (część) |
| Telemetria produktowa | klient | analityka | zanonimizowana, ephemeral id | — (bez cookies/localStorage) | TelemetryDeck (EU) | wg TelemetryDeck | opt-out w Ustawieniach |
| Web analytics/perf | klient | pomiar techniczny | pochodne IP, bezcookie | Vercel | Vercel | wg Vercel | — ([ANALYTICS-CONSENT]) |
| Zgłoszenia błędów | klient + serwer | wykrywanie awarii | techniczne dane błędu, scrubbing PII, tylko prod | Sentry (region UE) | Sentry (Functional Software, Inc.) | wg Sentry | wg Sentry |
| E-mail beta | użytkownik | lista beta | zod+honeypot | Airtable | Airtable | wg Airtable | wg Airtable |

## Storage przeglądarki (inwentaryzacja)

| Klucz | Magazyn | Zawartość | Wrażliwość | Czyszczenie |
| --- | --- | --- | --- | --- |
| `investor-web-pending-sync-v1` | localStorage | operacje sync: **szyfrogram** + metadane (id, typ, czas, device) | metadane | Ustawienia→wyloguj TAK; pasek boczny **NIE** ([LOGOUT-QUEUE-RESIDUE]) |
| `investor-web-profile` | localStorage | profil web (preferencje/etykiety) | niska PII | brak auto-czyszczenia przy wylogowaniu |
| `zecca-web-language`, sekcje UI, `investor-auto-refresh`, `investor-show-real-return` | localStorage | preferencje | brak | — |
| `investor-web-device-id` | localStorage | UUID urządzenia web | pseudonim | — |
| `investor-app-lock-*` | local/sessionStorage | PIN (słaby hash), setup, idle | niska ([APP-LOCK-PIN]) | częściowo przy resecie/wylogowaniu |
| `investor-web-key-cache` (IndexedDB) | IndexedDB | CryptoKey nieeksportowalny per-user | wysoka (ale nieeksportowalny) | `clearCachedUserDataKey` przy wylogowaniu |
| cookies Supabase | cookie | sesja | wysoka | `signOut()` |

**Brak** tokenów dostępnych dla JS w localStorage (sesja w cookies Supabase). **Brak** jawnych kwot/tickerów w localStorage/URL/analityce. URL nie nosi danych osobowych (dane sync przez POST/RLS, nie query string).

## Zgodność polityki z kodem
Polityka prywatności (`app/privacy-policy/page.tsx`) **zgodna**: ujawnia TelemetryDeck (Augsburg, EU), Vercel Analytics + Speed Insights, klucz w IndexedDB usuwany przy wylogowaniu, tylko niezbędne cookies Supabase, brak cookies reklamowych, lokalne parsowanie importów/eksportów. Administrator: Jacek Zięba, kontakt podany. Prawa użytkownika i usuwanie konta opisane i zaimplementowane.

**Rozbieżności / do domknięcia:**
- Analityka ładowana bez bramki zgody — podstawa prawna dla UE do oceny IOD ([ANALYTICS-CONSENT]).
- Polityka mówi „klucz usuwany przy wylogowaniu" (prawda), ale kolejka sync i profil web nie są czyszczone na ścieżce paska bocznego ([LOGOUT-QUEUE-RESIDUE]) — na współdzielonym urządzeniu resztkowe metadane. Rozważyć czyszczenie profilu web przy wylogowaniu lub jawne udokumentowanie.

## Cookies i zgody
- Tylko niezbędne cookies sesji Supabase (HttpOnly ustawiane przez `@supabase/ssr` — potwierdzić flagi w runtime: `HttpOnly`, `Secure`, `SameSite`, prefiks `__Host-`). **NOT ASSESSED w runtime.**
- TelemetryDeck bez cookies/localStorage (ephemeral id) → brak triggera ePrivacy „storage/access". Vercel Analytics/Speed Insights bezcookie, ale przetwarzają IP → ocena prawna.
- Brak baneru zgód — uzasadnienie w polityce dotyczy wyłącznie cookies; nie rozstrzyga zgody na analitykę (kwestia IOD).

## Obszary do oceny prawnej (nie orzekamy)
1. Podstawa prawna Vercel Analytics/Speed Insights dla UE ([ANALYTICS-CONSENT]).
2. TelemetryDeck domyślnie włączony (opt-out) — czy dla produktu web wymagana zgoda czy uzasadniony interes.
3. Rejestr czynności przetwarzania, umowy powierzenia (Supabase, Vercel, TelemetryDeck, Airtable), transfery poza EOG (Vercel/Supabase region — do potwierdzenia).
