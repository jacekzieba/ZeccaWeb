"use client";

import { useEffect, useMemo, useState } from "react";
import { buildTransactionList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";
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

type IncomeCategory = "job" | "business" | "contract" | "rent" | "dividend" | "interest";
type IncomeEntry = {
  id: string;
  date: string;
  category: IncomeCategory;
  name: string;
  amount: number;
  currency: string;
  source: "local" | "transaction";
};

const CATEGORY_META: Record<IncomeCategory, { label: string; short: string; flow: "active" | "passive"; color: string }> = {
  job: { label: "Umowa o pracę", short: "UoP", flow: "active", color: V2.brand },
  business: { label: "Działalność gosp.", short: "B2B", flow: "active", color: V2.equity },
  contract: { label: "Zlecenie / dzieło", short: "UZ", flow: "active", color: V2.deposit },
  rent: { label: "Najem", short: "NAJ", flow: "passive", color: V2.gold },
  dividend: { label: "Dywidendy", short: "DYW", flow: "passive", color: V2.profit },
  interest: { label: "Odsetki / kupony", short: "ODS", flow: "passive", color: V2.bonds },
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_META) as IncomeCategory[];

const DEMO_ENTRIES: IncomeEntry[] = [
  { id: "job-1", date: "2026-04-10", category: "job", name: "Wynagrodzenie · kwiecień", amount: 8900, currency: "PLN", source: "local" },
  { id: "b2b-1", date: "2026-04-25", category: "business", name: "FV 2026/04 · NorthGate", amount: 9200, currency: "PLN", source: "local" },
  { id: "rent-1", date: "2026-04-30", category: "rent", name: "Mieszkanie · Wola", amount: 1800, currency: "PLN", source: "local" },
  { id: "contract-1", date: "2026-03-28", category: "contract", name: "Wykład · konferencja", amount: 1800, currency: "PLN", source: "local" },
];

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", { month: "short" });
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

function MonthlyBars({ entries }: { entries: IncomeEntry[] }) {
  const months = useMemo(() => {
    const now = new Date("2026-05-01T00:00:00.000Z");
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now);
      date.setMonth(now.getMonth() - (11 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, label: date.toLocaleDateString("pl-PL", { month: "short" }) };
    });
  }, []);

  const totals = months.map((month) => {
    const active = entries
      .filter((entry) => entry.date.startsWith(month.key) && CATEGORY_META[entry.category].flow === "active")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const passive = entries
      .filter((entry) => entry.date.startsWith(month.key) && CATEGORY_META[entry.category].flow === "passive")
      .reduce((sum, entry) => sum + entry.amount, 0);
    return { ...month, active, passive, total: active + passive };
  });
  const max = Math.max(...totals.map((item) => item.total), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2%", height: 210 }}>
      {totals.map((item) => {
        const height = Math.max(2, (item.total / max) * 170);
        const activeHeight = item.total ? (item.active / item.total) * height : 0;
        const passiveHeight = item.total ? (item.passive / item.total) * height : 0;
        return (
          <div key={item.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div style={{ fontFamily: V2_TYPE.mono, fontSize: 9.5, fontWeight: 600, color: item.total ? V2.ink : V2.subtle, height: 12 }}>
              {item.total ? `${(item.total / 1000).toFixed(1)}k` : ""}
            </div>
            <div style={{ width: "100%", maxWidth: 34, display: "flex", flexDirection: "column", justifyContent: "flex-end", height }}>
              {passiveHeight > 0 && <div style={{ height: passiveHeight, background: V2.gold, borderRadius: "3px 3px 0 0" }} />}
              {activeHeight > 0 && <div style={{ height: activeHeight, background: V2.brand, borderRadius: passiveHeight ? "0 0 3px 3px" : 3 }} />}
            </div>
            <div style={{ fontSize: 9.5, color: V2.subtle }}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function EarningsPage() {
  const records = useSyncStore((s) => s.records);
  const transactions = useMemo(() => (records ? buildTransactionList(records) : []), [records]);
  const isMobile = useMedia("(max-width: 720px)");
  const isTablet = useMedia("(max-width: 1060px)");
  const [localEntries, setLocalEntries] = useState<IncomeEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "passive">("all");
  const [category, setCategory] = useState<"all" | IncomeCategory>("all");
  const [draft, setDraft] = useState({ category: "job" as IncomeCategory, name: "", amount: "", date: "2026-05-01", currency: "PLN" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("investor-web.v2-earnings");
      if (saved) setLocalEntries(JSON.parse(saved) as IncomeEntry[]);
    } catch {
      setLocalEntries([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("investor-web.v2-earnings", JSON.stringify(localEntries));
    } catch {}
  }, [localEntries]);

  const passiveFromTransactions = useMemo<IncomeEntry[]>(
    () =>
      transactions
        .filter((tx) => ["dividend", "interest", "bondCoupon"].includes(tx.transactionType))
        .map((tx) => ({
          id: tx.id,
          date: tx.date,
          category: tx.transactionType === "dividend" ? "dividend" : "interest",
          name: tx.instrumentName ?? tx.instrumentSymbol ?? tx.transactionType,
          amount: tx.grossAmount,
          currency: tx.currency,
          source: "transaction" as const,
        })),
    [transactions],
  );

  const syncedEntries = [...localEntries, ...passiveFromTransactions];
  const entries = records && syncedEntries.length > 0 ? syncedEntries : [...localEntries, ...DEMO_ENTRIES];
  const filtered = entries.filter((entry) => {
    if (filter !== "all" && CATEGORY_META[entry.category].flow !== filter) return false;
    if (category !== "all" && entry.category !== category) return false;
    return true;
  });

  const activeTotal = entries.filter((entry) => CATEGORY_META[entry.category].flow === "active").reduce((sum, entry) => sum + entry.amount, 0);
  const passiveTotal = entries.filter((entry) => CATEGORY_META[entry.category].flow === "passive").reduce((sum, entry) => sum + entry.amount, 0);
  const total = activeTotal + passiveTotal;
  const avg = Math.round(total / 12);
  const categoryTotals = CATEGORY_OPTIONS.map((key) => ({
    key,
    amount: entries.filter((entry) => entry.category === key).reduce((sum, entry) => sum + entry.amount, 0),
  })).filter((item) => item.amount > 0);
  const maxCategory = Math.max(...categoryTotals.map((item) => item.amount), 1);

  function addEntry() {
    const amount = Number(draft.amount);
    if (!draft.name.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setLocalEntries((current) => [
      {
        id: crypto.randomUUID(),
        date: draft.date,
        category: draft.category,
        name: draft.name.trim(),
        amount,
        currency: draft.currency,
        source: "local",
      },
      ...current,
    ]);
    setDraft((current) => ({ ...current, name: "", amount: "" }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <V2ScreenHead
        eyebrow="Analiza"
        title="Zarobki"
        sub="Praca, działalność, najem, dywidendy i odsetki w jednym widoku"
      />

      <V2Card glass pad={0} style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(280px, 380px) 1fr" }}>
          <div style={{ padding: isMobile ? "24px 24px 18px" : "30px 30px 26px", borderRight: isTablet ? "none" : `0.5px solid ${V2.line}`, borderBottom: isTablet ? `0.5px solid ${V2.line}` : "none" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: V2.subtle }}>Dochód netto · 12 mies.</div>
            <div style={{ fontFamily: V2_TYPE.serif, fontWeight: 500, fontSize: 60, lineHeight: 0.98, letterSpacing: "-.015em", color: V2.ink, marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
              {fmt(total)}
              <span style={{ fontSize: 24, fontStyle: "italic", color: V2.subtle, marginLeft: 8 }}>PLN</span>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 22, flexWrap: "wrap" }}>
              <V2Kpi label="Aktywny" value={`+${fmt(activeTotal)} zł`} accent={V2.brand} sub="praca i działalność" />
              <V2Kpi label="Pasywny" value={`+${fmt(passiveTotal)} zł`} accent={V2.gold} sub="kapitał i najem" />
              <V2Kpi label="Śr. miesięcznie" value={`${fmt(avg)} zł`} />
            </div>
          </div>
          <div style={{ padding: isMobile ? "18px 20px 16px" : "22px 26px 18px", background: v2Mix(V2.card2, 0.4), minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: V2.subtle }}>Miesięcznie</div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: V2.muted }}>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: V2.brand, marginRight: 6 }} />Aktywny</span>
                <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: V2.gold, marginRight: 6 }} />Pasywny</span>
              </div>
            </div>
            <MonthlyBars entries={entries} />
          </div>
        </div>
      </V2Card>

      <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: 14 }}>
        <V2Card>
          <div style={{ fontFamily: V2_TYPE.serif, fontSize: 19, fontWeight: 500, marginBottom: 16 }}>Struktura źródeł</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {categoryTotals.map((item) => {
              const meta = CATEGORY_META[item.key];
              return (
                <div key={item.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <V2Badge label={meta.short} color={meta.color} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{meta.label}</span>
                    <span style={{ fontFamily: V2_TYPE.mono, fontSize: 12, color: V2.ink }}>{fmt(item.amount)} zł</span>
                  </div>
                  <div style={{ marginTop: 7, height: 7, borderRadius: 4, background: v2Mix(V2.ink, 0.06), overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(item.amount / maxCategory) * 100}%`, background: meta.color, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </V2Card>

        <V2Card>
          <div style={{ fontFamily: V2_TYPE.serif, fontSize: 19, fontWeight: 500, marginBottom: 14 }}>Dodaj wpływ</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as IncomeCategory }))} style={{ ...v2SelectStyle, gridColumn: "1 / -1" }}>
              {CATEGORY_OPTIONS.map((key) => <option key={key} value={key}>{CATEGORY_META[key].label}</option>)}
            </select>
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Źródło dochodu" style={{ ...v2InputStyle, paddingLeft: 12, gridColumn: "1 / -1" }} />
            <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} style={{ ...v2InputStyle, paddingLeft: 12 }} />
            <input type="number" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="Kwota netto" style={{ ...v2InputStyle, paddingLeft: 12 }} />
          </div>
          <V2Button onClick={addEntry} style={{ width: "100%", marginTop: 12 }}>Zaksięguj wpływ</V2Button>
        </V2Card>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["all", "active", "passive"] as const).map((item) => (
          <button key={item} onClick={() => setFilter(item)} style={{ padding: "7px 13px", borderRadius: 9, border: `0.5px solid ${filter === item ? "transparent" : V2.line}`, background: filter === item ? V2.ink : V2.card, color: filter === item ? V2.card : V2.muted, fontSize: 12.5, fontWeight: filter === item ? 700 : 500, cursor: "pointer" }}>
            {item === "all" ? "Wszystkie" : item === "active" ? "Aktywne" : "Pasywne"}
          </button>
        ))}
        <select value={category} onChange={(event) => setCategory(event.target.value as "all" | IncomeCategory)} style={v2SelectStyle}>
          <option value="all">Wszystkie kategorie</option>
          {CATEGORY_OPTIONS.map((key) => <option key={key} value={key}>{CATEGORY_META[key].label}</option>)}
        </select>
      </div>

      <V2Card pad={0}>
        {filtered.sort((a, b) => b.date.localeCompare(a.date)).map((entry, index) => {
          const meta = CATEGORY_META[entry.category];
          return (
            <div key={entry.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "auto minmax(0, 1fr)" : "auto minmax(0, 1fr) auto auto", alignItems: "center", gap: 12, padding: "13px 22px", borderTop: index ? `0.5px solid ${V2.line2}` : "none" }}>
              <V2Badge label={meta.short} color={meta.color} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.name}</div>
                <div style={{ fontFamily: V2_TYPE.mono, fontSize: 11, color: V2.subtle, marginTop: 1 }}>{fmtDate(entry.date)} · {meta.label}</div>
              </div>
              <div style={{ fontFamily: V2_TYPE.serif, fontSize: 17, fontWeight: 500, color: meta.color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", gridColumn: isMobile ? "2" : undefined }}>+{fmt(entry.amount)} {entry.currency}</div>
              {!isMobile && <div style={{ fontFamily: V2_TYPE.mono, fontSize: 10.5, color: V2.subtle }}>{monthLabel(entry.date)}</div>}
            </div>
          );
        })}
      </V2Card>
    </div>
  );
}
