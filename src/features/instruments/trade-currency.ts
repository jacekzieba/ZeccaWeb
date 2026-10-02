import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { nowSwiftReferenceSeconds } from "@/sync/records/macos-payloads";

type TradePayload = {
  instrumentID?: string | null;
  transactionType?: string;
  currency?: string;
};

function tradesOf(records: DecryptedRecord[], instrumentID: string) {
  return records.filter((record) => {
    if (record.deletedAt || record.envelope.type !== "transaction") return false;
    const payload = record.envelope.payload as TradePayload;
    return (
      payload.instrumentID === instrumentID &&
      (payload.transactionType === "buy" || payload.transactionType === "sell")
    );
  });
}

/**
 * Zakupy/sprzedaże instrumentu zapisane w innej walucie niż on sam (najczęstsza
 * z takich walut) — np. import oznaczył je jako USD, a ETF jest notowany w EUR.
 * Dywidendy pomijamy: bywają w PLN i to jest poprawne. Jak natywne
 * `mismatchedTradeCurrency`.
 */
export function mismatchedTradeCurrency(
  records: DecryptedRecord[],
  instrumentID: string,
  instrumentCurrency: string,
): { currency: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const record of tradesOf(records, instrumentID)) {
    const currency = (record.envelope.payload as TradePayload).currency;
    if (!currency || currency === instrumentCurrency) continue;
    counts.set(currency, (counts.get(currency) ?? 0) + 1);
  }
  let top: { currency: string; count: number } | null = null;
  for (const [currency, count] of counts) {
    if (!top || count > top.count) top = { currency, count };
  }
  return top;
}

/**
 * Kopie zakupów/sprzedaży instrumentu w `from` z walutą zmienioną na `to`.
 * Cena i ilość zostają; faktyczny kurs przewalutowania z wyciągu
 * (`fxRateToBase`) też — koszt w PLN się nie zmienia. `updatedAt` rekordu
 * zostaje stary: to podstawa strażnika konfliktów przy zapisie.
 */
export function retagTradeCurrency(
  records: DecryptedRecord[],
  instrumentID: string,
  from: string,
  to: string,
): DecryptedRecord[] {
  if (from === to) return [];
  return tradesOf(records, instrumentID)
    .filter((record) => (record.envelope.payload as TradePayload).currency === from)
    .map((record) => ({
      ...record,
      envelope: {
        ...record.envelope,
        payload: {
          ...(record.envelope.payload as Record<string, unknown>),
          currency: to,
          updatedAt: nowSwiftReferenceSeconds(),
        },
      },
    }));
}
