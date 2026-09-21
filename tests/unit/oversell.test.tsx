import { describe, expect, it } from "vitest";
import { findOversells, oversellMessage, type OversellInput } from "@/domain/ledger/oversell";
import { buildGoldenRecords, type GoldenScenario } from "./helpers/native-golden";
import { randomBook } from "./helpers/random-book";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { render, screen } from "@testing-library/react";
import { DataQualityBanner } from "@/features/sync/data-quality-banner";
import { oversellInputsFromRecords, oversellWarningForCandidate, payloadDateMs, toOversellInput } from "@/sync/records/oversell-check";
import { makeRecord } from "./helpers/records";

// Sprzedaż ponad stan: silnik web odcina ją do posiadanych sztuk i księguje wpływ tylko za
// nie. `findOversells` wskazuje takie zdarzenia (ostrzeżenie), a diagnostyka snapshotu
// pokazuje je w banerze jakości danych.

const P = "p1";
const I = "i1";
let n = 0;
const tx = (transactionType: string, day: number, quantity: number | null, extra: Partial<OversellInput> = {}): OversellInput => ({
  id: `t${(n += 1)}`,
  portfolioID: P,
  instrumentID: I,
  transactionType,
  quantity,
  price: 100,
  dateMs: Date.UTC(2026, 0, day),
  ...extra,
});

describe("findOversells", () => {
  it("sprzedaż w granicach stanu nie jest zdarzeniem", () => {
    expect(findOversells([tx("buy", 1, 10), tx("sell", 2, 10)])).toEqual([]);
    expect(findOversells([tx("buy", 1, 5), tx("buy", 2, 5), tx("sell", 3, 7), tx("sell", 4, 3)])).toEqual([]);
  });

  it("sprzedaż ponad stan: ilość żądana i dostępna", () => {
    const [a, b] = [tx("buy", 1, 5), tx("sell", 2, 10)];
    expect(findOversells([a, b])).toEqual([{ id: b.id, portfolioID: P, instrumentID: I, requested: 10, available: 5 }]);
  });

  it("kolejność wejścia nie ma znaczenia, liczy się data", () => {
    const buy = tx("buy", 1, 5);
    const sell = tx("sell", 2, 5);
    expect(findOversells([sell, buy])).toEqual([]);
  });

  it("kupno po dacie sprzedaży jej nie pokrywa", () => {
    const sell = tx("sell", 1, 5);
    expect(findOversells([sell, tx("buy", 2, 5)]).map((i) => i.id)).toEqual([sell.id]);
  });

  it("po zdarzeniu stan zerowany: kolejne sprzedaże nie dziedziczą długu", () => {
    const [buy, s1, s2] = [tx("buy", 1, 5), tx("sell", 2, 8), tx("sell", 3, 1)];
    const issues = findOversells([buy, s1, s2]);
    expect(issues.map((i) => i.id)).toEqual([s1.id, s2.id]);
    expect(issues[1]).toMatchObject({ requested: 1, available: 0 });
  });

  it("pozycje liczone osobno per portfel i instrument", () => {
    const other = tx("sell", 2, 1, { portfolioID: "p2" });
    const otherInstrument = tx("sell", 2, 1, { instrumentID: "i2" });
    expect(findOversells([tx("buy", 1, 10), other, otherInstrument]).map((i) => i.id)).toEqual([other.id, otherInstrument.id]);
  });

  it("wykup obligacji i zamknięcie lokaty zmniejszają stan; lokata = 1 szt.", () => {
    expect(findOversells([tx("buy", 1, 3), tx("bondRedemption", 2, 5, { price: null })]).length).toBe(1);
    expect(findOversells([tx("depositOpen", 1, null), tx("depositClose", 2, null)])).toEqual([]);
    expect(findOversells([tx("depositClose", 2, null)]).length).toBe(1);
  });

  it("transfer instrumentu (asset) zwiększa stan; ilość z partii ma pierwszeństwo", () => {
    const transfer = tx("accountTransferIn", 1, 1, { transferKind: "asset", transferLotQuantity: 5 });
    expect(findOversells([transfer, tx("sell", 2, 5)])).toEqual([]);
    expect(findOversells([transfer, tx("sell", 2, 6)]).length).toBe(1);
    const cash = tx("accountTransferIn", 1, 5, { transferKind: "cash" });
    expect(findOversells([cash, tx("sell", 2, 1)]).length).toBe(1);
  });

  it("zapisy pomijane przez księgę (bez instrumentu, ilości lub ceny) nie zmieniają stanu", () => {
    const noPrice = tx("buy", 1, 10, { price: null });
    const noQty = tx("buy", 1, null);
    const noInstrument = tx("buy", 1, 10, { instrumentID: null });
    expect(findOversells([noPrice, noQty, noInstrument, tx("sell", 2, 1)]).length).toBe(1);
  });

  it("tolerancja zmiennoprzecinkowa: 0,1 + 0,2 pokrywa 0,3", () => {
    expect(findOversells([tx("buy", 1, 0.1), tx("buy", 1, 0.2), tx("sell", 2, 0.3)])).toEqual([]);
  });

  it("komunikat zawiera obie liczby i mówi, co się stanie", () => {
    const text = oversellMessage({ requested: 10, available: 5 });
    expect(text).toContain("10 szt.");
    expect(text).toContain("5");
    expect(text).toContain("pominięta");
  });
});

