import { findOversells, oversellMessage } from "@/domain/ledger/oversell";
import { toOversellInput, type TransactionLike } from "@/sync/records/oversell-check";
import type { ImportReferenceData, TransactionImportPreview } from "./import-parser";

/** Dopisuje do wierszy podglądu ostrzeżenie o sprzedaży ponad stan.
 *
 * Stan liczymy z istniejących transakcji (`references.existingTransactions`) i pozostałych
 * poprawnych wierszy pliku, więc kupno w tym samym pliku pokrywa późniejszą sprzedaż.
 * To OSTRZEŻENIE: wiersz zostaje poprawny i można go zapisać (decyzja produktowa —
 * natywnie taki zapis jest odrzucany, na webie użytkownik decyduje sam).
 * Mutuje `warnings` wierszy, bo `rows`, `validRows` i `errorRows` współdzielą obiekty. */
export function annotateOversellWarnings<P extends TransactionImportPreview>(
  preview: P,
  references: ImportReferenceData,
): P {
  const candidates = preview.rows.flatMap((row, index) => {
    if (!row.payload || row.errors.length > 0) return [];
    const input = toOversellInput(row.payload as unknown as TransactionLike, `import:${index}`);
    return input ? [{ row, input: { ...input, id: `import:${index}` } }] : [];
  });
  if (candidates.length === 0) return preview;

  const issues = findOversells([
    ...(references.existingTransactions ?? []),
    ...candidates.map((candidate) => candidate.input),
  ]);
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  for (const { row, input } of candidates) {
    const issue = byId.get(input.id);
    if (issue) row.warnings.push(oversellMessage(issue));
  }
  return preview;
}
