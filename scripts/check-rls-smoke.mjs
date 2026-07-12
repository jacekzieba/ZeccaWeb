#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
}

const restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
const anonHeaders = {
  apikey: anonKey,
  authorization: `Bearer ${anonKey}`,
};

await expectNoRowsOrDenied("anon encrypted_records", `${restUrl}/encrypted_records?select=id&limit=1`, anonHeaders);
await expectNoRowsOrDenied("anon encrypted_key_backups", `${restUrl}/encrypted_key_backups?select=user_id&limit=1`, anonHeaders);
await expectNoRowsOrDenied("anon profiles", `${restUrl}/profiles?select=id&limit=1`, anonHeaders);
await expectNoRowsOrDenied("anon user_devices", `${restUrl}/user_devices?select=user_id&limit=1`, anonHeaders);

const userAEmail = env.SUPABASE_RLS_USER_A_EMAIL;
const userAPassword = env.SUPABASE_RLS_USER_A_PASSWORD;
const userBEmail = env.SUPABASE_RLS_USER_B_EMAIL;
const userBPassword = env.SUPABASE_RLS_USER_B_PASSWORD;

if (userAEmail && userAPassword && userBEmail && userBPassword) {
  const userA = await signIn(userAEmail, userAPassword);
  const userB = await signIn(userBEmail, userBPassword);

  await upsertDeviceTwiceAndExpectOneRow(userA);

  const ownershipFilters = [
    ["profiles", `id=eq.${encodeURIComponent(userA.user.id)}`],
    ["user_devices", `user_id=eq.${encodeURIComponent(userA.user.id)}`],
    ["encrypted_records", `user_id=eq.${encodeURIComponent(userA.user.id)}`],
    ["encrypted_key_backups", `user_id=eq.${encodeURIComponent(userA.user.id)}`],
  ];
  for (const [table, filter] of ownershipFilters) {
    await expectQueryWorks(
      `user A ${table}`,
      `${restUrl}/${table}?select=*&${filter}&limit=1`,
      authHeaders(userA.access_token),
    );
    await expectNoRows(
      `user B cannot read user A ${table}`,
      `${restUrl}/${table}?select=*&${filter}&limit=1`,
      authHeaders(userB.access_token),
    );
  }

  console.log("RLS smoke passed for anon and two authenticated users.");
} else {
  if (env.SUPABASE_RLS_REQUIRE_TWO_USERS === "1") {
    fail("two-user credentials are required when SUPABASE_RLS_REQUIRE_TWO_USERS=1.");
  }
  console.log("RLS smoke passed for anon access.");
  console.log("Two-user RLS smoke skipped; set SUPABASE_RLS_USER_A_EMAIL/PASSWORD and SUPABASE_RLS_USER_B_EMAIL/PASSWORD to enable it.");
}

function loadEnv() {
  const result = { ...process.env };
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return result;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in result)) result[key] = value;
  }
  return result;
}

async function expectNoRows(label, url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    fail(`${label}: HTTP ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    fail(`${label}: expected JSON array.`);
  }

  if (rows.length !== 0) {
    fail(`${label}: expected 0 rows, got ${rows.length}.`);
  }
}

async function expectNoRowsOrDenied(label, url, headers) {
  const response = await fetch(url, { headers });
  if (response.status === 401 || response.status === 403) {
    console.log(`${label}: denied for anon role, OK.`);
    return;
  }

  if (!response.ok) {
    fail(`${label}: HTTP ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    fail(`${label}: expected JSON array.`);
  }

  if (rows.length !== 0) {
    fail(`${label}: expected 0 rows, got ${rows.length}.`);
  }
}

async function expectQueryWorks(label, url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    fail(`${label}: HTTP ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    fail(`${label}: expected JSON array.`);
  }
}

async function upsertDeviceTwiceAndExpectOneRow(session) {
  const deviceID = "rls-smoke-contract";
  const url = `${restUrl}/user_devices?on_conflict=user_id%2Cdevice_id`;
  const headers = {
    ...authHeaders(session.access_token),
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=representation",
  };
  const payload = [{
    user_id: session.user.id,
    device_id: deviceID,
    device_name: "RLS smoke",
    platform: "web-test",
    last_seen_at: new Date().toISOString(),
  }];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!response.ok) {
      fail(`user_devices upsert: HTTP ${response.status} ${await response.text()}`);
    }
  }

  const response = await fetch(
    `${restUrl}/user_devices?select=user_id,device_id&device_id=eq.${encodeURIComponent(deviceID)}`,
    { headers: authHeaders(session.access_token) },
  );
  if (!response.ok) {
    fail(`user_devices verification: HTTP ${response.status} ${await response.text()}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) {
    fail(`user_devices verification: expected 1 row after two upserts, got ${rows.length}.`);
  }
}

async function signIn(email, password) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    fail(`sign in failed for ${email}: HTTP ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function authHeaders(accessToken) {
  return {
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`,
  };
}

function fail(message) {
  console.error(`RLS smoke failed: ${message}`);
  process.exit(1);
}
