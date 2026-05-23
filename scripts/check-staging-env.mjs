#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return null;
  }

  const values = new Map();
  const contents = readFileSync(path, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    values.set(key, value);
  }

  return values;
}

function fail(message) {
  console.error(`Staging env check failed: ${message}`);
  process.exitCode = 1;
}

const values = parseEnvFile(envPath);

if (!values) {
  fail("missing .env.local. Copy .env.example and fill staging Supabase values.");
  process.exit();
}

const supabaseUrl = values.get("NEXT_PUBLIC_SUPABASE_URL") ?? "";
const supabaseAnonKey = values.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "";
const fakeSync = values.get("NEXT_PUBLIC_FAKE_SYNC") ?? "";

if (!supabaseUrl) {
  fail("NEXT_PUBLIC_SUPABASE_URL is empty.");
}

if (supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  fail("NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co.");
}

if (!supabaseAnonKey) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY is empty.");
}

if (supabaseAnonKey && supabaseAnonKey.length < 80) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short for a Supabase anon key.");
}

if (fakeSync && fakeSync !== "0" && fakeSync.toLowerCase() !== "false") {
  fail("NEXT_PUBLIC_FAKE_SYNC must be empty, 0, or false for staging validation.");
}

if (!process.exitCode) {
  console.log("Staging env check passed.");
}
