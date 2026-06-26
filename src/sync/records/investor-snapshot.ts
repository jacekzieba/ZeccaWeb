import { z } from "zod";
import type {
  AllocationSlice,
  CashBalance,
  HoldingRow,
  IncomeSummary,
  InstrumentRow,
  InvestorDataSnapshot,
  PortfolioDetail,
  PortfolioMetrics,
  PortfolioSummary,
  SnapshotSettings,
  TransactionRow,
  ValuationPoint,
} from "@/domain/models/investor-data";
import {
  buildIncomeListsFromRows,
  type EarningBurdenCategory,
  type EarningBurdenRow,
  type EarningRow,
  type EmploymentType,
  type IncomeLists,
} from "@/domain/models/earnings";
import {
  computeMaxDrawdownPct,
  computeRealReturnPct,
  computeTotalReturnPct,
  computeXirr,
  type CashflowPoint,
} from "@/domain/metrics/portfolio-metrics";
import {
  valueCashBalances,
  valueInstrumentPosition,
  type PositionAssetInput,
  type PositionValuationDataset,
  type FxRateInput,
} from "@/domain/valuation/position-valuator";
import {
  resolveFxRate,
  type MarketQuoteInput,
} from "@/domain/valuation/price-resolver";
import { normalizeTreasuryBondParams } from "@/domain/valuation/treasury-bond-issues";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

/** Resolves how many units of the native (PLN) base currency one unit of the
 * chosen display currency is worth on a given date. Returns 1 for PLN so the
 * default view is byte-identical to the native computation (preserving macOS
 * parity); for EUR/USD it divides PLN amounts down into the display currency
 * using the per-day NBP history loaded into `fxRates`. */
type BaseToPln = (date: Date) => number;

function makeBaseToPln(
  displayCurrency: string,
  dataset: ParsedDataset,
): BaseToPln {
  if (displayCurrency === "PLN") {
    return () => 1;
  }
  return (date) => {
    const resolved = resolveFxRate(
      displayCurrency,
      dataset.transactions.map((transaction) => ({
        transactionType: transaction.transactionType,
        currency: transaction.currency,
        grossAmount: transaction.grossAmount,
        fxRateToBase: transaction.fxRateToBase,
        targetCurrency: transaction.targetCurrency,
        targetGrossAmount: transaction.targetGrossAmount,
        date: toDate(transaction.date),
      })),
      date,
      dataset.fxRates,
      { latestTransactionRate: dataset.useLatestTransactionFxRate },
    );
    // Missing/zero rate → fall back to 1 (no conversion) rather than divide by
    // zero; the UI keeps the display currency on PLN until rates have loaded.
    return resolved.source !== "missing" && resolved.rate > EPSILON
      ? resolved.rate
      : 1;
  };
}

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);
const EPSILON = 0.000001;

const swiftDateSchema = z.union([z.number(), z.string()]);

const accountPayloadSchema = z.object({
  recordType: z.literal("account"),
  id: z.string().uuid(),
  name: z.string(),
  accountType: z.string().optional(),
  baseCurrency: z.string().min(1),
  colorHex: z.string().optional(),
  targetAllocation: z.record(z.number()).optional(),
});

const assetPayloadSchema = z.object({
  recordType: z.literal("asset"),
  id: z.string().uuid(),
  kind: z.string(),
  symbol: z.string(),
  name: z.string(),
  currency: z.string().min(1),
  exchange: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  isin: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  marketDataID: z.string().nullable().optional(),
  bondParams: z.object({
    issueDate: swiftDateSchema,
    maturityDate: swiftDateSchema,
    nominalValue: z.number(),
    firstPeriodRate: z.number(),
    subsequentBase: z.string(),
    marginOverBase: z.number(),
    capitalization: z.string(),
    interestPayment: z.string(),
  }).nullable().optional(),
  listedBondParams: z.unknown().nullable().optional(),
  depositParams: z.unknown().nullable().optional(),
});

const transferLotSchema = z.object({
  acquisitionDate: swiftDateSchema,
  quantity: z.number(),
  unitCost: z.number(),
  currency: z.string(),
  fxRateToBase: z.number().nullable().optional(),
});

const transactionPayloadSchema = z.object({
  recordType: z.literal("transaction"),
  id: z.string().uuid(),
  date: swiftDateSchema,
  bookingDate: swiftDateSchema.nullable().optional(),
  portfolioID: z.string().uuid(),
  instrumentID: z.string().uuid().nullable().optional(),
  transactionType: z.string(),
  quantity: z.number().nullable().optional(),
  price: z.number().nullable().optional(),
  grossAmount: z.number(),
  currency: z.string().min(1),
  fees: z.number(),
  taxes: z.number(),
  fxRateToBase: z.number().nullable().optional(),
  targetCurrency: z.string().nullable().optional(),
  targetGrossAmount: z.number().nullable().optional(),
  notes: z.string().optional(),
  externalImportID: z.string().nullable().optional(),
  sourcePortfolioID: z.string().uuid().nullable().optional(),
  transferKind: z.string().nullable().optional(),
  transferSourceKind: z.string().nullable().optional(),
  contributionTreatment: z.string().nullable().optional(),
  transferCostBasisMode: z.string().nullable().optional(),
  transferLots: z.array(transferLotSchema).nullable().optional(),
  createdAt: swiftDateSchema.optional(),
  updatedAt: swiftDateSchema.optional(),
});

const manualValuationPayloadSchema = z.object({
  recordType: z.literal("manualValuation"),
  id: z.string().uuid(),
  instrumentID: z.string().uuid(),
  date: swiftDateSchema,
  value: z.number(),
  currency: z.string().min(1),
  note: z.string().optional(),
  createdAt: swiftDateSchema.optional(),
  updatedAt: swiftDateSchema.optional(),
});

const marketQuotePayloadSchema = z.object({
  recordType: z.literal("marketQuote"),
  id: z.string().uuid(),
  instrumentID: z.string().uuid(),
  date: swiftDateSchema,
  price: z.number(),
  currency: z.string().min(1),
  source: z.string().optional(),
  previousClose: z.number().nullable().optional(),
  createdAt: swiftDateSchema.optional(),
  updatedAt: swiftDateSchema.optional(),
});

const incomePayloadSchema = z.object({
  recordType: z.literal("income"),
  id: z.string().uuid(),
  entryKind: z.enum(["earning", "burden"]),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  employmentType: z.string().nullable().optional(),
  enteredAmount: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  fxRateToPLN: z.number().nullable().optional(),
  plnAmount: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  burdenCategory: z.string().nullable().optional(),
  amountPLN: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
});

const settingsPayloadSchema = z.object({
  recordType: z.literal("settings"),
  id: z.string().uuid().optional(),
  syncMode: z.string().optional(),
  accountProvider: z.string().optional(),
  telemetryEnabled: z.boolean().optional(),
  hasAcknowledgedPrivacyDisclosure: z.boolean().optional(),
  baseCurrency: z.string().min(1).optional(),
  showBelkaTax: z.boolean().optional(),
  useFIFO: z.boolean().optional(),
  showRealReturns: z.boolean().optional(),
  autoRefreshEnabled: z.boolean().optional(),
  selectedProvider: z.string().optional(),
  fxProvider: z.string().optional(),
  inflationRegion: z.string().optional(),
  inflationRate: z.number().optional(),
  appLanguage: z.string().optional(),
  updatedAt: swiftDateSchema.optional(),
});

type AccountPayload = z.infer<typeof accountPayloadSchema>;
type AssetPayload = z.infer<typeof assetPayloadSchema>;
type TransactionPayload = z.infer<typeof transactionPayloadSchema>;
type ManualValuationPayload = z.infer<typeof manualValuationPayloadSchema>;
type MarketQuotePayload = z.infer<typeof marketQuotePayloadSchema>;
type IncomePayload = z.infer<typeof incomePayloadSchema>;
type SettingsPayload = z.infer<typeof settingsPayloadSchema>;

