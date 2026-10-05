import { describe, expect, it, vi } from "vitest";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import {
  accountDeletionMessage,
  requestAccountDeletion,
} from "@/features/settings/account-deletion";

function clientReturning(error: unknown) {
  const invoke = vi.fn(async () => ({ data: error ? null : { status: "deleted" }, error }));
  return { client: { functions: { invoke } }, invoke };
}

function httpError(status: number, body: unknown) {
  return new FunctionsHttpError(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

describe("requestAccountDeletion — kontrakt wdrożonej funkcji delete-account (repo Zecca)", () => {
  it("wywołuje funkcję delete-account i zgłasza usunięcie", async () => {
    const { client, invoke } = clientReturning(null);
    await expect(requestAccountDeletion(client)).resolves.toBe("deleted");
    expect(invoke).toHaveBeenCalledWith("delete-account", { method: "POST" });
  });

  it("403 reauthentication_required → wymaga świeżego logowania", async () => {
    const { client } = clientReturning(
      httpError(403, { error: "reauthentication_required", max_age_seconds: 300 }),
    );
    await expect(requestAccountDeletion(client)).resolves.toBe("reauthentication_required");
  });

  it("403 apple_reauthentication_required → tylko w aplikacji iOS/macOS", async () => {
    const { client } = clientReturning(httpError(403, { error: "apple_reauthentication_required" }));
    await expect(requestAccountDeletion(client)).resolves.toBe("apple_reauthentication_required");
  });

  it("503 apple_revocation_not_configured → błąd konfiguracji serwera", async () => {
    const { client } = clientReturning(httpError(503, { error: "apple_revocation_not_configured" }));
    await expect(requestAccountDeletion(client)).resolves.toBe("not_configured");
  });

  it("inne błędy HTTP, nieczytelna odpowiedź i błąd sieci → ogólne niepowodzenie", async () => {
    for (const error of [
      httpError(500, { error: "account_deletion_failed" }),
      new FunctionsHttpError(new Response("<html>", { status: 502 })),
      new FunctionsFetchError(new TypeError("Failed to fetch")),
    ]) {
      await expect(requestAccountDeletion(clientReturning(error).client)).resolves.toBe("failed");
    }
  });

  it("odrzucone wywołanie (wyjątek) → ogólne niepowodzenie", async () => {
    const client = { functions: { invoke: vi.fn(async () => { throw new Error("boom"); }) } };
    await expect(requestAccountDeletion(client)).resolves.toBe("failed");
  });
});

describe("accountDeletionMessage", () => {
  it("prowadzi do ponownego logowania i usunięcia w ciągu 5 minut", () => {
    expect(accountDeletionMessage("reauthentication_required")).toMatch(/zaloguj się ponownie/i);
    expect(accountDeletionMessage("reauthentication_required")).toMatch(/5 minut/);
  });

  it("dla konta Apple wskazuje ścieżkę w aplikacji iOS/macOS", () => {
    expect(accountDeletionMessage("apple_reauthentication_required")).toContain(
      "Ustawienia → Konto i synchronizacja → Usuń konto Zecca",
    );
  });

  it("ma komunikat dla błędu konfiguracji i ogólnego niepowodzenia", () => {
    expect(accountDeletionMessage("not_configured")).toMatch(/serwer/i);
    expect(accountDeletionMessage("failed")).toBe("Nie udało się usunąć konta. Spróbuj ponownie.");
  });
});
