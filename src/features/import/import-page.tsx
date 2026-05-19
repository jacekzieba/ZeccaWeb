"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { COLORS, SHADOWS, SURFACES } from "@/lib/design-tokens";
import {
  buildImportReferenceData,
  parseTransactionCsvImport,
  parseTransactionTable,
  transactionCsvTemplate,
  type TransactionImportPreview,
} from "@/features/import/import-parser";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { useSyncStore } from "@/sync/store/sync-store";

const cardStyle: CSSProperties = {
  ...SURFACES.glassCard,
};

const buttonBase: CSSProperties = {
  border: "none",
  borderRadius: 9,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

function downloadTemplate() {
  const blob = new Blob([transactionCsvTemplate()], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "investor-transactions-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImportPage() {
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const references = useMemo(() => buildImportReferenceData(records), [records]);

  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransactionImportPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    setResult(null);
    setError(null);
    setPreview(null);
    setFileName(file?.name ?? null);

    if (!file) return;

    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "xlsx" || extension === "xls") {
        const { readSheet } = await import("read-excel-file/browser");
        const rows = await readSheet(file);
        setPreview(parseTransactionTable(rows, references));
      } else {
        const text = await file.text();
        setPreview(parseTransactionCsvImport(text, references));
      }
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "Nie udało się odczytać pliku.",
      );
    }
  }

  async function handleImport() {
    if (!preview || !supabase || !userDataKey) {
      setError("Odblokuj dane w panelu synchronizacji przed importem.");
      return;
    }

    setSaving(true);
    setError(null);
    setResult(null);

    try {
      if (dryRun) {
        setResult(
          `Dry run: ${preview.validRows.length} transakcji gotowych do zapisu, ${preview.errorRows.length} wymaga poprawy.`,
        );
        return;
      }

      let queued = 0;
      for (const row of preview.validRows) {
        if (!row.payload) continue;
        const saveResult = await saveRecord(
          supabase,
          userDataKey,
          "transaction",
          row.payload,
          { baseUpdatedAt: null },
        );
        if (saveResult.queued) queued += 1;
      }

      const { records: nextRecords, snapshot } = await refreshSyncStore(
        supabase,
        userDataKey,
      );
      setSync(nextRecords, snapshot);
      setResult(
        `Zaimportowano ${preview.validRows.length - queued} transakcji${
          queued > 0 ? `, ${queued} czeka w kolejce sync` : ""
        }.`,
      );
      setPreview(null);
      setFileName(null);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Nie udało się zapisać importu.",
      );
    } finally {
      setSaving(false);
    }
  }

  const validCount = preview?.validRows.length ?? 0;
  const errorCount = preview?.errorRows.length ?? 0;
  const warningCount = preview?.rows.filter((row) => row.warnings.length > 0).length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: "0 2px 4px" }}>
        <div
          style={{
            color: COLORS.text,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          Import
        </div>
        <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}>
          CSV/XLSX transakcji z lokalnym preview przed szyfrowanym zapisem
        </div>
      </div>

      {!records && (
        <div style={{ ...cardStyle, padding: "34px 22px", textAlign: "center" }}>
          <div style={{ color: COLORS.subtle, fontSize: 14 }}>
            Odblokuj dane w panelu synchronizacji, żeby zaimportować transakcje.
          </div>
        </div>
      )}

      {records && (
        <>
          <div
            style={{
              ...cardStyle,
              padding: 18,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  color: COLORS.text,
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 5,
                }}
              >
                Transakcje CSV/XLSX
              </div>
              <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.45 }}>
                Wymagane kolumny: date, portfolio, transactionType, grossAmount,
                currency. Instrument może być podany jako ID, symbol albo nazwa.
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              style={{
                ...buttonBase,
                background: COLORS.surfaceAlt,
                color: COLORS.text,
                padding: "9px 13px",
              }}
            >
              Szablon CSV
            </button>
          </div>

          <label
            style={{
              ...cardStyle,
              display: "block",
              padding: "22px 18px",
              cursor: "pointer",
              borderStyle: "dashed",
            }}
          >
            <input
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              type="file"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>
              {fileName ?? "Wybierz plik CSV albo XLSX"}
            </div>
            <div style={{ color: COLORS.subtle, fontSize: 12, marginTop: 5 }}>
              Plik jest parsowany lokalnie w przeglądarce.
            </div>
          </label>

          {preview && (
            <div style={{ ...cardStyle, overflow: "hidden" }}>
              <div
                style={{
                  borderBottom: `0.5px solid ${COLORS.lineSoft}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "15px 18px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 700 }}>
                    Preview importu
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>
                    {validCount} poprawnych · {warningCount} z ostrzeżeniami · {errorCount} z błędami
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <label
                    style={{
                      alignItems: "center",
                      color: COLORS.muted,
                      display: "inline-flex",
                      fontSize: 12,
                      fontWeight: 700,
                      gap: 7,
                    }}
                  >
                    <input
                      checked={dryRun}
                      onChange={(event) => setDryRun(event.target.checked)}
                      type="checkbox"
                    />
                    Dry run
                  </label>
                  <button
                    disabled={validCount === 0 || saving || !userDataKey}
                    onClick={() => void handleImport()}
                    style={{
                      ...buttonBase,
                      background:
                        validCount > 0 && userDataKey
                          ? COLORS.text
                          : "rgba(28,49,68,0.12)",
                      boxShadow:
                        validCount > 0 && userDataKey ? SHADOWS.button : "none",
                      color:
                        validCount > 0 && userDataKey ? COLORS.white : COLORS.subtle,
                      padding: "9px 14px",
                      cursor:
                        validCount > 0 && userDataKey && !saving
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    {saving
                      ? "Importuję..."
                      : dryRun
                        ? "Sprawdź import"
                        : "Zapisz poprawne"}
                  </button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    minWidth: 760,
                    width: "100%",
                  }}
                >
                  <thead>
                    <tr style={{ background: COLORS.textSofter }}>
                      {["Wiersz", "Data", "Typ", "Portfel", "Instrument", "Kwota", "Status"].map(
                        (heading) => (
                          <th
                            key={heading}
                            style={{
                              color: COLORS.subtle,
                              fontSize: 10.5,
                              fontWeight: 800,
                              letterSpacing: ".08em",
                              padding: "10px 12px",
                              textAlign: "left",
                              textTransform: "uppercase",
                            }}
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 40).map((row) => (
                      <tr
                        key={row.rowNumber}
                        style={{ borderTop: `0.5px solid ${COLORS.lineSoft}` }}
                      >
                        <td style={cellStyle}>{row.rowNumber}</td>
                        <td style={cellStyle}>{row.values.date || "-"}</td>
                        <td style={cellStyle}>{row.values.transactiontype || "-"}</td>
                        <td style={cellStyle}>{row.values.portfolio || "-"}</td>
                        <td style={cellStyle}>{row.values.instrument || "-"}</td>
                        <td style={cellStyle}>
                          {row.values.grossamount || "-"} {row.values.currency}
                        </td>
                        <td style={{ ...cellStyle, minWidth: 240 }}>
                          {row.errors.length > 0 ? (
                            <span style={{ color: COLORS.loss }}>
                              {row.errors.join(" ")}
                            </span>
                          ) : row.warnings.length > 0 ? (
                            <span style={{ color: COLORS.gold }}>
                              {row.warnings.join(" ")}
                            </span>
                          ) : (
                            <span style={{ color: COLORS.profit }}>Gotowe</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 40 && (
                <div
                  style={{
                    borderTop: `0.5px solid ${COLORS.lineSoft}`,
                    color: COLORS.subtle,
                    fontSize: 12,
                    padding: "10px 18px",
                  }}
                >
                  Pokazano pierwsze 40 wierszy z {preview.rows.length}.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {result && (
        <div style={{ color: COLORS.profit, fontSize: 13, fontWeight: 700 }}>
          {result}
        </div>
      )}
      {error && (
        <div style={{ color: COLORS.loss, fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
    </div>
  );
}

const cellStyle: CSSProperties = {
  color: COLORS.text,
  fontSize: 12,
  padding: "11px 12px",
  verticalAlign: "top",
};
