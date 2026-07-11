import { create } from "zustand";
import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import type { FxRateInput, MarketQuoteInput } from "@/domain/valuation/price-resolver";
import { CPI_YOY, type CpiSeries } from "@/domain/valuation/bond-rates";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { BrowserSupabaseClient } from "@/supabase/client";

type SyncState = {
  records: DecryptedRecord[] | null;
  snapshot: InvestorDataSnapshot | null;
  lastSyncedAt: number | null;
  marketFxRates: FxRateInput[];
  marketQuotes: MarketQuoteInput[];
  /** Defaults to the hardcoded GUS table; live GUS readings extend it. */
  marketCpi: CpiSeries;
  userDataKey: CryptoKey | null;
  supabase: BrowserSupabaseClient | null;
  addTransactionOpen: boolean;

  setSync: (records: DecryptedRecord[], snapshot: InvestorDataSnapshot) => void;
  setMarketFxRates: (rates: FxRateInput[]) => void;
  setMarketQuotes: (quotes: MarketQuoteInput[]) => void;
  setMarketCpi: (cpi: CpiSeries) => void;
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
  userDataKey: null,
  supabase: null,
  addTransactionOpen: false,

  setSync: (records, snapshot) => set({ records, snapshot, lastSyncedAt: Date.now() }),
  setMarketFxRates: (marketFxRates) => set({ marketFxRates }),
  setMarketQuotes: (marketQuotes) => set({ marketQuotes }),
  setMarketCpi: (marketCpi) => set({ marketCpi }),
  setCredentials: (userDataKey, supabase) => set({ userDataKey, supabase }),
  clearSync: () => set({ records: null, snapshot: null, lastSyncedAt: null, marketFxRates: [], marketQuotes: [], marketCpi: CPI_YOY, userDataKey: null, supabase: null }),
  openAddTransaction: () => set({ addTransactionOpen: true }),
  closeAddTransaction: () => set({ addTransactionOpen: false }),
}));
