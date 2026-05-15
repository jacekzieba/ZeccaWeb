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
  encrypted_key text
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
  "type": "transaction",
  "payloadVersion": 1,
  "schemaVersion": 1,
  "payload": {
    "id": "uuid",
    "portfolioID": "uuid",
    "date": "2026-05-15T00:00:00Z"
  }
}
```

Dokladny ksztalt JSON musi byc zgodny z obecnym Swift `Codable`. Pierwszym zadaniem implementacyjnym powinien byc eksport kilku testowych payloadow ze Swift i ich odczyt w TypeScript.

## Konflikty

Startowy model:

- `updated_at` jako porzadek synchronizacji,
- `deleted_at` jako tombstone,
- `device_id` do rozpoznania wlasnych zmian,
- konflikt, gdy lokalny i zdalny rekord zmienily sie od ostatniego sync.

Nie wprowadzac CRDT w pierwszym etapie. Dla danych finansowych lepsze sa jawne konflikty niz ciche scalanie niejednoznacznych transakcji.
