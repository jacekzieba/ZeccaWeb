import { create } from "zustand";
import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import type { FxRateInput, MarketQuoteInput } from "@/domain/valuation/price-resolver";
import {
  CPI_YOY,
  NBP_REFERENCE_RATES,
  type CpiSeries,
  type ReferenceRateSeries,
} from "@/domain/valuation/bond-rates";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { BrowserSupabaseClient } from "@/supabase/client";

type SyncState = {
  records: DecryptedRecord[] | null;
  snapshot: InvestorDataSnapshot | null;
  lastSyncedAt: number | null;
  marketFxRates: FxRateInput[];
  marketQuotes: MarketQuoteInput[];
  /**
   * As-announced CPI for bond coupons: the hardcoded GUS table, extended only
   * with newly announced months. Live GUS never overwrites an existing month
   * here, so a later annual revision can't change a locked-in bond coupon.
   */
  marketCpi: CpiSeries;
  /** Revised/current CPI for the real-return metric; live GUS overwrites freely. */
  marketMetricsCpi: CpiSeries;
  /** Defaults to the hardcoded NBP table; live NBP archive readings replace it. */
  marketReferenceRates: ReferenceRateSeries;
  userDataKey: CryptoKey | null;
  supabase: BrowserSupabaseClient | null;
  addTransactionOpen: boolean;
  /**
   * Signed-out visitor browsing the sample dataset. Writes are already blocked
   * by the missing `userDataKey`; this flag lets screens hide account-only
   * actions and explain why saving is off.
   */
  publicDemo: boolean;

  setSync: (records: DecryptedRecord[], snapshot: InvestorDataSnapshot) => void;
  setPublicDemo: (publicDemo: boolean) => void;
  setMarketFxRates: (rates: FxRateInput[]) => void;
  setMarketQuotes: (quotes: MarketQuoteInput[]) => void;
  setMarketCpi: (cpi: CpiSeries) => void;
  setMarketMetricsCpi: (cpi: CpiSeries) => void;
  setMarketReferenceRates: (rates: ReferenceRateSeries) => void;
  setCredentials: (key: CryptoKey, supabase: BrowserSupabaseClient) => void;
  clearSync: () => void;
  openAddTransaction: () => void;
  closeAddTransaction: () => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  records: null,
  snapshot: null,
  lastSyncedAt: null,
  marketFxRates: [],
  marketQuotes: [],
  marketCpi: CPI_YOY,
  marketMetricsCpi: CPI_YOY,
  marketReferenceRates: NBP_REFERENCE_RATES,
  userDataKey: null,
  supabase: null,
  addTransactionOpen: false,
  publicDemo: false,

  setSync: (records, snapshot) => set({ records, snapshot, lastSyncedAt: Date.now() }),
  setPublicDemo: (publicDemo) => set({ publicDemo }),
  setMarketFxRates: (marketFxRates) => set({ marketFxRates }),
  setMarketQuotes: (marketQuotes) => set({ marketQuotes }),
  setMarketCpi: (marketCpi) => set({ marketCpi }),
  setMarketMetricsCpi: (marketMetricsCpi) => set({ marketMetricsCpi }),
  setMarketReferenceRates: (marketReferenceRates) => set({ marketReferenceRates }),
  setCredentials: (userDataKey, supabase) => set({ userDataKey, supabase }),
  clearSync: () => set({ records: null, snapshot: null, lastSyncedAt: null, marketFxRates: [], marketQuotes: [], marketCpi: CPI_YOY, marketMetricsCpi: CPI_YOY, marketReferenceRates: NBP_REFERENCE_RATES, userDataKey: null, supabase: null, publicDemo: false }),
  openAddTransaction: () => set({ addTransactionOpen: true }),
  closeAddTransaction: () => set({ addTransactionOpen: false }),
}));
