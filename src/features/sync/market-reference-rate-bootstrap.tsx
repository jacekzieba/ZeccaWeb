"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  NBP_REFERENCE_RATES,
  type ReferenceRateSeries,
} from "@/domain/valuation/bond-rates";
import type { ReferenceRateChange } from "@/market-data/types";
import { buildInstrumentList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";

type ReferenceRatesResponse = {
  data: ReferenceRateChange[];
};

/**
 * Feeds the live NBP reference-rate history into the sync store so ROR/DOR
 * bonds (subsequentBase "stopa referencyjna NBP") price against the current
 * rate path after every RPP decision, not just the hardcoded fallback table.
 * Mirrors the native NBPInterestRateProvider refresh (live series replaces the
 * fallback wholesale when it is non-empty).
 */
export function MarketReferenceRateBootstrap() {
  const records = useSyncStore((state) => state.records);
  const setMarketReferenceRates = useSyncStore(
    (state) => state.setMarketReferenceRates,
  );
  const appliedKey = useRef<string | null>(null);

  const needsRates = useMemo(() => {
    if (!records) return false;
    return buildInstrumentList(records).some(
      (row) => row.valuationSource === "treasuryBond" && row.totalQuantity > 0,
    );
  }, [records]);

  const query = useQuery({
    queryKey: ["market-reference-rates"],
    enabled: needsRates,
    staleTime: 6 * 60 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch("/api/market-data/reference-rates");
      const body = (await response.json()) as
        | ReferenceRatesResponse
        | { error?: string };
      if (!response.ok || !("data" in body)) {
        throw new Error("Nie udało się pobrać stóp referencyjnych NBP.");
      }
      return body.data;
    },
  });

  useEffect(() => {
    if (!needsRates) {
      setMarketReferenceRates(NBP_REFERENCE_RATES);
      appliedKey.current = null;
      return;
    }

    if (query.status !== "success" || query.data.length === 0) {
      return;
    }

    const key = query.data
      .map((change) => `${change.effectiveDate}=${change.rate}`)
      .join("|");
    if (appliedKey.current === key) {
      return;
    }

    const series: ReferenceRateSeries = query.data.map((change) => ({
      date: new Date(`${change.effectiveDate}T00:00:00.000Z`),
      rate: change.rate,
    }));

    appliedKey.current = key;
    setMarketReferenceRates(series);
  }, [needsRates, query.status, query.data, setMarketReferenceRates]);

  return null;
}
