"use client";

import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

export const fakeUserDataKeyPromise = crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"],
);

const accountID = "11111111-1111-4111-8111-111111111111";
const instrumentID = "22222222-2222-4222-8222-222222222222";
const ikzeID = "11111111-1111-4111-8111-111111111112";
const taxableID = "11111111-1111-4111-8111-111111111113";

const vwceID = "22222222-2222-4222-8222-222222222223";
const pkoID = "22222222-2222-4222-8222-222222222224";
const edoID = "22222222-2222-4222-8222-222222222225";
const btcID = "22222222-2222-4222-8222-222222222226";
const depositID = "22222222-2222-4222-8222-222222222227";

let generatedID = 0;

function nextID() {
  generatedID += 1;
  return `90000000-0000-4000-8000-${String(generatedID).padStart(12, "0")}`;
}

function record(
  type: RecordType,
  id: string,
  payload: unknown,
  updatedAt = "2026-05-15T10:00:00.000Z",
): DecryptedRecord {
  return {
    id,
    deviceId: "fake-sync",
    updatedAt,
    deletedAt: null,
    envelope: {
      type,
      payloadVersion: 1,
      schemaVersion: 1,
      payload,
    },
  };
}

export function buildFakeSyncRecords(): DecryptedRecord[] {
  generatedID = 0;
  const records: DecryptedRecord[] = [
    record("account", accountID, {
      recordType: "account",
      id: accountID,
      name: "IKE · długi termin",
      accountType: "ike",
      baseCurrency: "PLN",
      colorHex: "#2F6B55",
    }),
    record("account", ikzeID, {
      recordType: "account",
      id: ikzeID,
      name: "IKZE · emerytura",
      accountType: "ikze",
      baseCurrency: "PLN",
      colorHex: "#34699A",
    }),
    record("account", taxableID, {
      recordType: "account",
      id: taxableID,
      name: "Portfel główny",
      accountType: "taxable",
      baseCurrency: "PLN",
      colorHex: "#B7791F",
    }),
    record("asset", instrumentID, {
      recordType: "asset",
      id: instrumentID,
      kind: "stock",
      symbol: "AAPL",
      name: "Apple",
      currency: "USD",
      category: "equity",
      marketDataID: "AAPL",
    }),
    record("asset", vwceID, {
      recordType: "asset",
      id: vwceID,
      kind: "etf",
      symbol: "VWCE.DE",
      name: "Vanguard FTSE All-World UCITS ETF",
      currency: "EUR",
      category: "equity",
      marketDataID: "VWCE.DE",
    }),
    record("asset", pkoID, {
      recordType: "asset",
      id: pkoID,
      kind: "stock",
      symbol: "PKO",
      name: "PKO Bank Polski",
      currency: "PLN",
      category: "equity",
    }),
    record("asset", edoID, {
      recordType: "asset",
      id: edoID,
      kind: "treasuryBond",
      symbol: "EDO0435",
      name: "Obligacje skarbowe EDO 10-letnie",
      currency: "PLN",
      category: "bonds",
    }),
    record("asset", btcID, {
      recordType: "asset",
      id: btcID,
      kind: "crypto",
      symbol: "BTC",
      name: "Bitcoin",
      currency: "USD",
      category: "crypto",
      marketDataID: "bitcoin",
    }),
    record("asset", depositID, {
      recordType: "asset",
      id: depositID,
      kind: "deposit",
      symbol: "LOKATA-6M",
      name: "Lokata terminowa 6M",
      currency: "PLN",
      category: "deposit",
    }),
    record("transaction", "33333333-3333-4333-8333-333333333333", {
      recordType: "transaction",
      id: "33333333-3333-4333-8333-333333333333",
      date: "2024-01-05T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID: null,
      transactionType: "cashDeposit",
      quantity: null,
      price: null,
      grossAmount: 70_000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
    record("transaction", "44444444-4444-4444-8444-444444444444", {
      recordType: "transaction",
      id: "44444444-4444-4444-8444-444444444444",
      date: "2024-01-12T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID,
      transactionType: "buy",
      quantity: 18,
      price: 185,
      grossAmount: 3_330,
      currency: "USD",
      fees: 6,
      taxes: 0,
      fxRateToBase: 4.02,
    }),
  ];

  const addTransaction = (input: {
    date: string;
    portfolioID: string;
    instrumentID?: string;
    transactionType: string;
    quantity?: number;
    price?: number;
    grossAmount: number;
    currency: string;
    fees?: number;
    taxes?: number;
    fxRateToBase?: number;
    notes?: string;
  }) => {
    const id = nextID();
    records.push(record("transaction", id, {
      recordType: "transaction",
      id,
      date: input.date,
      portfolioID: input.portfolioID,
      instrumentID: input.instrumentID ?? null,
      transactionType: input.transactionType,
      quantity: input.quantity ?? null,
      price: input.price ?? null,
      grossAmount: input.grossAmount,
      currency: input.currency,
      fees: input.fees ?? 0,
      taxes: input.taxes ?? 0,
      fxRateToBase: input.fxRateToBase ?? null,
      notes: input.notes ?? "Dane demonstracyjne",
    }));
  };

  addTransaction({ date: "2024-02-01T10:00:00.000Z", portfolioID: ikzeID, transactionType: "cashDeposit", grossAmount: 45_000, currency: "PLN" });
  addTransaction({ date: "2024-03-01T10:00:00.000Z", portfolioID: taxableID, transactionType: "cashDeposit", grossAmount: 85_000, currency: "PLN" });
  addTransaction({ date: "2024-02-08T10:00:00.000Z", portfolioID: accountID, instrumentID: vwceID, transactionType: "buy", quantity: 105, price: 112, grossAmount: 11_760, currency: "EUR", fees: 8, fxRateToBase: 4.34 });
  addTransaction({ date: "2024-02-12T10:00:00.000Z", portfolioID: ikzeID, instrumentID: pkoID, transactionType: "buy", quantity: 420, price: 47.5, grossAmount: 19_950, currency: "PLN", fees: 7 });
  addTransaction({ date: "2024-03-08T10:00:00.000Z", portfolioID: ikzeID, instrumentID: edoID, transactionType: "buy", quantity: 160, price: 100, grossAmount: 16_000, currency: "PLN" });
  addTransaction({ date: "2024-03-15T10:00:00.000Z", portfolioID: taxableID, instrumentID: btcID, transactionType: "buy", quantity: 0.18, price: 68_000, grossAmount: 12_240, currency: "USD", fees: 18, fxRateToBase: 3.96 });
  addTransaction({ date: "2024-04-02T10:00:00.000Z", portfolioID: taxableID, instrumentID: depositID, transactionType: "depositOpen", quantity: 1, price: 25_000, grossAmount: 25_000, currency: "PLN" });
  addTransaction({ date: "2025-02-10T10:00:00.000Z", portfolioID: accountID, transactionType: "cashDeposit", grossAmount: 18_000, currency: "PLN" });
  addTransaction({ date: "2025-02-12T10:00:00.000Z", portfolioID: accountID, instrumentID: vwceID, transactionType: "buy", quantity: 30, price: 131, grossAmount: 3_930, currency: "EUR", fees: 5, fxRateToBase: 4.19 });
  addTransaction({ date: "2025-05-20T10:00:00.000Z", portfolioID: ikzeID, instrumentID: pkoID, transactionType: "dividend", grossAmount: 756, currency: "PLN", taxes: 0, notes: "Dywidenda PKO" });
  addTransaction({ date: "2025-08-12T10:00:00.000Z", portfolioID: accountID, instrumentID, transactionType: "dividend", grossAmount: 46, currency: "USD", taxes: 7, fxRateToBase: 3.88, notes: "Dywidenda Apple" });
  addTransaction({ date: "2025-11-03T10:00:00.000Z", portfolioID: ikzeID, instrumentID: edoID, transactionType: "interest", grossAmount: 1_040, currency: "PLN", notes: "Odsetki od obligacji" });
  addTransaction({ date: "2026-01-08T10:00:00.000Z", portfolioID: taxableID, transactionType: "cashDeposit", grossAmount: 12_000, currency: "PLN" });
  addTransaction({ date: "2026-01-12T10:00:00.000Z", portfolioID: taxableID, instrumentID, transactionType: "buy", quantity: 8, price: 224, grossAmount: 1_792, currency: "USD", fees: 4, fxRateToBase: 4.05 });
  addTransaction({ date: "2026-03-18T10:00:00.000Z", portfolioID: taxableID, instrumentID: btcID, transactionType: "sell", quantity: 0.03, price: 91_000, grossAmount: 2_730, currency: "USD", fees: 9, taxes: 0, fxRateToBase: 3.91 });

  const valuationDates = [
    ["2024-06-30", [205, 118, 56, 104, 62_000, 25_650]],
    ["2024-12-31", [250, 126, 59, 108, 74_000, 26_150]],
    ["2025-06-30", [212, 135, 71, 113, 84_000, 26_720]],
    ["2025-12-31", [272, 142, 83, 119, 96_000, 27_260]],
    ["2026-03-31", [258, 149, 79, 122, 91_000, 27_680]],
    ["2026-06-15", [286, 154, 86, 126, 104_000, 28_120]],
  ] as const;
  const pricedAssets = [
    [instrumentID, "USD"], [vwceID, "EUR"], [pkoID, "PLN"],
    [edoID, "PLN"], [btcID, "USD"], [depositID, "PLN"],
  ] as const;

  for (const [date, prices] of valuationDates) {
    pricedAssets.forEach(([assetID, currency], index) => {
      const id = nextID();
      records.push(record("manualValuation", id, {
        recordType: "manualValuation",
        id,
        instrumentID: assetID,
        date: `${date}T00:00:00.000Z`,
        value: prices[index],
        currency,
        note: "Wycena demonstracyjna",
      }, `${date}T12:00:00.000Z`));
    });
  }

  for (let monthOffset = 0; monthOffset < 18; monthOffset += 1) {
    const date = new Date(Date.UTC(2025, monthOffset, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const salary = 11_800 + monthOffset * 95;
    const earningID = nextID();
    records.push(record("income", earningID, {
      recordType: "income", id: earningID, entryKind: "earning", year, month,
      employmentType: "employment", enteredAmount: salary, currency: "PLN",
      fxRateToPLN: 1, plnAmount: salary, source: "Wynagrodzenie", burdenCategory: null,
      amountPLN: null, note: "Dane demonstracyjne",
    }));
    const burdenID = nextID();
    records.push(record("income", burdenID, {
      recordType: "income", id: burdenID, entryKind: "burden", year, month,
      employmentType: null, enteredAmount: null, currency: null, fxRateToPLN: null,
      plnAmount: null, source: null, burdenCategory: "tax", amountPLN: 1_650 + monthOffset * 12,
      note: "Podatek i składki",
    }));
  }

  records.push(
    record("income", "66666666-6666-4666-8666-666666666666", {
      recordType: "income", id: "66666666-6666-4666-8666-666666666666",
      entryKind: "earning", year: 2026, month: 4, employmentType: "employment",
      enteredAmount: 8_900, currency: "PLN", fxRateToPLN: 1, plnAmount: 8_900,
      source: "Wynagrodzenie", burdenCategory: null, amountPLN: null, note: "fake sync",
    }),
    record("income", "77777777-7777-4777-8777-777777777777", {
      recordType: "income", id: "77777777-7777-4777-8777-777777777777",
      entryKind: "earning", year: 2026, month: 4, employmentType: "business",
      enteredAmount: 2_000, currency: "EUR", fxRateToPLN: 4.35, plnAmount: 8_700,
      source: "Faktura miesięczna", burdenCategory: null, amountPLN: null, note: "fake sync",
    }),
    record("income", "88888888-8888-4888-8888-888888888888", {
      recordType: "income", id: "88888888-8888-4888-8888-888888888888",
      entryKind: "burden", year: 2026, month: 4, employmentType: null,
      enteredAmount: null, currency: null, fxRateToPLN: null, plnAmount: null,
      source: null, burdenCategory: "zus", amountPLN: 1_830, note: "fake sync",
    }),
  );

  const settingsID = nextID();
  records.push(record("settings", settingsID, {
    recordType: "settings", id: settingsID, syncMode: "none", baseCurrency: "PLN",
    telemetryEnabled: false, hasAcknowledgedPrivacyDisclosure: true,
    inflationRate: 3.7, appLanguage: "pl", updatedAt: "2026-06-15T12:00:00.000Z",
  }));

  return records;
}

export function buildFakeManualValuationRecord(input: {
  instrumentID: string;
  date: string;
  value: number;
  currency: string;
}): DecryptedRecord {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  return record(
    "manualValuation",
    id,
    {
      recordType: "manualValuation",
      id,
      instrumentID: input.instrumentID,
      date: input.date,
      value: input.value,
      currency: input.currency,
    },
    now,
  );
}
