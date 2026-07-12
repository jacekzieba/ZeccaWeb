import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  authHeaders,
  loadSupabaseTestEnvironment,
  requireTestValue,
  signIn,
} from "../support/supabase-live";

const environment = loadSupabaseTestEnvironment();
const supabaseUrl = requireTestValue(environment, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const publishableKey = requireTestValue(environment, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = requireTestValue(environment, "SUPABASE_TEST_SERVICE_ROLE_KEY");
const deleteEmail = requireTestValue(environment, "SUPABASE_DELETE_TEST_EMAIL");
const deletePassword = requireTestValue(environment, "SUPABASE_DELETE_TEST_PASSWORD");
const restUrl = `${supabaseUrl}/rest/v1`;

test("delete-account removes the Auth user and all owned sync rows", async ({ request }) => {
  expect(environment.SUPABASE_DESTRUCTIVE_DELETE).toBe("1");
  const session = await signIn(request, supabaseUrl, publishableKey, deleteEmail, deletePassword);
  const userHeaders = {
    ...authHeaders(publishableKey, session.access_token),
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates,return=minimal",
  };
  const recordId = crypto.randomUUID();
  const now = new Date().toISOString();

  await expectUpsert(request, `${restUrl}/user_devices?on_conflict=user_id%2Cdevice_id`, userHeaders, [{
    user_id: session.user.id,
    device_id: "playwright-delete-contract",
    device_name: "Playwright destructive test",
    platform: "web-test",
    last_seen_at: now,
  }]);
  await expectUpsert(request, `${restUrl}/encrypted_key_backups?on_conflict=user_id`, userHeaders, [{
    user_id: session.user.id,
    encrypted_user_data_key: "test-ciphertext",
    salt: "test-salt",
    nonce: "test-nonce",
    kdf: "PBKDF2-HMAC-SHA256",
    kdf_iterations: 600000,
    updated_at: now,
  }]);
  await expectUpsert(request, `${restUrl}/encrypted_records?on_conflict=id`, userHeaders, [{
    id: recordId,
    user_id: session.user.id,
    record_type: "settings",
    encrypted_payload: "test-ciphertext",
    nonce: "test-nonce",
    payload_version: 1,
    schema_version: 1,
    device_id: "playwright-delete-contract",
    updated_at: now,
  }]);

  const ownershipFilters = [
    ["profiles", `id=eq.${session.user.id}`],
    ["user_devices", `user_id=eq.${session.user.id}`],
    ["encrypted_records", `user_id=eq.${session.user.id}`],
    ["encrypted_key_backups", `user_id=eq.${session.user.id}`],
  ] as const;
  const adminHeaders = authHeaders(serviceRoleKey, serviceRoleKey);

  for (const [table, filter] of ownershipFilters) {
    const before = await request.get(`${restUrl}/${table}?select=*&${filter}`, { headers: adminHeaders });
    expect(before.ok(), `${table}: ${await before.text()}`).toBe(true);
    expect((await before.json() as unknown[]).length).toBeGreaterThan(0);
  }

  const deletion = await request.post(`${supabaseUrl}/functions/v1/delete-account`, {
    headers: authHeaders(publishableKey, session.access_token),
  });
  expect(deletion.ok(), await deletion.text()).toBe(true);

  for (const [table, filter] of ownershipFilters) {
    const after = await request.get(`${restUrl}/${table}?select=*&${filter}`, { headers: adminHeaders });
    expect(after.ok(), `${table}: ${await after.text()}`).toBe(true);
    await expect(after.json()).resolves.toEqual([]);
  }

  const signInAfterDeletion = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: publishableKey, "content-type": "application/json" },
    data: { email: deleteEmail, password: deletePassword },
  });
  expect(signInAfterDeletion.ok()).toBe(false);
});

async function expectUpsert(
  request: APIRequestContext,
  url: string,
  headers: Record<string, string>,
  data: unknown,
) {
  const response = await request.post(url, { headers, data });
  expect(response.ok(), await response.text()).toBe(true);
}
