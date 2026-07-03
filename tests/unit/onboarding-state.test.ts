import { beforeEach, describe, expect, it } from "vitest";
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  clearOnboardingCompleted,
  resolveOnboardingEntry,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-state";

// The test environment does not ship a working Storage — mirror the
// localStorage mock used by section-customization.test.ts.
beforeEach(() => {
  const store: Record<string, string> = {};
  const mock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
  };
  Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
});

describe("onboarding completed flag", () => {

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
