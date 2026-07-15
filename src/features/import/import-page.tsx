"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  buildImportReferenceData,
  parseCsvImport,
  parseImportTable,
  transactionCsvTemplate,
  valuationCsvTemplate,
  type CsvImportPreview,
} from "@/features/import/import-parser";
import { parseXtbXlsx } from "@/features/import/xtb-parser";
import { loadEtfCatalog } from "@/features/import/etf-catalog";
import { resolveObservedCurrencies } from "@/features/import/xtb-currency-resolver";
import { parsePkoBondsXls } from "@/features/import/pko-parser";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";
import {
  importRowId,
  selectedImportPayloads,
} from "@/features/import/import-selection";
import type { RecordType } from "@/domain/models/investor-data";
import { saveRecord } from "@/sync/records/record-writer";
import { buildParitySnapshot } from "@/sync/records/parity-snapshot";
import {
  buildInvestorDataSnapshot,
  buildTransactionList,
  buildInstrumentList,
} from "@/sync/records/investor-snapshot";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import {
  getTelemetryService,
  TelemetryEvent,
  telemetryRowBucket,
} from "@/lib/telemetry";
import { useSyncStore } from "@/sync/store/sync-store";
import { isFakeSyncEnabled } from "@/lib/env";
import { V2, V2Card, V2ScreenHead, V2_TYPE, v2Mix } from "@/lib/v2-design";

const UI = V2_TYPE.ui;
const SERIF = V2_TYPE.serif;
const MONO = V2_TYPE.mono;

type ImportFormat = "generic" | "xtb" | "pko";

/** Maps the UI format to the contract `provider` value. Generic CSV/table
 * imports are not a broker, so they carry no broker telemetry. */
function brokerProvider(format: ImportFormat): string | null {
  switch (format) {
    case "xtb":
      return "xtb";
    case "pko":
      return "pko_bonds";
    default:
      return null;
  }
}

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

// Extended preview type that carries extra payloads (new instruments) from XTB/PKO parsers
type ExtendedPreview = CsvImportPreview & {
  newInstrumentPayloads?: Array<{ id: string; recordType: string; [key: string]: unknown }>;
  parserWarnings?: string[];
};

// Client-side FX lookup for the XTB currency-inference phase, via the internal
// NBP proxy route (avoids calling NBP directly from the browser). Returns null
// on any failure so inference simply skips that currency.
async function fetchFxRateViaApi(code: string, date: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/market-data/fx?code=${encodeURIComponent(code)}&date=${encodeURIComponent(date)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { rate?: unknown } };
    return typeof json.data?.rate === "number" ? json.data.rate : null;
  } catch {
    return null;
  }
}

