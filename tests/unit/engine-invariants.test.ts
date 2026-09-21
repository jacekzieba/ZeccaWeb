import { describe, expect, it } from "vitest";
import { buildGoldenRecords, type GoldenScenario } from "./helpers/native-golden";
import { Rng, randomBook, type BookOptions } from "./helpers/random-book";
import {
  buildInvestorDataSnapshot,
  buildPortfolioDetail,
} from "@/sync/records/investor-snapshot";

// Niezmienniki silnika wyceny na losowych, poprawnych księgach. Testy przykładowe
// (certyfikacja, fixtury) sprawdzają wybrane liczby; te sprawdzają WŁASNOŚCI, które
// muszą zachodzić dla każdej księgi — także tych, których nikt nie przewidział.
// Każdy przypadek ma seed w komunikacie, więc porażkę da się odtworzyć.

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

function run(scenario: GoldenScenario, shuffleSeed?: number) {
  const built = buildGoldenRecords(scenario);
  const records = [...built.records];
  if (shuffleSeed !== undefined) {
    const rng = new Rng(shuffleSeed);
    for (let i = records.length - 1; i > 0; i -= 1) {
      const j = rng.int(0, i);
      [records[i], records[j]] = [records[j], records[i]];
    }
  }
  const options = {
    asOf: built.asOf,
    fxRates: built.fxRates,
    cpi: built.cpi,
    metricsCpi: built.cpi,
    useMarketQuotes: true,
    historyGranularity: "daily" as const,
  };
  return {
    snapshot: buildInvestorDataSnapshot(records, { ...options, strict: true }),
    detail: buildPortfolioDetail(records, built.portfolioId, options)!,
    built,
  };
}

function forEachBook(options: BookOptions, check: (scenario: GoldenScenario, seed: number) => void) {
  for (const seed of SEEDS) {
    const scenario = randomBook(seed, options);
    try {
      check(scenario, seed);
    } catch (error) {
      (error as Error).message = `seed ${seed}: ${(error as Error).message}`;
      throw error;
    }
  }
}

/** Prosty, niezależny model księgi: gotówka per waluta, ilości i P/L FIFO w PLN. */
function reference(scenario: GoldenScenario) {
  const cash: Record<string, number> = {};
  const quantity: Record<string, number> = {};
  const lots: Record<string, { qty: number; cost: number }[]> = {};
  let realized = 0;
  let dividends = 0;
  const add = (currency: string, amount: number) => {
    cash[currency] = (cash[currency] ?? 0) + amount;
  };
  for (const t of scenario.transactions) {
    const fee = t.fees ?? 0;
    switch (t.type) {
      case "cashDeposit":
        add(t.currency, t.grossAmount);
        break;
      case "cashWithdrawal":
        add(t.currency, -t.grossAmount);
        break;
      case "fee":
      case "tax":
        add(t.currency, -t.grossAmount);
        break;
      case "dividend":
        add(t.currency, t.grossAmount - (t.taxes ?? 0));
        dividends += t.grossAmount;
        break;
      case "buy": {
        const symbol = t.instrumentSymbol!;
        add(t.currency, -(t.grossAmount + fee));
        quantity[symbol] = (quantity[symbol] ?? 0) + t.quantity!;
        // Koszt partii bez prowizji: zrealizowany i niezrealizowany P/L są „przed
        // kosztami” (prowizje i podatki liczone osobno) — tak samo jak natywnie.
        (lots[symbol] ??= []).push({ qty: t.quantity!, cost: t.grossAmount / t.quantity! });
        break;
      }
      case "sell": {
        const symbol = t.instrumentSymbol!;
        add(t.currency, t.grossAmount - fee);
        quantity[symbol] -= t.quantity!;
        let remaining = t.quantity!;
        let cost = 0;
        while (remaining > 1e-9) {
          const lot = lots[symbol][0];
          const take = Math.min(lot.qty, remaining);
          cost += take * lot.cost;
          lot.qty -= take;
          remaining -= take;
          if (lot.qty <= 1e-9) lots[symbol].shift();
        }
        realized += t.grossAmount - cost;
        break;
      }
    }
  }
  return { cash, quantity, realized, dividends };
}