type Ledger = {
  positions: Map<string, number>;
  cashBalances: Map<string, number>;
  openLots: Map<string, OpenLot[]>;
};

type OpenLot = {
  purchaseDate: Date;
  quantity: number;
  costPerUnit: number;
  currency: string;
};

type ParsedDataset = {
  accounts: AccountPayload[];
  assets: AssetPayload[];
  transactions: TransactionPayload[];
  manualValuations: ManualValuationPayload[];
  marketQuotes: MarketQuotePayload[];
  /** Daily quotes fetched live from a market-data provider (e.g. Yahoo) and
   * injected via options, rather than parsed from synced `marketQuote` records.
   * Already in resolver-ready form (keyed by instrumentID, dates as `Date`). */
  externalMarketQuotes: MarketQuoteInput[];
  income: IncomePayload[];
  settings: SettingsPayload[];
  fxRates: FxRateInput[];
  useMarketQuotes: boolean;
  useLatestTransactionFxRate: boolean;
};

export type SnapshotBuildOptions = {
  fxRates?: FxRateInput[];
  /** Live daily market quotes (per instrument) used to fill day-to-day price
   * movement in the valuation history between sparse manual valuations. Only
   * consulted when `useMarketQuotes` is set. */
  marketQuotes?: MarketQuoteInput[];
  asOf?: Date;
  historyGranularity?: "monthly" | "daily";
  useMarketQuotes?: boolean;
  useLatestTransactionFxRate?: boolean;
  /** Presentation currency for all monetary fields. Defaults to the native base
   * (PLN). When set to EUR/USD the snapshot is converted using per-day NBP rates
   * from `fxRates`; percentages, allocation and the performance index stay
   * currency-consistent because flows and values convert together. */
  displayCurrency?: string;
};

type PortfolioValuation = {
  totalValue: number;
  cashValue: number;
  positionCount: number;
  allocationValues: Map<string, number>;
};

export function buildInvestorDataSnapshot(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): InvestorDataSnapshot {
  const dataset = parseDataset(records, options);
  const baseCurrency = getBaseCurrency(dataset);
  const displayCurrency = (options.displayCurrency ?? baseCurrency).toUpperCase();
  const asOf = getAsOf(records, dataset, options);
  const baseToPln = makeBaseToPln(displayCurrency, dataset);
  const accounts = getAccounts(dataset, baseCurrency);
  const portfolios = accounts.map((account) =>
    buildPortfolioSummary(account, dataset, asOf, baseToPln),
  );
  const totalValue = portfolios.reduce(
    (sum, portfolio) => sum + portfolio.value,
    0,
  );
  const asOfRate = baseToPln(asOf);
  const cash =
    accounts.reduce((sum, account) => {
      const transactions = transactionsForPortfolio(dataset.transactions, account.id);
      const ledger = computeLedger(transactions, asOf);
      return sum + valueCash(ledger, dataset, asOf);
    }, 0) / asOfRate;
  const valuationSeries = convertSeriesCurrency(
    buildValuationSeries(accounts, dataset, asOf, options),
    baseToPln,
  );
  const monthlyChange = calculateMonthlyChange(valuationSeries);
  const income = buildIncomeSummary(dataset.income, asOfRate);
  const cashflows = buildCashflowSummary(accounts, dataset, asOf, baseToPln);
  const netInvestedSeries = buildNetInvestedSeries(
    accounts,
    dataset,
    valuationSeries,
    baseToPln,
  );
  const performanceSeries = buildPerformanceSeries(
    accounts,
    dataset,
    valuationSeries,
    baseToPln,
  );
  const metrics = buildMetrics(
    accounts,
    dataset,
    asOf,
    totalValue,
    performanceSeries,
    baseToPln,
  );

  return {
    asOf: asOf.toISOString(),
    totalValue,
    monthlyChange,
    cash,
    income,
    cashflows,
    portfolios,
    valuationSeries,
    netInvestedSeries,
    performanceSeries,
    // Allocation is a set of ratios, so it stays currency-invariant and is
    // computed from the native PLN valuation.
    allocation: buildAllocation(accounts, dataset, asOf),
    metrics,
    settings: getTelemetrySettings(dataset),
  };
}

/** Divides each valuation point by the display-currency rate on that point's
 * own date, so a multi-year chart reflects how FX moved over time. The rate is
 * read at end-of-day to match the instant `buildValuationSeries` values each
 * point (it labels points with the day start but values them at the day end). */
function convertSeriesCurrency(
  series: InvestorDataSnapshot["valuationSeries"],
  baseToPln: BaseToPln,
): InvestorDataSnapshot["valuationSeries"] {
  return series.map((point) => ({
    ...point,
    value: point.value / baseToPln(endOfLocalDay(new Date(point.date))),
  }));
}

/** Latest settings record by `updatedAt`. Used for both base currency and the
 * telemetry gate so they agree on which record "wins". */
function getLatestSettings(dataset: ParsedDataset): SettingsPayload | undefined {
  return dataset.settings
    .slice()
    .sort(
      (left, right) =>
        toDate(left.updatedAt ?? 0).getTime() -
        toDate(right.updatedAt ?? 0).getTime(),
    )
    .at(-1);
}

/** Surface only the gate-relevant flags. Defaults mirror native
 * `InvestorAppSettings`: telemetry opt-in is on, but stays gated until the
 * privacy disclosure is acknowledged — so no record means the gate is closed. */
function getTelemetrySettings(dataset: ParsedDataset): SnapshotSettings {
  const latest = getLatestSettings(dataset);
  return {
    telemetryEnabled: latest?.telemetryEnabled ?? true,
    hasAcknowledgedPrivacyDisclosure:
      latest?.hasAcknowledgedPrivacyDisclosure ?? false,
    syncMode: latest?.syncMode ?? null,
  };
}

/** Build a time-weighted-return index (growth of 100) from the valuation series,
 * removing the effect of deposits/withdrawals so the line reflects real
 * performance rather than how much capital was added. */
function buildPerformanceSeries(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  valuationSeries: InvestorDataSnapshot["valuationSeries"],
  baseToPln: BaseToPln,
): InvestorDataSnapshot["valuationSeries"] {
  if (valuationSeries.length === 0) return [];

  const accountIds = new Set(accounts.map((account) => account.id));
  // Net capital flowing INTO the portfolio per calendar day (deposit +, withdrawal −).
  // Flows convert at their own date to match the already-converted valuation
  // series, so the time-weighted index reflects the display currency.
  const flowByDay = new Map<string, number>();
  for (const transaction of dataset.transactions) {
    if (!accountIds.has(transaction.portfolioID)) continue;
    const external = externalCashflowBaseAmount(transaction);
    if (external == null) continue;
    const converted = external / baseToPln(toDate(transaction.date));
    const key = startOfLocalDay(toDate(transaction.date)).toISOString();
    flowByDay.set(key, (flowByDay.get(key) ?? 0) - converted); // −converted = into portfolio
  }

  const dayKey = (iso: string) => startOfLocalDay(new Date(iso)).toISOString();
  let index = 100;
  let previousValue = valuationSeries[0].value;

  return valuationSeries.map((point, i) => {
    if (i > 0) {
      if (previousValue > EPSILON) {
        const flow = flowByDay.get(dayKey(point.date)) ?? 0;
        // Mirrors the native PerformanceEngine.periodReturn: divide the period
        // gain by the capital actually at work during the period — the opening
        // value plus any same-day inflow. Dividing by the opening value alone
        // makes a large deposit-and-buy into a near-empty account divide a tiny
        // accrual by cash dust and explode the index. Clamp the per-period
        // factor at 0 so a >100% drop can't drive the index negative.
        const denominator = previousValue + Math.max(flow, 0);
        const periodReturn = (point.value - flow - previousValue) / denominator;
        index *= Math.max(0, 1 + periodReturn);
      }
      previousValue = point.value;
    }
    return { label: point.label, date: point.date, value: index };
  });
}

