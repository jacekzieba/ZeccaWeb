"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { buildInvestorDataSnapshot, buildTransactionList } from "@/sync/records/investor-snapshot";
import {
  AddTransactionModal,
  type TransactionEditorDraft,
} from "@/features/transactions/add-transaction-modal";
import {
  deleteRecord,
  refreshSyncStore,
  restoreRecord,
  SyncConflictError,
} from "@/sync/records/record-writer";
import { isFakeSyncEnabled } from "@/lib/env";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { pluralPl } from "@/lib/plural-pl";
import { TRANSACTION_LABELS } from "@/lib/transaction-labels";
import { useProfile } from "@/features/profile/profile-store";
import { currencyLabel } from "@/lib/money";
import { announce } from "@/components/feedback/status-announcer";
import {
  V2,
  V2Badge,
  V2Button,
  V2Card,
  V2Kpi,
  V2ScreenHead,
  V2_TYPE,
  v2InputStyle,
  v2Mix,
  v2SelectStyle,
} from "@/lib/v2-design";

const MUTED = V2.muted;
const SUBTLE = V2.subtle;
const LINE_SOFT = V2.line2;
const PROFIT = V2.profit;
const LOSS = V2.loss;

const glassCard: CSSProperties = {
  background: V2.card,
  backdropFilter: "blur(30px) saturate(160%)",
  WebkitBackdropFilter: "blur(30px) saturate(160%)",
  borderRadius: 16,
  border: `0.5px solid ${V2.line}`,
  boxShadow: `0 1px 0 ${v2Mix(V2.ink, 0.03)}, 0 6px 20px ${v2Mix(V2.ink, 0.05)}`,
};

const TX_LABELS = TRANSACTION_LABELS;

// Plakietka typu transakcji jest neutralna. Wcześniej mapowała szesnaście
// TYPÓW na tokeny kierunku: wpłata, dywidenda, odsetki i kupon szły na --up,
// sprzedaż, opłata i podatek na --down, a otwarcie lokaty na token obligacji.
// To łamie dwie twarde reguły naraz — zieleń znaczy kierunek, nie kategorię,
// a bursztyn nie wchodzi w dane. Typ niesie własna etykieta („Kupno",
// „Dywidenda"), kierunek niesie znak przy kwocie i jego kolor. Jeden kanał na
// jedno znaczenie.
const TX_BADGE = MUTED;

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Turn a failed delete into a message the user can act on. Previously every
// delete error was swallowed (the handlers were `void`-called with no `catch`),
// so a failure looked identical to "nothing happened".
function describeDeleteError(error: unknown) {
  if (error instanceof SyncConflictError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return `Nie udało się usunąć transakcji: ${error.message}`;
  }
  return "Nie udało się usunąć transakcji. Spróbuj ponownie lub odśwież dane.";
}

