# Staging validation report

Use this file for one concrete staging validation run. Keep secrets out of the report.

## Run metadata

```text
Date: 2026-05-31
Tester: Codex + user
Supabase project ref: existing Investor project
Native platform/build: local macOS store via InvestorParityExport
Web commit: 6a65bc7
Test account: existing user account
Dataset source: existing Supabase test data; WEB-STAGE records were soft-deleted after key mismatch remediation
```

## Local gate

```text
npm run preflight:staging: PASS
npm run typecheck: PASS
npm test: PASS, 16 files / 62 tests
npm run lint: PASS
npm run build: PASS
npm run test:e2e:fake-sync: PASS
Post-bootstrap fix smoke: npm run typecheck PASS; npm run lint PASS; npm test PASS, 16 files / 62 tests; npm run build PASS
```

## Read parity

```text
Login: PASS, user confirmed login
Key backup unlock: PASS, user confirmed unlock
Encrypted records fetch: PASS, dashboard showed 508 decrypted records before web writes
Dashboard totals: PASS, dashboard rendered real snapshot without decode error
Portfolios: PASS, portfolio list rendered after unlock
Instruments: PASS, instrument list rendered after unlock
Transactions: PASS smoke, transaction list rendered 212 transactions after unlock
Valuation series: PASS smoke, dashboard rendered chart after unlock
Reports: PASS smoke, reports rendered portfolio history and allocation after unlock

Observed web UI after cleanup: dashboard 508 records; portfolios 2; instruments 7 / 6 in portfolio; transactions 212; reports value about 47 547 PLN.
Differences: no WEB-STAGE data remained active; exact native snapshot parity differs only on market valuation fields
```

## Write web -> native

```text
account: PASS in web, created WEB-STAGE-202605310925
asset: PASS in web, created WEBSTG310925 and WEB-STAGE Quote AAPL 0927
transaction: PASS in web, created buy transaction for WEBSTG310925 in WEB-STAGE portfolio
manualValuation: PASS in web, fetched Yahoo AAPL quote and saved manual valuation
Native decode result: BLOCKED by key mismatch after web writes; see key-remediation note below
Native snapshot parity: pending after clean re-unlock

Issues: WEB-STAGE records were encrypted with an older web key and were later soft-deleted
```

## Write native -> web

```text
account: pending native-created test after this run
asset: pending native-created test after this run
transaction: pending native-created test after this run
manualValuation: pending native-created test after this run
Web decode result: PASS after macOS repair and WEB-STAGE soft-delete; user confirmed unlock
Web snapshot parity: PARTIAL PASS through unlocked UI counts and exact JSON capture; valuation differs where native uses local market price cache

Issues:
```

## Exact parity export

```text
Web parity exporter: PASS code, window.__investorWebExportParitySnapshot bridge added from decrypted Zustand records
Native parity exporter: PASS code, InvestorParityExport SwiftPM executable added
Native explicit store support: PASS code, exporter can target app store directory with --store-directory
Real native store path: found via lsof at /Users/jacek/Library/Containers/com.jacek.investor/Data/Library/Application Support
Native live capture: PASS after closing InvestorMac, /tmp/investor-native-parity.json generated
Native live summary: 508 records; account 2, asset 7, transaction 212, income 286, settings 1; total value 47856.91 PLN
Comparator: PASS self-check, normalized native snapshot matched itself through compare:parity
Web live capture: PASS after user unlock on 2026-06-01, /tmp/investor-web-parity.json generated from hidden parity JSON bridge
Exact compare after date/history/fx fixes: PARTIAL PASS, record counts, object lists, Warsaw calendar dates, and daily history length match; 5 valuation differences remain
Remaining valuation differences: Obligacje total 19262.01 native vs 19262.16 web; IKE total 28594.90 native vs 28284.91 web; total value 47856.91 native vs 47547.08 web; latest history value 47857.48 native vs 47547.49 web; monthly change 0.0571 native vs 0.0019 web
Root cause: Web values VWRL.NL and ICOM.UK from last transaction price because market price cache is not synced; macOS native values from local market cache/latest price. Obligacje residual difference is rounding/day-level bond dirty-price drift of 0.15 PLN.
Fixed during validation: Web parity now uses daily valuation series (1462 points) and current as-of date like macOS; comparator normalizes Warsaw calendar dates
Decision: sync/share market price cache with Web via encrypted marketQuote records
Next validation action: run updated macOS sync/repair so native uploads marketQuote records, then re-unlock Web and repeat exact parity compare
```

## Market quote sync

