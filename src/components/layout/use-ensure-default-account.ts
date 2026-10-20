import { useEffect, useRef } from "react";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { makeAccountPayload } from "@/sync/records/macos-payloads";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { isFakeSyncEnabled } from "@/lib/env";
import { useSyncStore } from "@/sync/store/sync-store";

export function useEnsureDefaultAccount() {
  const records = useSyncStore((s) => s.records);
  const setSync = useSyncStore((s) => s.setSync);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const ensuringDefaultAccountRef = useRef(false);
  // Jedno ID na wszystkie próby: zakolejkowany zapis nie widać w `records`, więc
  // efekt ponawia przy każdym odświeżeniu — z nowym ID każda próba dokładała
  // do kolejki kolejny portfel „Główny”. Z tym samym kolejka trzyma jeden.
  const defaultAccountIdRef = useRef<string | null>(null);

  // The dashboard/add-transaction pickers only ever list real "account"
  // records — a user who never explicitly created a portfolio had nothing to
  // pick, so transactions (and the portfolio itself) couldn't be created at
  // all. buildInvestorDataSnapshot used to paper over this with a synthetic,
  // never-persisted "Portfel" placeholder, which is exactly what made both
  // bugs invisible in the data layer while still blocking the user. Create
  // one real, persisted account instead, the first time we see there isn't one.
  useEffect(() => {
    if (!records || !userDataKey || !supabase || ensuringDefaultAccountRef.current) {
      return;
    }
    const hasRealAccount = records.some(
      (record) => !record.deletedAt && record.envelope.type === "account",
    );
    if (hasRealAccount) return;

    ensuringDefaultAccountRef.current = true;
    void (async () => {
      try {
        const id = (defaultAccountIdRef.current ??= crypto.randomUUID());
        const payload = makeAccountPayload({ id, name: "Główny", baseCurrency: "PLN", accountType: "Własny" });
        if (isFakeSyncEnabled()) {
          const now = new Date().toISOString();
          const nextRecords = [
            ...records,
            { id, deviceId: "fake-sync-web", updatedAt: now, deletedAt: null, envelope: { type: "account" as const, payloadVersion: 1, schemaVersion: 1, payload } },
          ];
          setSync(nextRecords, buildInvestorDataSnapshot(nextRecords, { asOf: new Date(), historyGranularity: "daily", useLatestTransactionFxRate: true, useMarketQuotes: true }));
        } else {
          const result = await saveRecord(supabase, userDataKey, "account", payload);
          if (!result.queued) {
            const refreshed = await refreshSyncStore(supabase, userDataKey);
            setSync(refreshed.records, refreshed.snapshot);
          } else {
            // Queued for later (offline) — local `records` still has no
            // account, so allow this effect to check again (and retry if
            // still needed) once anything else changes, instead of staying
            // permanently blocked by the ref for this component's lifetime.
            ensuringDefaultAccountRef.current = false;
          }
        }
      } catch {
        // Network hiccup or similar — try again next time this mounts with
        // no real account rather than leaving the user permanently stuck.
        ensuringDefaultAccountRef.current = false;
      }
    })();
  }, [records, userDataKey, supabase, setSync]);
}