describe("niezmienniki: księga i wycena", () => {
  it("gotówka, ilości i zrealizowany P/L zgadzają się z prostym modelem referencyjnym", () => {
    forEachBook({ dividends: true, costs: true }, (scenario) => {
      const { detail, snapshot } = run(scenario);
      const model = reference(scenario);
      for (const [currency, amount] of Object.entries(model.cash)) {
        const row = detail.cashBalances.find((b) => b.currency === currency);
        expect(row?.amount ?? 0, `gotówka ${currency}`).toBeCloseTo(amount, 2);
      }
      for (const [symbol, qty] of Object.entries(model.quantity)) {
        const holding = detail.holdings.find((h) => h.symbol === symbol);
        expect(holding?.quantity ?? 0, `ilość ${symbol}`).toBeCloseTo(qty, 6);
      }
      expect(snapshot.metrics.realizedPnl, "zrealizowany P/L").toBeCloseTo(model.realized, 2);
    });
  });

  it("wartość portfela = wartość pozycji + gotówka (także wielowalutowo)", () => {
    forEachBook({ foreign: true, costs: true, dividends: true }, (scenario) => {
      const { snapshot, detail } = run(scenario);
      const holdings = detail.holdings.reduce((sum, h) => sum + h.marketValue, 0);
      expect(snapshot.totalValue).toBeCloseTo(holdings + snapshot.cash, 2);
    });
  });

  it("wynik = zrealizowany + niezrealizowany + dywidendy (księga bez kosztów)", () => {
    forEachBook({ dividends: true }, (scenario) => {
      const { snapshot } = run(scenario);
      const m = snapshot.metrics;
      const gains = m.realizedPnl + m.unrealizedPnl + snapshot.cashflows.dividends;
      expect(snapshot.totalValue - m.netInvested).toBeCloseTo(gains, 2);
    });
  });

  it("wynik po kosztach = P/L przed kosztami + dywidendy − wszystkie opłaty", () => {
    forEachBook({ dividends: true, costs: true }, (scenario) => {
      const { snapshot } = run(scenario);
      const m = snapshot.metrics;
      // P/L jest przed prowizjami, więc odejmujemy wszystkie: pole `fees` transakcji
      // kupna/sprzedaży oraz osobne transakcje „opłata”.
      const fees = scenario.transactions.reduce(
        (sum, t) => sum + (t.fees ?? 0) + (t.type === "fee" ? t.grossAmount : 0),
        0,
      );
      expect(snapshot.cashflows.fees).toBeCloseTo(fees, 2);
      const gains = m.realizedPnl + m.unrealizedPnl + snapshot.cashflows.dividends - fees;
      expect(snapshot.totalValue - m.netInvested).toBeCloseTo(gains, 2);
    });
  });

  it("kolejność rekordów wejściowych nie zmienia wyniku", () => {
    forEachBook({ foreign: true, costs: true, dividends: true }, (scenario, seed) => {
      const base = run(scenario);
      const shuffled = run(scenario, seed);
      expect(shuffled.snapshot.totalValue).toBeCloseTo(base.snapshot.totalValue, 6);
      expect(shuffled.snapshot.metrics).toEqual(base.snapshot.metrics);
      expect(shuffled.snapshot.valuationSeries).toEqual(base.snapshot.valuationSeries);
    });
  });

  it("podział zakupu na dwa (ta sama cena, ten sam dzień) nie zmienia wyniku", () => {
    forEachBook({ dividends: true }, (scenario) => {
      const split: GoldenScenario = {
        ...scenario,
        transactions: scenario.transactions.flatMap((t) => {
          if (t.type !== "buy" || (t.quantity ?? 0) < 2) return [t];
          const first = Math.floor(t.quantity! / 2);
          const rest = t.quantity! - first;
          return [
            { ...t, quantity: first, grossAmount: Math.round(first * t.price! * 100) / 100 },
            { ...t, quantity: rest, grossAmount: Math.round(rest * t.price! * 100) / 100 },
          ];
        }),
      };
      const a = run(scenario).snapshot;
      const b = run(split).snapshot;
      expect(b.totalValue).toBeCloseTo(a.totalValue, 2);
      expect(b.metrics.realizedPnl).toBeCloseTo(a.metrics.realizedPnl, 2);
      expect(b.metrics.unrealizedPnl).toBeCloseTo(a.metrics.unrealizedPnl, 2);
      expect(b.metrics.totalReturnPct).toBeCloseTo(a.metrics.totalReturnPct, 4);
    });
  });

  it("wpłata w USD bez własnego kursu = ta sama wpłata z kursem NBP z dnia", () => {
    forEachBook({ foreign: true }, (scenario) => {
      const rates = new Map(scenario.fxHistory.USD.map((r) => [r.date, r.rate]));
      const explicit: GoldenScenario = {
        ...scenario,
        transactions: scenario.transactions.map((t) =>
          t.type === "cashDeposit" && t.currency === "USD"
            ? { ...t, fxRateToBase: rates.get(t.date)! }
            : t,
        ),
      };
      const stripped: GoldenScenario = {
        ...scenario,
        transactions: scenario.transactions.map((t) => {
          if (t.type !== "cashDeposit" || t.currency !== "USD") return t;
          const rest = { ...t };
          delete rest.fxRateToBase;
          return rest;
        }),
      };
      const a = run(explicit).snapshot;
      const b = run(stripped).snapshot;
      expect(b.metrics.netInvested).toBeCloseTo(a.metrics.netInvested, 6);
      expect(b.metrics.totalReturnPct).toBeCloseTo(a.metrics.totalReturnPct, 6);
      expect(b.metrics.xirrPct ?? 0).toBeCloseTo(a.metrics.xirrPct ?? 0, 6);
    });
  });

  // TWR przyjmuje wpłatę na POCZĄTKU dnia, więc gotówka wpłacona w dniu, w którym
  // cokolwiek zmienia wartość (ruch ceny, dywidenda, prowizja), rozcieńcza wynik tego
  // dnia — to konwencja, nie błąd. Ścisła neutralność zachodzi tylko w dniu bez zdarzeń,
  // dlatego dokładamy jeden nowy dzień z niezmienionymi cenami i wpłatę robimy w nim.
  it("wpłata gotówki w dniu bez zdarzeń nie zmienia TWR (jest przepływem zewnętrznym)", () => {
    forEachBook({ dividends: true }, (scenario) => {
      const lastBar = scenario.priceHistory.S1.at(-1)!;
      const nextDay = new Date(Date.parse(lastBar.date) + 86_400_000).toISOString().slice(0, 10);
      const extended: GoldenScenario = {
        ...scenario,
        asOf: nextDay,
        priceHistory: Object.fromEntries(
          Object.entries(scenario.priceHistory).map(([symbol, bars]) => [
            symbol,
            [...bars, { date: nextDay, close: bars.at(-1)!.close }],
          ]),
        ),
      };
      const extra: GoldenScenario = {
        ...extended,
        transactions: [
          ...extended.transactions,
          { date: nextDay, type: "cashDeposit", grossAmount: 7_000, currency: "PLN" },
        ],
      };
      const scenarioForA = extended;
      const a = run(scenarioForA).snapshot;
      const b = run(extra).snapshot;
      expect(b.totalValue).toBeCloseTo(a.totalValue + 7_000, 2);
      expect(b.metrics.netInvested).toBeCloseTo(a.metrics.netInvested + 7_000, 2);
      expect(b.metrics.totalReturnPct).toBeCloseTo(a.metrics.totalReturnPct, 4);
    });
  });
});

