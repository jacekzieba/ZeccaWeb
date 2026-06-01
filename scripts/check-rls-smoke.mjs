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

const userAEmail = env.SUPABASE_RLS_USER_A_EMAIL;
const userAPassword = env.SUPABASE_RLS_USER_A_PASSWORD;
const userBEmail = env.SUPABASE_RLS_USER_B_EMAIL;
const userBPassword = env.SUPABASE_RLS_USER_B_PASSWORD;

if (userAEmail && userAPassword && userBEmail && userBPassword) {
  const userA = await signIn(userAEmail, userAPassword);
  const userB = await signIn(userBEmail, userBPassword);

  await expectOwnRowsQueryWorks("user A encrypted_records", userA.access_token);
  await expectNoRows(
    "user B cannot read user A encrypted_records",
    `${restUrl}/encrypted_records?select=id&user_id=eq.${encodeURIComponent(userA.user.id)}&limit=1`,
    authHeaders(userB.access_token),
  );
  await expectNoRows(
    "user B cannot read user A encrypted_key_backups",
    `${restUrl}/encrypted_key_backups?select=user_id&user_id=eq.${encodeURIComponent(userA.user.id)}&limit=1`,
    authHeaders(userB.access_token),
  );

  console.log("RLS smoke passed for anon and two authenticated users.");
} else {
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

async function expectOwnRowsQueryWorks(label, accessToken) {
  const response = await fetch(`${restUrl}/encrypted_records?select=id&limit=1`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    fail(`${label}: HTTP ${response.status} ${await response.text()}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) {
    fail(`${label}: expected JSON array.`);
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