/** Aggregate portfolio dividends / interest / fees / taxes from transactions,
 * converted to the base currency. */
function buildCashflowSummary(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  asOf: Date,
  baseToPln: BaseToPln,
): InvestorDataSnapshot["cashflows"] {
  const accountIds = new Set(accounts.map((account) => account.id));
  let dividends = 0;
  let interest = 0;
  let fees = 0;
  let taxes = 0;

  for (const transaction of dataset.transactions) {
    if (!accountIds.has(transaction.portfolioID)) continue;
    if (toDate(transaction.date).getTime() > asOf.getTime()) continue;

    // Convert PLN booked amounts into the display currency at the rate on the
    // transaction's own date, so a lifetime dividend total reflects FX history.
    const fxRate =
      (transaction.currency === "PLN" || !transaction.fxRateToBase
        ? 1
        : transaction.fxRateToBase) / baseToPln(toDate(transaction.date));
    const gross = transaction.grossAmount * fxRate;

    fees += transaction.fees * fxRate;
    taxes += transaction.taxes * fxRate;

    switch (transaction.transactionType) {
      case "dividend":
        dividends += gross;
        break;
      case "interest":
      case "bondCoupon":
        interest += gross;
        break;
      case "fee":
        fees += gross;
        break;
      case "tax":
        taxes += gross;
        break;
    }
  }

  return { dividends, interest, fees, taxes };
}

/** Amount of an external (investor ⇄ portfolio) cashflow in the base currency,
 * signed from the investor's perspective: contributions negative, distributions
 * positive. Returns null for non-external (internal) transactions. */
function externalCashflowBaseAmount(
  transaction: TransactionPayload,
): number | null {
  const base = transactionBaseAmount(transaction);
  switch (transaction.transactionType) {
    case "cashDeposit":
    case "transferIn":
    // A transfer in from another of the user's accounts is fresh capital from
    // the scoped portfolio's perspective, not market performance — counting it
    // as a contribution keeps the time-weighted index, XIRR and net-invested
    // honest in the per-portfolio view. In the aggregate view it cancels
    // against the paired `transferOut` on the source account, so the total
    // stays neutral. Both cash and asset transfers carry their value in
    // grossAmount (the native editor books an asset transfer's grossAmount as
    // the summed lot cost basis, Σ quantity × unitCost), so the flow is
    // neutralised here just like cash — the holding's market value entering the
    // valuation is offset by this flow, leaving only any embedded gain.
    case "accountTransferIn":
      return -base;
    case "cashWithdrawal":
    case "transferOut":
      return base;
    default:
      return null;
  }
}

/** Like {@link externalCashflowBaseAmount}, but for the "net contributions"
 * (wpłaty) line rather than performance neutralisation. A transfer in from
 * another of the user's own accounts is an internal reallocation, not fresh
 * external capital, so it counts as a contribution only when the user marked it
 * `countAsContribution` — mirroring native HistoryEngine.contributionFlowAmount
 * (default `ignoreForContributions`). It is still neutralised for TWR/XIRR via
 * {@link externalCashflowBaseAmount}. */
function contributionBaseAmount(
  transaction: TransactionPayload,
): number | null {
  const base = transactionBaseAmount(transaction);
  switch (transaction.transactionType) {
    case "cashDeposit":
    case "transferIn":
      return -base;
    case "accountTransferIn":
      return transaction.contributionTreatment === "countAsContribution"
        ? -base
        : null;
    case "cashWithdrawal":
    case "transferOut":
      return base;
    default:
      return null;
  }
}

function transactionBaseAmount(transaction: TransactionPayload): number {
  if (transaction.currency === "PLN" || !transaction.fxRateToBase) {
    return transaction.grossAmount;
  }
  return transaction.grossAmount * transaction.fxRateToBase;
}

/** Cumulative net external capital (contributions − withdrawals) at each
 * valuation date, in display currency, so the deposits line can be overlaid on
 * the value line. Each flow is converted at its own date, consistent with the
 * `netInvested` metric and the already-converted valuation series. */
function buildNetInvestedSeries(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  valuationSeries: ValuationPoint[],
  baseToPln: BaseToPln,
): ValuationPoint[] {
  const accountIds = new Set(accounts.map((account) => account.id));
  const flows = dataset.transactions
    .filter((transaction) => accountIds.has(transaction.portfolioID))
    .map((transaction) => {
      const plnAmount = contributionBaseAmount(transaction);
      if (plnAmount == null) return null;
      const date = toDate(transaction.date);
      // Contributions increase invested capital, so negate the investor-signed flow.
      // Bucket by calendar day: the valuation series labels points at the day
      // start but values them at the day end, so a same-day flow must count for
      // that point. Comparing the raw timestamp instead would push an
      // afternoon deposit one point ahead of the value that already reflects it.
      return { time: startOfLocalDay(date).getTime(), invested: -(plnAmount / baseToPln(date)) };
    })
    .filter((flow): flow is { time: number; invested: number } => flow !== null)
    .sort((a, b) => a.time - b.time);

  return valuationSeries.map((point) => {
    const cutoff = startOfLocalDay(toDate(point.date)).getTime();
    let cumulative = 0;
    for (const flow of flows) {
      if (flow.time > cutoff) break;
      cumulative += flow.invested;
    }
    return { label: point.label, date: point.date, value: cumulative };
  });
}

function buildMetrics(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  asOf: Date,
  totalValue: number,
  performanceSeries: InvestorDataSnapshot["performanceSeries"],
  baseToPln: BaseToPln,
): PortfolioMetrics {
  const accountIds = new Set(accounts.map((account) => account.id));
  const cashflows: CashflowPoint[] = [];
  let netInvested = 0;

  for (const transaction of dataset.transactions) {
    if (!accountIds.has(transaction.portfolioID)) continue;
    if (toDate(transaction.date).getTime() > asOf.getTime()) continue;
    const date = toDate(transaction.date);
    // Convert each flow at its own date so XIRR and net-invested are stated in
    // the display currency consistently with the (already converted) terminal
    // value below.
    const rate = baseToPln(date);
    // XIRR must neutralise every external flow, including internal account
    // transfers, so it uses the broad external-flow definition.
    const external = externalCashflowBaseAmount(transaction);
    if (external != null) {
      cashflows.push({ date, amount: external / rate });
    }
    // Net-invested counts only genuine contributions: an unflagged account
    // transfer is an internal move, not fresh capital (parity with native).
    const contribution = contributionBaseAmount(transaction);
    if (contribution != null) {
      netInvested -= contribution / rate; // contribution increases invested
    }
  }

  if (totalValue > EPSILON) {
    cashflows.push({ date: asOf, amount: totalValue });
  }

  const xirr = computeXirr(cashflows);
  const inflationPct = getInflationPct(dataset);
  const totalReturnPct = computePerformanceReturnPct(performanceSeries);
  const cagrPct = computeCagrPct(performanceSeries);
  // Real return is stated on an ANNUAL basis: deflate the annualised nominal
  // return (CAGR) by the annual inflation rate. Deflating the *cumulative*
  // multi-year return by a single year's inflation would mix horizons and
  // overstate the real result for any portfolio older than a year.
  const realReturnPct = computeRealReturnPct(cagrPct, inflationPct);
  const maxDrawdownPct = computeMaxDrawdownPct(
    performanceSeries.map((point) => point.value),
  );
  const realizedPnl =
    buildRealizedPnl(accountIds, dataset, asOf) / baseToPln(asOf);

  return {
    netInvested: Math.max(netInvested, 0),
    totalReturnPct,
    cagrPct,
    realReturnPct,
    xirrPct: xirr == null ? null : xirr * 100,
    maxDrawdownPct,
    realizedPnl,
    inflationPct,
  };
}

