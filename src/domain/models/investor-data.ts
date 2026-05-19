export type RecordType =
  | "account"
  | "asset"
  | "transaction"
  | "manualValuation"
  | "income"
  | "settings";

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
};

export type InvestorDataSnapshot = {
  asOf: string;
  totalValue: number;
  monthlyChange: number;
  cash: number;
  portfolios: PortfolioSummary[];
  valuationSeries: ValuationPoint[];
  allocation: AllocationSlice[];
};

export type HoldingRow = {
  instrumentId: string;
  symbol: string;
  name: string;
  kind: string;
  quantity: number;
  lastPrice: number;
  currency: string;
  valuationSource: "manual" | "transaction" | "treasuryBond" | "missing";
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
  valuationSource: "manual" | "transaction" | "treasuryBond" | "missing";
  valuationSourceLabel: string;
  totalQuantity: number;
  marketValue: number;
  portfolios: string[];
};
