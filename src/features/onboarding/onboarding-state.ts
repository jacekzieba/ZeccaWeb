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
    // best-effort flag
  }
}

export function clearOnboardingCompleted(): void {
  try {
    window.localStorage.removeItem(COMPLETED_KEY);
  } catch {
    // best-effort flag
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