```text
Decision: option 1 selected, sync minimal current market quote snapshot instead of excluding market-data from parity.
Supabase schema: PASS, encrypted_records record_type constraint now allows marketQuote in live Investor project and migration 0002_allow_market_quote_records.sql was added.
Native writer: PASS code, macOS SyncService accepts extra local records and AppStore uploads livePrices as marketQuote records during normal sync and repair/reupload.
Web reader: PASS code, marketQuote payload is accepted, counted in sync summary, and used before manual/transaction prices for non-treasury instrument valuation.
Verification: npm run typecheck PASS; npm test PASS, 16 files / 64 tests; npm run lint PASS; npm run build PASS; swift test PASS, 234 tests.

Pending live validation: current Supabase data still has no marketQuote rows until updated macOS sync/repair runs.
```

## Web session bootstrap

```text
Problem: after reload, the dashboard could remain stuck on "Sprawdzanie sesji..." because the local Next dev server served HTML while client chunks were stale/missing, so React did not hydrate; client-side Supabase calls could also keep the unlock panel waiting.
Fix: restarted Next dev server on port 3000; AppShell now receives initial authenticated user from the server layout; /api/sync/bootstrap fetches key backup and encrypted records through server Supabase cookies while decryption remains local in the browser.
Verification: user confirmed unlock; browser showed passphrase field instead of checking session; Web parity JSON exported after unlock.
```

## Key-remediation note

```text
Problem: Web unlocked the key backup, but active Supabase records contained payloads encrypted by different user data keys.
Observed state before cleanup: 513 active records = 508 macOS records + 5 WEB-STAGE records from web device 857683c1-737d-418b-be57-909c48683ee8.
Native repair: PASS, macOS reuploaded 508 local records at 2026-05-31 17:40:39 UTC.
Cleanup: PASS, soft-deleted 5 WEB-STAGE records (1 account, 2 asset, 1 transaction, 1 manualValuation).
Current active sync state: 508 records from one macOS device.
Current active type counts: account 2, asset 7, transaction 212, income 286, settings 1.
User confirmation: PASS, web unlock succeeded after cleanup.
Fresh web UI validation: PASS, dashboard/portfolio/instrument/transaction/report screens rendered current macOS dataset without decrypt errors.

Follow-up: exact JSON parity export bridge was added after this inspection; UI count parity and Supabase metadata matched.
```

## Native passphrase flow

```text
Problem: native sign-in/sign-up passed the account password into configureEncryptionAfterAuthentication, which blurred account password and sync passphrase.
Fix: macOS Settings and mobile settings now collect a separate sync passphrase and use it for key-backup restore/create.
UI copy: updated to state that sync passphrase is separate from the account password and must match InvestorWeb.
Verification: swift test PASS, 234 tests.
```

## Conflicts and tombstones

```text
Conflict reject local: PASS unit, stale upsert/delete rejects with SyncConflictError and is not hidden in pending queue
Conflict force local: PASS unit, queued upsert/delete can be forced after user override
Live DB two-client smoke: PASS, simulated client A insert, client B update, stale client A no-match, client B tombstone, active-after-tombstone 0, cleanup 1
Live DB smoke cleanup: PASS, remaining sync_live_smoke/codex-live-client records 0
Tombstone native -> web: pending live native-created delete
Tombstone web -> native: PASS unit, web soft-delete sets deleted_at/updated_at and offline delete queues/flushes

Issues: native/Web UI-level two-device delete still pending; database-level tombstone/conflict semantics passed without persistent test records
```

## Market data privacy

```text
Quote request only includes single symbol: PASS by UI route, AAPL quote fetched through /api/market-data/quote
FX request only includes single currency/date:
No user_id/portfolio/snapshot/ciphertext in provider request: PASS by route design and local tests; pending live network/log inspection
Manual valuation only saved after explicit accept: PASS, quote preview was shown before Save

Issues: prior invalid WEBSTG quote returned 404, expected for non-listed test symbol
```

## RLS smoke test

```text
Second account cannot read first account key backup:
Second account cannot read first account encrypted records:
Second account can read only its own records:
Anonymous role cannot read sync tables: PASS, encrypted_records and encrypted_key_backups returned 401 permission denied

Issues: two-authenticated-user isolation not executed; set SUPABASE_RLS_USER_A_EMAIL/PASSWORD and SUPABASE_RLS_USER_B_EMAIL/PASSWORD for automated smoke
```

## Decision

```text
Result: PARTIAL PASS
Blocking issues: exact native JSON snapshot parity awaits first live marketQuote upload from updated macOS; RLS second-authenticated-user smoke still pending
Non-blocking issues: Stooq fallback not configured
Follow-up owner: Codex can continue conflict/tombstone checks; user only needed for native app actions/passphrase entry
```
