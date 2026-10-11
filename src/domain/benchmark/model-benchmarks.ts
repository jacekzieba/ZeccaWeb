export type ModelBenchmarkParams = {
  id: string;
  name: string;
  author: string;
  /** Assumed annual return, not a historical quote. */
  cagr: number;
  /** Assumed annual volatility. */
  vol: number;
  seed: number;
};

/** Model portfolios with assumed return and volatility. These are simulations, not market history. */
export const MODEL_BENCHMARKS: ModelBenchmarkParams[] = [
  { id: "allweather", name: "All Weather", author: "Ray Dalio", cagr: 0.07, vol: 0.075, seed: 71 },
  { id: "6040", name: "60 / 40", author: "Klasyczny", cagr: 0.088, vol: 0.11, seed: 33 },
  { id: "permanent", name: "Permanent", author: "Harry Browne", cagr: 0.062, vol: 0.065, seed: 52 },
  { id: "sp500", name: "S&P 500", author: "100% akcje", cagr: 0.135, vol: 0.17, seed: 19 },
];

export type GrowthSeries = {
  labels: string[];
  growth: number[];
  returns: number[];
};

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(random: () => number) {
  return (random() + random() + random() + random() - 2) / 0.577;
}

export function buildBenchmarkSeries(benchmark: Pick<ModelBenchmarkParams, "cagr" | "vol" | "seed">, length: number): GrowthSeries {
  const n = Math.max(2, length);
  const years = (n - 1) / 12;
  const target = Math.pow(1 + benchmark.cagr, years) - 1;
  const monthlyVol = benchmark.vol / Math.sqrt(12);
  const random = rng(benchmark.seed);
  let noise = Array.from({ length: n - 1 }, () => gauss(random));
  const mean = noise.reduce((sum, value) => sum + value, 0) / noise.length;
  noise = noise.map((value) => (value - mean) * monthlyVol);
  const drift = (Math.log(1 + target) - noise.reduce((sum, value) => sum + value, 0)) / noise.length;
  const growth = [100];
  const returns: number[] = [];

  for (const item of noise) {
    const previous = growth.at(-1) ?? 100;
    const next = previous * Math.exp(drift + item);
    returns.push(next / previous - 1);
    growth.push(next);
  }

  return { labels: [], growth, returns };
}

// Collapse a (possibly daily) series to one point per calendar month, keeping
// the last value of each month — so the portfolio aligns with the monthly
// benchmark models below.
export function toMonthly(series: { label: string; value: number; date: string }[]) {
  const byMonth = new Map<string, { label: string; value: number; date: string }>();
  for (const point of series) {
    const d = new Date(point.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    byMonth.set(key, point); // later points overwrite → keeps month's last value
  }
  return [...byMonth.values()].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

// Build the deposit-neutral growth-of-100 line from the time-weighted
// performance index (NOT raw value, which would include contributions).
export function growthFromMonthly(
  monthly: { label: string; value: number; date: string }[],
): GrowthSeries {
  if (monthly.length < 2) {
    return { labels: ["Start", "Teraz"], growth: [100, 100], returns: [0] };
  }

  const first = monthly[0].value || 100;
  const growth = monthly.map((point) => (point.value / first) * 100);
  const returns = growth.slice(1).map((value, index) => value / growth[index] - 1);
  return {
    labels: monthly.map((point) =>
      new Date(point.date).toLocaleString("pl-PL", { month: "short", year: "2-digit" }),
    ),
    growth,
    returns,
  };
}