export function ImportPage() {
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const marketFxRates = useSyncStore((s) => s.marketFxRates);
  const marketCpi = useSyncStore((s) => s.marketCpi);
  const references = useMemo(() => buildImportReferenceData(records), [records]);
  const snapshot = useSyncStore((s) => s.snapshot);

  const [tab, setTab] = useState<"import" | "export">("import");
  const [importFormat, setImportFormat] = useState<ImportFormat>("generic");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExtendedPreview | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [importAction, setImportAction] = useState<"check" | "commit" | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // For XTB/PKO: first portfolio is used as the target; user can change
  const firstPortfolioId = references.portfolios[0]?.id ?? "";
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const portfolioId = selectedPortfolioId || firstPortfolioId;

  function showPreview(nextPreview: ExtendedPreview) {
    setPreview(nextPreview);
    setSelectedRowIds(
      new Set(
        nextPreview.validRows.flatMap((row) => {
          const id = importRowId(row);
          return id ? [id] : [];
        }),
      ),
    );
  }

  async function handleFile(file: File | null) {
    setResult(null);
    setError(null);
    setPreview(null);
    setSelectedRowIds(new Set());
    setFileName(file?.name ?? null);
    if (!file) return;
    const provider = brokerProvider(importFormat);
    if (provider) {
      getTelemetryService().signal(TelemetryEvent.brokerImportStarted, { provider });
    }
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();

      if (importFormat === "xtb") {
        // XTB exports may have multiple sheets; prefer "Cash Operations".
        const rows = await readSpreadsheet(file, { sheet: "Cash Operations" });
        if (!portfolioId) {
          setError("Wybierz portfel docelowy przed importem XTB.");
          return;
        }
        const catalog = await loadEtfCatalog();
        const xtbPreview = parseXtbXlsx(rows, portfolioId, references, { catalog });
        // D2: resolve any currencies the parser left "?" by inferring them from
        // the observed FX and NBP rates on the trade date.
        if (xtbPreview.fxObservations.length > 0) {
          await resolveObservedCurrencies(xtbPreview, fetchFxRateViaApi);
        }
        showPreview(xtbPreview as ExtendedPreview);
        return;
      }

      if (importFormat === "pko") {
        const rows = await readSpreadsheet(file);
        if (!portfolioId) {
          setError("Wybierz portfel docelowy przed importem PKO Obligacje.");
          return;
        }
        showPreview(parsePkoBondsXls(rows, portfolioId, references) as ExtendedPreview);
        return;
      }

      // Generic
      if (extension === "xlsx" || extension === "xls") {
        const rows = await readSpreadsheet(file);
        showPreview(parseImportTable(rows, references));
      } else {
        const text = await file.text();
        showPreview(parseCsvImport(text, references));
      }
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Nie udało się odczytać pliku.");
      if (provider) {
        getTelemetryService().signal(TelemetryEvent.brokerImportFailed, {
          provider,
          reason: "parse_error",
        });
      }
    }
  }

  async function handleImport(action: "check" | "commit") {
    if (!preview || !supabase || !userDataKey) {
      setError("Odblokuj dane w panelu synchronizacji przed importem.");
      return;
    }
    setImportAction(action);
    setError(null);
    setResult(null);
    const provider = brokerProvider(importFormat);
    try {
      const selected = selectedImportPayloads(preview, selectedRowIds);
      if (action === "check") {
        const newInstCount = selected.newInstrumentPayloads.length;
        setResult(
          `Symulacja: ${selected.rows.length} wybranych pozycji gotowych do zapisu, ${preview.errorRows.length} wymaga poprawy` +
          (newInstCount > 0 ? `, ${newInstCount} nowych instrumentów do utworzenia` : "") + "."
        );
        return;
      }

      let queued = 0;
      const localPayloads: Array<{ id: string; recordType: string; [key: string]: unknown }> = [];

      // Save new instruments first
      for (const instrPayload of selected.newInstrumentPayloads) {
        if (!isFakeSyncEnabled()) {
          await saveRecord(supabase, userDataKey, instrPayload.recordType, instrPayload, { baseUpdatedAt: null });
        }
        localPayloads.push(instrPayload);
      }

      // Save transactions
      for (const row of selected.rows) {
        if (!row.payload) continue;
        if (!isFakeSyncEnabled()) {
          const saveResult = await saveRecord(supabase, userDataKey, row.payload.recordType, row.payload, { baseUpdatedAt: null });
          if (saveResult.queued) queued += 1;
        }
        localPayloads.push(row.payload);
      }

      const nextRecords = upsertLocalRecords(records ?? [], localPayloads);
      const nextSnapshot = buildInvestorDataSnapshot(nextRecords, {
        asOf: new Date(),
        fxRates: marketFxRates,
        historyGranularity: "daily",
        useLatestTransactionFxRate: true,
        useMarketQuotes: true,
        cpi: marketCpi,
      });
      setSync(nextRecords, nextSnapshot);
      setResult(`Zaimportowano ${selected.rows.length - queued} rekordów${queued > 0 ? `, ${queued} czeka w kolejce sync` : ""}.`);
      if (provider) {
        getTelemetryService().signal(TelemetryEvent.brokerImportSucceeded, {
          provider,
          result: "committed",
          row_bucket: telemetryRowBucket(selected.rows.length),
        });
      }
      setPreview(null);
      setSelectedRowIds(new Set());
      setFileName(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Nie udało się zapisać importu.");
      if (provider) {
        getTelemetryService().signal(TelemetryEvent.brokerImportFailed, {
          provider,
          reason: "commit_error",
        });
      }
    } finally {
      setImportAction(null);
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
    downloadBlob([header, ...lines].join("\n"), `investor-transakcje-${today()}.csv`, "text/csv;charset=utf-8");
  }

  function exportSnapshotJson() {
    if (!records) return;
    const snap = buildParitySnapshot(records, { asOf: new Date(), historyGranularity: "daily" });
    downloadBlob(JSON.stringify(snap, null, 2), `investor-portfel-${today()}.json`, "application/json");
  }

  function exportDailySnapshotsCsv() {
    const series = snapshot?.valuationSeries;
    if (!series || series.length === 0) return;
    const header = "date,value";
    const lines = series.map((p) => [csvCell(p.date.slice(0, 10)), csvCell(p.value)].join(","));
    downloadBlob([header, ...lines].join("\n"), `investor-historia-${today()}.csv`, "text/csv;charset=utf-8");
  }

  function exportIncomeCsv() {
    if (!records) return;
    const INCOME_TYPES = new Set(["dividend", "interest", "bondCoupon"]);
    const transactions = buildTransactionList(records).filter((t) => INCOME_TYPES.has(t.transactionType));
    const header = "date,portfolio,instrument,transactionType,grossAmount,currency,fees,taxes";
    const lines = transactions.map((t) =>
      [
        t.date.slice(0, 10),
        t.portfolioName,
        t.instrumentSymbol ?? t.instrumentName ?? "",
        t.transactionType,
        t.grossAmount,
        t.currency,
        t.fees,
        t.taxes,
      ].map(csvCell).join(","),
    );
    downloadBlob([header, ...lines].join("\n"), `investor-dochody-${today()}.csv`, "text/csv;charset=utf-8");
  }

  function exportPositionsCsv() {
    if (!records) return;
    const instruments = buildInstrumentList(records, {
      asOf: new Date(),
      fxRates: marketFxRates,
      useLatestTransactionFxRate: true,
      useMarketQuotes: true,
      cpi: marketCpi,
    });
    const active = instruments.filter((i) => i.totalQuantity > 0);
    const header = "symbol,name,kind,quantity,lastPrice,currency,marketValue,portfolioPercent,valuationSource";
    const lines = active.map((i) =>
      [
        i.symbol,
        i.name,
        i.kind,
        i.totalQuantity,
        i.lastPrice,
        i.currency,
        i.marketValue,
        i.portfolios.join(";"),
        i.valuationSource,
      ].map(csvCell).join(","),
    );
    downloadBlob([header, ...lines].join("\n"), `investor-pozycje-${today()}.csv`, "text/csv;charset=utf-8");
  }

  const validCount = preview?.validRows.length ?? 0;
  const selectedImport = useMemo(
    () =>
      preview
        ? selectedImportPayloads(preview, selectedRowIds)
        : { rows: [], newInstrumentPayloads: [] },
    [preview, selectedRowIds],
  );
  const selectedCount = selectedImport.rows.length;
  const errorCount = preview?.errorRows.length ?? 0;
  const warningCount = preview?.rows.filter((row) => row.warnings.length > 0).length ?? 0;
  const newInstCount = selectedImport.newInstrumentPayloads.length;
  const txCount = records ? buildTransactionList(records).length : 0;
  const snapshotPoints = snapshot?.valuationSeries.length ?? 0;
  const incomeCount = records
    ? buildTransactionList(records).filter((t) => ["dividend", "interest", "bondCoupon"].includes(t.transactionType)).length
    : 0;
  const positionCount = records
    ? buildInstrumentList(records, { asOf: new Date(), fxRates: marketFxRates, useLatestTransactionFxRate: true, useMarketQuotes: true, cpi: marketCpi })
        .filter((i) => i.totalQuantity > 0).length
    : 0;

  function setRowSelected(id: string, selected: boolean) {
    setResult(null);
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setAllRowsSelected(selected: boolean) {
    setResult(null);
    setSelectedRowIds(
      selected && preview
        ? new Set(
            preview.validRows.flatMap((row) => {
              const id = importRowId(row);
              return id ? [id] : [];
            }),
          )
        : new Set(),
    );
  }

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
          {/* Format picker */}
          <V2Card>
            <div style={{ ...SECTION_HEAD, marginBottom: 8 }}>Format importu</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(
                [
                  ["generic", "Generyczny CSV / XLSX", "Własny szablon transakcji i wycen"],
                  ["xtb", "XTB XLSX", "Konto → Historia rachunku → Eksport"],
                  ["pko", "PKO Obligacje XLS", "zakup.obligacjeskarbowe.pl → Historia dyspozycji"],
                ] as const
              ).map(([id, label, sub]) => (
                <button
                  key={id}
                  onClick={() => {
                    setImportFormat(id);
                    setPreview(null);
                    setSelectedRowIds(new Set());
                    setFileName(null);
                    setError(null);
                    setResult(null);
                  }}
                  style={{
                    border: `1.5px solid ${importFormat === id ? V2.brand : V2.line}`,
                    borderRadius: 12, padding: "10px 16px", textAlign: "left",
                    background: importFormat === id ? v2Mix(V2.brand, 0.07) : V2.card,
                    cursor: "pointer", minWidth: 200,
                  }}
                >
                  <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 700, color: importFormat === id ? V2.brand : V2.ink }}>{label}</div>
                  <div style={{ fontFamily: UI, fontSize: 11, color: V2.subtle, marginTop: 3 }}>{sub}</div>
                </button>
              ))}
            </div>

            {(importFormat === "xtb" || importFormat === "pko") && references.portfolios.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ ...SECTION_HEAD, marginBottom: 6 }}>Portfel docelowy</div>
                <select
                  value={selectedPortfolioId || firstPortfolioId}
                  onChange={(e) => setSelectedPortfolioId(e.target.value)}
                  style={{
                    fontFamily: UI, fontSize: 13, padding: "8px 12px", borderRadius: 8,
                    border: `0.5px solid ${V2.line}`, background: V2.card, color: V2.ink, cursor: "pointer",
                  }}
                >
                  {references.portfolios.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </V2Card>

          {importFormat === "generic" && (
            <V2Card>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.ink, marginBottom: 4 }}>Transakcje lub wyceny CSV / XLSX</div>
                  <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                    Transakcje: date, portfolio, transactionType, grossAmount, currency. Wyceny: date, instrument, value albo quantity + totalValue, currency.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <GhostButton onClick={() => downloadBlob(transactionCsvTemplate(), "investor-transakcje-szablon.csv", "text/csv;charset=utf-8")}>Szablon transakcji</GhostButton>
                  <GhostButton onClick={() => downloadBlob(valuationCsvTemplate(), "investor-wyceny-xtb-pko-2026-06-05.csv", "text/csv;charset=utf-8")}>Wyceny XTB/PKO</GhostButton>
                </div>
              </div>
            </V2Card>
          )}

          <label style={{ display: "block", cursor: "pointer", borderRadius: 16, border: `1.5px dashed ${V2.line}`, background: v2Mix(V2.card, 0.6), padding: "30px 18px", textAlign: "center" }}>
            <input
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              type="file"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <div style={{ fontSize: 22, color: V2.subtle, marginBottom: 8 }}>⬇</div>
            <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.ink }}>{fileName ?? "Wybierz plik CSV albo XLSX / XLS"}</div>
            <div style={{ color: V2.subtle, fontSize: 12, marginTop: 5 }}>
              {importFormat === "xtb" ? "Plik XTB XLSX — arkusz \"Cash Operations\"" :
               importFormat === "pko" ? "Plik PKO Obligacje XLS — Historia dyspozycji" :
               "Plik jest parsowany lokalnie w przeglądarce."}
            </div>
          </label>

          {!preview && (result || error) && (
            <div
              role={error ? "alert" : "status"}
              style={{
                color: error ? V2.loss : V2.profit,
                fontSize: 13,
                fontWeight: 600,
                padding: "0 4px",
              }}
            >
              {error ?? result}
            </div>
          )}

          {preview?.parserWarnings && preview.parserWarnings.length > 0 && (
            <V2Card>
              <div style={{ ...SECTION_HEAD, marginBottom: 8 }}>Ostrzeżenia parsera ({preview.parserWarnings.length})</div>
              {preview.parserWarnings.slice(0, 10).map((w, i) => (
                <div key={i} style={{ fontFamily: MONO, fontSize: 11.5, color: V2.muted, lineHeight: 1.6 }}>{w}</div>
              ))}
              {preview.parserWarnings.length > 10 && (
                <div style={{ fontSize: 11, color: V2.subtle, marginTop: 4 }}>… i {preview.parserWarnings.length - 10} więcej</div>
              )}
            </V2Card>
          )}

          {preview && (
            <V2Card pad={0} style={{ overflow: "hidden" }}>
              <div style={{ borderBottom: `0.5px solid ${V2.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "15px 20px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.ink }}>Podgląd importu {preview.kind === "manualValuation" ? "wycen" : "transakcji"}</div>
                  <div style={{ color: V2.muted, fontSize: 12, marginTop: 3 }}>
                    <span style={{ color: V2.profit, fontWeight: 600 }}>{validCount} poprawnych</span> · {selectedCount} wybranych · {warningCount} z ostrzeżeniami · <span style={{ color: errorCount ? V2.loss : V2.muted }}>{errorCount} z błędami</span>
                    {newInstCount > 0 && <span style={{ color: V2.bonds, fontWeight: 600 }}> · {newInstCount} nowych instrumentów</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <GhostButton disabled={selectedCount === 0 || importAction !== null || !userDataKey} onClick={() => void handleImport("check")}>
                    {importAction === "check" ? "Sprawdzam…" : "Sprawdź import"}
                  </GhostButton>
                  <PrimaryButton disabled={selectedCount === 0 || importAction !== null || !userDataKey} onClick={() => void handleImport("commit")}>
                    {importAction === "commit" ? "Importuję…" : "Importuj wybrane"}
                  </PrimaryButton>
                </div>
              </div>
              {(result || error) && (
                <div
                  role={error ? "alert" : "status"}
                  style={{
                    borderBottom: `0.5px solid ${V2.line}`,
                    color: error ? V2.loss : V2.profit,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "10px 20px",
                  }}
                >
                  {error ?? result}
                </div>
              )}
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", minWidth: 820, width: "100%" }}>
                  <thead>
                    <tr style={{ background: v2Mix(V2.ink, 0.025) }}>
                      <th style={{ padding: "10px 12px", textAlign: "left", width: 36 }}>
                        <input
                          aria-label="Zaznacz wszystko"
                          aria-checked={
                            selectedCount > 0 && selectedCount < validCount
                              ? "mixed"
                              : validCount > 0 && selectedCount === validCount
                          }
                          checked={validCount > 0 && selectedCount === validCount}
                          disabled={validCount === 0}
                          onChange={(event) => setAllRowsSelected(event.target.checked)}
                          ref={(input) => {
                            if (input) {
                              input.indeterminate =
                                selectedCount > 0 && selectedCount < validCount;
                            }
                          }}
                          type="checkbox"
                        />
                      </th>
                      {["Wiersz", "Data", "Typ", "Portfel / Instrument", "Kwota / wycena", "Status"].map((heading) => (
                        <th key={heading} style={{ color: V2.subtle, fontSize: 10, fontWeight: 700, letterSpacing: ".07em", padding: "10px 12px", textAlign: "left", textTransform: "uppercase" }}>{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, index) => {
                      const id = importRowId(row);
                      const isSelected = id !== null && selectedRowIds.has(id);
                      return (
                        <tr
                          key={id ?? `${row.rowNumber}-${index}`}
                          style={{
                            borderTop: `0.5px solid ${V2.line2}`,
                            opacity: id && !isSelected ? 0.55 : 1,
                          }}
                        >
                          <td style={{ ...cellStyle, width: 36 }}>
                            <input
                              aria-label={`Importuj pozycję ${index + 1} z wiersza ${row.rowNumber}`}
                              checked={isSelected}
                              disabled={!id}
                              onChange={(event) => {
                                if (id) setRowSelected(id, event.target.checked);
                              }}
                              type="checkbox"
                            />
                          </td>
                          <td style={cellStyle}>{row.rowNumber}</td>
                          <td style={cellStyle}>{row.values.date || "-"}</td>
                          <td style={cellStyle}>{row.values.transactiontype || (preview.kind === "manualValuation" ? "manualValuation" : "-")}</td>
                          <td style={cellStyle}>{row.values.portfolio || row.values.instrument || "-"}</td>
                          <td style={cellStyle}>{row.values.grossamount || row.values.totalvalue || row.values.value || "-"} {row.values.currency}</td>
                          <td style={{ ...cellStyle, minWidth: 240 }}>
                            {row.errors.length > 0 ? (
                              <span style={{ color: V2.loss }}>{row.errors.join(" ")}</span>
                            ) : !isSelected ? (
                              <span style={{ color: V2.muted }}>Pominięte</span>
                            ) : row.warnings.length > 0 ? (
                              <span style={{ color: V2.gold }}>{row.warnings.join(" ")}</span>
                            ) : (
                              <span style={{ color: V2.profit }}>Gotowe</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                  Pełna lista transakcji w formacie zgodnym z szablonem importu.
                </div>
              </div>
              <PrimaryButton disabled={txCount === 0} onClick={exportTransactionsCsv}>Pobierz CSV</PrimaryButton>
            </div>
          </V2Card>

          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={SECTION_HEAD}>CSV</div>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: V2.ink, margin: "3px 0 4px" }}>Historia dzienna ({snapshotPoints} punktów)</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Dzienne wartości portfela — do importu do arkusza lub zewnętrznego narzędzia.
                </div>
              </div>
              <GhostButton disabled={snapshotPoints === 0} onClick={exportDailySnapshotsCsv}>Pobierz CSV</GhostButton>
            </div>
          </V2Card>

          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={SECTION_HEAD}>CSV</div>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: V2.ink, margin: "3px 0 4px" }}>Dywidendy i odsetki ({incomeCount})</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Transakcje typu dividend, interest, bondCoupon — do zestawienia podatkowego.
                </div>
              </div>
              <GhostButton disabled={incomeCount === 0} onClick={exportIncomeCsv}>Pobierz CSV</GhostButton>
            </div>
          </V2Card>

          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={SECTION_HEAD}>CSV</div>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: V2.ink, margin: "3px 0 4px" }}>Pozycje na dziś ({positionCount})</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Aktualne instrumenty z ilościami, cenami i wartością rynkową.
                </div>
              </div>
              <GhostButton disabled={positionCount === 0} onClick={exportPositionsCsv}>Pobierz CSV</GhostButton>
            </div>
          </V2Card>

          <V2Card>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "center" }}>
              <div>
                <div style={SECTION_HEAD}>JSON</div>
                <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, color: V2.ink, margin: "3px 0 4px" }}>Pełna kopia portfela</div>
                <div style={{ color: V2.muted, fontSize: 12.5, lineHeight: 1.5 }}>
                  Migawka portfela (konta, pozycje, wyceny, historia) w formacie JSON.
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

    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function upsertLocalRecords(
  records: DecryptedRecord[],
  payloads: Array<{ id: string; recordType: string; [key: string]: unknown }>,
): DecryptedRecord[] {
  const now = new Date().toISOString();
  const next = new Map(records.map((record) => [record.id, record]));

  for (const payload of payloads) {
    next.set(payload.id, {
      id: payload.id,
      deviceId: "web-import",
      updatedAt: now,
      deletedAt: null,
      envelope: {
        type: payload.recordType as RecordType,
        payloadVersion: 1,
        schemaVersion: 1,
        payload,
      },
    });
  }

  return [...next.values()];
}

const cellStyle: CSSProperties = {
  color: V2.ink,
  fontSize: 12,
  padding: "11px 12px",
  verticalAlign: "top",
};
