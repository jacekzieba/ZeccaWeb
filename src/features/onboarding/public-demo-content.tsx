"use client";

import { DashboardOverview } from "@/features/dashboard/dashboard-overview";
import { EarningsPage } from "@/features/earnings/earnings-page";
import { PositionsPage } from "@/features/positions/positions-page";
import { useOnboardingStore } from "./onboarding-state";

/** Keeps the public tour on `/demo` while swapping the real highlighted view. */
export function PublicDemoContent() {
  const phase = useOnboardingStore((state) => state.phase);
  const stepIndex = useOnboardingStore((state) => state.stepIndex);

  if (phase === "tour" && stepIndex === 3) {
    return <PositionsPage />;
  }

  if (phase === "tour" && stepIndex === 4) {
    return <EarningsPage />;
  }

  return <DashboardOverview />;
}
