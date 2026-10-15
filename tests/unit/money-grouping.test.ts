import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/money";

describe("formatCurrency", () => {
  it("grupuje tysiące także dla 4 cyfr", () => {
    expect(formatCurrency(7028, "PLN")).toMatch(/^7\s028\s/);
  });

  it("grupuje dłuższe kwoty tak samo", () => {
    expect(formatCurrency(306424, "PLN")).toMatch(/^306\s424\s/);
  });
});
