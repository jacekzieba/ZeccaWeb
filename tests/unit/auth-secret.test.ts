import { describe, expect, it, vi } from "vitest";
import { deriveAuthSecret, signInWithAccountPassword } from "@/features/auth/auth-secret";

// Kontrakt wspólny z aplikacją iOS/macOS (AuthSecretTests.swift) — te same
// wektory muszą dawać te same sekrety, inaczej konto zalogowane na jednej
// platformie nie zaloguje się na drugiej.
const VECTORS: Array<[string, string, string]> = [
  ["  Jan.Kowalski@Example.PL ", "Haslo-Konta1", "Zk1-wG557jnMsYrrbKVomuQgHDGk0ZdhrCwHiz-mHBJK4A4"],
  ["jan.kowalski@example.pl", "Zażółć-Gęślą1", "Zk1-1WxzzZUMOQsyrvlBa4se3NvaJWVvJiZBH-wFqk3Vov8"],
];

describe("deriveAuthSecret", () => {
  it.each(VECTORS)("%s / %s → wektor wspólny z natywną", async (email, password, expected) => {
    await expect(deriveAuthSecret(email, password)).resolves.toBe(expected);
  });

  it("hasło w postaci rozłożonej (NFD) daje ten sam sekret co złożona (NFC)", async () => {
    const nfd = "Zażółć-Gęślą1".normalize("NFD");
    await expect(deriveAuthSecret("jan.kowalski@example.pl", nfd)).resolves.toBe(VECTORS[1][2]);
  });

  it("spełnia politykę haseł Supabase (mała, wielka litera, cyfra) i mieści się w limicie bcrypt", async () => {
    const secret = await deriveAuthSecret("a@b.pl", "x");
    expect(secret).toMatch(/[a-z]/);
    expect(secret).toMatch(/[A-Z]/);
    expect(secret).toMatch(/[0-9]/);
    expect(secret.length).toBeLessThanOrEqual(72);
  });
});

describe("signInWithAccountPassword", () => {
  function client(accepts: string[]) {
    const signInWithPassword = vi.fn(async ({ password }: { email: string; password: string }) =>
      accepts.includes(password) ? { error: null } : { error: { message: "Invalid login credentials" } },
    );
    const updateUser = vi.fn(async () => ({ error: null }));
    return { auth: { signInWithPassword, updateUser } };
  }

  it("konto już zmigrowane: loguje sekretem, surowe hasło nie wychodzi z urządzenia", async () => {
    const c = client([VECTORS[0][2]]);
    const result = await signInWithAccountPassword(c as never, VECTORS[0][0], VECTORS[0][1]);

    expect(result.error).toBeNull();
    expect(c.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(c.auth.signInWithPassword).toHaveBeenCalledWith({ email: "jan.kowalski@example.pl", password: VECTORS[0][2] });
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });

  it("stare konto: loguje surowym hasłem i od razu przestawia je na sekret", async () => {
    const c = client([VECTORS[0][1]]);
    const result = await signInWithAccountPassword(c as never, VECTORS[0][0], VECTORS[0][1]);

    expect(result.error).toBeNull();
    expect(c.auth.signInWithPassword).toHaveBeenCalledTimes(2);
    expect(c.auth.updateUser).toHaveBeenCalledWith({ password: VECTORS[0][2] });
  });

  it("złe hasło: zwraca błąd, niczego nie migruje", async () => {
    const c = client([]);
    const result = await signInWithAccountPassword(c as never, VECTORS[0][0], "zle");

    expect(result.error?.message).toMatch(/Invalid login credentials/);
    expect(c.auth.updateUser).not.toHaveBeenCalled();
  });
});
