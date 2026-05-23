# Staging validation report

Use this file for one concrete staging validation run. Keep secrets out of the report.

## Run metadata

```text
Date:
Tester:
Supabase project ref:
Native platform/build:
Web commit:
Test account:
Dataset source:
```

## Local gate

```text
npm run check:staging-env:
npm run typecheck:
npm test:
npm run lint:
npm run build:
npm run test:e2e:fake-sync:
```

## Read parity

```text
Login:
Key backup unlock:
Encrypted records fetch:
Dashboard totals:
Portfolios:
Instruments:
Transactions:
Valuation series:
Reports:

Differences:
```

## Write web -> native

```text
account:
asset:
transaction:
manualValuation:
Native decode result:
Native snapshot parity:

Issues:
```

## Write native -> web

```text
account:
asset:
transaction:
manualValuation:
Web decode result:
Web snapshot parity:

Issues:
```

## Conflicts and tombstones

```text
Conflict reject local:
Conflict force local:
Tombstone native -> web:
Tombstone web -> native:

Issues:
```

## Market data privacy

```text
Quote request only includes single symbol:
FX request only includes single currency/date:
No user_id/portfolio/snapshot/ciphertext in provider request:
Manual valuation only saved after explicit accept:

Issues:
```

## RLS smoke test

```text
Second account cannot read first account key backup:
Second account cannot read first account encrypted records:
Second account can read only its own records:

Issues:
```

## Decision

```text
Result: PASS / FAIL
Blocking issues:
Non-blocking issues:
Follow-up owner:
```
