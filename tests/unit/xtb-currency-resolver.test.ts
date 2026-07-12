import { describe, expect, it } from "vitest";
import { resolveObservedCurrencies } from "@/features/import/xtb-currency-resolver";
import type { XtbImportPreview } from "@/features/import/xtb-parser";

// D2 orchestration: take the parser's fx observations for "?" instruments, ask
// an injected rate source for candidate CCY->PLN rates on the trade date, and
// patch both the instrument payload and its transactions with the inferred ISO
// currency. Ambiguous/unknown cases stay "?".

function previewWith(currency: string): XtbImportPreview {
  return {
    kind: "transaction",
    rows: [],
    validRows: [
      { rowNumber: 1, values: {}, payload: { instrumentID: "i1", currency, transactionType: "buy" }, errors: [], warnings: [] },
    ],
    errorRows: [],
    newInstrumentPayloads: [{ id: "i1", recordType: "asset", symbol: "IEML.UK", currency }],
    warnings: [],
    fxObservations: [{ symbol: "IEML.UK", fxObserved: 5.2, date: "2026-03-02" }],
  } as unknown as XtbImportPreview;
}

const rates: Record<string, number> = { USD: 4.0, EUR: 4.3, GBP: 5.1, CHF: 4.5 };
const fetchRate = async (code: string) => rates[code] ?? null;

describe("resolveObservedCurrencies", () => {
  it("infers the settlement currency and patches instrument + transactions", async () => {
    const preview = previewWith("?");
    const resolved = await resolveObservedCurrencies(preview, fetchRate);

    expect(resolved).toBe(1);
    const payload = preview.newInstrumentPayloads[0] as Record<string, unknown>;
    expect(payload.currency).toBe("GBP");
    const tx = preview.validRows[0].payload as unknown as Record<string, unknown>;
    expect(tx.currency).toBe("GBP");
  });

  it("leaves currency as '?' when inference is ambiguous", async () => {
    const preview = previewWith("?");
    const ambiguous = async (code: string) => ({ USD: 5.15, GBP: 5.25 } as Record<string, number>)[code] ?? null;
    const resolved = await resolveObservedCurrencies(preview, ambiguous, ["USD", "GBP"]);

    expect(resolved).toBe(0);
    expect((preview.newInstrumentPayloads[0] as Record<string, unknown>).currency).toBe("?");
  });

  it("does nothing when there are no observations", async () => {
    const preview = previewWith("EUR");
    preview.fxObservations = [];
    const resolved = await resolveObservedCurrencies(preview, fetchRate);
    expect(resolved).toBe(0);
  });
});
