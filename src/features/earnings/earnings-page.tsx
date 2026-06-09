"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Banknote,
  Building2,
  Calendar,
  Filter,
  Loader2,
  MinusCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  BURDEN_CATEGORY_LABEL,
  EMPLOYMENT_TYPE_AMOUNT_LABEL,
  EMPLOYMENT_TYPE_LABEL,
  MONTH_LABELS_LONG,
  MONTH_LABELS_SHORT,
  buildEarningsMonthSummary,
  buildEarningsTotals,
  compareEarningsTableRows,
  earningsRowSearchIndex,
  findDuplicateEarning,
  normalizeEarningsSearchText,
  type EarningBurdenCategory,
  type EarningBurdenRow,
  type EarningRow,
  type EarningsTableFilter,
  type EarningsTableRow,
  type EmploymentType,
} from "@/domain/models/earnings";
import { isFakeSyncEnabled } from "@/lib/env";
import { parsePositiveAmount } from "@/lib/parse-amount";
import { V2, V2Badge, V2Button, V2Card, V2Kpi, V2ScreenHead, V2_TYPE, v2InputStyle, v2Mix, v2SelectStyle } from "@/lib/v2-design";
import { buildIncomeLists, buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { deleteRecord, refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { useSyncStore } from "@/sync/store/sync-store";

const EMPLOYMENT_TYPES: EmploymentType[] = ["employment", "business"];
const BURDEN_CATEGORIES: EarningBurdenCategory[] = ["incomeTax", "vat", "zus", "accounting"];
const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF"];
const PAGE_SIZE = 40;

type EarningDraft = {
  id: string;
  year: string;
  month: string;
  employmentType: EmploymentType;
  enteredAmount: string;
  currency: string;
  fxRateToPLN: string;
  plnAmount: string;
  source: string;
  note: string;
  sourceUpdatedAt: string | null;
};

type BurdenDraft = {
  id: string;
  year: string;
  month: string;
  category: EarningBurdenCategory;
  amountPLN: string;
  note: string;
  sourceUpdatedAt: string | null;
};

type SaveState = {
  saving: boolean;
  error: string | null;
};

const emptyIncomeLists = buildIncomeListsFromEmpty();

function buildIncomeListsFromEmpty() {
  return {
    earnings: [] as EarningRow[],
    burdens: [] as EarningBurdenRow[],
    rows: [] as EarningsTableRow[],
    summaries: [],
    yearlyAverages: [],
    totals: { totalPLN: 0, averagePLN: 0, averageBeforeBurdensPLN: 0, highestMonthPLN: 0 },
    years: [] as number[],
    currencies: [] as string[],
  };
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function parsePositiveNumber(value: string) {
  return parsePositiveAmount(value);
}

function parseYear(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 2000 ? parsed : null;
}

function parseMonth(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function monthYearLabel(year: number, month: number) {
  return `${MONTH_LABELS_SHORT[month - 1]} ${year}`;
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

function currentYearMonth() {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
  };
}

function newEarningDraft(): EarningDraft {
  const now = currentYearMonth();
  return {
    id: crypto.randomUUID(),
    year: now.year,
    month: now.month,
    employmentType: "employment",
    enteredAmount: "",
    currency: "PLN",
    fxRateToPLN: "1",
    plnAmount: "",
    source: "Wynagrodzenie",
    note: "",
    sourceUpdatedAt: null,
  };
}

function earningDraftFromRow(row: EarningRow): EarningDraft {
  return {
    id: row.id,
    year: String(row.year),
    month: String(row.month),
    employmentType: row.employmentType,
    enteredAmount: String(row.enteredAmount),
    currency: row.currency,
    fxRateToPLN: String(row.fxRateToPLN),
    plnAmount: String(row.plnAmount),
    source: row.source,
    note: row.note ?? "",
    sourceUpdatedAt: row.sourceUpdatedAt,
  };
}

function newBurdenDraft(): BurdenDraft {
  const now = currentYearMonth();
  return {
    id: crypto.randomUUID(),
    year: now.year,
    month: now.month,
    category: "incomeTax",
    amountPLN: "",
    note: "",
    sourceUpdatedAt: null,
  };
}

function burdenDraftFromRow(row: EarningBurdenRow): BurdenDraft {
  return {
    id: row.id,
    year: String(row.year),
    month: String(row.month),
    category: row.category,
    amountPLN: String(row.amountPLN),
    note: row.note ?? "",
    sourceUpdatedAt: row.sourceUpdatedAt,
  };
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: `0.5px solid ${danger ? v2Mix(V2.loss, 0.28) : V2.line}`,
        background: danger ? v2Mix(V2.loss, 0.06) : v2Mix(V2.card, 0.74),
        color: danger ? V2.loss : V2.muted,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function MonthlyChart({
  summaries,
  isMobile,
}: {
  summaries: ReturnType<typeof buildIncomeLists>["summaries"];
  isMobile: boolean;
}) {
  const items = [...summaries].sort((left, right) => left.periodStart.localeCompare(right.periodStart));
  const max = Math.max(...items.map((item) => Math.max(item.sourcePLN, item.totalPLN)), 1);

  if (items.length === 0) {
    return (
      <div style={{ minHeight: 210, display: "grid", placeItems: "center", color: V2.subtle, fontSize: 13 }}>
        Brak danych - dodaj pierwszy wpis.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: isMobile ? 7 : 10, height: 230, overflowX: "auto", paddingBottom: 4 }}>
      {items.map((item) => {
        const sourceHeight = Math.max(3, (item.sourcePLN / max) * 170);
        const totalHeight = Math.max(3, (Math.max(item.totalPLN, 0) / max) * 170);
        return (
          <div key={item.id} style={{ minWidth: isMobile ? 36 : 44, flex: "1 0 36px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 176 }}>
              <div title={`Przed obciążeniami: ${fmt(item.sourcePLN)} PLN`} style={{ width: 11, height: sourceHeight, borderRadius: 4, background: v2Mix(V2.equity, 0.32) }} />
              <div title={`Po obciążeniach: ${fmt(item.totalPLN)} PLN`} style={{ width: 11, height: totalHeight, borderRadius: 4, background: item.totalPLN >= 0 ? V2.profit : V2.loss }} />
            </div>
            <div style={{ fontSize: 10, color: V2.subtle, whiteSpace: "nowrap" }}>{MONTH_LABELS_SHORT[item.month - 1]}</div>
            {!isMobile && <div style={{ fontFamily: V2_TYPE.mono, fontSize: 9.5, color: V2.muted }}>{String(item.year).slice(2)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 220, display: "grid", placeItems: "center", padding: 16 }}>
      <button
        type="button"
        aria-label="Zamknij modal"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: "none", background: "rgba(12,16,13,0.36)", cursor: "default" }}
      />
      <div style={{ position: "relative", width: "min(720px, 100%)", maxHeight: "calc(100vh - 32px)", overflow: "auto", borderRadius: 14, background: V2.card, border: `0.5px solid ${V2.line}`, boxShadow: `0 24px 70px ${v2Mix(V2.ink, 0.28)}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 20px", borderBottom: `0.5px solid ${V2.line2}` }}>
          <div style={{ fontFamily: V2_TYPE.serif, fontSize: 22, fontWeight: 500 }}>{title}</div>
          <IconButton label="Zamknij" onClick={onClose}><X size={16} /></IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: V2.subtle }}>{label}</span>
      {children}
    </label>
  );
}

export function EarningsPage() {
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const setSync = useSyncStore((s) => s.setSync);
  const isMobile = useMedia("(max-width: 760px)");
  const isTablet = useMedia("(max-width: 1060px)");

  const incomeLists = useMemo(() => (records ? buildIncomeLists(records) : emptyIncomeLists), [records]);
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedTableYear, setSelectedTableYear] = useState<number | "all">("all");
  const [tableFilter, setTableFilter] = useState<EarningsTableFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");
  const [selectedEmploymentType, setSelectedEmploymentType] = useState<EmploymentType | "all">("all");
  const [selectedBurdenCategory, setSelectedBurdenCategory] = useState<EarningBurdenCategory | "all">("all");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);
  const [editingEarning, setEditingEarning] = useState<EarningDraft | null>(null);
  const [editingBurden, setEditingBurden] = useState<BurdenDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ saving: false, error: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [selectedYear, selectedTableYear, tableFilter, selectedMonth, selectedEmploymentType, selectedBurdenCategory, selectedCurrency, deferredSearchText]);

  const summariesForSelection = useMemo(() => {
    const summaries =
      selectedYear === "all"
        ? incomeLists.summaries
        : incomeLists.summaries.filter((summary) => summary.year === selectedYear);
    return {
      summaries,
      totals: buildEarningsTotals(summaries),
    };
  }, [incomeLists.summaries, selectedYear]);

  const normalizedSearch = normalizeEarningsSearchText(deferredSearchText);
  const tableYear = selectedTableYear === "all" ? selectedYear : selectedTableYear;
  const filteredRows = useMemo(() => {
    return incomeLists.rows
      .filter((row) => {
        if (tableYear !== "all" && row.year !== tableYear) return false;
        if (tableFilter === "earnings" && row.kind !== "earning") return false;
        if (tableFilter === "burdens" && row.kind !== "burden") return false;
        if (selectedMonth !== "all" && row.month !== selectedMonth) return false;
        if (selectedEmploymentType !== "all" && (row.kind !== "earning" || row.employmentType !== selectedEmploymentType)) return false;
        if (selectedBurdenCategory !== "all" && (row.kind !== "burden" || row.category !== selectedBurdenCategory)) return false;
        if (selectedCurrency !== "all" && (row.kind !== "earning" || row.currency !== selectedCurrency)) return false;
        if (normalizedSearch && !earningsRowSearchIndex(row).includes(normalizedSearch)) return false;
        return true;
      })
      .sort(compareEarningsTableRows);
  }, [incomeLists.rows, normalizedSearch, selectedBurdenCategory, selectedCurrency, selectedEmploymentType, selectedMonth, tableFilter, tableYear]);

  const visibleRows = filteredRows.slice(0, visibleLimit);
  const activeFilterCount = [
    tableFilter !== "all",
    selectedTableYear !== "all",
    selectedMonth !== "all",
    selectedEmploymentType !== "all",
    selectedBurdenCategory !== "all",
    selectedCurrency !== "all",
    normalizedSearch.length > 0,
  ].filter(Boolean).length;

  const unlocked = Boolean(userDataKey && supabase);

  async function refreshAfterWrite() {
    if (!supabase || !userDataKey) return;
    const { records: nextRecords, snapshot } = await refreshSyncStore(supabase, userDataKey);
    setSync(nextRecords, snapshot);
  }

  function applyFakeIncomePayload(payload: Record<string, unknown> & { id: string }) {
    if (!records) return false;
    const nextRecords = [
      ...records.filter((record) => !(record.id === payload.id && record.envelope.type === "income")),
      {
        id: payload.id,
        deviceId: "fake-sync-web",
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        envelope: {
          type: "income" as const,
          payloadVersion: 1,
          schemaVersion: 1,
          payload,
        },
      },
    ];
    setSync(
      nextRecords,
      buildInvestorDataSnapshot(nextRecords, {
        asOf: new Date(),
        historyGranularity: "daily",
        useLatestTransactionFxRate: true,
        useMarketQuotes: true,
      }),
    );
    return true;
  }

  function deleteFakeIncomePayload(id: string) {
    if (!records) return false;
    const nextRecords = records.filter((record) => !(record.id === id && record.envelope.type === "income"));
    setSync(
      nextRecords,
      buildInvestorDataSnapshot(nextRecords, {
        asOf: new Date(),
        historyGranularity: "daily",
        useLatestTransactionFxRate: true,
        useMarketQuotes: true,
      }),
    );
    return true;
  }

  async function saveEarning(draft: EarningDraft) {
    const year = parseYear(draft.year);
    const month = parseMonth(draft.month);
    const enteredAmount = parsePositiveNumber(draft.enteredAmount);
    const fxRateToPLN = parsePositiveNumber(draft.fxRateToPLN);
    const plnAmount = parsePositiveNumber(draft.plnAmount);
    const source = draft.source.trim() || "Wynagrodzenie";
    const note = draft.note.trim() || null;
    if (!year || !month || !enteredAmount || !fxRateToPLN || !plnAmount) {
      setSaveState({ saving: false, error: "Uzupełnij poprawnie rok, miesiąc i kwoty." });
      return;
    }

    const duplicate = findDuplicateEarning(incomeLists.earnings, {
      id: draft.id,
      year,
      month,
      source,
      employmentType: draft.employmentType,
    });
    const id = duplicate?.id ?? draft.id;
    const baseUpdatedAt = duplicate?.sourceUpdatedAt ?? draft.sourceUpdatedAt;
    const payload = {
      recordType: "income",
      id,
      entryKind: "earning",
      year,
      month,
      employmentType: draft.employmentType,
      enteredAmount,
      currency: draft.currency.trim().toUpperCase(),
      fxRateToPLN: draft.currency === "PLN" ? 1 : fxRateToPLN,
      plnAmount,
      source,
      burdenCategory: null,
      amountPLN: null,
      note,
    };

    if (isFakeSyncEnabled() && applyFakeIncomePayload(payload)) {
      setMessage("Zarobek zapisany lokalnie w fake sync.");
      setEditingEarning(null);
      return;
    }

    if (!supabase || !userDataKey) {
      setSaveState({ saving: false, error: "Odblokuj sync przed zapisem zarobku." });
      return;
    }

    setSaveState({ saving: true, error: null });
    try {
      const result = await saveRecord(
        supabase,
        userDataKey,
        "income",
        payload,
        { baseUpdatedAt },
      );
      if (!result.queued) await refreshAfterWrite();
      setMessage(result.queued ? "Zarobek czeka w kolejce sync." : "Zarobek zapisany.");
      setEditingEarning(null);
    } catch (error) {
      setSaveState({ saving: false, error: error instanceof Error ? error.message : "Nie udało się zapisać zarobku." });
      return;
    }
    setSaveState({ saving: false, error: null });
  }

  async function saveBurden(draft: BurdenDraft) {
    const year = parseYear(draft.year);
    const month = parseMonth(draft.month);
    const amountPLN = parsePositiveNumber(draft.amountPLN);
    const note = draft.note.trim() || null;
    if (!year || !month || !amountPLN) {
      setSaveState({ saving: false, error: "Uzupełnij poprawnie rok, miesiąc i kwotę." });
      return;
    }

    const payload = {
      recordType: "income",
      id: draft.id,
      entryKind: "burden",
      year,
      month,
      employmentType: null,
      enteredAmount: null,
      currency: null,
      fxRateToPLN: null,
      plnAmount: null,
      source: null,
      burdenCategory: draft.category,
      amountPLN,
      note,
    };

    if (isFakeSyncEnabled() && applyFakeIncomePayload(payload)) {
      setMessage("Obciążenie zapisane lokalnie w fake sync.");
      setEditingBurden(null);
      return;
    }

    if (!supabase || !userDataKey) {
      setSaveState({ saving: false, error: "Odblokuj sync przed zapisem obciążenia." });
      return;
    }

    setSaveState({ saving: true, error: null });
    try {
      const result = await saveRecord(
        supabase,
        userDataKey,
        "income",
        payload,
        { baseUpdatedAt: draft.sourceUpdatedAt },
      );
      if (!result.queued) await refreshAfterWrite();
      setMessage(result.queued ? "Obciążenie czeka w kolejce sync." : "Obciążenie zapisane.");
      setEditingBurden(null);
    } catch (error) {
      setSaveState({ saving: false, error: error instanceof Error ? error.message : "Nie udało się zapisać obciążenia." });
      return;
    }
    setSaveState({ saving: false, error: null });
  }

  async function deleteRow(row: EarningsTableRow) {
    if (isFakeSyncEnabled() && deleteFakeIncomePayload(row.id)) {
      setMessage("Wpis usunięty lokalnie w fake sync.");
      return;
    }

    if (!supabase || !userDataKey) {
      setMessage("Odblokuj sync przed usunięciem wpisu.");
      return;
    }
    setDeletingId(row.id);
    setMessage(null);
    try {
      const result = await deleteRecord(supabase, "income", row.id, {
        baseUpdatedAt: row.sourceUpdatedAt,
      });
      if (!result.queued) await refreshAfterWrite();
      setMessage(result.queued ? "Usunięcie czeka w kolejce sync." : "Wpis usunięty.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się usunąć wpisu.");
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    setSelectedTableYear("all");
    setTableFilter("all");
    setSelectedMonth("all");
    setSelectedEmploymentType("all");
    setSelectedBurdenCategory("all");
    setSelectedCurrency("all");
    setSearchText("");
  }

  const action = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <V2Button variant="ghost" disabled={!unlocked} onClick={() => { setSaveState({ saving: false, error: null }); setEditingBurden(newBurdenDraft()); }}>
        <MinusCircle size={15} /> Dodaj obciążenie
      </V2Button>
      <V2Button disabled={!unlocked} onClick={() => { setSaveState({ saving: false, error: null }); setEditingEarning(newEarningDraft()); }}>
        <Plus size={15} /> Dodaj wynagrodzenie
      </V2Button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <V2ScreenHead
        eyebrow="Analiza"
        title="Zarobki"
        sub="UoP, B2B i obciążenia miesięczne zsynchronizowane z macOS"
        action={action}
      />

      {!unlocked && (
        <V2Card style={{ color: V2.muted, fontSize: 13 }}>
          Odblokuj prywatną synchronizację, aby dodawać i edytować zarobki. Widok pokazuje dane `income`, gdy są dostępne w sync.
        </V2Card>
      )}
      {message && (
        <div style={{ padding: "10px 12px", borderRadius: 10, background: v2Mix(V2.brand, 0.08), border: `0.5px solid ${v2Mix(V2.brand, 0.16)}`, color: V2.brand, fontSize: 13 }}>
          {message}
        </div>
      )}

      <V2Card glass pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(300px, 430px) 1fr" }}>
          <div style={{ padding: isMobile ? 20 : 28, borderRight: isTablet ? "none" : `0.5px solid ${V2.line}`, borderBottom: isTablet ? `0.5px solid ${V2.line}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: V2.subtle }}>
                Łącznie w PLN {selectedYear === "all" ? "ogółem" : selectedYear}
              </div>
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value === "all" ? "all" : Number(event.target.value))} style={v2SelectStyle}>
                <option value="all">Wszystkie lata</option>
                {incomeLists.years.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>
            <div style={{ fontFamily: V2_TYPE.serif, fontWeight: 500, fontSize: isMobile ? 44 : 58, lineHeight: 0.98, color: V2.profit, fontVariantNumeric: "tabular-nums" }}>
              {fmt(summariesForSelection.totals.totalPLN)}
              <span style={{ fontSize: 22, fontStyle: "italic", color: V2.subtle, marginLeft: 8 }}>PLN</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 18, marginTop: 24 }}>
              <V2Kpi label="Średnia / m-c" value={`${fmt(summariesForSelection.totals.averagePLN)} zł`} sub="po obciążeniach" />
              <V2Kpi label="Śr. przed obc." value={`${fmt(summariesForSelection.totals.averageBeforeBurdensPLN)} zł`} sub="dochód + przychód" />
              <V2Kpi label="Najwyższy miesiąc" value={`${fmt(summariesForSelection.totals.highestMonthPLN)} zł`} accent={V2.equity} />
              <V2Kpi label="Rekordy" value={`${incomeLists.earnings.length + incomeLists.burdens.length}`} sub={`${incomeLists.earnings.length} zarobków / ${incomeLists.burdens.length} obciążeń`} />
            </div>
          </div>
          <div style={{ padding: isMobile ? 18 : 24, background: v2Mix(V2.card2, 0.42), minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: V2.subtle }}>Wynik miesięczny</div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: V2.muted }}>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: v2Mix(V2.equity, 0.32), marginRight: 6 }} />Przed obc.</span>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: V2.profit, marginRight: 6 }} />Po obc.</span>
              </div>
            </div>
            <MonthlyChart summaries={summariesForSelection.summaries} isMobile={isMobile} />
          </div>
        </div>
      </V2Card>

      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: 14 }}>
        <V2Card>
          <div style={{ fontFamily: V2_TYPE.serif, fontSize: 19, fontWeight: 500, marginBottom: 14 }}>Średnie roczne</div>
          {incomeLists.yearlyAverages.length === 0 ? (
            <div style={{ color: V2.subtle, fontSize: 13 }}>Brak danych</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {incomeLists.yearlyAverages.map((row) => (
                <div key={row.year} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 12, alignItems: "center" }}>
                  <div style={{ fontWeight: 700 }}>{row.year}</div>
                  <div style={{ height: 8, borderRadius: 5, background: v2Mix(V2.ink, 0.06), overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Math.max(4, (row.avgResult / Math.max(...incomeLists.yearlyAverages.map((item) => item.avgResult), 1)) * 100))}%`, height: "100%", background: V2.equity }} />
                  </div>
                  <div style={{ textAlign: "right", fontFamily: V2_TYPE.mono, fontSize: 12 }}>
                    {fmt(row.avgResult)} zł
                    <div style={{ color: V2.subtle, fontSize: 10 }}>{row.months} m-cy</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </V2Card>

        <V2Card>
          <div style={{ fontFamily: V2_TYPE.serif, fontSize: 19, fontWeight: 500, marginBottom: 14 }}>Struktura bieżącego wyboru</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <V2Kpi label="Zatrudnienie" value={`${fmt(summariesForSelection.summaries.reduce((sum, item) => sum + item.employmentPLN, 0))} zł`} accent={V2.profit} />
            <V2Kpi label="B2B" value={`${fmt(summariesForSelection.summaries.reduce((sum, item) => sum + item.businessRevenuePLN, 0))} zł`} accent={V2.equity} />
            <V2Kpi label="Obciążenia" value={`${fmt(summariesForSelection.summaries.reduce((sum, item) => sum + item.burdenPLN, 0))} zł`} accent={V2.loss} />
          </div>
        </V2Card>
      </div>

      <V2Card pad={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: 16, background: v2Mix(V2.card2, 0.48), borderBottom: `0.5px solid ${V2.line2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: V2.subtle }}>Wpisy</div>
              <div style={{ fontFamily: V2_TYPE.serif, fontSize: 24, fontWeight: 500 }}>{filteredRows.length} rekordów</div>
            </div>
            {activeFilterCount > 0 && <V2Badge label={`${activeFilterCount} filtrów`} color={V2.equity} />}
            <div style={{ flex: 1 }} />
            <V2Button variant="ghost" disabled={activeFilterCount === 0} onClick={clearFilters}><X size={14} /> Wyczyść</V2Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {(["all", "earnings", "burdens"] as EarningsTableFilter[]).map((filter) => (
              <button key={filter} type="button" onClick={() => setTableFilter(filter)} style={{ padding: "8px 13px", borderRadius: 9, border: `0.5px solid ${tableFilter === filter ? "transparent" : V2.line}`, background: tableFilter === filter ? V2.ink : V2.card, color: tableFilter === filter ? V2.card : V2.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                {filter === "all" ? "Wszystko" : filter === "earnings" ? "Zarobki" : "Obciążenia"}
              </button>
            ))}
            <div style={{ position: "relative", minWidth: isMobile ? "100%" : 250 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: V2.subtle }} />
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Szukaj po źródle, notatce, kategorii..." style={{ ...v2InputStyle, paddingLeft: 32 }} />
            </div>
            <Filter size={15} color={V2.subtle} />
            <select value={selectedTableYear} onChange={(event) => setSelectedTableYear(event.target.value === "all" ? "all" : Number(event.target.value))} style={v2SelectStyle}>
              <option value="all">Rok: wybór</option>
              {incomeLists.years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value === "all" ? "all" : Number(event.target.value))} style={v2SelectStyle}>
              <option value="all">Miesiąc: wszystkie</option>
              {MONTH_LABELS_LONG.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
            <select value={selectedEmploymentType} onChange={(event) => setSelectedEmploymentType(event.target.value as EmploymentType | "all")} style={v2SelectStyle}>
              <option value="all">Typ pracy: każdy</option>
              {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{EMPLOYMENT_TYPE_LABEL[type]}</option>)}
            </select>
            <select value={selectedBurdenCategory} onChange={(event) => setSelectedBurdenCategory(event.target.value as EarningBurdenCategory | "all")} style={v2SelectStyle}>
              <option value="all">Kategoria: każda</option>
              {BURDEN_CATEGORIES.map((category) => <option key={category} value={category}>{BURDEN_CATEGORY_LABEL[category]}</option>)}
            </select>
            <select value={selectedCurrency} onChange={(event) => setSelectedCurrency(event.target.value)} style={v2SelectStyle}>
              <option value="all">Waluta: wszystkie</option>
              {incomeLists.currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <div style={{ padding: 24, color: V2.subtle, fontSize: 13 }}>Brak wpisów dla wybranych filtrów.</div>
        ) : (
          <div>
            {visibleRows.map((row, index) => {
              const summary = buildEarningsMonthSummary(row.year, row.month, incomeLists.earnings, incomeLists.burdens);
              const isEarning = row.kind === "earning";
              const color = isEarning ? (row.employmentType === "employment" ? V2.profit : V2.equity) : V2.loss;
              return (
                <div key={`${row.kind}-${row.id}`} style={{ display: "grid", gridTemplateColumns: isMobile ? "34px minmax(0, 1fr) auto" : "38px minmax(0, 1fr) minmax(180px, auto) auto", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: index ? `0.5px solid ${V2.line2}` : "none" }}>
                  <div style={{ width: 32, height: 32, display: "grid", placeItems: "center", borderRadius: 8, background: v2Mix(color, 0.12), color }}>
                    {isEarning ? (row.employmentType === "employment" ? <UserRound size={16} /> : <Building2 size={16} />) : <Banknote size={16} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{monthYearLabel(row.year, row.month)}</span>
                      <V2Badge label={isEarning ? EMPLOYMENT_TYPE_LABEL[row.employmentType] : "Obciążenie"} color={color} />
                    </div>
                    <div style={{ fontSize: 12, color: V2.subtle, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {isEarning ? row.source : BURDEN_CATEGORY_LABEL[row.category]}{row.note ? ` · ${row.note}` : ""}
                    </div>
                    {(!isMobile && (!isEarning || row.employmentType === "business")) && (
                      <div style={{ fontSize: 11, color: V2.subtle, marginTop: 2 }}>
                        Obciążenia miesiąca: {fmt(summary.burdenPLN)} PLN · wynik: {fmt(summary.totalPLN)} PLN
                      </div>
                    )}
                  </div>
                  {!isMobile && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: V2_TYPE.serif, fontSize: 17, fontWeight: 500, color, whiteSpace: "nowrap" }}>
                        {isEarning ? "+" : "-"}{fmt(isEarning ? row.plnAmount : row.amountPLN)} PLN
                      </div>
                      {isEarning && (
                        <div style={{ fontFamily: V2_TYPE.mono, fontSize: 10.5, color: V2.subtle }}>
                          {fmt(row.enteredAmount, row.currency === "PLN" ? 0 : 2)} {row.currency} · kurs {fmt(row.fxRateToPLN, row.currency === "PLN" ? 0 : 4)}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
                    <IconButton
                      label="Edytuj"
                      disabled={!unlocked}
                      onClick={() => {
                        setSaveState({ saving: false, error: null });
                        if (isEarning) {
                          setEditingEarning(earningDraftFromRow(row));
                        } else {
                          setEditingBurden(burdenDraftFromRow(row));
                        }
                      }}
                    >
                      <Pencil size={14} />
                    </IconButton>
                    <IconButton label="Usuń" danger disabled={!unlocked || deletingId === row.id} onClick={() => void deleteRow(row)}>
                      {deletingId === row.id ? <Loader2 size={14} /> : <Trash2 size={14} />}
                    </IconButton>
                  </div>
                </div>
              );
            })}
            {filteredRows.length > visibleRows.length && (
              <div style={{ display: "flex", justifyContent: "center", padding: 14, borderTop: `0.5px solid ${V2.line2}` }}>
                <V2Button variant="ghost" onClick={() => setVisibleLimit((current) => current + PAGE_SIZE)}>Pokaż więcej</V2Button>
              </div>
            )}
          </div>
        )}
      </V2Card>

      {editingEarning && (
        <EarningModal
          draft={editingEarning}
          setDraft={setEditingEarning}
          state={saveState}
          knownSources={Array.from(new Set(incomeLists.earnings.map((item) => item.source))).sort()}
          onClose={() => setEditingEarning(null)}
          onSave={() => void saveEarning(editingEarning)}
        />
      )}
      {editingBurden && (
        <BurdenModal
          draft={editingBurden}
          setDraft={setEditingBurden}
          state={saveState}
          onClose={() => setEditingBurden(null)}
          onSave={() => void saveBurden(editingBurden)}
        />
      )}
    </div>
  );
}

function EarningModal({
  draft,
  setDraft,
  state,
  knownSources,
  onClose,
  onSave,
}: {
  draft: EarningDraft;
  setDraft: (draft: EarningDraft | null) => void;
  state: SaveState;
  knownSources: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [manualPLN, setManualPLN] = useState(false);

  useEffect(() => {
    if (draft.currency === "PLN") {
      setDraft({ ...draft, fxRateToPLN: "1", plnAmount: draft.enteredAmount });
      setFxError(null);
      return;
    }
    const year = parseYear(draft.year);
    const month = parseMonth(draft.month);
    const amount = parsePositiveNumber(draft.enteredAmount);
    if (!year || !month || !amount) return;

    let cancelled = false;
    setFxLoading(true);
    setFxError(null);
    fetch(`/api/market-data/fx?code=${encodeURIComponent(draft.currency)}&year=${year}&month=${month}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Nie udało się pobrać kursu NBP.");
        return body.data as { rate: number };
      })
      .then((rate) => {
        if (cancelled) return;
        setDraft({
          ...draft,
          fxRateToPLN: String(rate.rate),
          plnAmount: manualPLN ? draft.plnAmount : String(amount * rate.rate),
        });
      })
      .catch((error) => {
        if (!cancelled) setFxError(error instanceof Error ? error.message : "Nie udało się pobrać kursu NBP.");
      })
      .finally(() => {
        if (!cancelled) setFxLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // draft is intentionally not a dependency; individual primitive fields drive FX refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.currency, draft.year, draft.month, draft.enteredAmount, manualPLN, setDraft]);

  return (
    <ModalShell title={draft.sourceUpdatedAt ? "Edycja zarobku" : "Nowy wpis zarobku"} onClose={onClose}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="Typ">
            <select value={draft.employmentType} onChange={(event) => setDraft({ ...draft, employmentType: event.target.value as EmploymentType })} style={v2SelectStyle}>
              {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{EMPLOYMENT_TYPE_LABEL[type]}</option>)}
            </select>
          </Field>
          <Field label="Rok">
            <input value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} style={{ ...v2InputStyle, paddingLeft: 12 }} />
          </Field>
          <Field label="Miesiąc">
            <select value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} style={v2SelectStyle}>
              {MONTH_LABELS_LONG.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label={EMPLOYMENT_TYPE_AMOUNT_LABEL[draft.employmentType]}>
            <input value={draft.enteredAmount} onChange={(event) => setDraft({ ...draft, enteredAmount: event.target.value, plnAmount: draft.currency === "PLN" ? event.target.value : draft.plnAmount })} style={{ ...v2InputStyle, paddingLeft: 12 }} inputMode="decimal" />
          </Field>
          <Field label="Waluta">
            <select value={draft.currency} onChange={(event) => { setManualPLN(false); setDraft({ ...draft, currency: event.target.value }); }} style={v2SelectStyle}>
              {CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </Field>
          <Field label="Kwota w PLN">
            <input value={draft.plnAmount} disabled={draft.currency === "PLN"} onChange={(event) => { setManualPLN(true); setDraft({ ...draft, plnAmount: event.target.value }); }} style={{ ...v2InputStyle, paddingLeft: 12 }} inputMode="decimal" />
          </Field>
          <Field label="Kurs do PLN">
            <input value={draft.fxRateToPLN} disabled={draft.currency === "PLN"} onChange={(event) => { setManualPLN(true); setDraft({ ...draft, fxRateToPLN: event.target.value }); }} style={{ ...v2InputStyle, paddingLeft: 12 }} inputMode="decimal" />
          </Field>
        </div>

        {draft.currency !== "PLN" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: fxError ? V2.loss : V2.subtle, fontSize: 12 }}>
            {fxLoading && <Loader2 size={14} />}
            <span>{fxError ?? (manualPLN ? "Kwota PLN została ustawiona ręcznie." : "Domyślnie używana jest średnia NBP z wybranego miesiąca.")}</span>
          </div>
        )}

        <Field label="Pracodawca / źródło">
          <div style={{ display: "flex", gap: 8 }}>
            {knownSources.length > 0 && (
              <select value="" onChange={(event) => event.target.value && setDraft({ ...draft, source: event.target.value })} style={{ ...v2SelectStyle, width: 130 }}>
                <option value="">Wybierz</option>
                {knownSources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            )}
            <input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} style={{ ...v2InputStyle, paddingLeft: 12 }} placeholder="np. Wynagrodzenie, Faktura miesięczna" />
          </div>
        </Field>
        <Field label="Notatka">
          <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} style={{ ...v2InputStyle, paddingLeft: 12 }} />
        </Field>

        {state.error && <div style={{ color: V2.loss, fontSize: 13 }}>{state.error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: `0.5px solid ${V2.line2}`, paddingTop: 14 }}>
          <V2Button variant="ghost" onClick={onClose}>Anuluj</V2Button>
          <V2Button disabled={state.saving || Boolean(fxError)} onClick={onSave}>{state.saving ? <Loader2 size={15} /> : <Calendar size={15} />} Zapisz</V2Button>
        </div>
      </div>
    </ModalShell>
  );
}

function BurdenModal({
  draft,
  setDraft,
  state,
  onClose,
  onSave,
}: {
  draft: BurdenDraft;
  setDraft: (draft: BurdenDraft | null) => void;
  state: SaveState;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalShell title={draft.sourceUpdatedAt ? "Edycja obciążenia" : "Nowe obciążenie"} onClose={onClose}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <Field label="Rok">
            <input value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} style={{ ...v2InputStyle, paddingLeft: 12 }} />
          </Field>
          <Field label="Miesiąc">
            <select value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} style={v2SelectStyle}>
              {MONTH_LABELS_LONG.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
            </select>
          </Field>
          <Field label="Kategoria">
            <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as EarningBurdenCategory })} style={v2SelectStyle}>
              {BURDEN_CATEGORIES.map((category) => <option key={category} value={category}>{BURDEN_CATEGORY_LABEL[category]}</option>)}
            </select>
          </Field>
          <Field label="Kwota PLN">
            <input value={draft.amountPLN} onChange={(event) => setDraft({ ...draft, amountPLN: event.target.value })} style={{ ...v2InputStyle, paddingLeft: 12 }} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Notatka">
          <input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} style={{ ...v2InputStyle, paddingLeft: 12 }} />
        </Field>

        {state.error && <div style={{ color: V2.loss, fontSize: 13 }}>{state.error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: `0.5px solid ${V2.line2}`, paddingTop: 14 }}>
          <V2Button variant="ghost" onClick={onClose}>Anuluj</V2Button>
          <V2Button disabled={state.saving} onClick={onSave}>{state.saving ? <Loader2 size={15} /> : <Calendar size={15} />} Zapisz</V2Button>
        </div>
      </div>
    </ModalShell>
  );
}
