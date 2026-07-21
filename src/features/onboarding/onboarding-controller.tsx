"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords } from "@/sync/dev/fake-sync";
import { isFakeSyncEnabled } from "@/lib/env";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { useSyncStore } from "@/sync/store/sync-store";
import { V2, V2_TYPE } from "@/lib/v2-design";
import { OnboardingCard } from "./onboarding-card";
import { TourOverlay } from "./tour-overlay";
import { FINALE_COPY, INTRO_CARDS, TOUR_STEPS } from "./steps";
import {
  resolveOnboardingEntry,
  useOnboardingStore,
} from "./onboarding-state";

/** Seeds the sync store with the demo dataset (same builder as fake-sync). */
function seedDemoRecords() {
  const records = buildFakeSyncRecords();
  const snapshot = buildInvestorDataSnapshot(records, {
    asOf: new Date(),
    historyGranularity: "daily",
    useLatestTransactionFxRate: true,
    useMarketQuotes: true,
  });
  useSyncStore.getState().setSync(records, snapshot);
}

/**
 * Sits in AppShell's `!records` branch. A brand-new account gets demo data
 * seeded and the onboarding started; public `/demo` always starts a fresh
 * in-memory tour. Everyone else falls through to the regular SyncUnlockGate.
 */
export function OnboardingDemoGate({
  children,
  accountOnboardingCompleted,
  publicDemo,
}: {
  children: React.ReactNode;
  accountOnboardingCompleted: boolean;
  publicDemo: boolean;
}) {
  const start = useOnboardingStore((s) => s.start);
  const phase = useOnboardingStore((s) => s.phase);
  const startedRef = useRef(false);

  // Fake-sync seeds records asynchronously — this branch renders briefly even
  // though data is on the way, so never auto-start the demo there (the tour is
  // still reachable via ?tour=1, which is what the e2e suite exercises).
  const entry = publicDemo
    ? "demo-start"
    : isFakeSyncEnabled()
    ? "none"
    : resolveOnboardingEntry({
        hasRecords: false,
        completed: accountOnboardingCompleted,
        tourParam: false,
      });

  useEffect(() => {
    if (entry === "demo-start" && !startedRef.current) {
      startedRef.current = true;
      seedDemoRecords();
      start(publicDemo ? "public-demo" : "demo");
    }
  }, [entry, publicDemo, start]);

  if (entry === "demo-start" || phase !== "idle") {
    // Demo records land in a moment; AppShell re-renders straight into the app.
    return null;
  }
  return <>{children}</>;
}

/** Starts a replay when the URL carries ?tour=1 (FAQ/settings links). */
function TourQueryParamListener() {
  const searchParams = useSearchParams();
  const start = useOnboardingStore((s) => s.start);
  const phase = useOnboardingStore((s) => s.phase);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    if (searchParams.get("tour") === "1" && phase === "idle") {
      consumedRef.current = true;
      start("replay");
    }
  }, [searchParams, phase, start]);

  return null;
}

