import { describe, expect, it } from "vitest";
import { LIGHT, DARK, RADIUS, SPACE, TOKEN_NAMES } from "@/design/tokens";

describe("tokeny", () => {
  it("oba motywy mają dokładnie ten sam zestaw kluczy", () => {
    expect(Object.keys(LIGHT).sort()).toEqual(Object.keys(DARK).sort());
    expect(Object.keys(LIGHT).sort()).toEqual([...TOKEN_NAMES].sort());
  });

  it("motyw jasny ma zatwierdzone wartości", () => {
    expect(LIGHT.ground).toBe("#FBFCFA");
    expect(LIGHT.ink).toBe("#123B2B");
    expect(LIGHT.accent).toBe("#A0512F");
    expect(LIGHT.assetDeposit).toBe("#7A6E63");
  });

  it("motyw ciemny ma zatwierdzone wartości", () => {
    expect(DARK.ground).toBe("#0B1A14");
    expect(DARK.accent).toBe("#C9765F");
    expect(DARK.assetDeposit).toBe("#B0A294");
  });

  it("jest pięć klas aktywów, nie cztery", () => {
    const classes = TOKEN_NAMES.filter((n) => n.startsWith("asset"));
    expect(classes).toHaveLength(5);
  });

  it("nie ma tokenu ostrzeżenia — stan niesie słowo i glif", () => {
    expect(TOKEN_NAMES).not.toContain("warning");
  });

  it("skala promieni ma sześć stopni, a odstępów dziewięć", () => {
    expect(Object.keys(RADIUS)).toHaveLength(6);
    expect(SPACE).toEqual([4, 8, 12, 16, 24, 32, 48, 64, 96]);
  });
});
