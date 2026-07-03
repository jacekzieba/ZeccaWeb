# Onboarding (intro + coach-mark tour) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Po pierwszym logowaniu użytkownik dostaje 2 karty intro + 5-krokowy spotlight-tour po realnym UI (na danych demo), zakończony przekazaniem do istniejącej bramki synca; tour można powtórzyć z FAQ/Ustawień lub przez `?tour=1`.

**Architecture:** Stan onboardingu to mały moduł `src/features/onboarding/` (flaga w localStorage + zustand store faz). AppShell w gałęzi `!records` kieruje nowego użytkownika do trybu demo (rekordy z `buildFakeSyncRecords()`), a `OnboardingController` zamontowany w AppShell renderuje karty intro, silnik spotlight (`data-tour` anchors) i finał. Zakończenie w trybie demo czyści store synca, co naturalnie wraca do `SyncUnlockGate`.

**Tech Stack:** Next.js 15 App Router, React 19, zustand, inline styles z tokenami `@/lib/v2-design`, Vitest (jsdom), Playwright (config fake-sync).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-03-onboarding-design.md`.
- Copy (teksty kroków/kart) — placeholdery z mockupu; użytkownik podmieni później. Trzymać całość copy w `steps.ts`, nie rozproszone po komponentach.
- Flaga ukończenia wyłącznie w localStorage (`zecca.onboarding.completed.v1`) — profil NIE jest synchronizowany między urządzeniami, więc pole w profilu nic nie daje (świadome odstępstwo od specu).
- Kolejność kroków touru (finalna, wg zaakceptowanego mockupu v2): dashboard-hero → dashboard-instruments → sidebar-portfolios → positions-table → earnings-summary.
- Onboarding nigdy nie blokuje aplikacji: brak kotwicy po 2 s → krok pomijany; błąd → completeOnboarding() i zdjęcie overlay.
- Nie zmieniać logiki istniejących komponentów — tylko atrybuty `data-tour` (wrappery) i punkty montażu.
- Istniejące testy e2e fake-sync muszą pozostać zielone: auto-start touru tylko w gałęzi `!records` (nowy user); w fake-sync rekordy są seedowane, więc tour startuje wyłącznie z `?tour=1` / przycisków replay.
- Grafiki: `public/onboarding/intro-hero.png`, `public/onboarding/intro-privacy.png` — jeśli brak pliku, karta pokazuje placeholder (onError), build nie może się wywalać.

---

### Task 1: Stan onboardingu (`onboarding-state.ts`)

**Files:**
- Create: `src/features/onboarding/onboarding-state.ts`
- Test: `tests/unit/onboarding-state.test.ts`

**Interfaces:**
- Produces:
  - `isOnboardingCompleted(): boolean`, `markOnboardingCompleted(): void`, `clearOnboardingCompleted(): void`
  - `resolveOnboardingEntry(input: { hasRecords: boolean; completed: boolean; tourParam: boolean }): "demo-start" | "replay" | "none"`
  - `useOnboardingStore` (zustand): `{ phase: "idle" | "intro" | "tour" | "finale"; stepIndex: number; mode: "demo" | "replay" | null; start(mode): void; setPhase(p): void; setStepIndex(i): void; finish(): void }` — `finish()` ustawia `phase: "idle"`, `mode: null`, `stepIndex: 0` i woła `markOnboardingCompleted()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/onboarding-state.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  clearOnboardingCompleted,
  resolveOnboardingEntry,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-state";

describe("onboarding completed flag", () => {
  beforeEach(() => localStorage.clear());

  it("is false by default and true after marking", () => {
    expect(isOnboardingCompleted()).toBe(false);
    markOnboardingCompleted();
    expect(isOnboardingCompleted()).toBe(true);
    clearOnboardingCompleted();
    expect(isOnboardingCompleted()).toBe(false);
  });
});

describe("resolveOnboardingEntry", () => {
  it("starts demo for a new user without records", () => {
    expect(resolveOnboardingEntry({ hasRecords: false, completed: false, tourParam: false })).toBe("demo-start");
  });
  it("shows nothing (gate) when completed and no records", () => {
    expect(resolveOnboardingEntry({ hasRecords: false, completed: true, tourParam: false })).toBe("none");
  });
  it("does not auto-start over real records", () => {
    expect(resolveOnboardingEntry({ hasRecords: true, completed: false, tourParam: false })).toBe("none");
  });
  it("replays on ?tour=1 regardless of completion", () => {
    expect(resolveOnboardingEntry({ hasRecords: true, completed: true, tourParam: true })).toBe("replay");
    expect(resolveOnboardingEntry({ hasRecords: false, completed: true, tourParam: true })).toBe("replay");
  });
});

