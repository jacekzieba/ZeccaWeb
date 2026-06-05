"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  buildImportReferenceData,
  parseTransactionCsvImport,
  parseTransactionTable,
  transactionCsvTemplate,
  type TransactionImportPreview,
} from "@/features/import/import-parser";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { buildParitySnapshot } from "@/sync/records/parity-snapshot";
import { buildTransactionList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";
import { V2, V2Card, V2ScreenHead, V2_TYPE, v2Mix } from "@/lib/v2-design";

const UI = V2_TYPE.ui;
const SERIF = V2_TYPE.serif;
const MONO = V2_TYPE.mono;

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const SECTION_HEAD: CSSProperties = {
  fontFamily: UI, fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em",
  textTransform: "uppercase", color: V2.subtle,
};

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none", borderRadius: 10, padding: "9px 16px", fontFamily: UI, fontSize: 13, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
        background: disabled ? v2Mix(V2.ink, 0.12) : V2.ink,
        color: disabled ? V2.subtle : V2.card,
        boxShadow: disabled ? "none" : `0 3px 10px ${v2Mix(V2.ink, 0.2)}`,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `0.5px solid ${V2.line}`, borderRadius: 10, padding: "9px 16px", fontFamily: UI, fontSize: 13,
        fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
        background: V2.card, color: disabled ? V2.subtle : V2.ink, opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}

