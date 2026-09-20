import { afterEach, describe, expect, it } from "vitest";
import { passwordRequirementError } from "@/features/auth/password-requirements";
import {
  clearPendingAuthPassword,
  peekPendingAuthPassword,
  setPendingAuthPassword,
} from "@/features/auth/pending-auth-password";

afterEach(() => sessionStorage.clear());

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
