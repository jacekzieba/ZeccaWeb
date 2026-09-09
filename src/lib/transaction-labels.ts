/** Polskie nazwy typów transakcji — jedno źródło.
 *
 * Mapa istniała w trzech kopiach (pulpit, transakcje, pozycje), a paleta
 * poleceń nie miała żadnej i indeksowała transakcje surowym identyfikatorem.
 * Skutkiem było jedno i drugie naraz: `cashDeposit` jako tytuł wyniku
 * wyszukiwania i „Brak wyników" dla poprawnie wpisanego „wpłata".
 */
export const TRANSACTION_LABELS: Record<string, string> = {
  buy: "Kupno",
  sell: "Sprzedaż",
  cashDeposit: "Wpłata",
  cashWithdrawal: "Wypłata",
  dividend: "Dywidenda",
  interest: "Odsetki",
  bondCoupon: "Kupon",
  bondRedemption: "Wykup",
  depositOpen: "Otwarcie lokaty",
  depositClose: "Zamknięcie lokaty",
  fee: "Opłata",
  tax: "Podatek",
  fxConversion: "Przewalutowanie",
  transferIn: "Transfer IN",
  transferOut: "Transfer OUT",
  accountTransferIn: "Przeniesienie",
  correction: "Korekta",
};

export function transactionLabel(type: string): string {
  return TRANSACTION_LABELS[type] ?? type;
}
