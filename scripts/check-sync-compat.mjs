#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function includesAll(source, patterns) {
  return patterns.every((pattern) => source.includes(pattern));
}

const envelope = read("src/sync/envelopes/envelope.ts");
const snapshot = read("src/sync/records/investor-snapshot.ts");
const writer = read("src/sync/records/record-writer.ts");
const syncStore = read("src/sync/records/supabase-sync-store.ts");
const syncUnlockPanel = read("src/features/sync/sync-unlock-panel.tsx");
const migration = read("supabase/migrations/0001_initial_sync.sql");

const recordTypes = [
  "account",
  "asset",
  "transaction",
  "manualValuation",
  "income",
  "settings",
];

const checks = [
  {
    name: "record type enum covers native sync classes",
    ok: includesAll(envelope, recordTypes.map((type) => `"${type}"`)),
  },
  {
    name: "Supabase migration allows native sync classes",
    ok: includesAll(migration, recordTypes.map((type) => `'${type}'`)),
  },
  {
    name: "snapshot parses account payloads",
    ok: snapshot.includes("accountPayloadSchema") && snapshot.includes('case "account"'),
  },
  {
    name: "snapshot parses asset payloads",
    ok: snapshot.includes("assetPayloadSchema") && snapshot.includes('case "asset"'),
  },
  {
    name: "snapshot parses transaction payloads",
    ok: snapshot.includes("transactionPayloadSchema") && snapshot.includes('case "transaction"'),
  },
  {
    name: "snapshot parses manualValuation payloads",
    ok: snapshot.includes("manualValuationPayloadSchema") && snapshot.includes('case "manualValuation"'),
  },
  {
    name: "snapshot parses settings payloads",
    ok: snapshot.includes("settingsPayloadSchema") && snapshot.includes('case "settings"'),
  },
  {
    name: "snapshot parses income payloads",
    ok: snapshot.includes("incomePayloadSchema") && snapshot.includes('case "income"'),
  },
  {
    name: "writer encrypts and upserts records",
    ok: writer.includes("encryptJsonPayload") && writer.includes("upsertEncryptedRecord"),
  },
  {
    name: "writer supports soft delete tombstones",
    ok: writer.includes("softDeleteEncryptedRecord") && syncStore.includes("deleted_at"),
  },
  {
    name: "writer has conflict guard based on updated_at",
    ok: writer.includes("assertNoConflict") && writer.includes("baseUpdatedAt"),
  },
  {
    name: "key backup table is present",
    ok: syncStore.includes("encrypted_key_backups") && migration.includes("encrypted_key_backups"),
  },
  {
    name: "web registers user_devices heartbeat",
    ok:
      syncStore.includes("registerWebDevice") &&
      syncStore.includes('from("user_devices")') &&
      syncUnlockPanel.includes("registerWebDevice"),
  },
];

const failures = checks.filter((check) => !check.ok);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}`);
}

console.log("");
console.log("Known compatibility gaps:");
console.log("- staging RLS still requires live verification with two real Auth users.");

if (failures.length > 0) {
  process.exitCode = 1;
}