export function TransactionsPage() {
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const openAddTransaction = useSyncStore((s) => s.openAddTransaction);
  const publicDemo = useSyncStore((s) => s.publicDemo);
  const snapshot = useSyncStore((s) => s.snapshot);
  const { displayCurrency } = useProfile();

  const allTransactions = useMemo(
    () => (records ? buildTransactionList(records) : []),
    [records],
  );

  const [portfolioFilter, setPortfolioFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const portfolios = useMemo(() => {
    const seen = new Map<string, string>();
    for (const tx of allTransactions) {
      seen.set(tx.portfolioId, tx.portfolioName);
    }
    return [...seen.entries()];
  }, [allTransactions]);

  const txTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const tx of allTransactions) seen.add(tx.transactionType);
    return [...seen].sort();
  }, [allTransactions]);

  const editableTransactions = useMemo(() => {
    if (!records) return [];

    return records
      .filter((record) => !record.deletedAt && record.envelope.type === "transaction")
      .map((record) => {
        const payload = record.envelope.payload as {
          id: string;
          date: number | string;
          portfolioID: string;
          instrumentID?: string | null;
          transactionType: string;
          quantity?: number | null;
          price?: number | null;
          grossAmount: number;
          currency: string;
          fees: number;
          taxes: number;
          fxRateToBase?: number | null;
          targetCurrency?: string | null;
          targetGrossAmount?: number | null;
          notes?: string;
          sourcePortfolioID?: string | null;
          transferKind?: string | null;
          contributionTreatment?: string | null;
        };

        return {
          id: payload.id,
          date:
            typeof payload.date === "number"
              ? new Date(Date.UTC(2001, 0, 1) + payload.date * 1000).toISOString()
              : new Date(payload.date).toISOString(),
          portfolioId: payload.portfolioID,
          instrumentId: payload.instrumentID ?? null,
          transactionType: payload.transactionType,
          quantity: payload.quantity ?? null,
          price: payload.price ?? null,
          grossAmount: payload.grossAmount,
          currency: payload.currency,
          fees: payload.fees,
          taxes: payload.taxes,
          fxRateToBase: payload.fxRateToBase ?? null,
          targetCurrency: payload.targetCurrency ?? null,
          targetGrossAmount: payload.targetGrossAmount ?? null,
          notes: payload.notes ?? "",
          sourcePortfolioId: payload.sourcePortfolioID ?? null,
          transferKind: payload.transferKind ?? null,
          contributionTreatment: payload.contributionTreatment ?? null,
          updatedAt: record.updatedAt,
        } satisfies TransactionEditorDraft;
      });
  }, [records]);

  const editingTransaction = editingTransactionId
    ? editableTransactions.find((transaction) => transaction.id === editingTransactionId) ?? null
    : null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTransactions.filter((tx) => {
      if (portfolioFilter !== "all" && tx.portfolioId !== portfolioFilter) return false;
      if (typeFilter !== "all" && tx.transactionType !== typeFilter) return false;
      if (q) {
        const haystack = [
          tx.instrumentName,
          tx.instrumentSymbol,
          tx.portfolioName,
          TX_LABELS[tx.transactionType] ?? tx.transactionType,
          tx.currency,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allTransactions, portfolioFilter, typeFilter, search]);

  // Najgęstsza tabela w produkcie nie dawała się ułożyć po kwocie ani po dacie.
  const [sort, setSort] = useState<{ key: "date" | "grossAmount"; dir: "asc" | "desc" }>({
    key: "date",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const znak = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "grossAmount") return (a.grossAmount - b.grossAmount) * znak;
      return (Date.parse(a.date) - Date.parse(b.date)) * znak;
    });
  }, [filtered, sort]);

  function toggleSort(key: "date" | "grossAmount") {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  const displayedTransactions = useMemo(() => sorted.slice(0, 200), [sorted]);
  const displayedIds = useMemo(
    () => displayedTransactions.map((transaction) => transaction.id),
    [displayedTransactions],
  );
  const selectedVisibleCount = displayedIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = displayedIds.length > 0 && selectedVisibleCount === displayedIds.length;
  const hasPartialVisibleSelection = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    setSelectedIds((current) => {
      const liveIds = new Set(allTransactions.map((transaction) => transaction.id));
      const next = new Set([...current].filter((id) => liveIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [allTransactions]);

  function rebuildSnapshot(nextRecords: NonNullable<typeof records>) {
    return buildInvestorDataSnapshot(nextRecords, {
      asOf: new Date(),
      historyGranularity: "daily",
      useLatestTransactionFxRate: true,
      useMarketQuotes: true,
    });
  }

  function markTransactionsDeletedLocally(ids: Iterable<string>) {
    if (!records) return;
    const deletedIds = new Set(ids);
    if (deletedIds.size === 0) return;

    const deletedAt = new Date().toISOString();
    const nextRecords = records.map((record) =>
      !record.deletedAt &&
      record.envelope.type === "transaction" &&
      deletedIds.has(record.id)
        ? { ...record, updatedAt: deletedAt, deletedAt }
        : record,
    );
    setSync(nextRecords, rebuildSnapshot(nextRecords));
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of displayedIds) next.delete(id);
      } else {
        for (const id of displayedIds) next.add(id);
      }
      return next;
    });
  }

  // Natywny confirm nie mówił, CO usuwa, wyglądał jak okno systemu i blokował
  // wątek. Potwierdzenie jest teraz oknem aplikacji i nazywa usuwaną pozycję.
  const [confirmDelete, setConfirmDelete] = useState<
    { rodzaj: "jedna"; id: string; opis: string } | { rodzaj: "wiele"; ids: string[] } | null
  >(null);

  async function handleDeleteTransaction(id: string) {
    if (!userDataKey || !supabase || !records) {
      return;
    }

    if (isFakeSyncEnabled()) {
      const przed = records;
      const przedSnapshot = snapshot;
      markTransactionsDeletedLocally([id]);
      setSelectedIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      announce(
        "Transakcja usunięta.",
        przedSnapshot ? { label: "Cofnij", run: () => setSync(przed, przedSnapshot) } : undefined,
      );
      return;
    }

    const sourceRecord = records.find(
      (record) =>
        !record.deletedAt &&
        record.envelope.type === "transaction" &&
        record.id === id,
    );

    setDeletingId(id);
    setDeleteError(null);

    try {
      const result = await deleteRecord(supabase, "transaction", id, {
        baseUpdatedAt: sourceRecord?.updatedAt ?? null,
      });
      if (!result.queued) {
        const { records: nextRecords, snapshot: nextSnapshot } = await refreshSyncStore(
          supabase,
          userDataKey,
        );
        setSync(nextRecords, nextSnapshot);
      } else {
        markTransactionsDeletedLocally([id]);
      }
      setSelectedIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      // Usunięcie jest miękkie — szyfrogram został w wierszu, zmienił się tylko
      // znacznik. Cofnięcie czyści go, podając znacznik z chwili usunięcia.
      const usunieteO = result.updatedAt;
      announce(
        "Transakcja usunięta.",
        usunieteO
          ? { label: "Cofnij", run: () => void przywrocTransakcje(id, usunieteO) }
          : undefined,
      );
    } catch (error) {
      setDeleteError(describeDeleteError(error));
    } finally {
      setDeletingId(null);
    }
  }

  async function przywrocTransakcje(id: string, baseUpdatedAt: string) {
    if (!userDataKey || !supabase) return;
    try {
      await restoreRecord(supabase, "transaction", id, { baseUpdatedAt });
      const { records: nextRecords, snapshot: nextSnapshot } = await refreshSyncStore(
        supabase,
        userDataKey,
      );
      setSync(nextRecords, nextSnapshot);
      announce("Transakcja przywrócona.");
    } catch (error) {
      setDeleteError(describeDeleteError(error));
    }
  }

  /** Cofnięcie hurtowe. Każdy rekord ma własny znacznik z chwili usunięcia,
   *  więc strażnik konfliktów sprawdza każdy z osobna — jeśli któryś zmienił
   *  się w międzyczasie na innym urządzeniu, tylko on zostaje usunięty. */
  async function przywrocWiele(pary: Array<[string, string]>) {
    if (!userDataKey || !supabase) return;
    let bledy = 0;
    for (const [id, baseUpdatedAt] of pary) {
      try {
        await restoreRecord(supabase, "transaction", id, { baseUpdatedAt });
      } catch {
        bledy += 1;
      }
    }
    const { records: nextRecords, snapshot: nextSnapshot } = await refreshSyncStore(
      supabase,
      userDataKey,
    );
    setSync(nextRecords, nextSnapshot);
    const przywrocone = pary.length - bledy;
    announce(
      bledy === 0
        ? `Przywrócono ${przywrocone} ${pluralPl(przywrocone, "transakcję", "transakcje", "transakcji")}.`
        : `Przywrócono ${przywrocone} z ${pary.length} — reszta zmieniła się na innym urządzeniu.`,
    );
  }

  async function handleDeleteSelectedTransactions() {
    if (!userDataKey || !supabase || !records || selectedIds.size === 0) {
      return;
    }

    const liveIds = new Set(allTransactions.map((transaction) => transaction.id));
    const idsToDelete = [...selectedIds].filter((id) => liveIds.has(id));
    if (idsToDelete.length === 0) {
      return;
    }


    if (isFakeSyncEnabled()) {
      const przed = records;
      const przedSnapshot = snapshot;
      markTransactionsDeletedLocally(idsToDelete);
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of idsToDelete) next.delete(id);
        return next;
      });
      announce(
        `Usunięto ${idsToDelete.length} ${pluralPl(idsToDelete.length, "transakcję", "transakcje", "transakcji")}.`,
        przedSnapshot ? { label: "Cofnij", run: () => setSync(przed, przedSnapshot) } : undefined,
      );
      return;
    }

    setBulkDeleting(true);
    setDeleteError(null);
    const queuedIds: string[] = [];
    const deletedIds: string[] = [];
    const doCofniecia: Array<[string, string]> = [];
    let failure: unknown = null;

    try {
      for (const id of idsToDelete) {
        const sourceRecord = records.find(
          (record) =>
            !record.deletedAt &&
            record.envelope.type === "transaction" &&
            record.id === id,
        );
        try {
          const result = await deleteRecord(supabase, "transaction", id, {
            baseUpdatedAt: sourceRecord?.updatedAt ?? null,
          });
          deletedIds.push(id);
          if (result.updatedAt) doCofniecia.push([id, result.updatedAt]);
          if (result.queued) {
            queuedIds.push(id);
          }
        } catch (error) {
          // Capture the first failure but keep deleting the rest so one bad
          // record doesn't silently abort the whole batch.
          failure ??= error;
        }
      }

      if (deletedIds.length > 0) {
        if (queuedIds.length === 0) {
          const { records: nextRecords, snapshot: nextSnapshot } = await refreshSyncStore(
            supabase,
            userDataKey,
          );
          setSync(nextRecords, nextSnapshot);
        } else {
          markTransactionsDeletedLocally(deletedIds);
        }
        setSelectedIds((current) => {
          const next = new Set(current);
          for (const id of deletedIds) next.delete(id);
          return next;
        });
        announce(
          `Usunięto ${deletedIds.length} ${pluralPl(deletedIds.length, "transakcję", "transakcje", "transakcji")}.`,
          doCofniecia.length === deletedIds.length && doCofniecia.length > 0
            ? { label: "Cofnij", run: () => void przywrocWiele(doCofniecia) }
            : undefined,
        );
      }

      if (failure) {
        const remaining = idsToDelete.length - deletedIds.length;
        setDeleteError(
          `${describeDeleteError(failure)}${
            remaining > 0 ? ` (nie usunięto ${remaining} z ${idsToDelete.length})` : ""
          }`,
        );
      }
    } catch (error) {
      setDeleteError(describeDeleteError(error));
    } finally {
      setBulkDeleting(false);
    }
  }

  const selectStyle: CSSProperties = v2SelectStyle;
  // Sumy liczą się TYLKO w walucie bazowej. Wcześniej `reduce` dodawał kwoty
  // z różnych walut i doklejał „zł": dywidenda 46 USD i 756 PLN dawały „802 zł",
  // choć uczciwa wartość to około 941. Ten widok nie ma kursów z dnia transakcji,
  // więc zamiast zmyślać przeliczenie, zawęża zakres i mówi o tym w cesze.
  const wBazowej = allTransactions.filter((tx) => tx.currency === displayCurrency);
  const pominietych = allTransactions.length - wBazowej.length;
  const deposits = wBazowej.filter((tx) => tx.transactionType === "cashDeposit").reduce((sum, tx) => sum + tx.grossAmount, 0);
  const dividends = wBazowej.filter((tx) => tx.transactionType === "dividend").reduce((sum, tx) => sum + tx.grossAmount, 0);
  const interest = wBazowej.filter((tx) => ["interest", "bondCoupon"].includes(tx.transactionType)).reduce((sum, tx) => sum + tx.grossAmount, 0);
  // Prowizja siedzi w polu `fees`/`taxes` KAŻDEJ transakcji — to ją pokazują
  // wiersze („prowizja 9,00"). Kafelek sumował wyłącznie transakcje typu fee/tax,
  // więc pisał „−0 zł" nad sześcioma widocznymi prowizjami.
  const fees = wBazowej.reduce(
    (sum, tx) => sum + tx.fees + tx.taxes + (["fee", "tax"].includes(tx.transactionType) ? tx.grossAmount : 0),
    0,
  );
  const cechaZakresu = pominietych > 0 ? `tylko w ${currencyLabel(displayCurrency)}` : "wszystkie waluty";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <V2ScreenHead
        eyebrow="Analiza"
        title="Transakcje"
        sub={records ? `${allTransactions.length} operacji · ${filtered.length} widocznych` : "Odblokuj dane w panelu synchronizacji"}
        action={<V2Button onClick={openAddTransaction}><span style={{ fontSize: 15, lineHeight: 1 }}>+</span>Dodaj transakcję</V2Button>}
      />

      {records && (
        <V2Card pad={20}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <V2Kpi label="Wpłaty" value={`+${fmt(deposits)} zł`} />
            <div style={{ width: "0.5px", background: V2.line, alignSelf: "stretch" }} />
            <V2Kpi label="Dywidendy" value={`+${fmt(dividends)} zł`} accent={V2.profit} />
            <V2Kpi label="Odsetki" value={`+${fmt(interest)} zł`} accent={V2.bonds} />
            <V2Kpi label="Prowizje" value={`−${fmt(fees)} zł`} accent={V2.loss} />
          </div>
        </V2Card>
      )}

      {/* Filters */}
      {records && (
        <div
          style={{
            padding: "0",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px" }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 13,
                color: V2.subtle,
                pointerEvents: "none",
              }}
            >
              ⌕
            </span>
            <input
              type="text"
              aria-label="Szukaj w transakcjach" placeholder="Szukaj instrumentu, portfela…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                ...v2InputStyle,
              }}
            />
          </div>

          {/* Portfolio filter */}
          <select
            aria-label="Filtr portfela" value={portfolioFilter}
            onChange={(e) => setPortfolioFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Wszystkie portfele</option>
            {portfolios.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            aria-label="Filtr typu transakcji" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="all">Wszystkie typy</option>
            {txTypes.map((t) => (
              <option key={t} value={t}>{TX_LABELS[t] ?? t}</option>
            ))}
          </select>

          {/* Clear */}
          {(search || portfolioFilter !== "all" || typeFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setPortfolioFilter("all"); setTypeFilter("all"); }}
              style={{
                padding: "7px 12px",
                borderRadius: 9,
                border: `0.5px solid ${V2.line}`,
                background: "transparent",
                color: V2.muted,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: V2_TYPE.ui,
              }}
            >
              Wyczyść ×
            </button>
          )}
        </div>
      )}

      {records && selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: v2Mix(V2.brand, 0.08),
            border: `0.5px solid ${v2Mix(V2.brand, 0.16)}`,
          }}
        >
          <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12, fontWeight: 650, color: V2.brand }}>
            Zaznaczone: {selectedIds.size}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkDeleting}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: `0.5px solid ${V2.line}`,
                background: "transparent",
                color: V2.muted,
                fontSize: 12,
                cursor: bulkDeleting ? "not-allowed" : "pointer",
                fontFamily: V2_TYPE.ui,
              }}
            >
              Odznacz
            </button>
            <button
              onClick={() => {
                const liveIds = new Set(allTransactions.map((transaction) => transaction.id));
                const ids = [...selectedIds].filter((id) => liveIds.has(id));
                if (ids.length) setConfirmDelete({ rodzaj: "wiele", ids });
              }}
              disabled={!userDataKey || bulkDeleting}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: `0.5px solid ${v2Mix(V2.loss, 0.2)}`,
                background: bulkDeleting ? v2Mix(V2.loss, 0.08) : "transparent",
                color: V2.loss,
                fontSize: 12,
                cursor: !userDataKey || bulkDeleting ? "not-allowed" : "pointer",
                fontFamily: V2_TYPE.ui,
              }}
            >
              {bulkDeleting ? "Usuwam…" : "Usuń zaznaczone"}
            </button>
          </div>
        </div>
      )}

      {deleteError && (
        <div
          role="alert"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: v2Mix(V2.loss, 0.08),
            border: `0.5px solid ${v2Mix(V2.loss, 0.22)}`,
          }}
        >
          <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12, fontWeight: 600, color: V2.loss }}>
            {deleteError}
          </div>
          <button
            onClick={() => setDeleteError(null)}
            style={{
              padding: "5px 9px",
              borderRadius: 8,
              border: `0.5px solid ${v2Mix(V2.loss, 0.2)}`,
              background: "transparent",
              color: V2.loss,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: V2_TYPE.ui,
              flexShrink: 0,
            }}
          >
            Zamknij ×
          </button>
        </div>
      )}

      {/* Table */}
      {/* Siatka div-ów dostaje semantykę tabeli: nagłówki kolumn, wiersze i komórki.
          Bez tego czytnik ekranu dostawał 17 wierszy po 8 kolumn jako jeden ciąg
          tekstu, bez powiązania wartości z nazwą kolumny. */}
      {!userDataKey && (
        <div
          id="powod-wylaczenia"
          style={{
            padding: "11px 16px",
            borderRadius: "var(--r-md)",
            border: `1px solid ${v2Mix(V2.brand, 0.35)}`,
            background: v2Mix(V2.brand, 0.06),
            fontFamily: V2_TYPE.ui,
            fontSize: 12,
            color: V2.brand,
            fontWeight: 500,
          }}
        >
          {publicDemo
            ? "Tryb demo — możesz przeglądać, sortować i filtrować cały rejestr, ale edycja i usuwanie są wyłączone. Załóż konto, żeby prowadzić własny."
            : "Odblokuj dane w panelu synchronizacji, żeby edytować i usuwać transakcje."}
        </div>
      )}

      <div className="transactions-table" role="table" aria-label="Transakcje" style={{ ...glassCard, padding: 0 }}>
        {/* Header row */}
        <div
          className="transactions-table-header"
          role="row"
          style={{
            display: "grid",
            gridTemplateColumns: "32px 100px minmax(0,1.5fr) minmax(0,1.2fr) 90px minmax(0,1fr) 90px 126px",
            padding: "10px 22px",
            background: v2Mix(V2.ink, 0.022),
            borderBottom: `0.5px solid ${LINE_SOFT}`,
            borderRadius: "var(--r-xl) var(--r-xl) 0 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              aria-checked={hasPartialVisibleSelection ? "mixed" : allVisibleSelected}
              aria-label="Zaznacz widoczne transakcje"
              onChange={toggleVisibleSelection}
              disabled={displayedIds.length === 0 || bulkDeleting}
              style={{ width: 15, height: 15, accentColor: V2.brand, cursor: bulkDeleting ? "not-allowed" : "pointer" }}
            />
          </div>
          {["Data", "Instrument", "Portfel", "Typ", "Kwota", "Waluta", "Akcje"].map((h, i) => {
            const klucz = h === "Data" ? "date" : h === "Kwota" ? "grossAmount" : null;
            const aktywny = klucz !== null && sort.key === klucz;
            const styl: CSSProperties = {
              fontSize: 10,
              fontWeight: 700,
              color: aktywny ? V2.ink : V2.subtle,
              textTransform: "uppercase",
              letterSpacing: ".08em",
              textAlign: i >= 3 ? "right" : "left",
            };
            return (
              <div
                key={h}
                role="columnheader"
                className={klucz ? "transactions-th is-sortable" : "transactions-th"}
                aria-sort={klucz === null ? undefined : aktywny ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                style={styl}
              >
                {klucz === null ? (
                  h
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSort(klucz)}
                    style={{
                      ...styl,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      width: "100%",
                      textAlign: styl.textAlign,
                    }}
                  >
                    {h}
                    <span aria-hidden="true" style={{ marginLeft: 4, opacity: aktywny ? 1 : 0.35 }}>
                      {aktywny && sort.dir === "asc" ? "↑" : "↓"}
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!records && (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 31, opacity: 0.12, marginBottom: 12 }}>↕</div>
            <div style={{ fontSize: 13, color: SUBTLE }}>
              Odblokuj dane w panelu synchronizacji
            </div>
          </div>
        )}

        {records && filtered.length === 0 && (
          <div style={{ padding: "32px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: SUBTLE }}>Brak transakcji dla wybranych filtrów</div>
          </div>
        )}

        {displayedTransactions.map((tx) => {
          const color = TX_BADGE;
          const label = TX_LABELS[tx.transactionType] ?? tx.transactionType;
          // Sprzedaż PRZYNOSI gotówkę. Brakowało jej na tej liście, więc każda
          // sprzedaż w rejestrze miała minus i kolor straty — tak samo jak zakup.
          const isInflow = ["sell", "cashDeposit", "dividend", "interest", "bondCoupon", "bondRedemption", "depositClose", "transferIn", "correction"].includes(tx.transactionType);
          const isSelected = selectedIds.has(tx.id);

          return (
            <div
              key={tx.id}
              className="transactions-table-row"
              role="row"
              style={{
                display: "grid",
                gridTemplateColumns: "32px 100px minmax(0,1.5fr) minmax(0,1.2fr) 90px minmax(0,1fr) 90px 126px",
                padding: "13px 22px",
                borderTop: `0.5px solid ${LINE_SOFT}`,
                alignItems: "center",
                background: isSelected ? v2Mix(V2.brand, 0.055) : "transparent",
                transition: "background .12s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = v2Mix(V2.ink, 0.022))}
              onMouseLeave={(e) => (e.currentTarget.style.background = isSelected ? v2Mix(V2.brand, 0.055) : "transparent")}
            >
              <div role="cell" className="transactions-table-select" style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  aria-label={`Zaznacz transakcję: ${label} · ${tx.instrumentName ?? tx.portfolioName} · ${fmtDate(tx.date)}`}
                  onChange={() => toggleSelected(tx.id)}
                  disabled={bulkDeleting || deletingId === tx.id}
                  style={{ width: 15, height: 15, accentColor: V2.brand, cursor: bulkDeleting || deletingId === tx.id ? "not-allowed" : "pointer" }}
                />
              </div>

              {/* Date */}
              <div role="cell" className="transactions-table-date" style={{ fontFamily: V2_TYPE.mono, fontSize: 11, color: V2.muted }}>{fmtDate(tx.date)}</div>

              {/* Instrument */}
              <div role="cell" className="transactions-table-instrument">
                {tx.instrumentName ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: V2.ink }}>{tx.instrumentName}</div>
                    <div style={{ fontSize: 11, color: V2.subtle, marginTop: 1 }}>
                      {tx.instrumentSymbol}
                      {tx.quantity != null && ` · ${tx.quantity.toLocaleString("pl-PL", { maximumFractionDigits: 6 })} szt.`}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: V2.muted }}>—</div>
                )}
              </div>

              {/* Portfolio */}
              <div role="cell" className="transactions-table-portfolio" style={{ fontFamily: V2_TYPE.mono, fontSize: 11, color: V2.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tx.portfolioName}
              </div>

              {/* Type badge */}
              <div role="cell" className="transactions-table-type" style={{ textAlign: "right" }}>
                <V2Badge label={label} color={color} />
              </div>

              {/* Amount */}
              <div role="cell" className="transactions-table-amount" style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontFamily: V2_TYPE.serif,
                    fontSize: 15,
                    fontWeight: 500,
                    // Kolor kwoty niesie KIERUNEK. Zakup to wyjście gotówki, ale nie strata —
                    // dostaje ton neutralny, a nie token klasy akcji, który tu nic nie znaczył.
                    color: isInflow ? PROFIT : tx.transactionType === "buy" ? MUTED : LOSS,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {isInflow ? "+" : "−"}{fmt(tx.grossAmount, 2)}
                </div>
                {(tx.fees > 0 || tx.taxes > 0) && (
                  <div style={{ fontFamily: V2_TYPE.mono, fontSize: 10, color: V2.subtle }}>
                    prowizja {fmt(tx.fees + tx.taxes, 2)}
                  </div>
                )}
              </div>

              {/* Currency */}
              <div role="cell" className="transactions-table-currency" style={{ textAlign: "right", fontFamily: V2_TYPE.mono, fontSize: 11, color: V2.muted, fontWeight: 500 }}>
                {tx.currency}
              </div>

              <div role="cell" className="transactions-table-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  aria-label={`Edytuj transakcję: ${label} · ${tx.instrumentName ?? tx.portfolioName} · ${fmtDate(tx.date)}`}
                  aria-describedby={!userDataKey ? "powod-wylaczenia" : undefined}
                  onClick={() => setEditingTransactionId(tx.id)}
                  disabled={!userDataKey}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `0.5px solid ${V2.line}`,
                    background: v2Mix(V2.card, 0.72),
                    color: userDataKey ? V2.muted : V2.subtle,
                    fontSize: 12,
                    cursor: userDataKey ? "pointer" : "not-allowed",
                    fontFamily: V2_TYPE.ui,
                  }}
                >
                  Edytuj
                </button>
                <button
                  aria-label={`Usuń transakcję: ${label} · ${tx.instrumentName ?? tx.portfolioName} · ${fmtDate(tx.date)}`}
                  aria-describedby={!userDataKey ? "powod-wylaczenia" : undefined}
                  onClick={() =>
                    setConfirmDelete({
                      rodzaj: "jedna",
                      id: tx.id,
                      opis: `${label} · ${tx.instrumentName ?? tx.portfolioName} · ${fmtDate(tx.date)}`,
                    })
                  }
                  disabled={!userDataKey || deletingId === tx.id}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `0.5px solid ${v2Mix(V2.loss, 0.18)}`,
                    background: deletingId === tx.id ? v2Mix(V2.loss, 0.08) : "transparent",
                    color: deletingId === tx.id ? LOSS : MUTED,
                    fontSize: 12,
                    cursor: !userDataKey || deletingId === tx.id ? "not-allowed" : "pointer",
                    fontFamily: V2_TYPE.ui,
                  }}
                >
                  {deletingId === tx.id ? "Usuwam…" : "Usuń"}
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length > 200 && (
          <div
            style={{
              padding: "14px 22px",
              borderTop: `0.5px solid ${LINE_SOFT}`,
              textAlign: "center",
              fontSize: 12,
              color: SUBTLE,
            }}
          >
            Pokazano 200 z {filtered.length} transakcji — użyj filtrów, żeby zawęzić wyniki
          </div>
        )}
      </div>

      <AddTransactionModal
        open={Boolean(editingTransactionId)}
        initialValue={editingTransaction}
        onClose={() => setEditingTransactionId(null)}
      />

    <ConfirmDialog
      open={confirmDelete !== null}
      title={confirmDelete?.rodzaj === "wiele" ? "Usunąć zaznaczone transakcje?" : "Usunąć transakcję?"}
      body={
        confirmDelete?.rodzaj === "wiele"
          ? `${confirmDelete.ids.length} ${pluralPl(confirmDelete.ids.length, "transakcja", "transakcje", "transakcji")} zniknie z rejestru. Cofniesz to zaraz po usunięciu.`
          : confirmDelete?.rodzaj === "jedna"
            ? `${confirmDelete.opis}. Cofniesz to zaraz po usunięciu.`
            : undefined
      }
      onCancel={() => setConfirmDelete(null)}
      onConfirm={() => {
        const zadanie = confirmDelete;
        setConfirmDelete(null);
        if (zadanie?.rodzaj === "jedna") void handleDeleteTransaction(zadanie.id);
        else if (zadanie?.rodzaj === "wiele") void handleDeleteSelectedTransactions();
      }}
    />

    </div>
  );
}
