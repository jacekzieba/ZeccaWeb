# Telemetry Contract (TelemetryDeck)

**Status:** canonical source of truth for telemetry across **all platforms** — iOS, macOS, web.
**Owner repos:** `Investor` (native, Swift) and `InvestorWeb` (web, TS). Any change here must land in both.

This document defines *every* signal we are allowed to send, its parameters, and the
allowed values. If it is not in this document, it is not sent. Implementations
(`TelemetryService.swift`, `src/lib/telemetry/`) must mirror this list 1:1.

---

## 1. Identity & provider

- **TelemetryDeck App ID:** `0B524246-D7D6-4A77-9685-129DE5604015` (shared by all platforms).
- **Organization tag:** `com.jacekzieba` (sent as the `organization` parameter).
- **User identity:** TelemetryDeck's default anonymized, salted, non-reversible user hash.
  We **never** set a custom user identifier here. The Supabase `user.id` is reserved
  exclusively for RevenueCat App User ID and must **never** be passed to TelemetryDeck.

### 1.1 Web operational telemetry

The Settings telemetry switch controls only TelemetryDeck product telemetry. The web
app also keeps Vercel Analytics and Vercel Speed Insights in `app/layout.tsx` for
operational visit, performance, and stability measurement. Vercel telemetry must be
disclosed in the privacy policy and marketing copy must not claim that no technical
telemetry exists. Vercel events must not include portfolio contents, decrypted
records, tickers, imported files, Supabase user ids, or free-text financial data.

---

## 2. Hard privacy rules (non-negotiable)

These are enforced by tests on both platforms.

1. **No values, only categories.** Parameters may carry *types/buckets* (e.g.
   `type=buy`, `provider=xtb`, `row_bucket=6_20`) but **never** raw user data.
2. **Never send any of:** amounts, prices, FX rates, tickers/symbols, instrument or
   account names, portfolio IDs, e-mails, free-text notes, dates of individual records,
   the Supabase user id, or any value derived from decrypted records.
3. **Gating.** A signal is emitted **only** when
   `telemetryEnabled && hasAcknowledgedPrivacyDisclosure && !forcedOff`.
   Both flags come from the synced settings record, so all platforms gate identically.
   `forcedOff` is the UI-test / e2e kill switch.
4. **`app_launched` fires at most once per process**, and only after the gate is open.

---

## 3. Common parameters (attached to EVERY signal)

| Param | Values | Notes |
|---|---|---|
| `platform` | `iOS` \| `macOS` \| `web` | |
| `app_version` | semver string | iOS/macOS: `CFBundleShortVersionString`; web: `package.json` version via `NEXT_PUBLIC_APP_VERSION` |
| `build` | string | iOS/macOS: `CFBundleVersion`; web: git short SHA or build number |
| `sync_mode` | `none` \| `iCloud` \| `supabase` | current sync mode |
| `organization` | `com.jacekzieba` | constant |

Event-specific parameters below are **merged on top** of these.

---

## 4. Naming rules

- Event names and parameter values are `lower_snake_case`, ASCII only.
- Native enum (`TelemetryEvent`) `rawValue` **is** the wire name. Web mirrors the same strings.
- Buckets use `<lo>_<hi>` / `<n>_plus` (e.g. `6_20`, `50_plus`). Never the exact count.
- Error/reason values are sanitized to a short category code, never `localizedDescription`.

---

## 5. Signal catalogue

### 5.1 Lifecycle & navigation — *Phase A* (exists on native; add to web)

| Event | When | Extra params | Platforms |
|---|---|---|---|
| `app_launched` | once, after gate opens | — | all |
| `dashboard_viewed` | dashboard shown | `screen=dashboard` | all |
| `positions_viewed` | positions/holdings shown | `screen=positions` | all |
| `transactions_viewed` | transactions list shown | `screen=transactions` | all |
| `earnings_viewed` | earnings/income shown | `screen=earnings` | all |
| `settings_viewed` | settings shown | `screen=settings` | all |
| `sample_data_loaded` | demo/sample data rendered (user not synced) | — | all |
| `sync_mode_changed` | user switches sync mode | `from`, `to` (both from SyncMode set) | all |

> All five `*_viewed` events are wired on web via `<ScreenView>` in each route's
> `page.tsx`. `sample_data_loaded` is wired on /benchmark and /reports (the only
> sample-fallback screens) via `useSampleDataSignal`; on web it fires only if
> consent was granted before syncing real data, since the gate is otherwise closed.

### 5.2 Product events — *Phase B* (NEW — add to native AND web together)

| Event | When | Extra params | Allowed values |
|---|---|---|---|
| `transaction_added` | a transaction is committed | `type` | `buy` `sell` `dividend` `interest` `bond_coupon` `bond_redemption` `deposit_open` `deposit_close` `cash_deposit` `cash_withdrawal` |
| | | `entry_method` | `manual` \| `import` |
| `earning_added` | an income/earning record is committed | `employment_type` | `employment` \| `business` |

`type` values map 1:1 to `TransactionType` (camelCase → snake_case).
**Never** add a `value`/`amount`/`symbol` parameter to these events.

### 5.3 Broker import — *Phase B* (exists on native; extend + port to web)

| Event | When | Extra params | Allowed values |
|---|---|---|---|
| `broker_import_started` | import begins | `provider` | `xtb` \| `pko_bonds` |
| `broker_import_succeeded` | import committed | `provider`, `result=committed`, `row_bucket` | `row_bucket`: `1_5` `6_20` `21_50` `50_plus` |
| `broker_import_failed` | import fails | `provider`, `reason` | `reason`: sanitized category code (e.g. `parse_error`, `empty_file`, `no_portfolio`) |

> Native normalizes `provider` via `telemetrySnakeCased` (`pkoBonds` → `pko_bonds`)
> and sends `row_bucket` on `_succeeded`. Web emits the same three events from its
> XTB/PKO import flow (`provider` = `xtb` / `pko_bonds`); generic CSV/table imports
> are not a broker and carry no broker telemetry.

### 5.4 Jacek-only / internal events

`jacek_earnings_import_started|succeeded|failed` exist on native for a private importer.
**Not** ported to web. Listed here only so the names stay reserved and documented.

---

## 6. What this lets us answer

- **Engagement:** DAU/MAU, retention, session frequency — derived automatically from
  `app_launched` + any signal (TelemetryDeck's anonymous user hash), split by `platform`.
- **Activation:** how many users are stuck in demo (`sample_data_loaded`) and never sync.
- **Behaviour:** do users add transactions / earnings, and which *types* (`transaction_added.type`, `earning_added`).
- **Import funnel:** adoption per `provider`, success vs failure rate, failure reasons,
  rough import size (`row_bucket`) — without any portfolio contents.

What it deliberately does **not** answer: amounts invested, which instruments, anyone's
identity. Those are out of scope by design.

---

## 7. Change process

1. Edit this file first (add/rename event or parameter, define allowed values).
2. Mirror in `Investor/Sources/InvestorCore/Services/Telemetry/TelemetryService.swift`.
3. Mirror in `InvestorWeb/src/lib/telemetry/`.
4. Update the privacy-payload tests in both repos.
5. Keep `Investor/docs/TELEMETRY_CONTRACT.md` a pointer to this canonical file (or a synced copy).
