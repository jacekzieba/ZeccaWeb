/**
 * Najczęstsze błędy Supabase Auth po polsku; pozostałe zostają bez zmian.
 * Ten sam zestaw co w aplikacji iOS/macOS (AuthService.userFacingMessage).
 */
export type AuthErrorLike = { message: string; code?: string; status?: number };

/**
 * Błędne dane logowania zwykle znaczą literówkę albo konto sprzed 28.09.2026,
 * które w Auth ma jeszcze surowe hasło (zob. auth-secret.ts) — w obu
 * przypadkach pomaga reset hasła.
 */
const INVALID_CREDENTIALS_MESSAGE =
  "Nieprawidłowy e-mail lub hasło. Jeśli konto zakładałeś przed 28.09.2026 albo nie pamiętasz hasła, użyj „Nie pamiętasz hasła?”.";

export function isInvalidCredentials(error: AuthErrorLike): boolean {
  return error.code === "invalid_credentials" || error.message === "Invalid login credentials";
}

export function authErrorMessage(error: AuthErrorLike): string {
  if (isInvalidCredentials(error)) return INVALID_CREDENTIALS_MESSAGE;
  if (error.code === "email_not_confirmed" || error.message === "Email not confirmed") {
    return "Adres e-mail nie jest jeszcze potwierdzony. Kliknij link z wiadomości, którą wysłaliśmy przy rejestracji, i zaloguj się ponownie.";
  }
  if (
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit" ||
    error.status === 429
  ) {
    return "Zbyt wiele prób w krótkim czasie. Odczekaj chwilę i spróbuj ponownie.";
  }
  return error.message;
}
