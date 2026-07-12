import { expect, test } from "@playwright/test";
import {
  authHeaders,
  loadSupabaseTestEnvironment,
  requireTestValue,
  signIn,
} from "../support/supabase-live";

const environment = loadSupabaseTestEnvironment();
const supabaseUrl = requireTestValue(environment, "NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
const publishableKey = requireTestValue(environment, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const restUrl = `${supabaseUrl}/rest/v1`;

test("Data API grants, device upsert and two-account RLS work on staging", async ({ request }) => {
  const userA = await signIn(
    request,
    supabaseUrl,
    publishableKey,
    requireTestValue(environment, "SUPABASE_RLS_USER_A_EMAIL"),
    requireTestValue(environment, "SUPABASE_RLS_USER_A_PASSWORD"),
  );
  const userB = await signIn(
    request,
    supabaseUrl,
    publishableKey,
    requireTestValue(environment, "SUPABASE_RLS_USER_B_EMAIL"),
    requireTestValue(environment, "SUPABASE_RLS_USER_B_PASSWORD"),
  );
  const deviceId = "playwright-staging-rls-contract";
  const device = {
    user_id: userA.user.id,
    device_id: deviceId,
    device_name: "Playwright staging",
    platform: "web-test",
    last_seen_at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const upsert = await request.post(`${restUrl}/user_devices?on_conflict=user_id%2Cdevice_id`, {
      headers: {
        ...authHeaders(publishableKey, userA.access_token),
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation",
      },
      data: [device],
    });
    expect(upsert.ok(), await upsert.text()).toBe(true);
  }

  const ownDevice = await request.get(
    `${restUrl}/user_devices?select=user_id,device_id&device_id=eq.${deviceId}`,
    { headers: authHeaders(publishableKey, userA.access_token) },
  );
  expect(ownDevice.ok(), await ownDevice.text()).toBe(true);
  await expect(ownDevice.json()).resolves.toEqual([{ user_id: userA.user.id, device_id: deviceId }]);

  const ownershipFilters = [
    ["profiles", `id=eq.${userA.user.id}`],
    ["user_devices", `user_id=eq.${userA.user.id}`],
    ["encrypted_records", `user_id=eq.${userA.user.id}`],
    ["encrypted_key_backups", `user_id=eq.${userA.user.id}`],
  ] as const;

  for (const [table, filter] of ownershipFilters) {
    const ownRead = await request.get(`${restUrl}/${table}?select=*&${filter}&limit=1`, {
      headers: authHeaders(publishableKey, userA.access_token),
    });
    expect(ownRead.ok(), `${table}: ${await ownRead.text()}`).toBe(true);

    const foreignRead = await request.get(`${restUrl}/${table}?select=*&${filter}&limit=1`, {
      headers: authHeaders(publishableKey, userB.access_token),
    });
    expect(foreignRead.ok(), `${table}: ${await foreignRead.text()}`).toBe(true);
    await expect(foreignRead.json()).resolves.toEqual([]);
  }
});
