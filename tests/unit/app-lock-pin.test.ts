import { beforeEach, describe, expect, it } from "vitest";
import {
  createPinVerifier,
  hasPinVerifier,
  removePinVerifier,
  verifyPin,
} from "@/features/auth/app-lock-pin";

describe("trwały weryfikator PIN-u (W10)", () => {
  let session: Record<string, string>;
  beforeEach(() => {
    // Node 22+ ma własny localStorage zasłaniający jsdomowy; podstawiamy prosty magazyn.
    const makeStore = (store: Record<string, string>) => ({
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
    });
    const local: Record<string, string> = {};
    session = {};
    Object.defineProperty(window, "localStorage", { value: makeStore(local), writable: true, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: makeStore(session), writable: true, configurable: true });
  });

  it("przeżywa wyczyszczenie sessionStorage, czyli działa w nowej karcie", async () => {
    await createPinVerifier("1234");
    sessionStorage.clear();

    expect(hasPinVerifier()).toBe(true);
    expect(await verifyPin("1234")).toBe(true);
    expect(await verifyPin("1235")).toBe(false);
  });

  it("nie zapisuje PIN-u ani słabego skrótu 32-bitowego, tylko sól i skrót PBKDF2", async () => {
    await createPinVerifier("1234");
    const raw = localStorage.getItem("investor-app-lock-verifier") ?? "";

    expect(raw).not.toContain("1234");
    const stored = JSON.parse(localStorage.getItem("investor-app-lock-verifier") ?? "null");
    expect(stored.iterations).toBeGreaterThanOrEqual(100_000);
    expect(atob(stored.salt).length).toBeGreaterThanOrEqual(16);
    expect(atob(stored.hash).length).toBe(32);
  });

  it("dwa weryfikatory tego samego PIN-u mają różną sól", async () => {
    await createPinVerifier("1234");
    const first = localStorage.getItem("investor-app-lock-verifier");
    await createPinVerifier("1234");
    expect(localStorage.getItem("investor-app-lock-verifier")).not.toBe(first);
  });

  it("bez weryfikatora albo z uszkodzonym wpisem odrzuca każdy PIN", async () => {
    expect(hasPinVerifier()).toBe(false);
    expect(await verifyPin("1234")).toBe(false);

    localStorage.setItem("investor-app-lock-verifier", "{nie-json");
    expect(await verifyPin("1234")).toBe(false);
  });

  it("removePinVerifier usuwa weryfikator", async () => {
    await createPinVerifier("1234");
    removePinVerifier();
    expect(hasPinVerifier()).toBe(false);
    expect(await verifyPin("1234")).toBe(false);
  });
});
