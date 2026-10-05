import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Wynik wywołania funkcji `delete-account`. Wdrożona wersja i jej źródło żyją
 * w repozytorium Zecca (supabase/functions/delete-account/handler.ts):
 * - 403 `reauthentication_required` — logowanie starsze niż 5 minut,
 * - 403 `apple_reauthentication_required` — konto Apple potrzebuje świeżego
 *   kodu autoryzacji Apple, który zdobędzie tylko aplikacja iOS/macOS,
 * - 503 `apple_revocation_not_configured` — serwer nie ma sekretów Apple.
 */
export type AccountDeletionOutcome =
  | "deleted"
  | "reauthentication_required"
  | "apple_reauthentication_required"
  | "not_configured"
  | "failed";

type FunctionsClient = {
  functions: { invoke: (name: string, options: { method: "POST" }) => Promise<{ error: unknown }> };
};

async function errorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body: unknown = await (error.context as Response).json();
    const code = body && typeof body === "object" ? (body as Record<string, unknown>).error : null;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

export async function requestAccountDeletion(supabase: FunctionsClient): Promise<AccountDeletionOutcome> {
  try {
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (!error) return "deleted";
    switch (await errorCode(error)) {
      case "reauthentication_required":
        return "reauthentication_required";
      case "apple_reauthentication_required":
        return "apple_reauthentication_required";
      case "apple_revocation_not_configured":
        return "not_configured";
      default:
        return "failed";
    }
  } catch {
    return "failed";
  }
}

export function accountDeletionMessage(outcome: Exclude<AccountDeletionOutcome, "deleted">): string {
  switch (outcome) {
    case "reauthentication_required":
      return "Ze względów bezpieczeństwa usunięcie konta wymaga świeżego logowania. Zaloguj się ponownie i w ciągu 5 minut usuń konto w Ustawieniach.";
    case "apple_reauthentication_required":
      return "Konto zalogowane przez Apple usuniesz w aplikacji Zecca na iPhonie, iPadzie lub Macu: Ustawienia → Konto i synchronizacja → Usuń konto Zecca. Przeglądarka nie może potwierdzić logowania Apple wymaganego do usunięcia konta.";
    case "not_configured":
      return "Usuwanie tego konta jest chwilowo niedostępne z powodu konfiguracji serwera. Spróbuj później.";
    case "failed":
      return "Nie udało się usunąć konta. Spróbuj ponownie.";
  }
}
