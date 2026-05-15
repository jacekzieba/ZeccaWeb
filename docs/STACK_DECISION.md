# Decyzja stacku

## Rekomendacja

```text
Next.js App Router
TypeScript
daisyUI + Tailwind CSS
Supabase Auth + Postgres + RLS
Web Crypto API
TanStack Query
TanStack Table
React Hook Form + Zod
Chart.js + D3.js jako narzedzie specjalne
Playwright
Vitest
```

## Frontend

### Next.js App Router

Dobry wybor dla Investora, bo daje:

- routing aplikacyjny,
- server-side auth z cookies przez Supabase,
- route handlers dla proxy do zewnetrznych providerow,
- mozliwosc deployu na Vercel lub wlasnym hostingu,
- latwa separacje shell server-side i wrażliwych danych client-side.

Ryzyko: App Router, Server Components i cache potrafia komplikowac aplikacje dashboardowe. Dlatego wrażliwe i interaktywne czesci portfela trzymamy jako Client Components.

### daisyUI

daisyUI jest sensownym wyborem, jesli chcemy szybciej budowac UI i uniknac duzej ilosci klas uzytkowych w JSX.

Wazne: daisyUI nie zastepuje Tailwind CSS. To biblioteka komponentow oparta o Tailwind plugin API. W praktyce stack brzmi: Tailwind CSS jako silnik stylow, daisyUI jako warstwa komponentow i themingu.

Konsekwencje:

- mniej wlasnych komponentow bazowych niz przy shadcn,
- szybszy start,
- slabsza kontrola nad detalami niz przy Radix/shadcn,
- przy zlozonych komponentach i tak bedziemy dopisywac React logic, np. combobox, advanced table filters, command palette.

### Formularze

React Hook Form + Zod:

- transakcje beda mialy wiele wariantow walidacji,
- Zod da wspolne schematy dla formularzy, importu i payloadow sync,
- RHF ogranicza niepotrzebne rerendery przy duzych formularzach.

### Tabele

TanStack Table:

- transakcje,
- instrumenty,
- import previews,
- konflikty sync,
- raporty dochodow i obciazen.

To lepszy wybor niz gotowa tabela z UI library, bo logika sortowania, filtrow, kolumn i wirtualizacji bedzie domenowa.

## Backend i dane

### Supabase

Supabase zostaje wspolnym punktem logowania i synchronizacji:

- Auth dla kont uzytkownikow,
- Postgres dla rekordow sync,
- RLS dla izolacji danych uzytkownika,
- Realtime opcjonalnie dla live-sync,
- Edge Functions opcjonalnie dla providerow z kluczami API.

### ORM

Na start nie forsowac ORM-a.

Opcje:

- Supabase generated types + `supabase-js` dla aplikacji.
- SQL migrations w `supabase/migrations`.
- Drizzle dopiero jesli migracje i typowanie SQL zaczna realnie oszczedzac czas.

Poniewaz glowna tabela uzytkownika bedzie przechowywac ciphertext, ORM nie wnosi wiele do domeny. Najwazniejszy kontrakt to format payloadow i szyfrowania.

## Testy

- Vitest dla domeny, sync envelope, walidacji i crypto helpers.
- Playwright dla logowania, odblokowania klucza, dashboardu i tabel.
- Test vectors miedzy Swift CryptoKit i Web Crypto API sa obowiazkowe przed realnym sync.
