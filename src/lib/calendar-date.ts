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

/** Dzisiejsza (albo podana) data kalendarzowa w strefie użytkownika, `RRRR-MM-DD`.
 * `toISOString().slice(0, 10)` daje datę UTC — w Polsce między północą a 1:00/2:00
 * to jeszcze wczorajszy dzień. */
export function localDateString(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const warsawDateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const warsawDayCache = new Map<number, number>();

/** Dzień kalendarzowy chwili `date` w Polsce, jako północ UTC tego dnia.
 * Aplikacja natywna zapisuje daty jako północ czasu lokalnego (w UTC to
 * 22:00/23:00 dnia poprzedniego), a web jako północ UTC — w tej strefie obie
 * wypadają w tym samym dniu. Wynik nadaje się do arytmetyki dni w UTC. */
export function warsawCalendarDay(date: Date): Date {
  return new Date(warsawCalendarDayTime(date));
}

/** {@link warsawCalendarDay} jako znacznik czasu, bez alokacji `Date`. */
export function warsawCalendarDayTime(date: Date): number {
  const time = date.getTime();
  const cached = warsawDayCache.get(time);
  if (cached !== undefined) return cached;
  const parts = Object.fromEntries(
    warsawDateParts.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  if (warsawDayCache.size >= 10_000) warsawDayCache.clear();
  warsawDayCache.set(time, day);
  return day;
}
