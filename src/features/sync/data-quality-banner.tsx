import type { SnapshotDiagnostic } from "@/domain/models/investor-data";
import { COLORS, TYPOGRAPHY } from "@/lib/design-tokens";
import { v2Mix } from "@/lib/v2-design";

/**
 * Warns that displayed portfolio values may be approximate because some market
 * inputs were missing when the snapshot was built (current price, FX rate, or
 * the CPI/NBP macro reading a treasury bond needs), or a record was unreadable.
 * Rendered on every view that shows portfolio value so an incomplete/stale
 * valuation is never presented as exact. Returns `null` when there is nothing
 * to report. The bond case is driven by `treasuryBondMacroGaps` in the
 * valuation layer via the snapshot's `diagnostics`.
 */
export function DataQualityBanner({
  diagnostics,
}: {
  diagnostics: SnapshotDiagnostic[];
}) {
  if (diagnostics.length === 0) return null;

  const join = (code: SnapshotDiagnostic["code"]) =>
    [...new Set(diagnostics.filter((d) => d.code === code).map((d) => d.context))].join(", ");
  const priceMissing = join("price-missing");
  const fxMissing = join("fx-missing");
  const bondMissing = join("bond-missing-macro");
  const recordSkipped = join("record-skipped");

  const lines: string[] = [];
  if (priceMissing) lines.push(`Brak aktualnej ceny (pominięte w wartości): ${priceMissing}.`);
  if (fxMissing) lines.push(`Brak kursu waluty (liczone 1:1 do PLN): ${fxMissing}.`);
  if (bondMissing) lines.push(`Niepełne dane makro do wyceny obligacji (wynik przybliżony): ${bondMissing}.`);
  if (recordSkipped) lines.push(`Pominięto nieczytelne rekordy (${recordSkipped}) — zaktualizuj aplikację lub zgłoś problem.`);

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: `0.5px solid ${v2Mix(COLORS.gold, 0.4)}`,
        background: v2Mix(COLORS.gold, 0.08),
        borderRadius: 12,
        padding: "10px 14px",
        fontFamily: TYPOGRAPHY.system,
        fontSize: 12.5,
        color: COLORS.text,
      }}
    >
      <div style={{ fontWeight: 700 }}>Część danych rynkowych jest niepełna — wartości mogą być przybliżone.</div>
      {lines.map((line) => (
        <div key={line} style={{ color: COLORS.muted }}>{line}</div>
      ))}
    </div>
  );
}