/** Annualises the time-weighted (deposit-neutral) index over its own span. */
function computeCagrPct(
  performanceSeries: InvestorDataSnapshot["performanceSeries"],
): number {
  const first = performanceSeries[0];
  const last = performanceSeries.at(-1);
  if (!first || !last || first.value <= EPSILON) return 0;
  const years =
    (toDate(last.date).getTime() - toDate(first.date).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);
  if (years <= EPSILON) return computeTotalReturnPct(last.value, first.value);
  const growth = last.value / first.value;
  if (growth <= 0) return 0;
  return (Math.pow(growth, 1 / years) - 1) * 100;
}

type RealizedLot = { quantity: number; costBasisBase: number };

/** Self-contained FIFO realised-P&L pass. Kept separate from `computeLedger`
 * so the parity-tested valuation path is untouched: it replays position exits
 * (sell / bondRedemption / depositClose) against FIFO lots and sums
 * proceeds − cost basis, all in the native PLN base. */
function buildRealizedPnl(
  accountIds: Set<string>,
  dataset: ParsedDataset,
  asOf: Date,
): number {
  const toBase = (currency: string, fxRateToBase: number | null | undefined) =>
    currency === "PLN" || !fxRateToBase ? 1 : fxRateToBase;
  const lotsByInstrument = new Map<string, RealizedLot[]>();
  let realizedBase = 0;

  const pushLot = (
    instrumentID: string | null | undefined,
    quantity: number,
    costPerUnitBase: number,
    // Acquisition costs (e.g. buy commission) capitalised into the lot's cost
    // basis, so realised P&L nets out entry costs the way the exit side already
    // nets out fees/taxes from proceeds.
    extraCostBase = 0,
  ) => {
    if (!instrumentID || quantity <= EPSILON) return;
    const lots = lotsByInstrument.get(instrumentID) ?? [];
    lots.push({
      quantity,
      costBasisBase: costPerUnitBase * quantity + Math.max(0, extraCostBase),
    });
    lotsByInstrument.set(instrumentID, lots);
  };

  const consume = (
    instrumentID: string | null | undefined,
    quantity: number,
  ): number => {
    if (!instrumentID || quantity <= EPSILON) return 0;
    const lots = lotsByInstrument.get(instrumentID) ?? [];
    let remaining = quantity;
    let costBase = 0;
    while (remaining > EPSILON && lots.length > 0) {
      const lot = lots[0];
      const consumed = Math.min(lot.quantity, remaining);
      const unitCost = lot.quantity > EPSILON ? lot.costBasisBase / lot.quantity : 0;
      costBase += unitCost * consumed;
      lot.quantity -= consumed;
      lot.costBasisBase -= unitCost * consumed;
      remaining -= consumed;
      if (lot.quantity <= EPSILON) lots.shift();
    }
    lotsByInstrument.set(instrumentID, lots);
    return costBase;
  };

  const transactions = dataset.transactions
    .filter(
      (transaction) =>
        accountIds.has(transaction.portfolioID) &&
        toDate(transaction.date).getTime() <= asOf.getTime(),
    )
    .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());

  for (const transaction of transactions) {
    const quantity = transaction.quantity ?? 0;
    const fx = toBase(transaction.currency, transaction.fxRateToBase);
    switch (transaction.transactionType) {
      case "buy": {
        const costPerUnit =
          transaction.price ??
          (quantity > EPSILON ? transaction.grossAmount / quantity : 0);
        pushLot(
          transaction.instrumentID,
          quantity,
          costPerUnit * fx,
          transaction.fees * fx,
        );
        break;
      }
      case "depositOpen":
        pushLot(transaction.instrumentID, 1, transaction.grossAmount * fx);
        break;
      case "accountTransferIn":
        if (transaction.transferKind === "asset") {
          const transferLots = transaction.transferLots ?? [];
          if (transferLots.length > 0) {
            for (const lot of transferLots) {
              pushLot(
                transaction.instrumentID,
                lot.quantity,
                lot.unitCost * toBase(lot.currency, lot.fxRateToBase),
              );
            }
          } else {
            const costPerUnit =
              transaction.price ??
              (quantity > EPSILON ? transaction.grossAmount / quantity : 0);
            pushLot(transaction.instrumentID, quantity, costPerUnit * fx);
          }
        }
        break;
      case "sell":
      case "bondRedemption":
      case "depositClose": {
        const exitQty =
          transaction.transactionType === "depositClose" && quantity <= EPSILON
            ? 1
            : quantity;
        const costBase = consume(transaction.instrumentID, exitQty);
        const proceedsBase =
          (transaction.grossAmount - transaction.fees - transaction.taxes) * fx;
        realizedBase += proceedsBase - costBase;
        break;
      }
    }
  }

  return realizedBase;
}

function computePerformanceReturnPct(
  performanceSeries: InvestorDataSnapshot["performanceSeries"],
) {
  const first = performanceSeries[0];
  const last = performanceSeries.at(-1);
  if (!first || !last || first.value <= EPSILON) return 0;
  return computeTotalReturnPct(last.value, first.value);
}

function getInflationPct(dataset: ParsedDataset): number {
  // Pick the rate from the most recently updated settings record, consistent
  // with how base currency and the telemetry gate resolve "latest" — array
  // order is not reliable, so sort by `updatedAt`.
  const latest = getLatestSettings(dataset)?.inflationRate;
  if (latest == null) return 0;
  // Stored either as a fraction (0.035) or a percentage (3.5).
  return Math.abs(latest) <= 1 ? latest * 100 : latest;
}

function parseDataset(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): ParsedDataset {
  const dataset: ParsedDataset = {
    accounts: [],
    assets: [],
    transactions: [],
    manualValuations: [],
    marketQuotes: [],
    externalMarketQuotes: options.marketQuotes ?? [],
    income: [],
    settings: [],
    fxRates: options.fxRates ?? [],
    useMarketQuotes: options.useMarketQuotes ?? false,
    useLatestTransactionFxRate: options.useLatestTransactionFxRate ?? false,
  };

  for (const record of records) {
    if (record.deletedAt) {
      continue;
    }

    switch (record.envelope.type) {
      case "account":
        dataset.accounts.push(accountPayloadSchema.parse(record.envelope.payload));
        break;
      case "asset":
        dataset.assets.push(assetPayloadSchema.parse(record.envelope.payload));
        break;
      case "transaction":
        dataset.transactions.push(
          transactionPayloadSchema.parse(record.envelope.payload),
        );
        break;
      case "manualValuation":
        dataset.manualValuations.push(
          manualValuationPayloadSchema.parse(record.envelope.payload),
        );
        break;
      case "marketQuote":
        dataset.marketQuotes.push(
          marketQuotePayloadSchema.parse(record.envelope.payload),
        );
        break;
      case "settings":
        dataset.settings.push(settingsPayloadSchema.parse(record.envelope.payload));
        break;
      case "income":
        dataset.income.push(incomePayloadSchema.parse(record.envelope.payload));
        break;
    }
  }

  dataset.transactions.sort(
    (left, right) =>
      toDate(left.date).getTime() - toDate(right.date).getTime(),
  );
  dataset.manualValuations.sort(
    (left, right) =>
      toDate(left.date).getTime() - toDate(right.date).getTime(),
  );
  dataset.marketQuotes.sort(
    (left, right) =>
      toDate(left.date).getTime() - toDate(right.date).getTime(),
  );

  return dataset;
}

function buildIncomeSummary(
  income: IncomePayload[],
  asOfRate: number,
): IncomeSummary {
  let earningCount = 0;
  let burdenCount = 0;
  let earningsPLN = 0;
  let burdensPLN = 0;

  for (const item of income) {
    if (item.entryKind === "earning") {
      earningCount += 1;
      earningsPLN += (item.plnAmount ?? 0) / asOfRate;
    } else {
      burdenCount += 1;
      burdensPLN += (item.amountPLN ?? 0) / asOfRate;
    }
  }

  return {
    earningCount,
    burdenCount,
    earningsPLN,
    burdensPLN,
    netPLN: earningsPLN - burdensPLN,
  };
}

