import type { GoldenScenario, GoldenTransaction } from "./native-golden";

// Generator losowych, POPRAWNYCH ksiąg (bez sprzedaży ponad stan i wypłat ponad
// gotówkę) do testów niezmienników. Deterministyczny: ten sam seed → ta sama księga.

export class Rng {
  private state: bigint;
  constructor(seed: number) {
    this.state = BigInt(seed) * 0x9e3779b97f4a7c15n + 1n;
  }
  next(): number {
    const mask = (1n << 64n) - 1n;
    this.state = (this.state + 0x9e3779b97f4a7c15n) & mask;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & mask;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & mask;
    return Number((z ^ (z >> 31n)) >> 11n) / 2 ** 53;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

const DAY = 86_400_000;
const START = Date.UTC(2026, 0, 1);
const day = (offset: number) => new Date(START + offset * DAY).toISOString().slice(0, 10);

export type BookOptions = {
  days?: number;
  /** Wpłaty i zakupy w USD (z historią kursu NBP). */
  foreign?: boolean;
  /** Prowizje, podatki i osobne transakcje fee/tax. */
  costs?: boolean;
  /** Dywidendy od posiadanych akcji. */
  dividends?: boolean;
};

export function randomBook(seed: number, options: BookOptions = {}): GoldenScenario {
  const rng = new Rng(seed);
  const days = options.days ?? 90;
  const symbols = ["S1", "S2", "S3"];
  const instruments: GoldenScenario["instruments"] = symbols.map((symbol) => ({
    symbol,
    kind: "stock",
    name: symbol,
    currency: "PLN",
    category: "equityPL",
  }));
  if (options.foreign) {
    instruments.push({ symbol: "U1", kind: "etf", name: "U1", currency: "USD", category: "equityForeign" });
  }

  // Ceny dzienne (błądzenie losowe) i kurs USD/PLN.
  const priceHistory: GoldenScenario["priceHistory"] = {};
  const priceOn: Record<string, number[]> = {};
  for (const item of instruments) {
    let price = rng.int(20, 200);
    priceOn[item.symbol] = [];
    priceHistory[item.symbol] = [];
    for (let d = 0; d <= days; d += 1) {
      price = Math.max(5, Math.round((price * (1 + (rng.next() - 0.5) * 0.06)) * 100) / 100);
      priceOn[item.symbol].push(price);
      priceHistory[item.symbol].push({ date: day(d), close: price });
    }
  }
  const usd: number[] = [];
  const fxHistory: GoldenScenario["fxHistory"] = {};
  if (options.foreign) {
    let rate = 3.9 + rng.next() * 0.4;
    fxHistory.USD = [];
    for (let d = 0; d <= days; d += 1) {
      rate = Math.round((rate * (1 + (rng.next() - 0.5) * 0.01)) * 10_000) / 10_000;
      usd.push(rate);
      fxHistory.USD.push({ date: day(d), rate });
    }
  }

  const transactions: GoldenTransaction[] = [];
  const cash = { PLN: 0, USD: 0 };
  const held: Record<string, number> = {};
  const push = (t: GoldenTransaction) => transactions.push(t);

  push({ date: day(0), type: "cashDeposit", grossAmount: rng.int(5, 20) * 1000, currency: "PLN" });
  cash.PLN += transactions[0].grossAmount;

  for (let d = 1; d <= days; d += 1) {
    if (!rng.chance(0.25)) continue;
    const roll = rng.next();
    if (roll < 0.15) {
      const amount = rng.int(1, 5) * 1000;
      push({ date: day(d), type: "cashDeposit", grossAmount: amount, currency: "PLN" });
      cash.PLN += amount;
    } else if (roll < 0.22 && options.foreign) {
      const amount = rng.int(1, 5) * 100;
      // co druga wpłata w USD bez własnego kursu — silnik musi użyć kursu NBP z dnia
      const own = rng.chance(0.5);
      push({
        date: day(d),
        type: "cashDeposit",
        grossAmount: amount,
        currency: "USD",
        ...(own ? { fxRateToBase: usd[d] } : {}),
      });
      cash.USD += amount;
    } else if (roll < 0.62) {
      const symbol = rng.pick(instruments.map((i) => i.symbol).filter((s) => s !== "U1" || options.foreign));
      const isUsd = symbol === "U1";
      const price = priceOn[symbol][d];
      const quantity = rng.int(1, 8);
      const gross = Math.round(quantity * price * 100) / 100;
      const fee = options.costs ? Math.round(gross * 0.002 * 100) / 100 : 0;
      const wallet = isUsd ? "USD" : "PLN";
      if (cash[wallet] < gross + fee) continue;
      cash[wallet] -= gross + fee;
      held[symbol] = (held[symbol] ?? 0) + quantity;
      push({
        date: day(d),
        instrumentSymbol: symbol,
        type: "buy",
        quantity,
        price,
        grossAmount: gross,
        currency: wallet,
        fees: fee,
        ...(isUsd ? { fxRateToBase: usd[d] } : {}),
      });
    } else if (roll < 0.82) {
      const owned = Object.keys(held).filter((s) => held[s] > 0);
      if (owned.length === 0) continue;
      const symbol = rng.pick(owned);
      const isUsd = symbol === "U1";
      const quantity = rng.int(1, held[symbol]);
      const price = priceOn[symbol][d];
      const gross = Math.round(quantity * price * 100) / 100;
      const fee = options.costs ? Math.round(gross * 0.002 * 100) / 100 : 0;
      const wallet = isUsd ? "USD" : "PLN";
      held[symbol] -= quantity;
      cash[wallet] += gross - fee;
      push({
        date: day(d),
        instrumentSymbol: symbol,
        type: "sell",
        quantity,
        price,
        grossAmount: gross,
        currency: wallet,
        fees: fee,
        ...(isUsd ? { fxRateToBase: usd[d] } : {}),
      });
    } else if (roll < 0.9 && options.dividends) {
      const owned = Object.keys(held).filter((s) => held[s] > 0 && s !== "U1");
      if (owned.length === 0) continue;
      const amount = rng.int(5, 60);
      cash.PLN += amount;
      push({ date: day(d), instrumentSymbol: rng.pick(owned), type: "dividend", grossAmount: amount, currency: "PLN" });
    } else if (roll < 0.95 && cash.PLN > 600) {
      const amount = rng.int(1, 5) * 100;
      cash.PLN -= amount;
      push({ date: day(d), type: "cashWithdrawal", grossAmount: amount, currency: "PLN" });
    } else if (options.costs && cash.PLN > 100) {
      const amount = rng.int(1, 20);
      cash.PLN -= amount;
      push({ date: day(d), type: "fee", grossAmount: amount, currency: "PLN" });
    }
  }

  return {
    asOf: day(days),
    portfolio: { name: `Losowy ${seed}`, type: "custom" },
    instruments,
    transactions,
    latestPrices: {},
    previousPrices30d: {},
    latestFX: {},
    priceHistory,
    fxHistory,
    cpiHistory: [{ date: "2026-01-01", yoyRate: 3 }],
    expected: {},
    invalidTransactions: [],
  };
}
