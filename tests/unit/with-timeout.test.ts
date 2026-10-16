import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "@/lib/with-timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("zwraca wynik obietnicy i nie zostawia timera", async () => {
    await expect(withTimeout(Promise.resolve("ok"), "Krok")).resolves.toBe("ok");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("nie zostawia timera, gdy obietnica się odrzuci", async () => {
    await expect(withTimeout(Promise.reject(new Error("sieć")), "Krok")).rejects.toThrow("sieć");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("odrzuca z etykietą po przekroczeniu limitu", async () => {
    const pending = withTimeout(new Promise<never>(() => {}), "Pobranie backupu", 5_000);
    const assertion = expect(pending).rejects.toThrow("Pobranie backupu przekroczyło limit 5s.");
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });
});