function getBaseCurrency(dataset: ParsedDataset) {
  return (
    dataset.settings
      .filter((settings) => settings.baseCurrency)
      .sort(
        (left, right) =>
          toDate(left.updatedAt ?? 0).getTime() -
          toDate(right.updatedAt ?? 0).getTime(),
      )
      .at(-1)?.baseCurrency ??
    dataset.accounts[0]?.baseCurrency ??
    "PLN"
  );
}

function getAsOf(
  records: DecryptedRecord[],
  dataset: ParsedDataset,
  options: SnapshotBuildOptions = {},
) {
  if (options.asOf) {
    return options.asOf;
  }

  const dates = [
    ...records.map((record) => new Date(record.updatedAt)),
    ...dataset.transactions.map((transaction) => toDate(transaction.date)),
    ...dataset.manualValuations.map((valuation) => toDate(valuation.date)),
    ...dataset.marketQuotes.map((quote) => toDate(quote.date)),
  ].filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length === 0) {
    return new Date();
  }

  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function getAccounts(dataset: ParsedDataset, baseCurrency: string) {
  if (dataset.accounts.length > 0) {
    return dataset.accounts;
  }

  return [
    {
      recordType: "account" as const,
      id: "00000000-0000-4000-8000-000000000000",
      name: "Portfel",
      baseCurrency,
    },
  ];
}

function buildPortfolioSummary(
  account: AccountPayload,
  dataset: ParsedDataset,
  asOf: Date,
  baseToPln: BaseToPln,
): PortfolioSummary {
  const transactions = transactionsForPortfolio(dataset.transactions, account.id);
  const todayLedger = computeLedger(transactions, asOf);
  const valuation = valuePortfolio(todayLedger, dataset, asOf);
  const value = valuation.totalValue / baseToPln(asOf);

  const previousDay = endOfLocalDay(addLocalDays(asOf, -1));
  // For the 1D comparison we want yesterday's POSITIONS at today's PRICES.
  // If a market quote or manual valuation arrived today (date > previousDay),
  // excluding it from the previous-day calculation would compare today's market
  // price against yesterday's formula price, producing a spurious daily jump.
  // Backdating any "future" prices to previousDay keeps the valuation source
  // consistent across both days.
  const datasetForPreviousDay = withPricesCappedAt(dataset, previousDay);
  const previousLedger = computeLedger(transactions, previousDay);

  // Daily-change basis: value treasury bonds by their accrual formula on BOTH
  // days. A bond valued from sparse manual valuations is otherwise flat between
  // entries — and `withPricesCappedAt` backdates a fresh entry onto the previous
  // day — so the 1D move would read 0% even though the bond accrues interest
  // every day. The formula yields the true daily accrual; non-bond assets are
  // unaffected by the flag and keep their quote/valuation pricing.
  const valueForDelta =
    valuePortfolio(todayLedger, dataset, asOf, { bondsUseFormula: true })
      .totalValue / baseToPln(asOf);
  const previousValueForDelta =
    valuePortfolio(previousLedger, datasetForPreviousDay, previousDay, {
      bondsUseFormula: true,
    }).totalValue / baseToPln(previousDay);
  const periodFlow =
    portfolioFlowIntoBaseAmount(transactions, previousDay, asOf) / baseToPln(asOf);
  // Divide by the capital at work during the day (opening value + same-day
  // inflow), matching the native PerformanceEngine.periodReturn, so a deposit
  // into a near-empty account doesn't divide a tiny accrual by cash dust.
  const dailyDenominator = previousValueForDelta + Math.max(periodFlow, 0);
  const dailyChange =
    previousValueForDelta > EPSILON
      ? ((valueForDelta - periodFlow - previousValueForDelta) / dailyDenominator) *
        100
      : 0;

  const sparkline = buildValuationSeries([account], dataset, asOf, {
    historyGranularity: "daily",
  })
    .slice(-30)
    .map((point) => point.value / baseToPln(endOfLocalDay(new Date(point.date))));

  return {
    id: account.id,
    name: account.name,
    baseCurrency: account.baseCurrency,
    value,
    dailyChange,
    positions: valuation.positionCount,
    sparkline,
  };
}

// Returns a copy of dataset where any market quote or manual valuation whose
// date is strictly after `cap` is backdated to `cap`. This lets the 1D
// comparison use the same price source for both today and yesterday, avoiding
// spurious jumps when a new quote/valuation appears with today's date.
function withPricesCappedAt(dataset: ParsedDataset, cap: Date): ParsedDataset {
  const capMs = cap.getTime();
  const capStr = cap.toISOString();
  const needsCap = (d: z.infer<typeof swiftDateSchema>) =>
    toDate(d).getTime() > capMs;

  return {
    ...dataset,
    marketQuotes: dataset.marketQuotes.map((q) =>
      needsCap(q.date) ? { ...q, date: capStr } : q,
    ),
    manualValuations: dataset.manualValuations.map((mv) =>
      needsCap(mv.date) ? { ...mv, date: capStr } : mv,
    ),
  };
}

function portfolioFlowIntoBaseAmount(
  transactions: TransactionPayload[],
  after: Date,
  beforeOrOn: Date,
) {
  let flow = 0;

  for (const transaction of transactions) {
    const date = toDate(transaction.date);
    if (date.getTime() <= after.getTime() || date.getTime() > beforeOrOn.getTime()) {
      continue;
    }

    switch (transaction.transactionType) {
      case "cashDeposit":
      case "transferIn":
      case "accountTransferIn":
        flow += transactionBaseAmount(transaction);
        break;
      case "cashWithdrawal":
      case "transferOut":
        flow -= transactionBaseAmount(transaction);
        break;
    }
  }

  return flow;
}

function transactionsForPortfolio(
  transactions: TransactionPayload[],
  portfolioID: string,
) {
  return transactions.filter(
    (transaction) => transaction.portfolioID === portfolioID,
  );
}

function computeLedger(transactions: TransactionPayload[], asOf: Date): Ledger {
  const ledger: Ledger = {
    positions: new Map(),
    cashBalances: new Map(),
    openLots: new Map(),
  };

  for (const transaction of transactions) {
    if (toDate(transaction.date).getTime() > asOf.getTime()) {
      continue;
    }

    applyTransaction(ledger, transaction);
  }

  return ledger;
}

function applyTransaction(ledger: Ledger, transaction: TransactionPayload) {
  const type = transaction.transactionType;
  const grossAmount = transaction.grossAmount;
  const fees = transaction.fees;
  const taxes = transaction.taxes;
  const currency = transaction.currency;
  const fxRate = transaction.fxRateToBase;

  switch (type) {
    case "cashDeposit":
    case "transferIn":
      addCash(ledger, currency, grossAmount);
      break;
    case "accountTransferIn":
      if (transaction.transferKind === "asset") {
        addAssetTransfer(ledger, transaction);
      } else {
        addCash(ledger, currency, grossAmount);
      }
      break;
    case "cashWithdrawal":
    case "transferOut":
      addCash(ledger, currency, -grossAmount);
      break;
    case "buy":
      addCashForTrade(ledger, transaction, -(grossAmount + fees));
      addPosition(ledger, transaction.instrumentID, transaction.quantity ?? 0);
      addLot(ledger, transaction);
      break;
    case "sell":
      addCashForTrade(ledger, transaction, grossAmount - fees - taxes);
      addPosition(ledger, transaction.instrumentID, -(transaction.quantity ?? 0));
      consumeLots(ledger, transaction.instrumentID, transaction.quantity ?? 0);
      break;
    case "dividend":
    case "interest":
    case "bondCoupon":
      addCash(ledger, currency, grossAmount - fees - taxes);
      break;
    case "bondRedemption":
      addCash(ledger, currency, grossAmount - fees - taxes);
      addPosition(ledger, transaction.instrumentID, -(transaction.quantity ?? 0));
      consumeLots(ledger, transaction.instrumentID, transaction.quantity ?? 0);
      break;
    case "depositOpen":
      addCash(ledger, currency, -grossAmount);
      addPosition(ledger, transaction.instrumentID, 1);
      addLot(ledger, {
        ...transaction,
        quantity: 1,
        price: grossAmount,
      });
      break;
    case "depositClose":
      addCash(ledger, currency, grossAmount - fees - taxes);
      addPosition(ledger, transaction.instrumentID, -(transaction.quantity ?? 1));
      consumeLots(ledger, transaction.instrumentID, transaction.quantity ?? 1);
      break;
    case "fee":
    case "tax":
      addCash(ledger, currency, -grossAmount);
      break;
    case "fxConversion":
      addCash(ledger, currency, -grossAmount);
      if (transaction.targetCurrency && transaction.targetGrossAmount) {
        addCash(
          ledger,
          transaction.targetCurrency,
          transaction.targetGrossAmount,
        );
      } else if (fxRate) {
        addCash(ledger, "PLN", grossAmount * fxRate);
      }
      break;
    case "correction":
      addCash(ledger, currency, grossAmount);
      break;
  }
}

