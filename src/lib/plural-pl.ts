/** Polska liczba mnoga: 1 → forma pojedyncza, 2–4 → forma mnoga, reszta → dopełniacz.
 *
 * Wyjątek na końcówkach 12–14, które mimo cyfry 2/3/4 biorą dopełniacz
 * („12 pozycji", nie „12 pozycje"). Kod w kilku miejscach obsługiwał tylko
 * `n === 1`, przez co produkt pisał „2 pozycji" i „1 obciążeń".
 */
export function pluralPl(n: number, jeden: string, dwaCztery: string, wiele: string): string {
  const abs = Math.abs(n);
  const ostatnia = abs % 10;
  const dwieOstatnie = abs % 100;
  if (abs === 1) return jeden;
  if (ostatnia >= 2 && ostatnia <= 4 && (dwieOstatnie < 12 || dwieOstatnie > 14)) return dwaCztery;
  return wiele;
}
