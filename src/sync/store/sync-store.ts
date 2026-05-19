import { create } from "zustand";
import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import type { FxRateInput } from "@/domain/valuation/price-resolver";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { BrowserSupabaseClient } from "@/supabase/client";

type SyncState = {
  records: DecryptedRecord[] | null;
  snapshot: InvestorDataSnapshot | null;
  marketFxRates: FxRateInput[];
  userDataKey: CryptoKey | null;
  supabase: BrowserSupabaseClient | null;
  addTransactionOpen: boolean;

  setSync: (records: DecryptedRecord[], snapshot: InvestorDataSnapshot) => void;
  setMarketFxRates: (rates: FxRateInput[]) => void;
  setCredentials: (key: CryptoKey, supabase: BrowserSupabaseClient) => void;
  clearSync: () => void;
  openAddTransaction: () => void;
  closeAddTransaction: () => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  records: null,
  snapshot: null,
  marketFxRates: [],
  userDataKey: null,
  supabase: null,
  addTransactionOpen: false,

  setSync: (records, snapshot) => set({ records, snapshot }),
  setMarketFxRates: (marketFxRates) => set({ marketFxRates }),
  setCredentials: (userDataKey, supabase) => set({ userDataKey, supabase }),
  clearSync: () => set({ records: null, snapshot: null, marketFxRates: [], userDataKey: null, supabase: null }),
  openAddTransaction: () => set({ addTransactionOpen: true }),
  closeAddTransaction: () => set({ addTransactionOpen: false }),
}));