function addAssetTransfer(ledger: Ledger, transaction: TransactionPayload) {
  const instrumentID = transaction.instrumentID;
  if (!instrumentID) {
    return;
  }

  const lots = transaction.transferLots ?? [];
  const quantity =
    lots.length > 0
      ? lots.reduce((sum, lot) => sum + lot.quantity, 0)
      : transaction.quantity ?? 0;

  addPosition(ledger, instrumentID, quantity);

  if (lots.length > 0) {
    const openLots = ledger.openLots.get(instrumentID) ?? [];
    openLots.push(
      ...lots.map((lot) => ({
        purchaseDate: toDate(lot.acquisitionDate),
        quantity: lot.quantity,
        costPerUnit: lot.unitCost,
        currency: lot.currency,
      })),
    );
    ledger.openLots.set(instrumentID, openLots);
    return;
  }

  addLot(ledger, transaction);
}

function addCashForTrade(
  ledger: Ledger,
  transaction: TransactionPayload,
  amount: number,
) {
  if (transaction.currency !== "PLN" && transaction.fxRateToBase) {
    addCash(ledger, "PLN", amount * transaction.fxRateToBase);
    return;
  }

  addCash(ledger, transaction.currency, amount);
}

function addCash(ledger: Ledger, currency: string, amount: number) {
  ledger.cashBalances.set(currency, (ledger.cashBalances.get(currency) ?? 0) + amount);
}

function addPosition(
  ledger: Ledger,
  instrumentID: string | null | undefined,
  quantity: number,
) {
  if (!instrumentID || Math.abs(quantity) <= EPSILON) {
    return;
  }

  ledger.positions.set(
    instrumentID,
    (ledger.positions.get(instrumentID) ?? 0) + quantity,
  );
}

function addLot(ledger: Ledger, transaction: TransactionPayload) {
  const instrumentID = transaction.instrumentID;
  const quantity = transaction.quantity ?? 0;
  if (!instrumentID || quantity <= EPSILON) {
    return;
  }

  const costPerUnit =
    transaction.price ??
    (transaction.grossAmount > EPSILON ? transaction.grossAmount / quantity : 0);
  const lots = ledger.openLots.get(instrumentID) ?? [];
  lots.push({
    purchaseDate: toDate(transaction.date),
    quantity,
    costPerUnit,
    currency: transaction.currency,
  });
  ledger.openLots.set(instrumentID, lots);
}

function consumeLots(
  ledger: Ledger,
  instrumentID: string | null | undefined,
  quantity: number,
) {
  if (!instrumentID || quantity <= EPSILON) {
    return;
  }

  const lots = ledger.openLots.get(instrumentID) ?? [];
  let remaining = quantity;

  while (remaining > EPSILON && lots.length > 0) {
    const lot = lots[0];
    const consumed = Math.min(lot.quantity, remaining);
    lot.quantity -= consumed;
    remaining -= consumed;
    if (lot.quantity <= EPSILON) {
      lots.shift();
    }
  }

  ledger.openLots.set(instrumentID, lots);
}

function valuePortfolio(
  ledger: Ledger,
  dataset: ParsedDataset,
  asOf: Date,
  options: { bondsUseFormula?: boolean } = {},
): PortfolioValuation {
  const assetsByID = new Map(dataset.assets.map((asset) => [asset.id, asset]));
  const valuationDataset = toPositionValuationDataset(dataset);
  const allocationValues = new Map<string, number>();
  let holdingsValue = 0;
  let positionCount = 0;

  for (const [instrumentID, quantity] of ledger.positions) {
    if (quantity <= EPSILON) {
      continue;
    }

    const asset = assetsByID.get(instrumentID);
    const valuation = valueInstrumentPosition(
      {
        instrumentID,
        quantity,
        asset: toPositionAssetInput(asset),
        lots: ledger.openLots.get(instrumentID) ?? [],
        dataset: valuationDataset,
        asOf,
        bondsUseFormula: options.bondsUseFormula,
      },
    );
    const marketValue = valuation.marketValue;

    if (marketValue <= EPSILON) {
      continue;
    }

    holdingsValue += marketValue;
    positionCount += 1;
    const assetClass = assetClassLabel(asset?.kind);
    allocationValues.set(
      assetClass,
      (allocationValues.get(assetClass) ?? 0) + marketValue,
    );
  }

  const cashValue = valueCash(ledger, dataset, asOf);

  if (cashValue > EPSILON) {
    allocationValues.set(
      "Gotówka",
      (allocationValues.get("Gotówka") ?? 0) + cashValue,
    );
  }

  return {
    totalValue: holdingsValue + cashValue,
    cashValue,
    positionCount,
    allocationValues,
  };
}

function valueCash(
  ledger: Ledger,
  dataset: Pick<
    ParsedDataset,
    | "manualValuations"
    | "marketQuotes"
    | "externalMarketQuotes"
    | "transactions"
    | "fxRates"
    | "useMarketQuotes"
    | "useLatestTransactionFxRate"
  >,
  asOf: Date,
) {
  return valueCashBalances(
    ledger.cashBalances,
    toPositionValuationDataset(dataset),
    asOf,
  );
}

function toPositionValuationDataset(
  dataset: Pick<
    ParsedDataset,
    | "manualValuations"
    | "marketQuotes"
    | "externalMarketQuotes"
    | "transactions"
    | "fxRates"
    | "useMarketQuotes"
    | "useLatestTransactionFxRate"
  >,
): PositionValuationDataset {
  return {
    manualValuations: dataset.manualValuations.map((valuation) => ({
      instrumentID: valuation.instrumentID,
      value: valuation.value,
      currency: valuation.currency,
      date: toDate(valuation.date),
    })),
    marketQuotes: dataset.useMarketQuotes
      ? [
          ...dataset.marketQuotes.map((quote) => ({
            instrumentID: quote.instrumentID,
            price: quote.price,
            currency: quote.currency,
            date: toDate(quote.date),
          })),
          ...dataset.externalMarketQuotes,
        ]
      : [],
    transactions: dataset.transactions.map((transaction) => ({
      instrumentID: transaction.instrumentID,
      price: transaction.price,
      transactionType: transaction.transactionType,
      currency: transaction.currency,
      grossAmount: transaction.grossAmount,
      fxRateToBase: transaction.fxRateToBase,
      targetCurrency: transaction.targetCurrency,
      targetGrossAmount: transaction.targetGrossAmount,
      date: toDate(transaction.date),
    })),
    fxRates: dataset.fxRates,
    useLatestTransactionFxRate: dataset.useLatestTransactionFxRate,
  };
}