describe("sprzedaż ponad stan a silnik", () => {
  const scenario = (sellQty: number): GoldenScenario => ({
    asOf: "2026-03-01",
    portfolio: { name: "T", type: "custom" },
    instruments: [{ symbol: "AAA", kind: "stock", name: "AAA", currency: "PLN", category: "equityPL" }],
    transactions: [
      { date: "2026-01-02", type: "cashDeposit", grossAmount: 10000, currency: "PLN" },
      { date: "2026-01-05", instrumentSymbol: "AAA", type: "buy", quantity: 5, price: 100, grossAmount: 500, currency: "PLN" },
      { date: "2026-02-01", instrumentSymbol: "AAA", type: "sell", quantity: sellQty, price: 120, grossAmount: sellQty * 120, currency: "PLN" },
    ],
    latestPrices: {}, previousPrices30d: {}, latestFX: {},
    priceHistory: { AAA: [{ date: "2026-01-05", close: 100 }, { date: "2026-02-01", close: 120 }, { date: "2026-03-01", close: 130 }] },
    fxHistory: {}, cpiHistory: [{ date: "2026-01-01", yoyRate: 3 }], expected: {}, invalidTransactions: [],
  });
  const run = (sc: GoldenScenario) => {
    const b = buildGoldenRecords(sc);
    return buildInvestorDataSnapshot(b.records, { asOf: b.asOf, fxRates: b.fxRates, cpi: b.cpi, useMarketQuotes: true, historyGranularity: "daily" });
  };

  it("diagnostyka wskazuje instrument, a silnik faktycznie księguje tylko posiadane sztuki", () => {
    const snapshot = run(scenario(10));
    expect(snapshot.diagnostics).toContainEqual({ code: "oversell", severity: "warning", context: "AAA" });
    // 10 000 − 500 (kupno) + 5·120 (tylko posiadane), nie 1 200: to jest to, przed czym ostrzegamy.
    expect(snapshot.cash).toBeCloseTo(10_100, 2);
  });

  it("sprzedaż w granicach stanu nie daje diagnostyki", () => {
    expect((run(scenario(5)).diagnostics ?? []).some((d) => d.code === "oversell")).toBe(false);
  });

  it("poprawne losowe księgi nigdy nie dają diagnostyki (brak fałszywych alarmów)", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const snapshot = run(randomBook(seed, { foreign: true, costs: true, dividends: true }));
      expect((snapshot.diagnostics ?? []).some((d) => d.code === "oversell"), `seed ${seed}`).toBe(false);
    }
  });

  it("dokładając sprzedaż ponad stan do losowej księgi, diagnostyka ją wykrywa", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const book = randomBook(seed, { dividends: true });
      const last = book.priceHistory.S1.at(-1)!;
      const withOversell: GoldenScenario = {
        ...book,
        transactions: [...book.transactions, { date: last.date, instrumentSymbol: "S1", type: "sell", quantity: 100_000, price: last.close, grossAmount: 100_000 * last.close, currency: "PLN" }],
      };
      expect((run(withOversell).diagnostics ?? []).some((d) => d.code === "oversell" && d.context === "S1"), `seed ${seed}`).toBe(true);
    }
  });
});