describe("niezmienniki: niezależny rachunek TWR", () => {
  // indeks_t = indeks_{t-1} · V_t / (V_{t-1} + przepływ_t); przepływ = wpłata/wypłata
  // przeliczona kursem NBP z tego dnia. Wartości dzienne bierzemy z serii silnika,
  // ale przepływy i wzór liczymy tutaj — błąd przeliczenia przepływów rozjeżdża wynik.
  it("TWR z serii dziennej i przepływów = totalReturnPct silnika (księgi wielowalutowe)", () => {
    forEachBook({ foreign: true, costs: true, dividends: true }, (scenario) => {
      const { snapshot } = run(scenario);
      const rates = new Map(scenario.fxHistory.USD.map((r) => [r.date, r.rate]));
      // Dzień liczymy w czasie lokalnym — tak jak silnik (transakcja o 00:00 UTC bywa
      // poprzednim dniem lokalnym).
      const dayOf = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const flowByDay = new Map<string, number>();
      for (const t of scenario.transactions) {
        if (t.type !== "cashDeposit" && t.type !== "cashWithdrawal") continue;
        const rate = t.currency === "PLN" ? 1 : rates.get(t.date)!;
        const sign = t.type === "cashDeposit" ? 1 : -1;
        const key = dayOf(`${t.date}T00:00:00.000Z`);
        flowByDay.set(key, (flowByDay.get(key) ?? 0) + sign * t.grossAmount * rate);
      }
      let index = 1;
      const series = snapshot.valuationSeries;
      for (let i = 1; i < series.length; i += 1) {
        const flow = flowByDay.get(dayOf(series[i].date)) ?? 0;
        index *= series[i].value / (series[i - 1].value + flow);
      }
      expect(snapshot.metrics.totalReturnPct).toBeCloseTo((index - 1) * 100, 4);
    });
  });
});

