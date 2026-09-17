export const MIN_PASSWORD_LENGTH = 8;

/** Supabase Auth requires lowercase + uppercase + a digit (dashboard-configured
 * password_requirements: lower_upper_letters_digits) — shown upfront here in
 * Polish instead of letting the raw English GoTrue error surface after submit.
 * Shared by signup and password-reset, since both submit to the same policy. */
export function passwordRequirementError(pwd: string): string | null {
  if (pwd.length < MIN_PASSWORD_LENGTH) {
    return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`;
  }
  if (!/[a-z]/.test(pwd) || !/[A-Z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return "Hasło musi zawierać małą literę, wielką literę i cyfrę.";
  }
  return null;
}
