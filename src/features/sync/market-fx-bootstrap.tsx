"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { FxRateInput } from "@/domain/valuation/price-resolver";
import type { FxRate } from "@/market-data/types";
import { useProfile } from "@/features/profile/profile-store";
import { useSyncStore } from "@/sync/store/sync-store";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

type FxResponse = {
  data: FxRate;
};

type FxSeriesResponse = {
  data: FxRate[];
};

export function MarketFxBootstrap() {
  const records = useSyncStore((state) => state.records);
  const snapshot = useSyncStore((state) => state.snapshot);
  const setMarketFxRates = useSyncStore((state) => state.setMarketFxRates);
  const { displayCurrency } = useProfile();
  const appliedKey = useRef<string | null>(null);

  const valuationDate = snapshot?.asOf.slice(0, 10) ?? null;
  const currencies = useMemo(
    () => (records ? currenciesNeedingFx(records) : []),
    [records],
  );

  // Earliest day in the dashboard series — the window the display currency must
  // cover so a multi-year chart can be converted at each day's rate.
  const seriesStart = snapshot?.valuationSeries[0]?.date?.slice(0, 10) ?? null;
  const needsDisplayFx = displayCurrency !== "PLN";

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

  const displaySeriesQuery = useQuery({
    queryKey: ["market-fx-series", displayCurrency, seriesStart, valuationDate],
    enabled: needsDisplayFx && Boolean(seriesStart && valuationDate),
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const response = await fetch(
        `/api/market-data/fx?code=${encodeURIComponent(displayCurrency)}&start=${seriesStart}&end=${valuationDate}`,
      );
      const body = (await response.json()) as FxSeriesResponse | { error?: string };
      if (!response.ok || !("data" in body)) {
        throw new Error("Nie udało się pobrać historii kursu NBP.");
      }
      return body.data;
    },
  });

  useEffect(() => {
    if (!records || (currencies.length === 0 && !needsDisplayFx)) {
      setMarketFxRates([]);
      appliedKey.current = null;
      return;
    }

    if (queries.some((query) => query.status !== "success")) {
      return;
    }
    // Wait for the display-currency history too, otherwise the snapshot would
    // briefly render PLN values labelled as EUR/USD.
    if (needsDisplayFx && displaySeriesQuery.status !== "success") {
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

    if (needsDisplayFx && displaySeriesQuery.data) {
      for (const rate of displaySeriesQuery.data) {
        rates.push({
          currency: rate.base,
          rate: rate.rate,
          date: new Date(`${rate.effectiveDate}T00:00:00.000Z`),
        });
      }
    }

    const key = rates
      .map((rate) => `${rate.currency}:${rate.date.toISOString()}:${rate.rate}`)
      .sort()
      .join("|");

    if (appliedKey.current === key) {
      return;
    }

    appliedKey.current = key;
    setMarketFxRates(rates);
  }, [
    currencies.length,
    needsDisplayFx,
    queries,
    displaySeriesQuery.status,
    displaySeriesQuery.data,
    records,
    setMarketFxRates,
  ]);

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