function toPositionAssetInput(
  asset: AssetPayload | undefined,
): PositionAssetInput | undefined {
  if (!asset) {
    return undefined;
  }

  return {
    kind: asset.kind,
    currency: asset.currency,
    bondParams: asset.bondParams
      ? normalizeTreasuryBondParams(asset.symbol, {
          maturityDate: toDate(asset.bondParams.maturityDate),
          nominalValue: asset.bondParams.nominalValue,
          firstPeriodRate: asset.bondParams.firstPeriodRate,
          subsequentBase: asset.bondParams.subsequentBase,
          marginOverBase: asset.bondParams.marginOverBase,
          capitalization: asset.bondParams.capitalization,
          interestPayment: asset.bondParams.interestPayment,
        })
      : null,
  };
}

function buildAllocation(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  asOf: Date,
): AllocationSlice[] {
  const values = new Map<string, number>();

  for (const account of accounts) {
    const ledger = computeLedger(
      transactionsForPortfolio(dataset.transactions, account.id),
      asOf,
    );
    const valuation = valuePortfolio(ledger, dataset, asOf);

    for (const [label, value] of valuation.allocationValues) {
      values.set(label, (values.get(label) ?? 0) + value);
    }
  }

  // Allocation is a ratio, so normalise against its own total. This is
  // currency-invariant: switching display currency does not change the shares.
  const total = [...values.values()].reduce((sum, value) => sum + value, 0);
  if (total <= EPSILON) {
    return [];
  }

  return [...values.entries()]
    .filter(([, value]) => value > EPSILON)
    .sort(([, left], [, right]) => right - left)
    .map(([label, value]) => ({
      label,
      percent: (value / total) * 100,
    }));
}

function buildValuationSeries(
  accounts: AccountPayload[],
  dataset: ParsedDataset,
  asOf: Date,
  options: SnapshotBuildOptions = {},
) {
  // Monthly is the default (kept for parity with the native app); the UI opts
  // into a daily series so the period selector and chart show day-to-day moves.
  const daily = options.historyGranularity === "daily";
  const dates = daily
    ? fullDailyDates(dataset, asOf)
    : fullMonthEndDates(dataset, asOf);

  return dates.map((date) => {
    const dayEnd = endOfLocalDay(date);
    const value = accounts.reduce((sum, account) => {
      const ledger = computeLedger(
        transactionsForPortfolio(dataset.transactions, account.id),
        dayEnd,
      );
      return sum + valuePortfolio(ledger, dataset, dayEnd).totalValue;
    }, 0);

    return {
      label: daily ? dayLabel(date) : monthLabel(date),
      date: date.toISOString(),
      value,
    };
  });
}

function fullDailyDates(dataset: ParsedDataset, asOf: Date): Date[] {
  const allDates = [
    ...dataset.transactions.map((t) => toDate(t.date)),
    ...dataset.manualValuations.map((v) => toDate(v.date)),
    ...dataset.marketQuotes.map((q) => toDate(q.date)),
    ...dataset.externalMarketQuotes.map((q) => q.date),
  ].filter((d) => !Number.isNaN(d.getTime()));

  if (allDates.length === 0) {
    return [startOfLocalDay(asOf)];
  }

  const earliest = startOfLocalDay(
    new Date(Math.min(...allDates.map((d) => d.getTime()))),
  );
  const end = startOfLocalDay(asOf);
  const dates: Date[] = [];
  let current = earliest;

  while (current.getTime() <= end.getTime()) {
    dates.push(current);
    current = addLocalDays(current, 1);
  }

  return dates;
}

function fullMonthEndDates(dataset: ParsedDataset, asOf: Date): Date[] {
  const allDates = [
    ...dataset.transactions.map((t) => toDate(t.date)),
    ...dataset.manualValuations.map((v) => toDate(v.date)),
    ...dataset.marketQuotes.map((q) => toDate(q.date)),
    ...dataset.externalMarketQuotes.map((q) => q.date),
  ].filter((d) => !Number.isNaN(d.getTime()));

  if (allDates.length === 0) {
    return [asOf];
  }

  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const dates: Date[] = [];

  let year = earliest.getUTCFullYear();
  let month = earliest.getUTCMonth();

  while (true) {
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    if (monthEnd >= asOf) {
      dates.push(asOf);
      break;
    }
    dates.push(monthEnd);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return dates;
}

function calculateMonthlyChange(
  valuationSeries: InvestorDataSnapshot["valuationSeries"],
) {
  if (valuationSeries.length === 0) return 0;
  const last = valuationSeries[valuationSeries.length - 1];
  const cutoff = new Date(last.date);
  cutoff.setMonth(cutoff.getMonth() - 1);

  // The most recent point at or before one month ago (series is chronological).
  let previous = valuationSeries[0];
  for (const point of valuationSeries) {
    if (new Date(point.date).getTime() <= cutoff.getTime()) {
      previous = point;
    } else {
      break;
    }
  }

  if (previous.value <= EPSILON) return 0;
  return ((last.value - previous.value) / previous.value) * 100;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addLocalDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function assetClassLabel(kind: string | undefined) {
  switch (kind) {
    case "stock":
    case "etf":
      return "Akcje / ETF";
    case "treasuryBond":
    case "listedBond":
      return "Obligacje";
    case "crypto":
      return "Kryptowaluty";
    case "deposit":
      return "Lokaty";
    case "cash":
      return "Gotówka";
    default:
      return "Inne aktywa";
  }
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "short" }).format(date);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(date);
}

function toDate(value: z.infer<typeof swiftDateSchema>) {
  if (typeof value === "number") {
    return new Date(APPLE_REFERENCE_DATE_UNIX_MS + value * 1000);
  }

  return new Date(value);
}

export function buildPortfolioDetail(
  records: DecryptedRecord[],
  portfolioId: string,
  options: SnapshotBuildOptions = {},
): PortfolioDetail | null {
  const dataset = parseDataset(records, options);
  const account = dataset.accounts.find((a) => a.id === portfolioId);
  if (!account) return null;

  const asOf = getAsOf(records, dataset, options);
  const displayCurrency = (options.displayCurrency ?? "PLN").toUpperCase();
  const baseToPln = makeBaseToPln(displayCurrency, dataset);
  const asOfRate = baseToPln(asOf);
  const transactions = transactionsForPortfolio(dataset.transactions, portfolioId);
  const ledger = computeLedger(transactions, asOf);
  const assetsByID = new Map(dataset.assets.map((a) => [a.id, a]));
  const valuationDataset = toPositionValuationDataset(dataset);

  const holdings: HoldingRow[] = [];
  let holdingsValue = 0;

  for (const [instrumentId, quantity] of ledger.positions) {
    if (quantity <= EPSILON) continue;

    const asset = assetsByID.get(instrumentId);
    const valuation = valueInstrumentPosition(
      {
        instrumentID: instrumentId,
        quantity,
        asset: toPositionAssetInput(asset),
        lots: ledger.openLots.get(instrumentId) ?? [],
        dataset: valuationDataset,
        asOf,
      },
    );
    const marketValue = valuation.marketValue / asOfRate;

    if (marketValue <= EPSILON) continue;

    holdingsValue += marketValue;
    holdings.push({
      instrumentId,
      symbol: asset?.symbol ?? instrumentId.slice(0, 8),
      name: asset?.name ?? asset?.symbol ?? instrumentId.slice(0, 8),
      kind: asset?.kind ?? "unknown",
      quantity,
      lastPrice: valuation.price,
      currency: valuation.currency,
      valuationSource: valuation.source,
      valuationSourceLabel: valuation.sourceLabel,
      marketValue,
      portfolioPercent: 0,
    });
  }

  // cashValue is in the display currency; per-currency cashBalances below stay
  // in their own currency (each carries its `currency`).
  const cashValue = valueCash(ledger, dataset, asOf) / asOfRate;
  const totalValue = holdingsValue + cashValue;

  for (const h of holdings) {
    h.portfolioPercent = totalValue > EPSILON ? (h.marketValue / totalValue) * 100 : 0;
  }

  holdings.sort((a, b) => b.marketValue - a.marketValue);

  const cashBalances: CashBalance[] = [...ledger.cashBalances.entries()]
    .filter(([, amount]) => Math.abs(amount) > EPSILON)
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => b.amount - a.amount);

  const valuationSeries = convertSeriesCurrency(
    buildValuationSeries([account], dataset, asOf, options),
    baseToPln,
  );

  const cashflows = buildCashflowSummary([account], dataset, asOf, baseToPln);
  const netInvestedSeries = buildNetInvestedSeries(
    [account],
    dataset,
    valuationSeries,
    baseToPln,
  );
  const performanceSeries = buildPerformanceSeries(
    [account],
    dataset,
    valuationSeries,
    baseToPln,
  );
  const metrics = buildMetrics(
    [account],
    dataset,
    asOf,
    totalValue,
    performanceSeries,
    baseToPln,
  );

  return {
    id: account.id,
    name: account.name,
    baseCurrency: account.baseCurrency,
    totalValue,
    cashValue,
    holdings,
    cashBalances,
    valuationSeries,
    netInvestedSeries,
    metrics,
    cashflows,
  };
}