describe("useOnboardingStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useOnboardingStore.setState({ phase: "idle", stepIndex: 0, mode: null });
  });

  it("start() enters intro with the given mode", () => {
    useOnboardingStore.getState().start("demo");
    expect(useOnboardingStore.getState()).toMatchObject({ phase: "intro", mode: "demo", stepIndex: 0 });
  });

  it("finish() resets state and persists the flag", () => {
    useOnboardingStore.getState().start("replay");
    useOnboardingStore.getState().finish();
    expect(useOnboardingStore.getState()).toMatchObject({ phase: "idle", mode: null });
    expect(isOnboardingCompleted()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding-state.test.ts`
Expected: FAIL — cannot resolve `@/features/onboarding/onboarding-state`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/onboarding/onboarding-state.ts
import { create } from "zustand";

// Onboarding completion is a per-browser presentation flag (the profile store
// is also local-only, so persisting it there would not add cross-device sync).
const COMPLETED_KEY = "zecca.onboarding.completed.v1";

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(COMPLETED_KEY) === "1";
  } catch {
    return true; // storage unavailable → never trap the user in onboarding
  }
}

export function markOnboardingCompleted(): void {
  try {
    window.localStorage.setItem(COMPLETED_KEY, "1");
  } catch {
    // ignore — flag is best-effort
  }
}

export function clearOnboardingCompleted(): void {
  try {
    window.localStorage.removeItem(COMPLETED_KEY);
  } catch {
    // ignore
  }
}

export type OnboardingEntry = "demo-start" | "replay" | "none";

export function resolveOnboardingEntry(input: {
  hasRecords: boolean;
  completed: boolean;
  tourParam: boolean;
}): OnboardingEntry {
  if (input.tourParam) return "replay";
  if (!input.hasRecords && !input.completed) return "demo-start";
  return "none";
}

export type OnboardingPhase = "idle" | "intro" | "tour" | "finale";
export type OnboardingMode = "demo" | "replay";

type OnboardingState = {
  phase: OnboardingPhase;
  stepIndex: number;
  mode: OnboardingMode | null;
  start: (mode: OnboardingMode) => void;
  setPhase: (phase: OnboardingPhase) => void;
  setStepIndex: (index: number) => void;
  finish: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  phase: "idle",
  stepIndex: 0,
  mode: null,
  start: (mode) => set({ phase: "intro", mode, stepIndex: 0 }),
  setPhase: (phase) => set({ phase }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  finish: () => {
    markOnboardingCompleted();
    set({ phase: "idle", mode: null, stepIndex: 0 });
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding-state.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/onboarding-state.ts tests/unit/onboarding-state.test.ts
git commit -m "feat(onboarding): completion flag, entry resolver and phase store"
```

---

### Task 2: Definicje kroków i sekwencjonowanie (`steps.ts`)

**Files:**
- Create: `src/features/onboarding/steps.ts`
- Test: `tests/unit/onboarding-steps.test.ts`

**Interfaces:**
- Consumes: nic (czyste dane + helper).
- Produces:
  - `INTRO_CARDS: IntroCard[]` — `{ id, eyebrow, title, body, image: { src, alt } | null }` (2 karty).
  - `TOUR_STEPS: TourStep[]` — `{ id, route, anchor, title, body, placement: "bottom" | "right" }` (5 kroków, kolejność z Global Constraints).
  - `FINALE_COPY` — `{ eyebrow, title, bodyDemo, bodyReplay, ctaDemo, ctaReplay }`.
  - `nextPresentStep(steps: TourStep[], from: number, dir: 1 | -1, isPresent: (anchor: string) => boolean): number` — indeks następnego kroku z obecną kotwicą albo `-1` gdy koniec.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/onboarding-steps.test.ts
import { describe, expect, it } from "vitest";
import { INTRO_CARDS, TOUR_STEPS, nextPresentStep } from "@/features/onboarding/steps";

describe("onboarding step definitions", () => {
  it("has 2 intro cards and 5 tour steps in the approved order", () => {
    expect(INTRO_CARDS).toHaveLength(2);
    expect(TOUR_STEPS.map((s) => s.anchor)).toEqual([
      "dashboard-hero",
      "dashboard-instruments",
      "sidebar-portfolios",
      "positions-table",
      "earnings-summary",
    ]);
  });

  it("steps carry a route so the tour can navigate", () => {
    expect(TOUR_STEPS[0].route).toBe("/dashboard");
    expect(TOUR_STEPS[3].route).toBe("/positions");
    expect(TOUR_STEPS[4].route).toBe("/earnings");
  });

  it("ids are unique", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("nextPresentStep", () => {
  const present = (missing: string[]) => (anchor: string) => !missing.includes(anchor);

  it("advances to the immediate next step when present", () => {
    expect(nextPresentStep(TOUR_STEPS, 0, 1, present([]))).toBe(1);
  });

  it("skips steps whose anchor is missing", () => {
    expect(nextPresentStep(TOUR_STEPS, 0, 1, present(["dashboard-instruments"]))).toBe(2);
  });

  it("returns -1 past the last step", () => {
    expect(nextPresentStep(TOUR_STEPS, TOUR_STEPS.length - 1, 1, present([]))).toBe(-1);
  });

  it("walks backwards too", () => {
    expect(nextPresentStep(TOUR_STEPS, 2, -1, present(["dashboard-instruments"]))).toBe(0);
    expect(nextPresentStep(TOUR_STEPS, 0, -1, present([]))).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding-steps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation (copy = placeholdery z mockupu)**

```ts
// src/features/onboarding/steps.ts
// Całe copy onboardingu mieszka tutaj — do podmiany przez właściciela produktu.

export type IntroCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: { src: string; alt: string } | null;
};

export type TourStep = {
  id: string;
  route: "/dashboard" | "/positions" | "/earnings";
  anchor: string;
  title: string;
  body: string;
  placement: "bottom" | "right";
};

export const INTRO_CARDS: IntroCard[] = [
  {
    id: "intro-welcome",
    eyebrow: "Witaj w Zecca",
    title: "Cały Twój majątek, czytany jak rocznik finansowy.",
    body:
      "Zecca to prywatny tracker inwestycji — akcje i ETF-y, obligacje skarbowe, lokaty i gotówka w jednym miejscu. " +
      "Bez reklam, bez sprzedawania danych. Liczby, które rozumiesz, i wykresy, które mówią prawdę — także po inflacji.",
    image: { src: "/onboarding/intro-hero.png", alt: "Podgląd aplikacji Zecca" },
  },
  {
    id: "intro-privacy",
    eyebrow: "Twoje dane, Twój klucz",
    title: "Nikt nie czyta Twojego portfela. Nawet my.",
    body:
      "Dane wprowadzasz w aplikacji Zecca na macOS lub iOS. Do przeglądarki trafiają zaszyfrowane end-to-end — " +
      "klucz istnieje tylko na Twoich urządzeniach. Serwer widzi wyłącznie zaszyfrowany pakiet.",
    image: { src: "/onboarding/intro-privacy.png", alt: "Szyfrowanie end-to-end" },
  },
];

export const TOUR_STEPS: TourStep[] = [
  {
    id: "tour-kpi",
    route: "/dashboard",
    anchor: "dashboard-hero",
    title: "Liczby, które naprawdę coś znaczą",
    body:
      "Wartość całego portfela, a obok MWR (XIRR) — realna roczna stopa zwrotu z uwzględnieniem wpłat — " +
      "i wynik realny, czyli ile zarabiasz po odjęciu inflacji. Okres historii przełączysz przyciskami 1M–MAX.",
    placement: "bottom",
  },
  {
    id: "tour-instruments",
    route: "/dashboard",
    anchor: "dashboard-instruments",
    title: "Co dokładnie posiadasz",
    body:
      "Każdy instrument z liczbą jednostek, kursem i bieżącą wartością. Kliknięcie otwiera szczegóły — " +
      "skład serii obligacji, historię kursu, transakcje.",
    placement: "bottom",
  },
  {
    id: "tour-portfolios",
    route: "/dashboard",
    anchor: "sidebar-portfolios",
    title: "Każdy portfel pod ręką",
    body:
      "IKE, konto obligacji, rachunek maklerski — portfele z bieżącą wartością zawsze w sidebarze. " +
      "Na dole karta z łączną wartością całego majątku.",
    placement: "right",
  },
  {
    id: "tour-positions",
    route: "/positions",
    anchor: "positions-table",
    title: "Każda złotówka ma swoją historię",
    body:
      "Pozycje pokazują pełny skład portfela z zyskiem/stratą liczonym od realnych transakcji zakupu. " +
      "Obok, w zakładce Transakcje, cała historia: zakupy, sprzedaże, dywidendy i odsetki.",
    placement: "bottom",
  },
  {
    id: "tour-earnings",
    route: "/earnings",
    anchor: "earnings-summary",
    title: "Pełny obraz — nie tylko inwestycje",
    body:
      "Zarobki to rejestr Twoich dochodów: etat, B2B i obciążenia, miesiąc po miesiącu. " +
      "Średnia po obciążeniach pokazuje, ile realnie zostaje — i ile z tego może pracować w portfelu.",
    placement: "bottom",
  },
];

export const FINALE_COPY = {
  eyebrow: "Połącz swoje dane",
  title: "Zobaczmy Twój portfel.",
  bodyDemo:
    "To już wszystko — wiesz, gdzie co jest. Oglądałeś dane przykładowe; teraz odblokuj synchronizację " +
    "frazą z aplikacji natywnej albo zacznij od pobrania Zecca na macOS lub iOS.",
  bodyReplay: "To już wszystko — tour zakończony. Twoje dane są zsynchronizowane.",
  ctaDemo: "Przejdź do konfiguracji synchronizacji →",
  ctaReplay: "Wróć do aplikacji →",
} as const;

export function nextPresentStep(
  steps: TourStep[],
  from: number,
  dir: 1 | -1,
  isPresent: (anchor: string) => boolean,
): number {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    if (isPresent(steps[i].anchor)) return i;
  }
  return -1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding-steps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/steps.ts tests/unit/onboarding-steps.test.ts
git commit -m "feat(onboarding): intro/tour step definitions and skip-aware sequencing"
```

---

### Task 3: Karta modalna intro/finału (`onboarding-card.tsx`)

**Files:**
- Create: `src/features/onboarding/onboarding-card.tsx`

**Interfaces:**
- Consumes: tokeny `V2`, `V2_TYPE` z `@/lib/v2-design`.
- Produces: `OnboardingCard({ eyebrow, title, body, image, dots, footer, children }: { eyebrow: string; title: string; body: string; image?: { src: string; alt: string } | null; dots?: { count: number; active: number }; footer: React.ReactNode; children?: React.ReactNode })` — pełnoekranowy dim (`position: fixed; inset: 0; zIndex: 900`) z wycentrowaną kartą. `footer` to rząd przycisków; `children` renderowane między body a footerem (finał wstawia tu treść wariantu).

Bez testu jednostkowego (czysta prezentacja) — weryfikacja wizualna w Task 8.

- [ ] **Step 1: Implementacja**

```tsx
// src/features/onboarding/onboarding-card.tsx
"use client";

import { useState } from "react";
import { V2, V2_TYPE } from "@/lib/v2-design";

export function OnboardingCard({
  eyebrow,
  title,
  body,
  image = null,
  dots,
  footer,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  image?: { src: string; alt: string } | null;
  dots?: { count: number; active: number };
  footer: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [imageBroken, setImageBroken] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        background: "rgba(20,26,21,.52)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(620px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: V2.card, borderRadius: 20,
          border: `0.5px solid ${V2.line}`,
          boxShadow: "0 18px 60px rgba(20,26,21,.35)",
          padding: "34px 38px", textAlign: "center",
          fontFamily: V2_TYPE.ui, color: V2.ink,
        }}
      >
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: V2.subtle }}>
          {eyebrow}
        </div>
        <h2 style={{ fontFamily: V2_TYPE.serif, fontWeight: 400, fontSize: 30, lineHeight: 1.15, letterSpacing: "-.01em", marginTop: 12 }}>
          {title}
        </h2>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: V2.muted, marginTop: 12 }}>{body}</p>

        {image && !imageBroken ? (
          // eslint-disable-next-line @next/next/no-img-element -- static onboarding asset, fallback on error
          <img
            src={image.src}
            alt={image.alt}
            onError={() => setImageBroken(true)}
            style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12, marginTop: 18 }}
          />
        ) : image ? (
          <div
            style={{
              marginTop: 18, height: 140, borderRadius: 12,
              border: `1.5px dashed ${V2.brand}55`, background: `${V2.brand}14`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: V2.brand, fontSize: 12, fontWeight: 600,
            }}
          >
            {image.alt}
          </div>
        ) : null}

        {children}

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 22, flexWrap: "wrap" }}>{footer}</div>

        {dots && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 18 }}>
            {Array.from({ length: dots.count }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === dots.active ? V2.brand : V2.line,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

Uwaga: sprawdź w `src/lib/v2-design.ts`, że `V2.card`, `V2.line`, `V2.ink`, `V2.muted`, `V2.subtle`, `V2.brand` oraz `V2_TYPE.serif/ui` istnieją (są używane w earnings/positions). Jeśli któregoś brakuje, użyj najbliższego istniejącego tokena zamiast dodawać nowy.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: bez błędów.

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding/onboarding-card.tsx
git commit -m "feat(onboarding): full-screen modal card for intro/finale"
```

---

### Task 4: Silnik touru (`tour-overlay.tsx`)

**Files:**
- Create: `src/features/onboarding/tour-overlay.tsx`

**Interfaces:**
- Consumes: `TourStep`, `nextPresentStep` z `./steps`; tokeny V2.
- Produces: `TourOverlay({ steps, stepIndex, mode, onStepChange, onFinish, onSkip }: { steps: TourStep[]; stepIndex: number; mode: "demo" | "replay"; onStepChange(next: number): void; onFinish(): void; onSkip(): void })`.
  - Kotwica: element `[data-tour="<anchor>"]`; overlay czeka do 2 s (poll 50 ms) na mount, potem `onStepChange(nextPresentStep(...))`.
  - Spotlight: fixed div na recie kotwicy (padding 6 px, borderRadius 14) z `boxShadow: 0 0 0 9999px rgba(20,26,21,.52)`; recalc na scroll/resize.
  - Tooltip: karta przy spotlighcie (placement z kroku, clamp do viewportu); na mobile (`max-width: 720px`) bottom-sheet przyklęty do dołu.
  - Klawiatura: `→`/`Enter` dalej, `←` wstecz, `Esc` = `onSkip()`.
  - Nawigację między trasami robi kontroler (Task 5) — overlay tylko zgłasza `onStepChange`.

- [ ] **Step 1: Implementacja**

```tsx
// src/features/onboarding/tour-overlay.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { V2, V2_TYPE } from "@/lib/v2-design";
import { nextPresentStep, type TourStep } from "./steps";

const DIM = "rgba(20,26,21,.52)";
const ANCHOR_TIMEOUT_MS = 2000;
const ANCHOR_POLL_MS = 50;

function anchorEl(anchor: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
}

type Rect = { top: number; left: number; width: number; height: number };

export function TourOverlay({
  steps,
  stepIndex,
  mode,
  onStepChange,
  onFinish,
  onSkip,
}: {
  steps: TourStep[];
  stepIndex: number;
  mode: "demo" | "replay";
  onStepChange: (next: number) => void;
  onFinish: () => void;
  onSkip: () => void;
}) {
  const step = steps[stepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const waitedRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback(
    (dir: 1 | -1) => {
      const next = nextPresentStep(steps, stepIndex, dir, (a) => anchorEl(a) != null || dir === 1);
      // dir===1: pozwól przejść na krok na innej trasie (kotwica jeszcze nie istnieje);
      // kontroler nawiguje, a overlay poczeka na mount.
      if (next === -1) {
        if (dir === 1) onFinish();
        return;
      }
      onStepChange(next);
    },
    [steps, stepIndex, onFinish, onStepChange],
  );

  // Wait for the anchor, measure it, keep it measured on scroll/resize.
  useEffect(() => {
    if (!step) return;
    setRect(null);
    waitedRef.current = 0;
    let cancelled = false;
    let raf = 0;

    const measure = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const tick = () => {
      if (cancelled) return;
      const el = anchorEl(step.anchor);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        measure(el);
        const remeasure = () => {
          const current = anchorEl(step.anchor);
          if (current) measure(current);
        };
        window.addEventListener("scroll", remeasure, { passive: true });
        window.addEventListener("resize", remeasure);
        cleanupRef.current = () => {
          window.removeEventListener("scroll", remeasure);
          window.removeEventListener("resize", remeasure);
        };
        return;
      }
      waitedRef.current += ANCHOR_POLL_MS;
      if (waitedRef.current >= ANCHOR_TIMEOUT_MS) {
        // Anchor never appeared (hidden section, changed UI) → skip the step.
        const next = nextPresentStep(steps, stepIndex, 1, (a) => anchorEl(a) != null);
        if (next === -1) onFinish();
        else onStepChange(next);
        return;
      }
      raf = window.setTimeout(tick, ANCHOR_POLL_MS) as unknown as number;
    };

    const cleanupRef = { current: null as null | (() => void) };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(raf);
      cleanupRef.current?.();
    };
  }, [step, stepIndex, steps, onFinish, onStepChange]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight" || e.key === "Enter") goTo(1);
      else if (e.key === "ArrowLeft") goTo(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, onSkip]);

  if (!step) return null;

  const isLast = nextPresentStep(steps, stepIndex, 1, (a) => anchorEl(a) != null || true) === -1;

  const PAD = 6;
  const spot = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Tooltip placement (desktop): under or to the right of the spotlight, clamped.
  const TIP_W = 320;
  let tipStyle: React.CSSProperties;
  if (isMobile || !spot) {
    tipStyle = { position: "fixed", left: 12, right: 12, bottom: 12 };
  } else if (step.placement === "right") {
    tipStyle = {
      position: "fixed",
      left: Math.min(spot.left + spot.width + 14, window.innerWidth - TIP_W - 12),
      top: Math.max(12, Math.min(spot.top, window.innerHeight - 260)),
      width: TIP_W,
    };
  } else {
    tipStyle = {
      position: "fixed",
      left: Math.max(12, Math.min(spot.left + 20, window.innerWidth - TIP_W - 12)),
      top: Math.min(spot.top + spot.height + 14, window.innerHeight - 240),
      width: TIP_W,
    };
  }

  const btn = (primary: boolean): React.CSSProperties => ({
    fontFamily: V2_TYPE.ui, fontWeight: 600, fontSize: 12.5, borderRadius: 9,
    padding: "9px 15px", cursor: "pointer",
    border: primary ? "none" : `1px solid ${V2.line}`,
    background: primary ? V2.brand : "transparent",
    color: primary ? "#F4F2E6" : V2.ink,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900 }}>
      {/* click-blocker; dim comes from the spotlight's giant box-shadow */}
      {spot ? (
        <div
          style={{
            position: "fixed",
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            borderRadius: 14,
            boxShadow: `0 0 0 9999px ${DIM}`,
            pointerEvents: "none",
          }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: DIM }} />
      )}

      <div
        role="dialog"
        aria-label={step.title}
        style={{
          ...tipStyle,
          zIndex: 901,
          background: V2.card,
          borderRadius: 14,
          border: `0.5px solid ${V2.line}`,
          boxShadow: "0 12px 40px rgba(30,26,22,.28)",
          padding: "18px 20px",
          fontFamily: V2_TYPE.ui,
          color: V2.ink,
        }}
      >
        <div style={{ fontFamily: V2_TYPE.mono, fontSize: 10, letterSpacing: ".08em", color: "#B5863A" }}>
          TOUR · KROK {stepIndex + 1} / {steps.length}
        </div>
        <div style={{ fontFamily: V2_TYPE.serif, fontWeight: 500, fontSize: 19, marginTop: 7, lineHeight: 1.2 }}>
          {step.title}
        </div>
        <p style={{ fontSize: 12.5, lineHeight: 1.6, color: V2.muted, marginTop: 8 }}>{step.body}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          {stepIndex > 0 && (
            <button style={btn(false)} onClick={() => goTo(-1)}>
              ← Wstecz
            </button>
          )}
          <button style={btn(true)} onClick={() => goTo(1)} data-testid="tour-next">
            {isLast || stepIndex === steps.length - 1 ? "Zakończ tour →" : "Dalej →"}
          </button>
          <button
            onClick={onSkip}
            data-testid="tour-skip"
            style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", fontSize: 11, color: V2.subtle }}
          >
            Pomiń tour (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
```

Uwaga implementacyjna: `V2_TYPE.mono` — sprawdź nazwę tokena w `src/lib/v2-design.ts` (może być `V2_TYPE.mono` albo osobny eksport); dopasuj.

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: bez błędów (lint może wymagać drobnych poprawek stylu).

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding/tour-overlay.tsx
git commit -m "feat(onboarding): spotlight tour overlay with anchor waiting and keyboard nav"
```

---

### Task 5: Kontroler + integracja z AppShell (tryb demo)

**Files:**
- Create: `src/features/onboarding/onboarding-controller.tsx`
- Modify: `src/components/layout/app-shell.tsx` (gałąź `!records` ~linia 445; grupa nav „Portfele"; mount kontrolera obok `<CommandPalette/>`/`<AddTransactionModal/>`)

**Interfaces:**
- Consumes: `useOnboardingStore`, `resolveOnboardingEntry`, `isOnboardingCompleted` (Task 1); `INTRO_CARDS`, `TOUR_STEPS`, `FINALE_COPY` (Task 2); `OnboardingCard` (Task 3); `TourOverlay` (Task 4); `buildFakeSyncRecords` z `@/sync/dev/fake-sync`, `buildInvestorDataSnapshot` z `@/sync/records/investor-snapshot`, `useSyncStore`.
- Produces:
  - `OnboardingController()` — komponent montowany w AppShell (renderuje fazy intro/tour/finale + badge „Dane przykładowe" w trybie demo; nawiguje `router.push(step.route)` gdy krok ma inną trasę).
  - `OnboardingDemoGate({ children })` — używany w gałęzi `!records`: gdy `resolveOnboardingEntry` → `demo-start`, seeduje rekordy demo i startuje onboarding, w przeciwnym razie renderuje `children` (czyli dotychczasowy `SyncUnlockGate`).
  - `useTourQueryParam()` — czyta `?tour=1` (useSearchParams) i odpala replay raz.

- [ ] **Step 1: Implementacja kontrolera**

```tsx
// src/features/onboarding/onboarding-controller.tsx
"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildFakeSyncRecords } from "@/sync/dev/fake-sync";
import { useSyncStore } from "@/sync/store/sync-store";
import { V2, V2_TYPE } from "@/lib/v2-design";
import { OnboardingCard } from "./onboarding-card";
import { TourOverlay } from "./tour-overlay";
import { FINALE_COPY, INTRO_CARDS, TOUR_STEPS } from "./steps";
import {
  isOnboardingCompleted,
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
 * Replaces SyncUnlockGate for a brand-new user: seeds demo data and starts
 * the onboarding. Everyone else falls through to `children` (the gate).
 */
export function OnboardingDemoGate({ children }: { children: React.ReactNode }) {
  const start = useOnboardingStore((s) => s.start);
  const phase = useOnboardingStore((s) => s.phase);
  const startedRef = useRef(false);

  const entry = resolveOnboardingEntry({
    hasRecords: false,
    completed: isOnboardingCompleted(),
    tourParam: false,
  });

  useEffect(() => {
    if (entry === "demo-start" && !startedRef.current) {
      startedRef.current = true;
      seedDemoRecords();
      start("demo");
    }
  }, [entry, start]);

  if (entry === "demo-start" || phase !== "idle") {
    return null; // records land in a moment; AppShell re-renders into the app
  }
  return <>{children}</>;
}

/** Starts a replay when the URL carries ?tour=1 (FAQ/settings links). */
function useTourQueryParam() {
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
}

export function OnboardingController() {
  const { phase, stepIndex, mode, setPhase, setStepIndex, finish } = useOnboardingStore();
  const clearSync = useSyncStore((s) => s.clearSync);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const router = useRouter();
  const pathname = usePathname();

  useTourQueryParam();

  const step = TOUR_STEPS[stepIndex];

  // Navigate when the current tour step lives on another route.
  useEffect(() => {
    if (phase !== "tour" || !step) return;
    if (pathname !== step.route) router.push(step.route);
  }, [phase, step, pathname, router]);

  if (phase === "idle" || !mode) return null;

  const endDemo = () => {
    finish();
    if (mode === "demo" && !userDataKey) {
      // Drop the seeded demo dataset → AppShell falls back to SyncUnlockGate.
      clearSync();
      router.push("/dashboard");
    }
  };

  if (phase === "intro") {
    const card = INTRO_CARDS[Math.min(stepIndex, INTRO_CARDS.length - 1)];
    const isLastCard = stepIndex >= INTRO_CARDS.length - 1;
    const btn = (primary: boolean): React.CSSProperties => ({
      fontFamily: V2_TYPE.ui, fontWeight: 600, fontSize: 13, borderRadius: 9,
      padding: "10px 18px", cursor: "pointer",
      border: primary ? "none" : `1px solid ${V2.line}`,
      background: primary ? V2.brand : "transparent",
      color: primary ? "#F4F2E6" : V2.ink,
    });
    return (
      <OnboardingCard
        eyebrow={card.eyebrow}
        title={card.title}
        body={card.body}
        image={card.image}
        dots={{ count: INTRO_CARDS.length, active: stepIndex }}
        footer={
          <>
            {stepIndex > 0 ? (
              <button style={btn(false)} onClick={() => setStepIndex(stepIndex - 1)}>← Wstecz</button>
            ) : (
              <button style={btn(false)} onClick={endDemo} data-testid="onboarding-skip">Pomiń</button>
            )}
            <button
              style={btn(true)}
              data-testid="onboarding-next"
              onClick={() => {
                if (isLastCard) {
                  setStepIndex(0);
                  setPhase("tour");
                  if (pathname !== TOUR_STEPS[0].route) router.push(TOUR_STEPS[0].route);
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
    );
  }

  if (phase === "tour") {
    return (
      <>
        <TourOverlay
          steps={TOUR_STEPS}
          stepIndex={stepIndex}
          mode={mode}
          onStepChange={setStepIndex}
          onFinish={() => setPhase("finale")}
          onSkip={endDemo}
        />
        {mode === "demo" && (
          <div
            style={{
              position: "fixed", left: 14, bottom: 14, zIndex: 902,
              fontFamily: V2_TYPE.ui, fontSize: 11, fontWeight: 700,
              letterSpacing: ".08em", textTransform: "uppercase",
              color: "#B5863A", background: "rgba(181,134,58,.14)",
              padding: "6px 11px", borderRadius: 99,
              border: "0.5px solid rgba(181,134,58,.3)",
            }}
          >
            Dane przykładowe
          </div>
        )}
      </>
    );
  }

  // finale
  const btn = (primary: boolean): React.CSSProperties => ({
    fontFamily: V2_TYPE.ui, fontWeight: 600, fontSize: 13, borderRadius: 9,
    padding: "10px 18px", cursor: "pointer",
    border: primary ? "none" : `1px solid ${V2.line}`,
    background: primary ? V2.brand : "transparent",
    color: primary ? "#F4F2E6" : V2.ink,
  });
  return (
    <OnboardingCard
      eyebrow={FINALE_COPY.eyebrow}
      title={FINALE_COPY.title}
      body={mode === "demo" ? FINALE_COPY.bodyDemo : FINALE_COPY.bodyReplay}
      footer={
        <button style={btn(true)} data-testid="onboarding-finish" onClick={endDemo}>
          {mode === "demo" ? FINALE_COPY.ctaDemo : FINALE_COPY.ctaReplay}
        </button>
      }
    />
  );
}
```

- [ ] **Step 2: Integracja w AppShell**

W `src/components/layout/app-shell.tsx`:

1. Import: `import { OnboardingController, OnboardingDemoGate } from "@/features/onboarding/onboarding-controller";`
2. Gałąź `!records` (ok. linii 445) — opakuj gate:

```tsx
if (!records) {
  return (
    <AppLock>
      <OnboardingDemoGate>
        <SyncUnlockGate initialUser={initialUser} onSyncLoaded={handleSyncLoaded} />
      </OnboardingDemoGate>
    </AppLock>
  );
}
```

3. W zwykłym renderze shell-a (obok `<CommandPalette …/>` / `<AddTransactionModal/>`) dodaj `<OnboardingController />`.
4. Kotwica sidebara: w `SidebarContent`, w pętli `navGroups.map((group, gi) => (<div key={gi} …>` dodaj atrybut:

```tsx
<div key={gi} style={{ marginBottom: 8 }} data-tour={group.sec === "Portfele" ? "sidebar-portfolios" : undefined}>
```

Uwaga na Suspense: `useSearchParams` w kliencie wymaga granicy `<Suspense>` przy prerenderingu — jeśli `npm run build` zgłosi błąd, owiń `<OnboardingController />` w `<Suspense fallback={null}>` (import z `react`).

- [ ] **Step 3: Typecheck + istniejące testy jednostkowe**

Run: `npm run typecheck && npm test`
Expected: bez błędów; wszystkie testy zielone.

- [ ] **Step 4: Commit**

```bash
git add src/features/onboarding/onboarding-controller.tsx src/components/layout/app-shell.tsx
git commit -m "feat(onboarding): controller with demo gate wired into AppShell"
```

---

### Task 6: Kotwice `data-tour` w dashboardzie, pozycjach i zarobkach

**Files:**
- Modify: `src/features/dashboard/dashboard-overview.tsx` (hero `<Card glass pad={0}>` ~linia 1060; karta Instrumenty ~linia 1199)
- Modify: `src/features/positions/positions-page.tsx` (kontener tabeli pod `V2ScreenHead`, ~linia 315+)
- Modify: `src/features/earnings/earnings-page.tsx` (podsumowanie `V2Card glass` ~linia 886)

**Interfaces:**
- Produces: elementy DOM z `data-tour="dashboard-hero" | "dashboard-instruments" | "positions-table" | "earnings-summary"` (nazwy dokładnie jak w `TOUR_STEPS` z Task 2).

Komponenty `Card`/`V2Card` mogą nie przepuszczać `data-*` — wtedy opakuj każdą kartę cienkim wrapperem, bez zmiany layoutu:

- [ ] **Step 1: Dashboard — hero**

```tsx
// dashboard-overview.tsx (~1060): wrap istniejącej karty hero
<div data-tour="dashboard-hero">
  <Card glass pad={0}>
    …istniejąca zawartość bez zmian…
  </Card>
</div>
```

- [ ] **Step 2: Dashboard — instrumenty**

```tsx
// dashboard-overview.tsx (~1199): analogicznie
<div data-tour="dashboard-instruments">
  <Card pad={0}>
    …istniejąca zawartość bez zmian…
  </Card>
</div>
```

Uwaga: jeśli karty siedzą w gridzie z `display: grid`/`gap`, wrapper `<div>` nie zmienia niczego wizualnie (block w gridzie); sprawdź wizualnie w Task 8.

- [ ] **Step 3: Pozycje — kontener tabeli**

```tsx
// positions-page.tsx: karta/tabela pozycji (główny kontener listy pod filtrami)
<div data-tour="positions-table">
  …istniejąca karta z tabelą…
</div>
```

- [ ] **Step 4: Zarobki — karta podsumowania**

```tsx
// earnings-page.tsx (~886):
<div data-tour="earnings-summary">
  <V2Card glass pad={0} style={{ overflow: "hidden" }}>
    …istniejąca zawartość bez zmian…
  </V2Card>
</div>
```

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: bez błędów.

```bash
git add src/features/dashboard/dashboard-overview.tsx src/features/positions/positions-page.tsx src/features/earnings/earnings-page.tsx
git commit -m "feat(onboarding): data-tour anchors on dashboard, positions and earnings"
```

---

### Task 7: Replay z FAQ i Ustawień

**Files:**
- Modify: `app/faq/page.tsx` (sekcja nagłówka / lista pomocy)
- Modify: `app/(app)/settings/page.tsx` (lub komponent ustawień, jeśli strona tylko re-eksportuje — podążaj za strukturą: `src/features/settings/…`)

**Interfaces:**
- Consumes: nawigacja na `/dashboard?tour=1` (konsumowane przez `useTourQueryParam` z Task 5).

- [ ] **Step 1: FAQ — link „Zobacz wprowadzenie"**

W `app/faq/page.tsx` dodaj pod nagłówkiem link (dopasuj markup do istniejących stylów strony):

```tsx
<Link
  href="/dashboard?tour=1"
  style={{ display: "inline-block", marginTop: 10, fontSize: 13.5, fontWeight: 600, color: "#234D38", textDecoration: "none" }}
>
  ▶ Zobacz wprowadzenie do aplikacji (tour)
</Link>
```

(import `Link` z `next/link`, jeśli go tam nie ma; kolor weź z tokenów używanych na stronie, nie hardkoduj jeśli tokeny są dostępne).

- [ ] **Step 2: Ustawienia — przycisk w sekcji pomocniczej**

Znajdź w ustawieniach sekcję ogólną/pomoc (np. koniec strony) i dodaj analogiczny link/przycisk `href="/dashboard?tour=1"` z labelem „Zobacz wprowadzenie (tour)".

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck`

```bash
git add app/faq/page.tsx "app/(app)/settings/page.tsx" src/features/settings 2>/dev/null || git add -A app src/features/settings
git commit -m "feat(onboarding): replay links in FAQ and settings"
```

---

### Task 8: E2E (fake-sync) + pełna weryfikacja

**Files:**
- Create: `tests/e2e/fake-sync/onboarding.spec.ts`

**Interfaces:**
- Consumes: `?tour=1` replay path (fake-sync ma rekordy, więc auto-start demo nie odpala — zgodnie z Global Constraints), `data-testid`: `onboarding-next`, `tour-next`, `onboarding-finish`, `tour-skip`.

- [ ] **Step 1: Napisz test e2e**

```ts
// tests/e2e/fake-sync/onboarding.spec.ts
import { expect, test } from "@playwright/test";

test("tour replay walks intro → all steps → finale and does not auto-reopen", async ({ page }) => {
  await page.goto("/dashboard?tour=1");

  // Intro card 1 → 2 → start tour.
  const next = page.getByTestId("onboarding-next");
  await expect(next).toBeVisible();
  await next.click(); // card 2
  await next.click(); // "Zacznij tour po aplikacji"

  // 5 tour steps; each shows the step counter and highlights a real element.
  const tourNext = page.getByTestId("tour-next");
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`TOUR · KROK ${i} / 5`)).toBeVisible({ timeout: 10_000 });
    await tourNext.click();
  }

  // Cross-route navigation happened along the way.
  await expect(page).toHaveURL(/\/earnings/);

  // Finale card → finish.
  const finish = page.getByTestId("onboarding-finish");
  await expect(finish).toBeVisible();
  await finish.click();

  // Completed flag persisted → plain dashboard, no onboarding on next visit.
  await page.goto("/dashboard");
  await expect(page.getByTestId("onboarding-next")).toHaveCount(0);
  await expect(page.getByTestId("tour-next")).toHaveCount(0);
});

test("Esc skips the tour immediately", async ({ page }) => {
  await page.goto("/dashboard?tour=1");
  await page.getByTestId("onboarding-next").click();
  await page.getByTestId("onboarding-next").click();
  await expect(page.getByText("TOUR · KROK 1 / 5")).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour-next")).toHaveCount(0);
});
```

- [ ] **Step 2: Uruchom nowy spec**

Run: `npx playwright test --config playwright.fake-sync.config.ts tests/e2e/fake-sync/onboarding.spec.ts`
Expected: PASS (2 testy). Debuguj kotwice/timeouty, jeśli kroki nie nadążają za nawigacją.

- [ ] **Step 3: Pełna weryfikacja**

Run: `npm run typecheck && npm run lint && npm test && npm run test:e2e:fake-sync`
Expected: wszystko zielone — w tym dotychczasowe specs fake-sync (auto-start nie może ich zepsuć).

- [ ] **Step 4: Weryfikacja wizualna (preview)**

Uruchom dev z `NEXT_PUBLIC_FAKE_SYNC=1`, otwórz `/dashboard?tour=1`, przeklikaj intro + 5 kroków + finał; sprawdź spotlight na sidebarze (placement „right") i bottom-sheet na szerokości ≤720 px.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/fake-sync/onboarding.spec.ts
git commit -m "test(onboarding): e2e replay flow through intro, tour and finale"
```

---

## Self-Review (wykonany)

- **Spec coverage:** intro 2 karty (T2/T5), tour 5 kroków z nawigacją (T2/T4/T5/T6), demo mode dla nowego usera (T5 OnboardingDemoGate + seed), finał → bramka synca (T5 endDemo→clearSync), replay FAQ/Ustawienia/?tour=1 (T5/T7), skip/Esc (T4/T5), pomijanie brakujących kotwic (T2/T4), badge „Dane przykładowe" (T5), mobile bottom-sheet (T4), testy unit+e2e (T1/T2/T8). Odstępstwa od specu zapisane w Global Constraints (flaga tylko localStorage; kolejność kroków wg mockupu v2; finał przekazuje do istniejącej bramki zamiast osadzać drugi SyncUnlockPanel — bramka JEST panelem odblokowania, stany „unlocked/waiting/none" obsługuje istniejący komponent).
- **Placeholder scan:** copy oznaczone jako placeholdery świadomie (user podmieni); brak TBD/TODO w krokach.
- **Type consistency:** `useOnboardingStore` API (start/setPhase/setStepIndex/finish) spójne między T1 i T5; anchory `TOUR_STEPS` == `data-tour` w T5 (sidebar) i T6; testid-y T4/T5 == T8.