export function ImportPage() {
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const references = useMemo(() => buildImportReferenceData(records), [records]);

  const [tab, setTab] = useState<"import" | "export">("import");
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
      setError(parseError instanceof Error ? parseError.message : "Nie udało się odczytać pliku.");
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
        setResult(`Symulacja: ${preview.validRows.length} transakcji gotowych do zapisu, ${preview.errorRows.length} wymaga poprawy.`);
        return;
      }
      let queued = 0;
      for (const row of preview.validRows) {
        if (!row.payload) continue;
        const saveResult = await saveRecord(supabase, userDataKey, "transaction", row.payload, { baseUpdatedAt: null });
        if (saveResult.queued) queued += 1;
      }
      const { records: nextRecords, snapshot } = await refreshSyncStore(supabase, userDataKey);
      setSync(nextRecords, snapshot);
      setResult(`Zaimportowano ${preview.validRows.length - queued} transakcji${queued > 0 ? `, ${queued} czeka w kolejce sync` : ""}.`);
      setPreview(null);
      setFileName(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Nie udało się zapisać importu.");
    } finally {
      setSaving(false);
    }
  }

  function exportTransactionsCsv() {
    if (!records) return;
    const transactions = buildTransactionList(records);
    const header = "date,portfolio,instrument,transactionType,quantity,price,grossAmount,currency,fees,taxes";
    const lines = transactions.map((t) =>
      [
        t.date.slice(0, 10),
        t.portfolioName,
        t.instrumentSymbol ?? t.instrumentName ?? "",
        t.transactionType,
        t.quantity ?? "",
        t.price ?? "",
        t.grossAmount,
        t.currency,
        t.fees,
        t.taxes,
      ].map(csvCell).join(","),
    );
    downloadBlob([header, ...lines].join("\n"), `investor-transakcje-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  }

  function exportSnapshotJson() {
    if (!records) return;
    const snapshot = buildParitySnapshot(records, { asOf: new Date(), historyGranularity: "daily" });
    downloadBlob(JSON.stringify(snapshot, null, 2), `investor-portfel-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  }

  const validCount = preview?.validRows.length ?? 0;
  const errorCount = preview?.errorRows.length ?? 0;
  const warningCount = preview?.rows.filter((row) => row.warnings.length > 0).length ?? 0;
  const txCount = records ? buildTransactionList(records).length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: UI, color: V2.ink }}>
      <V2ScreenHead eyebrow="System" title="Import / Eksport" sub="Wczytaj lub pobierz transakcje i pełną kopię portfela — wszystko lokalnie w przeglądarce" />

      <div style={{ display: "inline-flex", gap: 6, background: v2Mix(V2.ink, 0.05), borderRadius: 11, padding: 4, alignSelf: "flex-start" }}>
        {([["import", "Import"], ["export", "Eksport"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: UI, fontSize: 12.5, fontWeight: tab === id ? 700 : 500,
              background: tab === id ? V2.card : "transparent", color: tab === id ? V2.ink : V2.muted,
              boxShadow: tab === id ? `0 1px 4px ${v2Mix(V2.ink, 0.1)}` : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {!records && (
        <V2Card>
          <div style={{ padding: "20px 4px", textAlign: "center", color: V2.subtle, fontSize: 14 }}>
            Odblokuj dane w panelu synchronizacji, żeby importować lub eksportować.
          </div>
        </V2Card>
      )}

      {records && tab === "import" && (
        <>
          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.ink, marginBottom: 4 }}>Transakcje CSV / XLSX</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Wymagane kolumny: date, portfolio, transactionType, grossAmount, currency.
                  Instrument można podać jako ID, symbol albo nazwę.
                </div>
              </div>
              <GhostButton onClick={() => downloadBlob(transactionCsvTemplate(), "investor-szablon.csv", "text/csv;charset=utf-8")}>Szablon CSV</GhostButton>
            </div>
          </V2Card>

          <label style={{ display: "block", cursor: "pointer", borderRadius: 16, border: `1.5px dashed ${V2.line}`, background: v2Mix(V2.card, 0.6), padding: "30px 18px", textAlign: "center" }}>
            <input
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              type="file"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 22, color: V2.subtle, marginBottom: 8 }}>⬇</div>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.ink }}>{fileName ?? "Wybierz plik CSV albo XLSX"}</div>
            <div style={{ color: V2.subtle, fontSize: 12, marginTop: 5 }}>Plik jest parsowany lokalnie w przeglądarce.</div>
          </label>

          {preview && (
            <V2Card pad={0} style={{ overflow: "hidden" }}>
              <div style={{ borderBottom: `0.5px solid ${V2.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 20px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.ink }}>Podgląd importu</div>
                  <div style={{ color: V2.muted, fontSize: 12, marginTop: 3 }}>
                    <span style={{ color: V2.profit, fontWeight: 600 }}>{validCount} poprawnych</span> · {warningCount} z ostrzeżeniami · <span style={{ color: errorCount ? V2.loss : V2.muted }}>{errorCount} z błędami</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 7, color: V2.muted, fontSize: 12, fontWeight: 600 }}>
                    <input checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} type="checkbox" />
                    Symulacja
                  </label>
                  <PrimaryButton disabled={validCount === 0 || saving || !userDataKey} onClick={() => void handleImport()}>
                    {saving ? "Importuję…" : dryRun ? "Sprawdź import" : "Zapisz poprawne"}
                  </PrimaryButton>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
                  <thead>
                    <tr style={{ background: v2Mix(V2.ink, 0.025) }}>
                      {["Wiersz", "Data", "Typ", "Portfel", "Instrument", "Kwota", "Status"].map((heading) => (
                        <th key={heading} style={{ color: V2.subtle, fontSize: 10, fontWeight: 700, letterSpacing: ".07em", padding: "10px 12px", textAlign: "left", textTransform: "uppercase" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 40).map((row) => (
                      <tr key={row.rowNumber} style={{ borderTop: `0.5px solid ${V2.line2}` }}>
                        <td style={cellStyle}>{row.rowNumber}</td>
                        <td style={cellStyle}>{row.values.date || "-"}</td>
                        <td style={cellStyle}>{row.values.transactiontype || "-"}</td>
                        <td style={cellStyle}>{row.values.portfolio || "-"}</td>
                        <td style={cellStyle}>{row.values.instrument || "-"}</td>
                        <td style={cellStyle}>{row.values.grossamount || "-"} {row.values.currency}</td>
                        <td style={{ ...cellStyle, minWidth: 240 }}>
                          {row.errors.length > 0 ? (
                            <span style={{ color: V2.loss }}>{row.errors.join(" ")}</span>
                          ) : row.warnings.length > 0 ? (
                            <span style={{ color: V2.gold }}>{row.warnings.join(" ")}</span>
                          ) : (
                            <span style={{ color: V2.profit }}>Gotowe</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 40 && (
                <div style={{ borderTop: `0.5px solid ${V2.line2}`, color: V2.subtle, fontSize: 12, padding: "10px 20px" }}>
                  Pokazano pierwsze 40 wierszy z {preview.rows.length}.
                </div>
              )}
            </V2Card>
          )}
        </>
      )}

      {records && tab === "export" && (
        <>
          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={SECTION_HEAD}>CSV</div>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: V2.ink, margin: "3px 0 4px" }}>Transakcje ({txCount})</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Pełna lista transakcji w formacie zgodnym z szablonem importu — gotowa do arkusza kalkulacyjnego.
                </div>
              </div>
              <PrimaryButton disabled={txCount === 0} onClick={exportTransactionsCsv}>Pobierz CSV</PrimaryButton>
            </div>
          </V2Card>

          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={SECTION_HEAD}>JSON</div>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: V2.ink, margin: "3px 0 4px" }}>Pełna kopia portfela</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Migawka portfela (konta, pozycje, wyceny, historia) w formacie JSON. Dane pozostają na Twoim urządzeniu.
                </div>
              </div>
              <GhostButton onClick={exportSnapshotJson}>Pobierz JSON</GhostButton>
            </div>
          </V2Card>

          <div style={{ fontFamily: MONO, fontSize: 11, color: V2.subtle, padding: "0 4px", lineHeight: 1.5 }}>
            Eksport odbywa się w całości lokalnie — pliki są generowane w przeglądarce i nie są wysyłane na serwer.
          </div>
        </>
      )}

      {result && <div style={{ color: V2.profit, fontSize: 13, fontWeight: 600 }}>{result}</div>}
      {error && <div style={{ color: V2.loss, fontSize: 13, fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

const cellStyle: CSSProperties = {
  color: V2.ink,
  fontSize: 12,
  padding: "11px 12px",
  verticalAlign: "top",
};