describe("niezmienniki: metryki wydajności w postaci zamkniętej", () => {
  // Jedna wpłata, jeden zakup „za całość”, brak innych przepływów:
  //   TWR  = V/D − 1                       (V — wartość końcowa, D — wpłata)
  //   XIRR = (V/D)^(365,25/N) − 1          (N — liczba dni od wpłaty)
  //   maks. obsunięcie = min po dniach z (V_t / szczyt_t − 1)
  it.each([11, 12, 13, 14, 15, 16, 17, 18])("zamknięta postać TWR/XIRR/drawdown, seed %i", (seed) => {
    const rng = new Rng(seed);
    const days = rng.int(40, 200);
    const price0 = rng.int(20, 90);
    const quantity = rng.int(10, 100);
    const deposit = quantity * price0;
    const path: number[] = [price0];
    for (let d = 1; d <= days; d += 1) {
      path.push(Math.max(5, Math.round(path[d - 1] * (1 + (rng.next() - 0.5) * 0.05) * 100) / 100));
    }
    const dayString = (d: number) => new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    const scenario: GoldenScenario = {
      asOf: dayString(days),
      portfolio: { name: "Zamknięta postać", type: "custom" },
      instruments: [{ symbol: "S1", kind: "stock", name: "S1", currency: "PLN", category: "equityPL" }],
      transactions: [
        { date: dayString(0), type: "cashDeposit", grossAmount: deposit, currency: "PLN" },
        { date: dayString(0), instrumentSymbol: "S1", type: "buy", quantity, price: price0, grossAmount: deposit, currency: "PLN" },
      ],
      latestPrices: {},
      previousPrices30d: {},
      latestFX: {},
      priceHistory: { S1: path.map((close, d) => ({ date: dayString(d), close })) },
      fxHistory: {},
      cpiHistory: [{ date: "2026-01-01", yoyRate: 3 }],
      expected: {},
      invalidTransactions: [],
    };
    const { snapshot } = run(scenario);
    const value = quantity * path[days];
    expect(snapshot.totalValue).toBeCloseTo(value, 2);
    expect(snapshot.metrics.totalReturnPct).toBeCloseTo((value / deposit - 1) * 100, 4);
    if (Math.abs(value - deposit) > 1e-6) {
      expect(snapshot.metrics.xirrPct!).toBeCloseTo(((value / deposit) ** (365.25 / days) - 1) * 100, 3);
    }
    let peak = -Infinity;
    let worst = 0;
    for (const price of path) {
      const v = quantity * price;
      peak = Math.max(peak, v);
      worst = Math.min(worst, (v / peak - 1) * 100);
    }
    expect(snapshot.metrics.maxDrawdownPct).toBeCloseTo(worst, 4);
  });
});
