import { describe, expect, it } from "vitest";
import {
  createEncryptedKeyBackup,
  generateUserDataKeyBytes,
  rewrapKeyBackup,
  unlockUserDataKey,
} from "@/sync/encryption/key-backup";
import { decryptJsonPayload, encryptJsonPayload, importAesGcmKey } from "@/sync/encryption/aes-gcm";

// Zmiana hasła, które jest zarazem kluczem: ten sam userDataKey musi dać się
// odpakować nowym hasłem, a starym już nie — inaczej rekordy na serwerze
// (zaszyfrowane tym kluczem) przestałyby się odszyfrowywać.
const ITER = 1_000;

describe("rewrapKeyBackup", () => {
  it("przepakowuje ten sam klucz danych pod nowe hasło", async () => {
    const raw = generateUserDataKeyBytes();
    const backup = await createEncryptedKeyBackup({ rawUserDataKey: raw, passphrase: "Stare-Haslo1", iterations: ITER });

    const next = await rewrapKeyBackup(backup, "Stare-Haslo1", "Nowe-Haslo2");

    const original = await importAesGcmKey(raw);
    const { encryptedPayload, nonce } = await encryptJsonPayload(original, { ok: 1 });
    const unlocked = await unlockUserDataKey(next, "Nowe-Haslo2");
    await expect(decryptJsonPayload(unlocked, encryptedPayload, nonce)).resolves.toEqual({ ok: 1 });
    await expect(unlockUserDataKey(next, "Stare-Haslo1")).rejects.toBeTruthy();
    expect(next.salt).not.toBe(backup.salt);
  });

  it("odrzuca złe obecne hasło (np. osobna, starsza passphrase)", async () => {
    const backup = await createEncryptedKeyBackup({
      rawUserDataKey: generateUserDataKeyBytes(),
      passphrase: "osobna fraza sync",
      iterations: ITER,
    });

    await expect(rewrapKeyBackup(backup, "Stare-Haslo1", "Nowe-Haslo2")).rejects.toBeTruthy();
  });
});
