"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { CPI_YOY, type CpiSeries } from "@/domain/valuation/bond-rates";
import type { CpiObservation } from "@/market-data/types";
import { isFakeSyncEnabled } from "@/lib/env";
import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";

type CpiResponse = {
  data: CpiObservation[];
};

// The hardcoded GUS table in bond-rates.ts already covers history through
// 2025-12; this window only needs to reach back far enough to extend it, not
// re-fetch years already baked into the table.
const LOOKBACK_MONTHS = 24;

/**
 * Feeds a live GUS CPI series into the sync store so inflation-indexed
 * treasury bonds price against current inflation, not just the hardcoded
 * table (which stops at 2025-12). Mirrors the native app's live
 * GUSInflationProvider fetch.
 */
export function MarketCpiBootstrap() {
  const records = useSyncStore((state) => state.records);
  const setMarketCpi = useSyncStore((state) => state.setMarketCpi);
  const appliedKey = useRef<string | null>(null);

  // Fake sync seeds a deterministic scenario (used by dev mode and e2e tests)
  // that must price its bonds off the hardcoded table, not a live network call.
  const enabled = !isFakeSyncEnabled();

  const needsCpi = useMemo(() => {
    if (!records || !enabled) return false;
    return buildInstrumentList(records).some(
      (row) => row.valuationSource === "treasuryBond" && row.totalQuantity > 0,
    );
  }, [records, enabled]);

  const { start, end } = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setUTCMonth(startDate.getUTCMonth() - LOOKBACK_MONTHS);
    return {
      start: startDate.toISOString().slice(0, 10),
      end: endDate.toISOString().slice(0, 10),
    };
  }, []);

  const query = useQuery({
    queryKey: ["market-cpi", start, end],
    enabled: needsCpi,
    staleTime: 6 * 60 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch(
        `/api/market-data/cpi?start=${start}&end=${end}`,
      );
      const body = (await response.json()) as CpiResponse | { error?: string };
      if (!response.ok || !("data" in body)) {
        throw new Error("Nie udało się pobrać wskaźnika CPI GUS.");
      }
      return body.data;
    },
  });

  useEffect(() => {
    if (!needsCpi) {
      setMarketCpi(CPI_YOY);
      appliedKey.current = null;
      return;
    }

    if (query.status !== "success") {
      return;
    }

    const key = query.data.map((o) => `${o.date}=${o.yoyRate}`).join("|");
    if (appliedKey.current === key) {
      return;
    }

    const cpi: CpiSeries = { ...CPI_YOY };
    for (const observation of query.data) {
      cpi[observation.date.slice(0, 7)] = observation.yoyRate;
    }

    appliedKey.current = key;
    setMarketCpi(cpi);
  }, [needsCpi, query.status, query.data, setMarketCpi]);

  return null;
}
