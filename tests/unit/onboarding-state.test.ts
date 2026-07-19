import { beforeEach, describe, expect, it } from "vitest";
import {
  resolveOnboardingEntry,
  useOnboardingStore,
} from "@/features/onboarding/onboarding-state";

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

  it("finish() resets the transient tour state", () => {
    useOnboardingStore.getState().start("replay");
    useOnboardingStore.getState().finish();
    expect(useOnboardingStore.getState()).toMatchObject({ phase: "idle", mode: null });
  });
});
