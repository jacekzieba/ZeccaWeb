import { describe, expect, it } from "vitest";
import { makeSettingsPayload } from "@/sync/records/macos-payloads";

describe("makeSettingsPayload", () => {
  it("preserves native-only fields when web writes consent", () => {
    const existing = {
      id: "settings-1",
      recordType: "settings",
      syncMode: "supabase",
      baseCurrency: "PLN",
      showBelkaTax: true,
      useFIFO: false,
      appLanguage: "pl",
      telemetryEnabled: false,
      hasAcknowledgedPrivacyDisclosure: false,
      updatedAt: 100,
    };

    const payload = makeSettingsPayload({
      id: "settings-1",
      existing,
      telemetryEnabled: true,
      hasAcknowledgedPrivacyDisclosure: true,
      updatedAt: 200,
    });

    // Consent flags overridden…
    expect(payload.telemetryEnabled).toBe(true);
    expect(payload.hasAcknowledgedPrivacyDisclosure).toBe(true);
    expect(payload.updatedAt).toBe(200);
    // …everything else preserved.
    expect(payload).toMatchObject({
      syncMode: "supabase",
      baseCurrency: "PLN",
      showBelkaTax: true,
      useFIFO: false,
      appLanguage: "pl",
      recordType: "settings",
    });
  });

  it("creates a minimal valid record when none exists", () => {
    const payload = makeSettingsPayload({
      id: "new-id",
      telemetryEnabled: false,
      hasAcknowledgedPrivacyDisclosure: true,
    });

    expect(payload.id).toBe("new-id");
    expect(payload.recordType).toBe("settings");
    expect(payload.telemetryEnabled).toBe(false);
    expect(payload.hasAcknowledgedPrivacyDisclosure).toBe(true);
    expect(typeof payload.updatedAt).toBe("number");
  });

  it("never carries financial fields it was not given", () => {
    const payload = makeSettingsPayload({
      id: "x",
      hasAcknowledgedPrivacyDisclosure: true,
    });
    expect(Object.keys(payload)).not.toContain("amount");
    expect(Object.keys(payload)).not.toContain("plnAmount");
  });

  it("updates the shared app language without dropping native settings", () => {
    const payload = makeSettingsPayload({
      id: "settings-1",
      existing: { recordType: "settings", baseCurrency: "PLN", useFIFO: true },
      appLanguage: "en",
      updatedAt: 300,
    });

    expect(payload).toMatchObject({
      recordType: "settings",
      baseCurrency: "PLN",
      useFIFO: true,
      appLanguage: "en",
      updatedAt: 300,
    });
  });
});
