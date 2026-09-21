/** Sprzedaż ponad stan (long-only, jak natywny FinancialRecordAdmission, ADR-0002).
 *
 * Silnik webowy nie odrzuca takiej sprzedaży, tylko odcina ją do posiadanych sztuk:
 * sprzedaż 10 szt. przy stanie 5 księguje wpływ za 5 szt. (600 zł zamiast 1 200 zł)
 * i nie zostawia śladu. Ta funkcja znajduje takie zdarzenia, żeby pokazać je
 * użytkownikowi (podgląd importu, modal transakcji, baner jakości danych).
 * To OSTRZEŻENIE, nie blokada: zapis pozostaje możliwy.
 *
 * Reguły pozycji są tymi samymi, którymi liczy księga w investor-snapshot.ts:
 * kupno, otwarcie lokaty i transfer instrumentu (`accountTransferIn`, rodzaj `asset`)
 * zwiększają stan; sprzedaż, wykup obligacji i zamknięcie lokaty go zmniejszają.
 * Kupno/sprzedaż bez instrumentu, ilości lub ceny księga pomija, więc tu też. */

export type OversellInput = {
  /** Identyfikator do rozpoznania kandydata w wynikach (dowolny, unikalny w wywołaniu). */
  id: string;
  portfolioID: string;
  instrumentID?: string | null;
  transactionType: string;
  quantity?: number | null;
  price?: number | null;
  transferKind?: string | null;
  /** Suma ilości z `transferLots`, jeśli są. */
  transferLotQuantity?: number;
  /** Czas transakcji (ms). Remisy rozstrzyga kolejność wejścia — jak w księdze. */
  dateMs: number;
};

export type OversellIssue = {
  id: string;
  portfolioID: string;
  instrumentID: string;
  /** Ile sztuk chciała zdjąć transakcja. */
  requested: number;
  /** Ile było dostępnych tuż przed nią. */
  available: number;
};

const EPSILON = 1e-9;

function positionDelta(t: OversellInput): number | null {
  const type = t.transactionType;
  if (type === "depositOpen") return 1;
  if (type === "buy" || type === "sell" || type === "bondRedemption") {
    if (!t.instrumentID || t.quantity == null) return null;
    if (type !== "bondRedemption" && t.price == null) return null;
    return type === "buy" ? t.quantity : -t.quantity;
  }
  if (type === "depositClose") return -((t.quantity ?? 0) > EPSILON ? t.quantity! : 1);
  if (type === "accountTransferIn" && t.transferKind === "asset") {
    const quantity = (t.transferLotQuantity ?? 0) > 0 ? t.transferLotQuantity! : t.quantity;
    return quantity != null ? quantity : null;
  }
  return null;
}

/** Zdarzenia zmniejszające stan bardziej, niż było go w danej chwili. Po takim zdarzeniu
 * stan jest zerowany (tak jak robi to księga), więc kolejne nie „dziedziczą” długu. */
export function findOversells(transactions: readonly OversellInput[]): OversellIssue[] {
  const ordered = transactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((a, b) => a.transaction.dateMs - b.transaction.dateMs || a.index - b.index);

  const held = new Map<string, number>();
  const issues: OversellIssue[] = [];

  for (const { transaction } of ordered) {
    const delta = positionDelta(transaction);
    if (delta == null || !transaction.instrumentID) continue;
    const key = `${transaction.portfolioID}|${transaction.instrumentID}`;
    const available = held.get(key) ?? 0;
    if (delta >= 0) {
      held.set(key, available + delta);
      continue;
    }
    const requested = -delta;
    if (requested > available + EPSILON) {
      issues.push({
        id: transaction.id,
        portfolioID: transaction.portfolioID,
        instrumentID: transaction.instrumentID,
        requested,
        available: Math.max(0, available),
      });
    }
    held.set(key, Math.max(0, available - requested));
  }
  return issues;
}

const format = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 6 });

export function oversellMessage(issue: Pick<OversellIssue, "requested" | "available">): string {
  return `Sprzedaż ${format(issue.requested)} szt., a dostępne ${format(issue.available)} — nadwyżka zostanie pominięta w wycenie (wpływ policzony tylko za posiadane sztuki).`;
}
