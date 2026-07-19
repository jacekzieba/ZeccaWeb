import { create } from "zustand";

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
export type OnboardingMode = "demo" | "public-demo" | "replay";

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
    set({ phase: "idle", mode: null, stepIndex: 0 });
  },
}));
