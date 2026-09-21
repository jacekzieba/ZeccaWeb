/** Data kalendarzowa (UTC) albo `null`, gdy taka nie istnieje.
 *
 * `Date.UTC` po cichu przelicza nieistniejące daty: 31.02 → 3.03, miesiąc 13 →
 * styczeń następnego roku. W imporcie oznaczało to zapis transakcji z inną datą
 * niż w pliku, bez żadnego ostrzeżenia. Tu data musi wrócić z tymi samymi
 * składnikami, z których ją zbudowano. */
export function utcDateOrNull(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}
