import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const waitlistSchema = z.object({
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  company: z.string().trim().max(120).optional(),
  source: z.string().trim().max(80).optional(),
});

function airtableConfig() {
  const token = process.env.AIRTABLE_API_KEY ?? process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_WAITLIST_TABLE_ID;
  return token && baseId && tableId ? { token, baseId, tableId } : null;
}

function waitlistError(detail?: string) {
  return NextResponse.json(
    {
      error: "Nie udało się zapisać na listę beta.",
      ...(process.env.NODE_ENV !== "production" && detail ? { detail } : {}),
    },
    { status: 502 },
  );
}

function unknownFieldName(detail: string) {
  let message = detail;
  try {
    const parsed = JSON.parse(detail) as { error?: { message?: string } };
    message = parsed.error?.message ?? detail;
  } catch {
    // Airtable usually returns JSON, but keep plain-text matching as a fallback.
  }
  return message.match(/Unknown field name: "([^"]+)"/)?.[1] ?? null;
}

export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_BETA_WAITLIST_ENABLED !== "1") {
    return NextResponse.json(
      { error: "Zapisy nie są jeszcze aktywne." },
      { status: 503 },
    );
  }

  const parsed = waitlistSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Niepoprawne dane formularza." }, { status: 400 });
  }

  const { email, consent, company, source } = parsed.data;
  if (company) {
    // Honeypot: accept the request without creating a record.
    return NextResponse.json({ ok: true });
  }

  const config = airtableConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Lista beta nie jest jeszcze skonfigurowana." },
      { status: 503 },
    );
  }

  const now = new Date().toISOString();
  const emailField = process.env.AIRTABLE_WAITLIST_EMAIL_FIELD ?? "Email";
  const consentField = process.env.AIRTABLE_WAITLIST_CONSENT_FIELD ?? "Consent";
  const fields = {
    [emailField]: email,
    [consentField]: consent,
    [process.env.AIRTABLE_WAITLIST_SOURCE_FIELD ?? "Source"]: source ?? "landing",
    [process.env.AIRTABLE_WAITLIST_CREATED_AT_FIELD ?? "Created At"]: now,
    [process.env.AIRTABLE_WAITLIST_USER_AGENT_FIELD ?? "User Agent"]:
      request.headers.get("user-agent") ?? "",
  };
  const optionalFields = new Set(
    Object.keys(fields).filter((field) => field !== emailField && field !== consentField),
  );

  let response: Response;
  let activeFields = fields;
  const maxAttempts = optionalFields.size + 1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      response = await fetch(
        `https://api.airtable.com/v0/${encodeURIComponent(config.baseId)}/${encodeURIComponent(config.tableId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            records: [{ fields: activeFields }],
            typecast: true,
          }),
        },
      );
    } catch (error) {
      console.error("Beta waitlist Airtable request failed", error);
      return waitlistError("Airtable request failed before receiving a response.");
    }

    if (response.ok) {
      return NextResponse.json({ ok: true });
    }

    const detail = await response.text().catch(() => "");
    const missingField = unknownFieldName(detail);
    if (missingField && optionalFields.has(missingField)) {
      optionalFields.delete(missingField);
      const { [missingField]: _removed, ...remainingFields } = activeFields;
      activeFields = remainingFields;
      continue;
    }

    console.warn("Beta waitlist Airtable rejected request", {
      status: response.status,
      detail,
    });
    return waitlistError(`Airtable ${response.status}: ${detail.slice(0, 500)}`);
  }

  return waitlistError("Airtable rejected all retry attempts.");
}
