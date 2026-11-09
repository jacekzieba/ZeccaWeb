"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useModalLayer } from "@/components/feedback/use-modal-layer";
import { V2, V2Card, V2_TYPE } from "@/lib/v2-design";
import { relatedReviewRows, reviewAmount, reviewFields, reviewProblemCount, reviewTitle, reviewCashTotal, reviewIntegrityMessage, reviewDateLabel, type ImportReviewDraft, type ReviewRow } from "./import-review";

type Props = {
  draft: ImportReviewDraft; busy: boolean;
  onChange(rowID: string, values?: Record<string, string>, excluded?: boolean): void;
  onCancel(): void;
};

export function ImportReviewPanel({ draft, busy, onChange, onCancel }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [removing, setRemoving] = useState<ReviewRow | null>(null);
  const problems = reviewProblemCount(draft);
  const originalCash = reviewCashTotal(draft, true), remainingCash = reviewCashTotal(draft);
  return (
    <V2Card>
      <div role={problems > 0 ? "alert" : "status"} style={{ color: problems > 0 ? V2.loss : V2.profit }}>
        <strong>{problems > 0 ? `Import wymaga sprawdzenia: ${problems} pozycji` : "Pozycje źródłowe zostały sprawdzone"}</strong>
        {problems > 0 && <p>Popraw wskazane wartości lub usuń pozycje z importu. Do tego czasu nic nie zostanie zapisane.</p>}
      </div>
      <p style={{ color: V2.muted, fontSize: 12 }}>Usunięto z importu: {draft.rows.filter(row => row.excluded).length} · Duplikaty / powiązane: {draft.rows.filter(row => row.duplicate).length}</p>
      {reviewIntegrityMessage(draft) && <p style={{ color: V2.loss }}>{reviewIntegrityMessage(draft)}</p>}
      {originalCash !== null && remainingCash !== null && <p style={{ color: V2.muted, fontSize: 12 }}>Przepływy w pliku: {originalCash.toFixed(2)} PLN · Pozostawione nowe pozycje: {remainingCash.toFixed(2)} PLN. Świadome edycje i wykluczenia mogą zmieniać sumę względem oryginalnego Total.</p>}
      <label style={{ fontSize: 13 }}><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} /> Pokaż wszystkie pozycje źródłowe</label>
      {draft.rows.filter(row => showAll || (!row.excluded && !row.duplicate && row.issues.length > 0)).map(row => (
        <div key={row.id} style={{ borderTop: `1px solid ${V2.line}`, padding: "14px 0", marginTop: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{draft.sheet}, wiersz {row.rowNumber}: {reviewTitle(row)}</div>
          <p style={{ fontFamily: V2_TYPE.mono, fontSize: 12 }}>Kwota źródłowa: {reviewAmount(row, true)} · W podglądzie: {reviewAmount(row)}</p>
          <p style={{ color: V2.muted, fontSize: 12 }}>{reviewDateLabel(row)}</p>
          {row.issues.map((issue, index) => <p key={`${issue.code}:${issue.field}:${index}`} style={{ color: V2.loss, fontSize: 13 }}>{issue.message}</p>)}
          {row.duplicate ? <p style={{ color: V2.muted, fontSize: 12 }}>Już zaimportowano — bez ponownego zapisu.</p> : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!row.excluded && <button type="button" disabled={busy} aria-label={`Edytuj pozycję z wiersza ${row.rowNumber}`} onClick={() => setEditing(row)}>Edytuj pozycję</button>}
              <button type="button" disabled={busy} aria-label={`${row.excluded ? "Przywróć pozycję" : "Usuń z importu pozycję"} z wiersza ${row.rowNumber}`} onClick={() => row.excluded ? onChange(row.id, undefined, false) : setRemoving(row)}>{row.excluded ? "Przywróć pozycję" : "Usuń z importu"}</button>
            </div>
          )}
        </div>
      ))}
      {problems > 0 && <button type="button" disabled={busy} onClick={onCancel} style={{ marginTop: 14 }}>Anuluj import</button>}
      {editing && <ReviewRowEditor draft={draft} row={editing} onCancel={() => setEditing(null)} onSave={values => { onChange(editing.id, values); setEditing(null); }} />}
      <ConfirmDialog open={removing !== null} title="Usunąć z przygotowywanego importu?" body="Zostaną wykluczone również powiązane zapisy. Transakcje już zapisane w portfelu pozostaną bez zmian." confirmLabel={`Usuń ${removing ? relatedReviewRows(draft, removing.id).size : 0} powiązanych pozycji`} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) onChange(removing.id, undefined, true); setRemoving(null); }} />
    </V2Card>
  );
}

function ReviewRowEditor({ draft, row, onSave, onCancel }: { draft: ImportReviewDraft; row: ReviewRow; onSave(values: Record<string, string>): void; onCancel(): void }) {
  const [values, setValues] = useState({ ...row.values });
  const panel = useRef<HTMLDivElement>(null);
  useModalLayer(true, panel, onCancel);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", background: V2.line, padding: 20 }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={`Edytuj pozycję — wiersz ${row.rowNumber}`} style={{ background: V2.card, color: V2.ink, border: `1px solid ${V2.line}`, borderRadius: "var(--r-xl)", padding: 22, width: "min(540px, 100%)", maxHeight: "85vh", overflowY: "auto" }}>
        <h2 style={{ fontFamily: V2_TYPE.serif, fontWeight: 500 }}>Edytuj pozycję — wiersz {row.rowNumber}</h2>
        <form onSubmit={event => { event.preventDefault(); onSave(values); }}>
          {reviewFields(draft, row).map(field => (
            <label key={field.key} style={{ display: "block", marginBottom: 14, fontSize: 13 }}>
              {field.label}
              <input aria-label={field.label} value={values[field.key] ?? ""} onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} style={{ display: "block", boxSizing: "border-box", width: "100%", margin: "5px 0", padding: 8, border: `1px solid ${V2.line}`, borderRadius: "var(--r-lg)", background: V2.card, color: V2.ink }} />
              <span style={{ color: V2.muted, fontSize: 12 }}>W pliku: {row.originalValues[field.key] || "—"}</span>
            </label>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button type="button" onClick={onCancel}>Anuluj</button>
            <button type="submit">Zapisz zmiany</button>
          </div>
        </form>
      </div>
    </div>, document.body,
  );
}
