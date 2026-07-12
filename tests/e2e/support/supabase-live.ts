import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { APIRequestContext } from "@playwright/test";

export type SupabaseTestEnvironment = Record<string, string | undefined>;

export type SupabaseSession = {
  access_token: string;
  user: { id: string };
};

export function loadSupabaseTestEnvironment(): SupabaseTestEnvironment {
  const result: SupabaseTestEnvironment = { ...process.env };
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

export function requireTestValue(environment: SupabaseTestEnvironment, key: string): string {
  const value = environment[key]?.trim();
  if (!value) throw new Error(`Missing ${key} for the live Supabase test.`);
  return value;
}

export async function signIn(
  request: APIRequestContext,
  supabaseUrl: string,
  publishableKey: string,
  email: string,
  password: string,
): Promise<SupabaseSession> {
  const response = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey, "content-type": "application/json" },
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Supabase sign-in failed: HTTP ${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<SupabaseSession>;
}

export function authHeaders(publishableKey: string, accessToken: string) {
  return {
    apikey: publishableKey,
    authorization: `Bearer ${accessToken}`,
  };
}
