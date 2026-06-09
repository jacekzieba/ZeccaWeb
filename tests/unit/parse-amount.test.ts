import { describe, expect, it } from "vitest";
import {
  AMOUNT_MAGNITUDE_CAP,
  parseAmount,
  parsePositiveAmount,
} from "@/lib/parse-amount";

describe("parseAmount", () => {
  it("parses plain decimals", () => {
    expect(parseAmount("123.45")).toBe(123.45);
    expect(parseAmount("0")).toBe(0);
  });

  it("accepts negatives", () => {
    expect(parseAmount("-42")).toBe(-42);
  });

  it("trims whitespace and normalizes comma decimal separator", () => {
    expect(parseAmount("  1 ")).toBe(1);
    expect(parseAmount("1,5")).toBe(1.5);
  });

  it("rejects empty / whitespace-only input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
  });

  it("rejects non-finite values (NaN / ±Infinity)", () => {
    // parseFloat("1e999") === Infinity, and `Infinity || 0 === Infinity` — the original bug.
    expect(parseAmount("1e999")).toBeNull();
    expect(parseAmount("-1e999")).toBeNull();
    expect(parseAmount("inf")).toBeNull();
    expect(parseAmount("Infinity")).toBeNull();
    expect(parseAmount("NaN")).toBeNull();
  });

  it("rejects magnitudes above the 1e12 cap", () => {
    expect(parseAmount("9e99")).toBeNull();
    expect(parseAmount(String(AMOUNT_MAGNITUDE_CAP + 1))).toBeNull();
    expect(parseAmount("-1e13")).toBeNull();
  });

  it("accepts the boundary value exactly at the cap", () => {
    expect(parseAmount(String(AMOUNT_MAGNITUDE_CAP))).toBe(AMOUNT_MAGNITUDE_CAP);
    expect(parseAmount(String(-AMOUNT_MAGNITUDE_CAP))).toBe(-AMOUNT_MAGNITUDE_CAP);
  });
});

describe("parsePositiveAmount", () => {
  it("accepts strictly positive finite values within range", () => {
    expect(parsePositiveAmount("1.5")).toBe(1.5);
  });

  it("rejects zero and negatives", () => {
    expect(parsePositiveAmount("0")).toBeNull();
    expect(parsePositiveAmount("-1")).toBeNull();
  });

  it("inherits finite + cap rejection", () => {
    expect(parsePositiveAmount("1e999")).toBeNull();
    expect(parsePositiveAmount("9e99")).toBeNull();
  });
});
