import { beforeEach, describe, expect, it } from "vitest";
import { useOnboardingStore } from "@/features/onboarding/onboarding-state";

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
