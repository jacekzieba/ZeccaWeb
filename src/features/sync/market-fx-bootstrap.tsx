"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { FxRateInput } from "@/domain/valuation/price-resolver";
import type { FxRate } from "@/market-data/types";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

type FxResponse = {
  data: FxRate;
};

export function MarketFxBootstrap() {
  const records = useSyncStore((state) => state.records);
  const snapshot = useSyncStore((state) => state.snapshot);
  const setSync = useSyncStore((state) => state.setSync);
  const setMarketFxRates = useSyncStore((state) => state.setMarketFxRates);
  const appliedKey = useRef<string | null>(null);

  const valuationDate = snapshot?.asOf.slice(0, 10) ?? null;
  const currencies = useMemo(
    () => (records ? currenciesNeedingFx(records) : []),
    [records],
  );

  const queries = useQueries({
    queries: currencies.map((currency) => ({
      queryKey: ["market-fx", currency, valuationDate],
      enabled: Boolean(valuationDate),
      queryFn: async () => {
        const response = await fetch(
          `/api/market-data/fx?code=${encodeURIComponent(currency)}&date=${valuationDate}`,
        );
        const body = await response.json() as FxResponse | { error?: string };
        if (!response.ok || !("data" in body)) {
          throw new Error("Nie udało się pobrać kursu NBP.");
        }
        return body.data;
      },
      staleTime: 60 * 60 * 1000,
    })),
  });

  useEffect(() => {
    if (!records || currencies.length === 0) {
      setMarketFxRates([]);
      appliedKey.current = null;
      return;
    }

    if (queries.some((query) => query.status !== "success")) {
      return;
    }

    const rates: FxRateInput[] = queries.map((query) => {
      const rate = query.data!;
      return {
        currency: rate.base,
        rate: rate.rate,
        date: new Date(`${rate.effectiveDate}T00:00:00.000Z`),
      };
    });
    const key = rates
      .map((rate) => `${rate.currency}:${rate.date.toISOString()}:${rate.rate}`)
      .sort()
      .join("|");

    if (appliedKey.current === key) {
      return;
    }

    appliedKey.current = key;
    setMarketFxRates(rates);
    setSync(records, buildInvestorDataSnapshot(records, { fxRates: rates, historyGranularity: "daily" }));
  }, [currencies.length, queries, records, setMarketFxRates, setSync]);

  return null;
}

function currenciesNeedingFx(records: DecryptedRecord[]) {
  const currencies = new Set<string>();

  for (const record of records) {
    if (record.deletedAt) {
      continue;
    }

    const payload = record.envelope.payload as {
      currency?: string | null;
      targetCurrency?: string | null;
    };

    addCurrency(currencies, payload.currency);
    addCurrency(currencies, payload.targetCurrency);
  }

  return [...currencies].sort();
}

function addCurrency(currencies: Set<string>, value: string | null | undefined) {
  const currency = value?.trim().toUpperCase();
  if (!currency || currency === "PLN") {
    return;
  }
  currencies.add(currency);
}