export function OnboardingController({
  accountUserId,
  publicDemo,
  onAccountOnboardingFinished,
}: {
  accountUserId?: string;
  publicDemo: boolean;
  onAccountOnboardingFinished: () => void;
}) {
  const { phase, stepIndex, mode, setPhase, setStepIndex, finish } = useOnboardingStore();
  const clearSync = useSyncStore((s) => s.clearSync);
  const router = useRouter();
  const pathname = usePathname();

  const step = TOUR_STEPS[stepIndex];

  // Navigate when the current tour step lives on another route.
  useEffect(() => {
    if (phase !== "tour" || !step) return;
    if (mode === "public-demo") return;
    if (pathname !== step.route) router.push(step.route);
  }, [mode, phase, step, pathname, router]);

  const listener = (
    <Suspense fallback={null}>
      <TourQueryParamListener />
    </Suspense>
  );

  if (phase === "idle" || !mode) return listener;

  const endOnboarding = (destination?: "/login" | "/register") => {
    const endingMode = mode;

    if (endingMode === "demo" && accountUserId) {
      onAccountOnboardingFinished();
      const supabase = createBrowserSupabaseClientOrNull();
      if (supabase) {
        void supabase
          .from("profiles")
          .update({ onboarding_completed_at: new Date().toISOString() } as never)
          .eq("id", accountUserId);
      }
    }

    finish();
    if (endingMode === "demo" || endingMode === "public-demo") {
      // Demo records exist only in memory and are always discarded on exit.
      clearSync();
    }

    if (endingMode === "public-demo") {
      window.location.assign(destination ?? "/login");
    } else if (endingMode === "demo") {
      router.push("/dashboard");
    }
  };

  const btn = (primary: boolean): React.CSSProperties => ({
    fontFamily: V2_TYPE.ui, fontWeight: 600, fontSize: 13, borderRadius: 9,
    padding: "10px 18px", cursor: "pointer",
    border: primary ? "none" : `1px solid ${V2.line}`,
    background: primary ? V2.brand : "transparent",
    color: primary ? V2.onBrand : V2.ink,
  });

  if (phase === "intro") {
    const card = INTRO_CARDS[Math.min(stepIndex, INTRO_CARDS.length - 1)];
    const isLastCard = stepIndex >= INTRO_CARDS.length - 1;
    return (
      <>
        {listener}
        <OnboardingCard
          eyebrow={card.eyebrow}
          title={card.title}
          body={card.body}
          visual={card.visual}
          dots={{ count: INTRO_CARDS.length, active: stepIndex }}
          footer={
            <>
              {stepIndex > 0 ? (
                <button style={btn(false)} onClick={() => setStepIndex(stepIndex - 1)}>← Wstecz</button>
              ) : (
                <button style={btn(false)} onClick={() => endOnboarding()} data-testid="onboarding-skip">Pomiń</button>
              )}
              <button
                style={btn(true)}
                data-testid="onboarding-next"
                onClick={() => {
                  if (isLastCard) {
                    setStepIndex(0);
                    setPhase("tour");
                    if (!publicDemo && pathname !== TOUR_STEPS[0].route) router.push(TOUR_STEPS[0].route);
                  } else {
                    setStepIndex(stepIndex + 1);
                  }
                }}
              >
                {isLastCard ? "Zacznij tour po aplikacji →" : "Dalej →"}
              </button>
            </>
          }
        />
      </>
    );
  }

  if (phase === "tour") {
    return (
      <>
        {listener}
        <TourOverlay
          steps={TOUR_STEPS}
          stepIndex={stepIndex}
          onStepChange={setStepIndex}
          onFinish={() => setPhase("finale")}
          onSkip={() => endOnboarding()}
        />
        {(mode === "demo" || mode === "public-demo") && (
          <div
            style={{
              position: "fixed", right: 16, bottom: 16, zIndex: 902,
              fontFamily: V2_TYPE.ui, fontSize: 11, fontWeight: 700,
              letterSpacing: ".08em", textTransform: "uppercase",
              color: V2.gold, background: "rgba(255,252,244,.82)",
              padding: "6px 11px", borderRadius: 99,
              border: "0.5px solid rgba(162,119,46,.35)",
              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 4px 16px rgba(22,29,24,.14)",
            }}
          >
            Dane przykładowe
          </div>
        )}
      </>
    );
  }

  // finale
  return (
    <>
      {listener}
      <OnboardingCard
        eyebrow={FINALE_COPY.eyebrow}
        title={FINALE_COPY.title}
        body={
          mode === "public-demo"
            ? FINALE_COPY.bodyPublic
            : mode === "demo"
              ? FINALE_COPY.bodyDemo
              : FINALE_COPY.bodyReplay
        }
        footer={
          mode === "public-demo" ? (
            <>
              <button
                style={btn(false)}
                data-testid="onboarding-public-login"
                onClick={() => endOnboarding("/login")}
              >
                {FINALE_COPY.ctaPublicLogin}
              </button>
              <button
                style={btn(true)}
                data-testid="onboarding-public-register"
                onClick={() => endOnboarding("/register")}
              >
                {FINALE_COPY.ctaPublicRegister}
              </button>
            </>
          ) : (
            <button style={btn(true)} data-testid="onboarding-finish" onClick={() => endOnboarding()}>
              {mode === "demo" ? FINALE_COPY.ctaDemo : FINALE_COPY.ctaReplay}
            </button>
          )
        }
      />
    </>
  );
}
