import type { DecryptedRecord } from "@/sync/records/encrypted-records";

/**
 * Żywy rekord portfela dla ID portfela z widoku. Widok zna portfel po ID
 * z treści rekordu, a migracja z lipca przeniosła część rekordów pod nowe ID
 * (portfel startowy „Główny” zachował w treści stare). Zapis i usunięcie
 * muszą trafić w faktyczne `record.id`.
 */
export function findAccountRecord(records: DecryptedRecord[] | null | undefined, portfolioId: string) {
  const live = (records ?? []).filter((record) => !record.deletedAt && record.envelope.type === "account");
  return (
    live.find((record) => record.id === portfolioId) ??
    live.find((record) => (record.envelope.payload as { id?: string }).id === portfolioId)
  );
}