export function buildTransactionList(records: DecryptedRecord[]): TransactionRow[] {
  const dataset = parseDataset(records);
  const accountsById = new Map(dataset.accounts.map((a) => [a.id, a]));
  const assetsById = new Map(dataset.assets.map((a) => [a.id, a]));

  return dataset.transactions
    .map((tx) => {
      const portfolio = accountsById.get(tx.portfolioID);
      const asset = tx.instrumentID ? assetsById.get(tx.instrumentID) : undefined;
      return {
        id: tx.id,
        date: toDate(tx.date).toISOString(),
        portfolioId: tx.portfolioID,
        portfolioName: portfolio?.name ?? tx.portfolioID.slice(0, 8),
        instrumentId: tx.instrumentID ?? null,
        instrumentSymbol: asset?.symbol ?? null,
        instrumentName: asset?.name ?? null,
        transactionType: tx.transactionType,
        quantity: tx.quantity ?? null,
        price: tx.price ?? null,
        grossAmount: tx.grossAmount,
        currency: tx.currency,
        fees: tx.fees,
        taxes: tx.taxes,
      } satisfies TransactionRow;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const employmentTypes = new Set<EmploymentType>(["employment", "business"]);
const burdenCategories = new Set<EarningBurdenCategory>([
  "incomeTax",
  "vat",
  "zus",
  "accounting",
]);

function isEmploymentType(value: string | null | undefined): value is EmploymentType {
  return typeof value === "string" && employmentTypes.has(value as EmploymentType);
}

function isBurdenCategory(value: string | null | undefined): value is EarningBurdenCategory {
  return typeof value === "string" && burdenCategories.has(value as EarningBurdenCategory);
}

export function buildIncomeLists(records: DecryptedRecord[]): IncomeLists {
  const dataset = parseDataset(records);
  const updatedAtByIncomeId = new Map(
    records
      .filter((record) => !record.deletedAt && record.envelope.type === "income")
      .map((record) => [record.id, record.updatedAt] as const),
  );
  const earnings: EarningRow[] = [];
  const burdens: EarningBurdenRow[] = [];

  for (const item of dataset.income) {
    if (item.entryKind === "earning") {
      if (
        !isEmploymentType(item.employmentType) ||
        typeof item.enteredAmount !== "number" ||
        typeof item.currency !== "string" ||
        typeof item.fxRateToPLN !== "number" ||
        typeof item.plnAmount !== "number"
      ) {
        continue;
      }

      earnings.push({
        id: item.id,
        kind: "earning",
        year: item.year,
        month: item.month,
        employmentType: item.employmentType,
        enteredAmount: item.enteredAmount,
        currency: item.currency,
        fxRateToPLN: item.fxRateToPLN,
        plnAmount: item.plnAmount,
        source: item.source?.trim() || "Wynagrodzenie",
        note: item.note?.trim() || null,
        sourceUpdatedAt: updatedAtByIncomeId.get(item.id) ?? null,
      });
    } else {
      if (!isBurdenCategory(item.burdenCategory) || typeof item.amountPLN !== "number") {
        continue;
      }

      burdens.push({
        id: item.id,
        kind: "burden",
        year: item.year,
        month: item.month,
        category: item.burdenCategory,
        amountPLN: item.amountPLN,
        note: item.note?.trim() || null,
        sourceUpdatedAt: updatedAtByIncomeId.get(item.id) ?? null,
      });
    }
  }

  return buildIncomeListsFromRows(earnings, burdens);
}

export function buildInstrumentList(
  records: DecryptedRecord[],
  options: SnapshotBuildOptions = {},
): InstrumentRow[] {
  const dataset = parseDataset(records, options);
  const asOf = getAsOf(records, dataset, options);
  const valuationDataset = toPositionValuationDataset(dataset);
  const displayCurrency = (options.displayCurrency ?? "PLN").toUpperCase();
  const asOfRate = makeBaseToPln(displayCurrency, dataset)(asOf);

  // Aggregate quantity held per instrument across all portfolios
  const quantityByInstrument = new Map<string, number>();
  const aggregateLedger: Ledger = {
    positions: new Map(),
    cashBalances: new Map(),
    openLots: new Map(),
  };
  const portfoliosByInstrument = new Map<string, Set<string>>();

  for (const account of dataset.accounts) {
    const txs = transactionsForPortfolio(dataset.transactions, account.id);
    const ledger = computeLedger(txs, asOf);
    for (const [instrumentId, qty] of ledger.positions) {
      if (qty <= EPSILON) continue;
      quantityByInstrument.set(instrumentId, (quantityByInstrument.get(instrumentId) ?? 0) + qty);
      aggregateLedger.positions.set(
        instrumentId,
        (aggregateLedger.positions.get(instrumentId) ?? 0) + qty,
      );
      aggregateLedger.openLots.set(
        instrumentId,
        [
          ...(aggregateLedger.openLots.get(instrumentId) ?? []),
          ...(ledger.openLots.get(instrumentId) ?? []),
        ],
      );
      const pfSet = portfoliosByInstrument.get(instrumentId) ?? new Set();
      pfSet.add(account.name);
      portfoliosByInstrument.set(instrumentId, pfSet);
    }
  }

  const rows: InstrumentRow[] = [];

  for (const asset of dataset.assets) {
    const totalQuantity = quantityByInstrument.get(asset.id) ?? 0;
    const valuation = valueInstrumentPosition(
      {
        instrumentID: asset.id,
        quantity: totalQuantity,
        asset: toPositionAssetInput(asset),
        lots: aggregateLedger.openLots.get(asset.id) ?? [],
        dataset: valuationDataset,
        asOf,
      },
    );

    rows.push({
      id: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      kind: asset.kind,
      currency: valuation.currency,
      lastPrice: valuation.price,
      lastPriceDate: valuation.priceDate?.toISOString() ?? null,
      valuationSource: valuation.source,
      valuationSourceLabel: valuation.sourceLabel,
      totalQuantity,
      // marketValue is in the display currency; lastPrice stays in the
      // instrument's own currency (shown alongside its `currency`).
      marketValue: valuation.marketValue / asOfRate,
      portfolios: [...(portfoliosByInstrument.get(asset.id) ?? [])],
    });
  }

  // Sort: held first (by market value), then unowned alphabetically
  return rows.sort((a, b) => {
    const aHeld = a.totalQuantity > EPSILON;
    const bHeld = b.totalQuantity > EPSILON;
    if (aHeld && !bHeld) return -1;
    if (!aHeld && bHeld) return 1;
    if (aHeld && bHeld) return b.marketValue - a.marketValue;
    return a.name.localeCompare(b.name, "pl");
  });
}
