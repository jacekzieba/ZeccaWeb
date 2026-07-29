"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Clipboard, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import type { EarningBurdenRow, EarningRow } from "@/domain/models/earnings";
import {
  EARNINGS_IMPORT_AI_INSTRUCTIONS,
  EARNINGS_IMPORT_COLUMNS,
  EARNINGS_IMPORT_TEMPLATE,
  parseEarningsImportCsv,
  parseEarningsImportTable,
  type EarningsImportItem,
  type EarningsImportPreview,
} from "@/features/earnings/earnings-import";
import {
  ImportProgressIndicator,
  type ImportProgressState,
  waitForNextPaint,
} from "@/features/import/import-progress";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";
import { V2, V2Button, V2_TYPE, v2Mix } from "@/lib/v2-design";

type Props = {
  earnings: EarningRow[];
  burdens: EarningBurdenRow[];
  onClose: () => void;
  onCommit: (preview: EarningsImportPreview) => Promise<void>;
};

export function EarningsImportModal({ earnings, burdens, onClose, onCommit }: Props) {
  const [mounted, setMounted] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<EarningsImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<ImportProgressState | null>(null);

  useEffect(() => setMounted(true), []);

  const displayItems = preview?.itemsToImport.slice(0, 12) ?? [];

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFileName(file?.name ?? null);
    setPreview(null);
    setError(null);
    if (!file) return;

    setProgress({ label: "Przygotowywanie pliku…", value: 8 });
    try {
      await waitForNextPaint();
      const extension = file.name.split(".").pop()?.toLowerCase();
      let next: EarningsImportPreview | null = null;
      if (extension === "xlsx") {
        setProgress({ label: "Odczytywanie arkusza…", value: 25 });
        const rows = await readSpreadsheet(file);
        setProgress({ label: "Analizowanie zarobków…", value: 72 });
        await waitForNextPaint();
        next = parseEarningsImportTable(rows, { earnings, burdens });
      } else if (extension === "csv") {
        setProgress({ label: "Odczytywanie pliku CSV…", value: 25 });
        const text = await file.text();
        setProgress({ label: "Analizowanie zarobków…", value: 72 });
        await waitForNextPaint();
        next = parseEarningsImportCsv(text, { earnings, burdens });
      }
      if (!next) throw new Error("Wybierz plik CSV lub XLSX.");
      setProgress({ label: "Tworzenie podglądu…", value: 95 });
      setPreview(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się odczytać pliku.");
    } finally {
      setProgress(null);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([EARNINGS_IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zecca-zarobki-wzor.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(EARNINGS_IMPORT_AI_INSTRUCTIONS);
      setCopied(true);
    } catch {
      setError("Nie udało się skopiować instrukcji do schowka.");
    }
  }

  async function commit() {
    if (!preview?.canImport) return;
    setSaving(true);
    setError(null);
    try {
      await onCommit(preview);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się zapisać importu.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 230, display: "grid", placeItems: "center", padding: 16 }}>
      <button
        type="button"
        aria-label="Zamknij import zarobków"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: "none", background: "rgba(12,16,13,0.36)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import zarobków"
        style={{
          position: "relative",
          width: "min(820px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          borderRadius: 14,
          background: V2.card,
          border: `0.5px solid ${V2.line}`,
          boxShadow: `0 24px 70px ${v2Mix(V2.ink, 0.28)}`,
          color: V2.ink,
          fontFamily: V2_TYPE.ui,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 20px", borderBottom: `0.5px solid ${V2.line2}` }}>
          <div>
            <div style={{ fontFamily: V2_TYPE.serif, fontSize: 22, fontWeight: 500 }}>Import zarobków</div>
            <div style={{ color: V2.subtle, fontSize: 12, marginTop: 3 }}>CSV lub pierwszy arkusz XLSX · zapis dopiero po podglądzie</div>
          </div>
          <button type="button" aria-label="Zamknij" onClick={onClose} style={iconButtonStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={sectionLabelStyle}>Przygotowanie pliku</div>
            <div style={{ color: V2.muted, fontSize: 13, lineHeight: 1.5 }}>
              Jeden wiersz oznacza jeden zarobek albo jedno obciążenie. Najpewniejszy rezultat daje wzór CSV i instrukcja przekazana AI razem z wyciągiem bankowym.
            </div>
            <code style={{ display: "block", overflowX: "auto", padding: "9px 10px", borderRadius: 8, background: V2.card2, color: V2.muted, fontFamily: V2_TYPE.mono, fontSize: 11 }}>
              {EARNINGS_IMPORT_COLUMNS.join(", ")}
            </code>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex" }}>
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  disabled={progress !== null}
                  onChange={(event) => void handleFile(event)}
                  style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
                />
                <span style={{ ...primaryActionStyle, opacity: progress ? 0.6 : 1 }}>
                  <Upload size={15} /> {progress ? "Wczytywanie…" : "Wybierz CSV lub XLSX"}
                </span>
              </label>
              <V2Button variant="ghost" onClick={downloadTemplate}><Download size={15} /> Pobierz wzór CSV</V2Button>
              <V2Button variant="ghost" onClick={() => void copyInstructions()}>
                {copied ? <Check size={15} /> : <Clipboard size={15} />}
                {copied ? "Skopiowano" : "Kopiuj instrukcję dla AI"}
              </V2Button>
            </div>
          </section>

          {progress && <ImportProgressIndicator {...progress} />}

          {error && (
            <div role="alert" style={{ padding: "10px 12px", borderRadius: 9, border: `0.5px solid ${v2Mix(V2.loss, 0.25)}`, background: v2Mix(V2.loss, 0.07), color: V2.loss, fontSize: 13 }}>
              {error}
            </div>
          )}

          {preview ? (
            <section style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <div style={sectionLabelStyle}>Podgląd</div>
                <div style={{ marginTop: 3, color: V2.muted, fontSize: 12 }}>
                  {fileName} · {preview.format === "standard" ? "Format Zecca" : "Arkusz miesięczny"} · {preview.sourceRowCount} wierszy źródłowych
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                <Summary label="Nowe" value={preview.insertCount} color={V2.profit} />
                <Summary label="Aktualizacje" value={preview.updateCount} color={V2.equity} />
                <Summary label="Bez zmian" value={preview.unchangedCount} color={V2.muted} />
                <Summary label="Błędy" value={preview.errorCount} color={preview.errorCount ? V2.loss : V2.muted} />
              </div>

              {preview.issues.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {preview.issues.map((issue, index) => (
                    <div key={`${issue.rowNumber}-${index}`} style={{ color: issue.severity === "error" ? V2.loss : V2.gold, fontSize: 12 }}>
                      {issue.rowNumber ? `Wiersz ${issue.rowNumber}: ` : ""}{issue.message}
                    </div>
                  ))}
                </div>
              )}

              {displayItems.length > 0 && (
                <div style={{ border: `0.5px solid ${V2.line}`, borderRadius: 10, overflow: "hidden" }}>
                  {displayItems.map((item, index) => (
                    <ImportRow key={`${item.payload.id}-${index}`} item={item} />
                  ))}
                  {preview.importCount > displayItems.length && (
                    <div style={{ padding: "9px 12px", borderTop: `0.5px solid ${V2.line2}`, color: V2.subtle, fontSize: 11 }}>
                      …oraz {preview.importCount - displayItems.length} kolejnych wpisów
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : !error && (
            <div style={{ minHeight: 120, display: "grid", placeItems: "center", border: `0.5px dashed ${V2.line}`, borderRadius: 10, color: V2.subtle, fontSize: 13, textAlign: "center" }}>
              <div><FileSpreadsheet size={24} style={{ marginBottom: 7 }} /><br />Wybierz plik, aby zobaczyć podgląd.</div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4, borderTop: `0.5px solid ${V2.line2}` }}>
            <V2Button variant="ghost" onClick={onClose}>Anuluj</V2Button>
            <V2Button disabled={!preview?.canImport || saving} onClick={() => void commit()}>
              {saving && <Loader2 size={15} />}
              Importuj {preview?.importCount ?? 0} wpisów
            </V2Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div aria-label={`${label}: ${value}`} style={{ padding: "10px 11px", borderRadius: 9, background: V2.card2 }}>
      <div style={sectionLabelStyle}>{label}</div>
      <div style={{ marginTop: 3, color, fontFamily: V2_TYPE.mono, fontSize: 20, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ImportRow({ item }: { item: EarningsImportItem }) {
  const payload = item.payload;
  const title = payload.entryKind === "earning"
    ? `${payload.source} · ${payload.employmentType === "employment" ? "Zatrudnienie" : "Działalność"}`
    : `${payload.note} · ${payload.burdenCategory}`;
  const amount = payload.entryKind === "earning" ? payload.plnAmount : payload.amountPLN;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "82px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "9px 12px", borderTop: `0.5px solid ${V2.line2}` }}>
      <span style={{ color: item.action === "insert" ? V2.profit : V2.equity, fontSize: 10, fontWeight: 700 }}>{item.action === "insert" ? "NOWY" : "AKTUALIZACJA"}</span>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
        {payload.year}-{String(payload.month).padStart(2, "0")} · {title}
      </span>
      <span style={{ color: payload.entryKind === "earning" ? V2.ink : V2.loss, fontFamily: V2_TYPE.mono, fontSize: 11.5, whiteSpace: "nowrap" }}>
        {payload.entryKind === "burden" ? "−" : ""}{amount?.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} PLN
      </span>
    </div>
  );
}

const sectionLabelStyle = {
  color: V2.subtle,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase" as const,
};

const iconButtonStyle = {
  width: 32,
  height: 32,
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  border: `0.5px solid ${V2.line}`,
  background: V2.card,
  color: V2.muted,
  cursor: "pointer",
};

const primaryActionStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  padding: "10px 16px",
  borderRadius: 10,
  background: V2.ink,
  color: V2.card,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
