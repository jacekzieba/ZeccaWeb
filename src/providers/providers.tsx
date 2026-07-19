"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isFakeSyncEnabled } from "@/lib/env";
import { FakeSyncBootstrap } from "@/sync/dev/fake-sync-bootstrap";
import { MarketFxBootstrap } from "@/features/sync/market-fx-bootstrap";
import { MarketQuoteBootstrap } from "@/features/sync/market-quote-bootstrap";
import { MarketCpiBootstrap } from "@/features/sync/market-cpi-bootstrap";
import { MarketReferenceRateBootstrap } from "@/features/sync/market-reference-rate-bootstrap";
import { BackgroundSyncBootstrap } from "@/features/sync/background-sync-bootstrap";
import { TelemetryBootstrap } from "@/features/telemetry/telemetry-bootstrap";
import { LanguageBootstrap } from "@/features/i18n/language-bootstrap";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageBootstrap />
      <FakeSyncBootstrap />
      <BackgroundSyncBootstrap />
      {/* Fake sync owns its deterministic market inputs (the store defaults or
          the certification fixture), so the live market bootstraps must not
          mount and overwrite them. The flag is a build-time constant, so the
          gate cannot flip between server and client render. */}
      {!isFakeSyncEnabled() && (
        <>
          <MarketFxBootstrap />
          <MarketQuoteBootstrap />
          <MarketCpiBootstrap />
          <MarketReferenceRateBootstrap />
        </>
      )}
      <TelemetryBootstrap />
      {children}
    </QueryClientProvider>
  );
}
