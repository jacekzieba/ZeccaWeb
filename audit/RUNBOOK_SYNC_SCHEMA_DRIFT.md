# Runbook — naprawa dryfu schematu `encrypted_records` (SYNC-SCHEMA-DRIFT, HIGH)

Cel: doprowadzić do stanu, w którym środowisko **odtworzone z migracji** poprawnie obsługuje zapisy sync (`onConflict: "id"`), bez zepsucia działającej produkcji. Migracja została już przygotowana: `supabase/migrations/20260721103000_reconcile_encrypted_records_id_constraint.sql` (idempotentna, nieniszcząca). Kod (`onConflict: "id"`) pozostaje bez zmian.

> ⚠️ Nie stosuj migracji na produkcji „w ciemno". Wykonaj kroki 1–4 najpierw. Migracji nie zastosowano automatycznie, bo audyt nie ma dostępu do żywego schematu.

## ✅ Ustalone fakty (inspekcja żywej bazy, 2026-07-21)

Zweryfikowano bezpośrednio w produkcji (projekt „Investor", `nfevwalgjfdsqdepfzin`, region eu-central-2, Postgres 17):

- **`encrypted_records` PK = `(id)`** (`encrypted_records_pkey UNIQUE (id)`) — zgodne z `onConflict:"id"`. **Produkcja działa poprawnie i nie wymaga żadnej zmiany.**
- Dodatkowo w prod istnieją 3 indeksy z wiodącym `user_id` (dla RLS + bootstrapu): `(user_id, deleted_at)`, `(user_id, record_type)`, `(user_id, updated_at DESC)`.
- **Żadnego z powyższych nie deklarują migracje** (0001 deklaruje PK złożony i brak tych indeksów).
- **Historia migracji w prod jest niekompletna** — `list_migrations` pokazuje tylko `0003, 0004, lock_down_handle_new_user, 0007`; brak `0001/0002/0005/0006/onboarding`. Schemat bazowy powstał poza systemem migracji.

**Wniosek:** ryzyko dotyczy WYŁĄCZNIE środowisk odtwarzanych z migracji (staging rebuild, DR, nowy region), nie bieżącej produkcji. Zaktualizowana migracja `20260721103000_reconcile_encrypted_records_id_constraint.sql` odtwarza realny kształt prod (PK na `id` + 3 indeksy), jest idempotentna i **gwarantowanym no-opem na produkcji**.

**Rekomendacja szersza (decyzja DBA):** skoro `encrypted_records` i historia migracji są zdryfowane, prawdopodobnie inne obiekty też. Warto ustanowić **kanoniczny baseline** przez `supabase db dump`/`db diff` z produkcji i pogodzić repo migracji z rzeczywistością (poza zakresem tej pojedynczej migracji). Kroki poniżej zostają jako procedura wdrożenia/weryfikacji.

## Krok 1 — Potwierdź żywy schemat (read-only)
W Supabase → SQL Editor (produkcja) uruchom:

```sql
-- Wszystkie constrainty tabeli i ich kolumny
select con.conname,
       con.contype,                         -- 'p' = PK, 'u' = UNIQUE
       array_agg(att.attname order by att.attnum) as columns
from pg_constraint con
join lateral unnest(con.conkey) as k(attnum) on true
join pg_attribute att
  on att.attrelid = con.conrelid and att.attnum = k.attnum
where con.conrelid = 'public.encrypted_records'::regclass
  and con.contype in ('p', 'u')
group by con.conname, con.contype
order by con.contype;
```

**Interpretacja:**
- Jeśli istnieje PK/UNIQUE na **`{id}`** (jedna kolumna) → produkcja jest już zgodna z kodem; migracja będzie **no-op** (jej `if not exists` pominie dodanie). Bezpiecznie.
- Jeśli klucz jest tylko **`{user_id, record_type, id}`** (złożony) → produkcja **też** działałaby dzięki dryfowi tylko jeśli istnieje osobny unikat na `id`; jeśli go nie ma, sprawdź, czemu produkcyjne zapisy działają (możliwy inny mechanizm). W razie wątpliwości — najpierw staging.

Dodatkowo sprawdź brak duplikatów `id` (wymóg dla `unique(id)`):
```sql
select id, count(*) from public.encrypted_records group by id having count(*) > 1;
-- musi zwrócić 0 wierszy
```

## Krok 2 — Test na świeżym środowisku z samych migracji
1. Utwórz throwaway-projekt Supabase (lub lokalny `supabase start`).
2. Zastosuj **wyłącznie** katalog `supabase/migrations` (`supabase db push` / `supabase migration up`).
3. Zweryfikuj, że nowa migracja dodała `unique (id)`:
   ```sql
   select conname, contype from pg_constraint
   where conrelid = 'public.encrypted_records'::regclass and contype in ('p','u');
   ```
4. Wykonaj **realny zapis sync** przez aplikację (zaloguj testowe konto, dodaj rekord) — upsert `onConflict:"id"` musi się powieść (brak błędu `42P10`).

## Krok 3 — Staging
1. Zastosuj migrację na stagingu (klon produkcji, jeśli dostępny).
2. Uruchom `npm run check:rls-smoke` (dwa konta) i `test:e2e:staging-smoke`.
3. Potwierdź: zapis/edycja/soft-delete rekordów działają; brak regresji RLS.

## Krok 4 — Produkcja
1. Zrób backup / potwierdź, że PITR jest włączone.
2. Zastosuj migrację w oknie serwisowym (operacja jest szybka — dodaje jeden unikat; przy dużej tabeli `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE` bierze `SHARE` lock i buduje indeks — rozważ `CREATE UNIQUE INDEX CONCURRENTLY` + `ADD CONSTRAINT ... USING INDEX`, jeśli tabela jest duża i nie chcesz blokować zapisów).
3. Smoke po wdrożeniu: zaloguj się, dodaj/edytuj rekord, potwierdź sync.

### Wariant dla dużej tabeli (bez blokady zapisów)
Zamiast `ADD CONSTRAINT ... UNIQUE`:
```sql
create unique index concurrently if not exists encrypted_records_id_key
  on public.encrypted_records (id);
alter table public.encrypted_records
  add constraint encrypted_records_id_key unique using index encrypted_records_id_key;
```
(`CONCURRENTLY` nie może działać w bloku transakcyjnym — uruchom poza migracją transakcyjną lub jako osobny krok.)

## Krok 5 — Zapobieganie nawrotom (CI)
Dodaj do CI krok wykrywający dryf, np.:
```bash
supabase db diff --linked --schema public   # musi być pusty względem migracji
```
Alternatywnie: cykliczny job porównujący `pg_constraint`/`pg_index` produkcji z oczekiwanym zrzutem.

## Rollback
- Migracja jest addytywna. Wycofanie: `alter table public.encrypted_records drop constraint if exists encrypted_records_id_key;` (przywraca stan sprzed, o ile constraint dodała ta migracja, a nie istniał wcześniej).
- Rollback aplikacji nie jest wymagany (kod `onConflict:"id"` był i pozostaje).

## Kryterium ukończenia
- Świeże środowisko z samych migracji zapisuje rekordy sync bez błędu.
- `supabase db diff` (prod ↔ migracje) pusty.
- Produkcja bez regresji (smoke + RLS-smoke zielone).

## Właściciele
BE/DB (migracja + apply), DevOps (CI drift-check), QA (smoke/RLS na stagingu).
