import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../app/api/beta-waitlist/route";

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/beta-waitlist", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "vitest",
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/beta-waitlist", () => {
  it("fails closed when the waitlist is not enabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(postRequest({ email: "a@example.com", consent: true }));

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates email and consent before touching Airtable", async () => {
    vi.stubEnv("NEXT_PUBLIC_BETA_WAITLIST_ENABLED", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(postRequest({ email: "not-an-email", consent: false }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts honeypot spam without creating an Airtable record", async () => {
    vi.stubEnv("NEXT_PUBLIC_BETA_WAITLIST_ENABLED", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      postRequest({
        email: "spam@example.com",
        consent: true,
        company: "filled by bot",
      }),
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an Airtable record when enabled and configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_BETA_WAITLIST_ENABLED", "1");
    vi.stubEnv("AIRTABLE_API_KEY", "pat_test");
    vi.stubEnv("AIRTABLE_BASE_ID", "app_test");
    vi.stubEnv("AIRTABLE_WAITLIST_TABLE_ID", "tbl_test");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ records: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      postRequest({
        email: "beta@example.com",
        consent: true,
        source: "landing",
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/app_test/tbl_test",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer pat_test",
          "Content-Type": "application/json",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body))).toMatchObject({
      records: [
        {
          fields: {
            Email: "beta@example.com",
            Consent: true,
            Source: "landing",
            "User Agent": "vitest",
          },
        },
      ],
      typecast: true,
    });
  });
});