describe("baner jakości danych", () => {
  it("pokazuje linię o sprzedaży ponad stan z symbolem instrumentu", () => {
    render(<DataQualityBanner diagnostics={[{ code: "oversell", severity: "warning", context: "AAA" }]} />);
    expect(screen.getByText(/Sprzedaż ponad stan/).textContent).toContain("AAA");
  });
});

describe("adapter rekordów synchronizacji", () => {
  const txRecord = (id: string, payload: Record<string, unknown>, deletedAt: string | null = null) => ({
    ...makeRecord("transaction", id, { portfolioID: P, instrumentID: I, price: 100, ...payload }),
    deletedAt,
  });
  const buy10 = txRecord("b1", { transactionType: "buy", quantity: 10, date: "2026-01-01T00:00:00.000Z" });
  const sell10 = txRecord("s1", { transactionType: "sell", quantity: 10, date: "2026-01-02T00:00:00.000Z" });

  it("pomija usunięte rekordy i rekordy innych typów", () => {
    const records = [
      buy10,
      txRecord("b2", { transactionType: "buy", quantity: 99, date: "2026-01-01T00:00:00.000Z" }, "2026-02-01T00:00:00.000Z"),
      makeRecord("account", "a1", { name: "x" }),
      makeRecord("asset", "as1", { symbol: "X" }),
    ];
    expect(oversellInputsFromRecords(records).map((i) => i.id)).toEqual(["b1"]);
  });

  it("usunięte kupno nie daje stanu", () => {
    const deletedBuy = txRecord("b2", { transactionType: "buy", quantity: 10, date: "2026-01-01T00:00:00.000Z" }, "2026-02-01T00:00:00.000Z");
    const candidate = toOversellInput({ id: "c", date: "2026-01-02T00:00:00.000Z", portfolioID: P, instrumentID: I, transactionType: "sell", quantity: 1, price: 1 }, "c")!;
    expect(oversellWarningForCandidate(oversellInputsFromRecords([deletedBuy]), candidate)).toContain("dostępne 0");
  });

  it("edytowana transakcja jest wyłączona z istniejących (nie liczy się dwa razy)", () => {
    const edit = toOversellInput({ id: "s1", date: "2026-01-02T00:00:00.000Z", portfolioID: P, instrumentID: I, transactionType: "sell", quantity: 10, price: 100 }, "s1")!;
    const records = [buy10, sell10];
    expect(oversellWarningForCandidate(oversellInputsFromRecords(records, new Set(["s1"])), edit)).toBeNull();
    // bez wyłączenia ta sama sprzedaż byłaby policzona podwójnie
    expect(oversellWarningForCandidate(oversellInputsFromRecords(records), edit)).toContain("Sprzedaż 10 szt., a dostępne 0");
  });

  it("payloadDateMs: liczba = sekundy od 2001, tekst = ISO, reszta = null", () => {
    expect(payloadDateMs(0)).toBe(Date.UTC(2001, 0, 1));
    expect(payloadDateMs(86_400)).toBe(Date.UTC(2001, 0, 2));
    expect(payloadDateMs("2026-03-04T05:06:07.000Z")).toBe(Date.UTC(2026, 2, 4, 5, 6, 7));
    for (const bad of ["nie data", "", null, undefined, {}, Number.NaN]) expect(payloadDateMs(bad)).toBeNull();
  });

  it("toOversellInput: brak daty, portfela lub typu → null; ilość z partii transferu sumuje się", () => {
    const base = { date: "2026-01-01T00:00:00.000Z", portfolioID: P, transactionType: "buy" };
    expect(toOversellInput({ ...base, date: "zła" }, "x")).toBeNull();
    expect(toOversellInput({ ...base, portfolioID: null }, "x")).toBeNull();
    expect(toOversellInput({ ...base, transactionType: null }, "x")).toBeNull();
    const withLots = toOversellInput({ ...base, transferLots: [{ quantity: 2 }, { quantity: 3 }] }, "x")!;
    expect(withLots.transferLotQuantity).toBe(5);
    expect(withLots.id).toBe("x");
    expect(toOversellInput({ ...base, id: "own" }, "x")!.id).toBe("own");
  });
});
