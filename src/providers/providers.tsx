"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { FakeSyncBootstrap } from "@/sync/dev/fake-sync-bootstrap";
import { MarketFxBootstrap } from "@/features/sync/market-fx-bootstrap";
import { MarketQuoteBootstrap } from "@/features/sync/market-quote-bootstrap";
import { MarketCpiBootstrap } from "@/features/sync/market-cpi-bootstrap";
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
      <MarketFxBootstrap />
      <MarketQuoteBootstrap />
      <MarketCpiBootstrap />
      <TelemetryBootstrap />
      {children}
    </QueryClientProvider>
  );
}
