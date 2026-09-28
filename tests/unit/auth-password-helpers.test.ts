import { afterEach, describe, expect, it, vi } from "vitest";
import { passwordRequirementError } from "@/features/auth/password-requirements";
import {
  clearPendingAuthPassword,
  peekPendingAuthPassword,
  setPendingAuthPassword,
} from "@/features/auth/pending-auth-password";

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("passwordRequirementError", () => {
  it.each([
    ["Ab1", /co najmniej 8 znaków/],
    ["aaaaaaaa", /małą literę, wielką literę i cyfrę/],
    ["AAAAAAAA1", /małą literę, wielką literę i cyfrę/],
    ["abcdefgh1", /małą literę, wielką literę i cyfrę/],
    ["Abcdefgh", /małą literę, wielką literę i cyfrę/],
  ])("odrzuca %s", (pwd, msg) => {
    expect(passwordRequirementError(pwd)).toMatch(msg);
  });

  it("przyjmuje hasło spełniające politykę, także z polskimi znakami", () => {
    expect(passwordRequirementError("Haslo-Konta1")).toBeNull();
    expect(passwordRequirementError("Zażółć-Gęślą1")).toBeNull();
  });
});

describe("pending-auth-password", () => {
  it("peek nie usuwa, clear usuwa", () => {
    setPendingAuthPassword("Haslo-Konta1");
    expect(peekPendingAuthPassword()).toBe("Haslo-Konta1");
    expect(peekPendingAuthPassword()).toBe("Haslo-Konta1");
    clearPendingAuthPassword();
    expect(peekPendingAuthPassword()).toBeNull();
  });

  it("wygasa po 2 minutach i wtedy znika ze storage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T10:00:00Z"));
    setPendingAuthPassword("Haslo-Konta1");
    vi.setSystemTime(new Date("2026-09-24T10:01:59Z"));
    expect(peekPendingAuthPassword()).toBe("Haslo-Konta1");
    vi.setSystemTime(new Date("2026-09-24T10:02:01Z"));
    expect(peekPendingAuthPassword()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("uszkodzony wpis jest traktowany jak brak hasła i usuwany", () => {
    sessionStorage.setItem("zecca:pending-auth-password", "{nie-json");
    expect(peekPendingAuthPassword()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("gdy sessionStorage rzuca (tryb prywatny), nic się nie wywraca", () => {
    const boom = () => { throw new Error("blocked"); };
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage")!;
    Object.defineProperty(window, "sessionStorage", { get: boom, configurable: true });
    try {
      expect(() => setPendingAuthPassword("x")).not.toThrow();
      expect(peekPendingAuthPassword()).toBeNull();
      expect(() => clearPendingAuthPassword()).not.toThrow();
    } finally {
      Object.defineProperty(window, "sessionStorage", original);
    }
  });
});
