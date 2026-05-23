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

async function checkJsonEndpoint(baseUrl, path, validate) {
  const url = new URL(path, baseUrl);

  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      fail(`${url.toString()} returned HTTP ${response.status}.`);
      return;
    }

    if (!contentType.includes("application/json")) {
      fail(`${url.toString()} did not return JSON.`);
      return;
    }

    const body = await response.json();
    validate(body, url);
  } catch (error) {
    fail(`${url.toString()} is not reachable. Start the app first or set STAGING_PREFLIGHT_URL to a running instance. ${error instanceof Error ? error.message : String(error)}`);
  }
}

const preflightUrl = process.env.STAGING_PREFLIGHT_URL;

if (preflightUrl) {
  let baseUrl;

  try {
    baseUrl = new URL(preflightUrl);
  } catch {
    fail("STAGING_PREFLIGHT_URL must be a valid URL.");
  }

  if (baseUrl) {
    await checkJsonEndpoint(baseUrl, "/api/health", (body, url) => {
      if (body?.ok !== true || body?.service !== "InvestorWeb") {
        fail(`${url.toString()} returned an unexpected health payload.`);
      }
    });

    await checkJsonEndpoint(baseUrl, "/api/market-data/status", (body, url) => {
      if (body?.providers?.yahoo?.configured !== true) {
        fail(`${url.toString()} reports Yahoo as unavailable.`);
      }

      if (body?.providers?.nbp?.configured !== true) {
        fail(`${url.toString()} reports NBP as unavailable.`);
      }

      if (!("stooq" in (body?.providers ?? {}))) {
        fail(`${url.toString()} is missing Stooq provider status.`);
      }
    });
  }
}

if (!process.exitCode) {
  console.log(preflightUrl ? "Staging env and endpoint check passed." : "Staging env check passed.");
}
