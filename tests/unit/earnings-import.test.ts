import { describe, expect, it } from "vitest";
import {
  parseEarningsImportCsv,
  parseEarningsImportTable,
} from "@/features/earnings/earnings-import";
import type { EarningBurdenRow, EarningRow } from "@/domain/models/earnings";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
  "66666666-6666-4666-8666-666666666666",
];

function idFactory() {
  let index = 0;
  return () => ids[index++];
}

describe("earnings import", () => {
  it("parses standard CSV into income sync payloads", () => {
    const preview = parseEarningsImportCsv(
      [
        "period,kind,type,amount,currency,fx_rate_to_pln,amount_pln,source",
        "2026-06,earning,employment,12500,PLN,1,12500,Wynagrodzenie",
        "2026-06,earning,business,2500,EUR,4.25,10625,Klient UE",
        "2026-06,burden,zus,1773.96,PLN,1,1773.96,ZUS",
      ].join("\n"),
      { earnings: [], burdens: [] },
      { idFactory: idFactory() },
    );

    expect(preview.format).toBe("standard");
    expect(preview.errorCount).toBe(0);
    expect(preview.insertCount).toBe(3);
    expect(preview.canImport).toBe(true);
    expect(preview.inserts[1].payload).toMatchObject({
      recordType: "income",
      entryKind: "earning",
      employmentType: "business",
      enteredAmount: 2500,
      currency: "EUR",
      fxRateToPLN: 4.25,
      plnAmount: 10625,
      source: "Klient UE",
    });
    expect(preview.inserts[2].payload).toMatchObject({
      entryKind: "burden",
      burdenCategory: "zus",
      amountPLN: 1773.96,
      note: "ZUS",
    });
  });

  it("accepts semicolon CSV with Polish decimal commas", () => {
    const preview = parseEarningsImportCsv(
      [
        "period;kind;type;amount;currency;fx_rate_to_pln;amount_pln;source",
        "2026-06;earning;employment;12500,50;PLN;1;12500,50;Etat",
      ].join("\n"),
      { earnings: [], burdens: [] },
      { idFactory: idFactory() },
    );

    expect(preview.errorCount).toBe(0);
    expect(preview.inserts[0].payload.plnAmount).toBe(12500.5);
  });

  it("blocks the whole import when conversion arithmetic is invalid", () => {
    const preview = parseEarningsImportCsv(
      [
        "period,kind,type,amount,currency,fx_rate_to_pln,amount_pln,source",
        "2026-06,earning,business,100,EUR,4.25,999,Klient UE",
        "2026-06,burden,zus,1000,PLN,1,1000,ZUS",
      ].join("\n"),
      { earnings: [], burdens: [] },
      { idFactory: idFactory() },
    );

    expect(preview.errorCount).toBe(1);
    expect(preview.insertCount).toBe(1);
    expect(preview.canImport).toBe(false);
  });

  it("reports unchanged rows and preserves the id for updates", () => {
    const existing: EarningRow = {
      id: ids[0],
      kind: "earning",
      year: 2026,
      month: 6,
      employmentType: "employment",
      enteredAmount: 12500,
      currency: "PLN",
      fxRateToPLN: 1,
      plnAmount: 12500,
      source: "Etat",
      note: null,
      sourceUpdatedAt: "2026-07-16T10:00:00.000Z",
    };
    const header = "period,kind,type,amount,currency,fx_rate_to_pln,amount_pln,source";
    const unchanged = parseEarningsImportCsv(
      `${header}\n2026-06,earning,employment,12500,PLN,1,12500,Etat`,
      { earnings: [existing], burdens: [] },
      { idFactory: idFactory() },
    );
    const changed = parseEarningsImportCsv(
      `${header}\n2026-06,earning,employment,13000,PLN,1,13000,Etat`,
      { earnings: [existing], burdens: [] },
      { idFactory: idFactory() },
    );

    expect(unchanged.unchangedCount).toBe(1);
    expect(unchanged.importCount).toBe(0);
    expect(changed.updateCount).toBe(1);
    expect(changed.updates[0]).toMatchObject({
      baseUpdatedAt: existing.sourceUpdatedAt,
      payload: { id: existing.id, plnAmount: 13000 },
    });
  });

  it("recognizes the historical monthly workbook layout", () => {
    const existingBurdens: EarningBurdenRow[] = [];
    const preview = parseEarningsImportTable(
      [
        ["Data", "Przychód PLN", "Przychód euro", "PIT", "VAT", "ZUS", "Inne", "Dochód PLN", "Dochód"],
        ["2020-10", 6533.84, 46, 0, 0, 362.64, 123, 6254.74, 6254.74],
      ],
      { earnings: [], burdens: existingBurdens },
      { idFactory: idFactory() },
    );

    expect(preview.format).toBe("legacyMonthlyWorkbook");
    expect(preview.errorCount).toBe(0);
    expect(preview.insertCount).toBe(4);
    expect(preview.inserts[1].payload).toMatchObject({
      currency: "EUR",
      fxRateToPLN: 4.49,
      plnAmount: 206.54,
    });
  });
});
