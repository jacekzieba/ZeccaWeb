export type RecordType =
  | "account"
  | "asset"
  | "transaction"
  | "manualValuation"
  | "income"
  | "settings"
  | "marketQuote";

export type ValuationPoint = {
  label: string;
  date: string;
  value: number;
};

export type AllocationSlice = {
  label: string;
  percent: number;
};

export type PortfolioSummary = {
  id: string;
  name: string;
  baseCurrency: string;
  value: number;
  dailyChange: number;
  positions: number;
  /** Recent daily values for an inline sparkline (chronological). */
  sparkline: number[];
};

export type IncomeSummary = {
  earningCount: number;
  burdenCount: number;
  earningsPLN: number;
  burdensPLN: number;
  netPLN: number;
};

export type PortfolioMetrics = {
  /** Net external capital contributed (deposits − withdrawals), base currency. */
  netInvested: number;
  /** Time-weighted total return, percent, neutral to deposits/withdrawals. */
  totalReturnPct: number;
  /** Annualised time-weighted return (CAGR) over the valuation span, percent. */
  cagrPct: number;
  /** Inflation-adjusted total return, percent. */
  realReturnPct: number;
  /** Annualised money-weighted return (XIRR), percent, or null if unsolvable. */
  xirrPct: number | null;
  /** Maximum drawdown of the valuation series, non-positive percent. */
  maxDrawdownPct: number;
  /** Realised P&L from closed positions (FIFO proceeds − cost basis), base
   * currency. Exact for single-currency data; FX figures are converted at the
   * as-of rate. */
  realizedPnl: number;
  /** Assumed annual inflation used for the real return, percent. */
  inflationPct: number;
};

/** Portfolio cashflows aggregated from transactions, in the base currency.
 * Distinct from {@link IncomeSummary}, which tracks the user's *personal*
 * earnings/burdens (salary, expenses) and must never be shown as dividends. */
export type CashflowSummary = {
  dividends: number;
  interest: number;
  fees: number;
  taxes: number;
};

export type InvestorDataSnapshot = {
  asOf: string;
  totalValue: number;
  monthlyChange: number;
  cash: number;
  income: IncomeSummary;
  cashflows: CashflowSummary;
  portfolios: PortfolioSummary[];
  valuationSeries: ValuationPoint[];
  /** Cumulative net external capital (deposits − withdrawals) at each
   * valuation-series date, display currency. Aligned 1:1 with valuationSeries
   * so the two can be overlaid (value vs. contributions). */
  netInvestedSeries: ValuationPoint[];
  /** Time-weighted return index (growth of 100), neutral to deposits/withdrawals.
   * Use this — not raw value — to compare actual performance vs a benchmark. */
  performanceSeries: ValuationPoint[];
  allocation: AllocationSlice[];
  metrics: PortfolioMetrics;
  /** Gate-relevant settings surfaced for telemetry. Optional: demo/sample
   * snapshots omit it, which keeps the telemetry gate closed by default. */
  settings?: SnapshotSettings;
};

/** Subset of the synced settings record needed to gate telemetry. Carries no
 * financial values — only consent flags and the sync mode. */
export type SnapshotSettings = {
  telemetryEnabled: boolean;
  hasAcknowledgedPrivacyDisclosure: boolean;
  syncMode: string | null;
};

export type HoldingRow = {
  instrumentId: string;
  symbol: string;
  name: string;
  kind: string;
  quantity: number;
  lastPrice: number;
  currency: string;
  valuationSource: "manual" | "market" | "transaction" | "treasuryBond" | "missing";
  valuationSourceLabel: string;
  marketValue: number;
  portfolioPercent: number;
};

export type CashBalance = {
  currency: string;
  amount: number;
};

export type PortfolioDetail = {
  id: string;
  name: string;
  baseCurrency: string;
  totalValue: number;
  cashValue: number;
  holdings: HoldingRow[];
  cashBalances: CashBalance[];
  valuationSeries: ValuationPoint[];
  /** Cumulative net external capital aligned to valuationSeries (see snapshot). */
  netInvestedSeries: ValuationPoint[];
  /** Return/risk metrics for this portfolio, computed like the global snapshot. */
  metrics: PortfolioMetrics;
  /** Dividends / interest / fees / taxes booked on this portfolio. */
  cashflows: CashflowSummary;
};

export type TransactionRow = {
  id: string;
  date: string;
  portfolioId: string;
  portfolioName: string;
  instrumentId: string | null;
  instrumentSymbol: string | null;
  instrumentName: string | null;
  transactionType: string;
  quantity: number | null;
  price: number | null;
  grossAmount: number;
  currency: string;
  fees: number;
  taxes: number;
};

export type InstrumentRow = {
  id: string;
  symbol: string;
  name: string;
  kind: string;
  currency: string;
  lastPrice: number;
  lastPriceDate: string | null;
  valuationSource: "manual" | "market" | "transaction" | "treasuryBond" | "missing";
  valuationSourceLabel: string;
  totalQuantity: number;
  marketValue: number;
  portfolios: string[];
};
