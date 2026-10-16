import { useState } from "react";

/**
 * Szkic edytora zamrożony w chwili otwarcia (albo przełączenia na inny rekord).
 *
 * Strony budują szkic z `records`, a synchronizacja w tle podmienia `records`
 * nową tablicą co minutę — także gdy nic się nie zmieniło. Edytor resetował
 * wtedy formularz i gubił to, co użytkownik wpisał. Zamrożony szkic trzyma też
 * `updatedAt` z chwili otwarcia, więc zmiana z innego urządzenia w trakcie
 * edycji kończy się jawnym konfliktem przy zapisie, a nie cichym nadpisaniem.
 */
export function useDraftAtOpen<T extends { id: string }>(open: boolean, draft: T | null | undefined) {
  const key = open ? (draft?.id ?? "new") : null;
  const [held, setHeld] = useState({ key, draft });
  if (held.key !== key) {
    const next = { key, draft };
    setHeld(next);
    return next.draft;
  }
  return held.draft;
}
