"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import type { FxRateInput } from "@/domain/valuation/price-resolver";
import type { MarketQuoteInput } from "@/domain/valuation/price-resolver";
import type { FxRate } from "@/market-data/types";
import { useProfile } from "@/features/profile/profile-store";
import { useSyncStore } from "@/sync/store/sync-store";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";

type FxSeriesResponse = {
  data: FxRate[];
};

const FX_SERIES_LOOKBACK_DAYS = 14;

/**
 * Includes a short lead-in so the first valuation day (which may be a weekend
 * or holiday) can carry forward the last published NBP fixing.
 */
export function marketFxSeriesPath(currency: string, start: string, end: string) {
  const rangeStart = new Date(`${start}T00:00:00.000Z`);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - FX_SERIES_LOOKBACK_DAYS);
  const params = new URLSearchParams({
    code: currency,
    start: rangeStart.toISOString().slice(0, 10),
    end,
  });
  return `/api/market-data/fx?${params.toString()}`;
}

export function MarketFxBootstrap() {
  const records = useSyncStore((state) => state.records);
  const snapshot = useSyncStore((state) => state.snapshot);
  const marketQuotes = useSyncStore((state) => state.marketQuotes);
  const setMarketFxRates = useSyncStore((state) => state.setMarketFxRates);
  const { displayCurrency } = useProfile();
  const appliedKey = useRef<string | null>(null);

  const valuationDate = snapshot?.asOf.slice(0, 10) ?? null;
  const currencies = useMemo(() => {
    if (!records) return [];
    const required = new Set(currenciesNeedingFx(records, marketQuotes));
    if (displayCurrency !== "PLN") required.add(displayCurrency);
    return [...required].sort();
  }, [records, marketQuotes, displayCurrency]);

  // Every quote/transaction currency needs the whole dashboard window. Loading
  // only today's GBP rate would price older VWRL.L points at the fallback 1:1
  // rate and manufacture a large gain on the final day.
  const seriesStart = snapshot?.valuationSeries[0]?.date?.slice(0, 10) ?? null;
  const needsDisplayFx = displayCurrency !== "PLN";

  const queries = useQueries({
    queries: currencies.map((currency) => ({
      queryKey: ["market-fx-series", currency, seriesStart, valuationDate],
      enabled: Boolean(seriesStart && valuationDate),
      queryFn: async () => {
        const response = await fetch(marketFxSeriesPath(currency, seriesStart!, valuationDate!));
        const body = await response.json() as FxSeriesResponse | { error?: string };
        if (!response.ok || !("data" in body)) {
          throw new Error("Nie udało się pobrać historii kursu NBP.");
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

    if (!seriesStart || !valuationDate) return;

    // A missing/unsupported currency must not turn off FX conversion for every
    // valid holding. Wait until the current batch settles, then keep successes.
    if (queries.some((query) => query.status === "pending")) {
      return;
    }
    // Keep the previous coherent snapshot if the selected display currency did
    // not load; rendering PLN values with a foreign-currency label is worse
    // than retaining the last valid result.
    const displayCurrencyIndex = currencies.indexOf(displayCurrency);
    if (
      needsDisplayFx &&
      (displayCurrencyIndex < 0 || queries[displayCurrencyIndex]?.status !== "success")
    ) {
      return;
    }

    const rates: FxRateInput[] = queries.flatMap((query) =>
      query.status === "success" && query.data
        ? query.data.map((rate) => ({
          currency: rate.base,
          rate: rate.rate,
          date: new Date(`${rate.effectiveDate}T00:00:00.000Z`),
        }))
        : [],
    );

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
    currencies,
    needsDisplayFx,
    queries,
    seriesStart,
    valuationDate,
    displayCurrency,
    records,
    setMarketFxRates,
  ]);

  return null;
}

export function currenciesNeedingFx(
  records: DecryptedRecord[],
  marketQuotes: Pick<MarketQuoteInput, "currency">[] = [],
) {
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

  for (const quote of marketQuotes) {
    addCurrency(currencies, quote.currency);
  }

  return [...currencies].sort();
}

function addCurrency(currencies: Set<string>, value: string | null | undefined) {
  const currency = value?.trim().toUpperCase();
  if (!currency || currency === "PLN" || !/^[A-Z]{3}$/.test(currency)) {
    return;
  }
  currencies.add(currency);
}
