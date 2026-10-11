import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStoredPasskeyId,
  isPasskeySupported,
  registerPasskey,
  removePasskey,
  userVerifiedFlag,
  verifyPasskey,
} from "@/features/auth/passkey";

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

function authData(flags: number) {
  const data = new Uint8Array(37);
  data[32] = flags;
  return data.buffer;
}

function installCredentials(impl: { create?: unknown; get?: unknown }) {
  Object.defineProperty(navigator, "credentials", {
    value: impl,
    configurable: true,
  });
  (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential = class {};
}

beforeEach(() => {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    },
  });
});

afterEach(() => {
  delete (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  Object.defineProperty(navigator, "credentials", { value: undefined, configurable: true });
});

describe("userVerifiedFlag", () => {
  it("reads the UV bit of authenticator data", () => {
    expect(userVerifiedFlag(authData(0x05))).toBe(true); // UP + UV
    expect(userVerifiedFlag(authData(0x01))).toBe(false); // UP only
  });
  it("is false for truncated data", () => {
    expect(userVerifiedFlag(new ArrayBuffer(10))).toBe(false);
  });
});

describe("passkey lock", () => {
  it("reports unsupported without WebAuthn", () => {
    expect(isPasskeySupported()).toBe(false);
  });

  it("registers a platform credential requiring user verification and stores its id", async () => {
    const create = vi.fn(async () => ({ rawId: bytes(1, 2, 3, 4) }));
    installCredentials({ create });
    expect(isPasskeySupported()).toBe(true);

    await registerPasskey();

    const options = (create.mock.calls[0] as unknown as [{ publicKey: PublicKeyCredentialCreationOptions }])[0].publicKey;
    expect(options.authenticatorSelection?.userVerification).toBe("required");
    expect(options.authenticatorSelection?.authenticatorAttachment).toBe("platform");
    expect(getStoredPasskeyId()).toBe("AQIDBA"); // base64url of 01 02 03 04
  });

  it("verifies only when the assertion is for the stored credential and user-verified", async () => {
    installCredentials({ create: async () => ({ rawId: bytes(9, 9) }) });
    await registerPasskey();
    const id = getStoredPasskeyId()!;

    const get = vi.fn(async () => ({
      rawId: bytes(9, 9),
      id,
      response: { authenticatorData: authData(0x05) },
    }));
    installCredentials({ get });
    expect(await verifyPasskey()).toBe(true);
    const request = (get.mock.calls[0] as unknown as [{ publicKey: PublicKeyCredentialRequestOptions }])[0].publicKey;
    expect(request.userVerification).toBe("required");
    expect(request.allowCredentials?.length).toBe(1);

    installCredentials({
      get: async () => ({ rawId: bytes(9, 9), id, response: { authenticatorData: authData(0x01) } }),
    });
    expect(await verifyPasskey()).toBe(false);

    installCredentials({
      get: async () => ({ rawId: bytes(7), id: "other", response: { authenticatorData: authData(0x05) } }),
    });
    expect(await verifyPasskey()).toBe(false);
  });

  it("returns false when the user cancels the prompt", async () => {
    installCredentials({ create: async () => ({ rawId: bytes(1) }) });
    await registerPasskey();
    installCredentials({
      get: async () => {
        throw new DOMException("cancelled", "NotAllowedError");
      },
    });
    expect(await verifyPasskey()).toBe(false);
  });

  it("removePasskey forgets the credential", async () => {
    installCredentials({ create: async () => ({ rawId: bytes(1) }) });
    await registerPasskey();
    removePasskey();
    expect(getStoredPasskeyId()).toBeNull();
    expect(await verifyPasskey()).toBe(false);
  });
});
