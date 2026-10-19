# Kontrakt sync i szyfrowania

## Cel

Web ma byc kompatybilny z obecna prywatna synchronizacja Investora. Oznacza to, ze aplikacja webowa powinna czytac i zapisywac te same klasy rekordow:

- `account`
- `asset`
- `transaction`
- `manualValuation`
- `income`
- `settings`

## Tabele Supabase

Minimalny zestaw:

```text
profiles
  id uuid primary key references auth.users(id)
  email text
  updated_at timestamptz

user_devices
  user_id uuid references auth.users(id)
  device_id text
  device_name text
  platform text
  last_seen_at timestamptz

encrypted_records
  id uuid
  user_id uuid references auth.users(id)
  record_type text
  encrypted_payload text
  nonce text
  payload_version integer
  schema_version integer
  device_id text
  created_at timestamptz
  updated_at timestamptz
  deleted_at timestamptz null

encrypted_key_backups
  user_id uuid primary key references auth.users(id)
  encrypted_user_data_key text
  nonce text
  salt text
  kdf text
  kdf_iterations integer
  created_at timestamptz
  updated_at timestamptz
```

Unikalnosc dla rekordow sync powinna obejmowac co najmniej:

```text
(user_id, record_type, id)
```

## RLS

RLS musi byc wlaczone na wszystkich tabelach uzytkownika.

Zasada polityk:

```sql
auth.uid() = user_id
```

Dla `profiles`:

```sql
auth.uid() = id
```

Szyfrowanie nie zastepuje RLS. RLS chroni przed dostepem miedzy kontami, a szyfrowanie chroni tresc portfela przed backendem i wyciekiem bazy.

## Format szyfrowania

Obecny natywny kod uzywa AES-GCM:

- klucz danych uzytkownika: 256 bit,
- losowy nonce per payload,
- ciphertext i tag laczone jako `ciphertext + tag`,
- wynik kodowany jako Base64,
- nonce kodowany jako Base64.

Web powinien odtworzyc ten format przy pomocy Web Crypto API:

```text
encrypted_payload = base64(ciphertext || auth_tag)
nonce = base64(iv)
algorithm = AES-GCM
key_length = 256 bit
```

Do potwierdzenia w test vectors:

- czy CryptoKit nonce ma dokladnie 12 bajtow,
- czy Web Crypto zwraca ciphertext z tagiem na koncu,
- czy Base64 jest zgodne bez dodatkowego opakowania.

## Klucz uzytkownika

Wymagany model:

1. Po pierwszym logowaniu web pyta o haslo/sekret odblokowania klucza.
2. Web pobiera `encrypted_key_backups`.
3. Web wyprowadza key-encryption-key z passphrase.
4. Web odszyfrowuje `userDataKey`.
5. `userDataKey` zostaje w pamieci sesji, a nie w plain localStorage.

Do rozwazenia pozniej:

- przechowywanie opakowanego klucza w IndexedDB,
- WebAuthn/passkey jako drugi sposob odblokowania,
- rotacja klucza danych.

## Payload envelope

Kazdy odszyfrowany rekord powinien byc opakowany w wersjonowany envelope.

Przyklad logiczny:

```json
{
  "recordType": "transaction",
  "id": "uuid",
  "portfolioID": "uuid",
  "date": 769219200
}
```

Dokladny ksztalt JSON musi byc zgodny z obecnym Swift `Codable`. Obecny Swift `SyncPayloadEnvelope` koduje payload plasko z polem `recordType`; `payload_version` i `schema_version` sa metadanymi tabeli `encrypted_records`, a nie polami payloadu. Pierwszym zadaniem implementacyjnym powinien byc eksport kilku testowych payloadow ze Swift i ich odczyt w TypeScript.

## Pobieranie (ADR-0010)

Serwer stempluje kazdy zapis wlasnym czasem w `server_updated_at` (wyzwalacz z migracji `20260928120000_sync_server_time_and_retention.sql`). Klienci nie ufaja tu `updated_at`, bo pochodzi z zegara urzadzenia.

- Natywny (`SyncPullPolicy.swift`): kursor w `UserDefaults`, pobieranie `server_updated_at >= kursor - 10 min` z tombstone'ami, pelne pobranie co 7 dni.
- Web (`src/sync/records/record-pull.ts`): ten sam filtr i ta sama zakladka 10 min, kursor tylko w pamieci karty (przeladowanie = pelne pobranie), pelne pobranie kontrolne co 30 min. Web nie ma lokalnej bazy, wiec twarde usuniecie z innego urzadzenia i czystka tombstone'ow (180 dni) wychodza dopiero przy pelnym pobraniu.
- Odblokowanie (`/api/sync/bootstrap`) jest zawsze pelnym pobraniem zywych rekordow.
- Serwer bez kolumny `server_updated_at` (blad 42703): web wraca do samych pelnych pobran.

## Konflikty

Startowy model:

- `updated_at` jako porzadek synchronizacji,
- `deleted_at` jako tombstone,
- `device_id` do rozpoznania wlasnych zmian,
- konflikt, gdy lokalny i zdalny rekord zmienily sie od ostatniego sync.

Nie wprowadzac CRDT w pierwszym etapie. Dla danych finansowych lepsze sa jawne konflikty niz ciche scalanie niejednoznacznych transakcji.
