"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { buildInstrumentList, buildTransactionList } from "@/sync/records/investor-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";
import { TYPOGRAPHY } from "@/lib/design-tokens";
import { V2, v2Mix } from "@/lib/v2-design";
import { transactionLabel } from "@/lib/transaction-labels";

const UI = TYPOGRAPHY.system;
const MONO = TYPOGRAPHY.mono;
const SERIF = TYPOGRAPHY.serif;

type SearchResult = {
  id: string;
  kind: "instrument" | "transaction" | "portfolio" | "page";
  title: string;
  subtitle: string;
  href: Route;
  tag: string;
};

const PAGES: SearchResult[] = [
  { id: "p-dashboard", kind: "page", title: "Dashboard", subtitle: "Przegląd portfela", href: "/dashboard", tag: "Strona" },
  { id: "p-portfolios", kind: "page", title: "Wszystkie portfele", subtitle: "Lista kont", href: "/portfolios", tag: "Strona" },
  { id: "p-transactions", kind: "page", title: "Transakcje", subtitle: "Historia operacji", href: "/transactions", tag: "Strona" },
  { id: "p-instruments", kind: "page", title: "Instrumenty", subtitle: "Posiadane aktywa", href: "/instruments", tag: "Strona" },
  { id: "p-earnings", kind: "page", title: "Zarobki", subtitle: "Przychody i obciążenia", href: "/earnings", tag: "Strona" },
  { id: "p-benchmark", kind: "page", title: "Porównanie", subtitle: "Punkt odniesienia", href: "/benchmark", tag: "Strona" },
  { id: "p-reports", kind: "page", title: "Raporty", subtitle: "Zestawienia", href: "/reports", tag: "Strona" },
  { id: "p-faq", kind: "page", title: "FAQ", subtitle: "Metryki i przykłady", href: "/faq", tag: "Pomoc" },
  { id: "p-settings", kind: "page", title: "Ustawienia", subtitle: "Konfiguracja", href: "/settings", tag: "Strona" },
];

function tagColor(kind: SearchResult["kind"]) {
  switch (kind) {
    case "instrument":
      return V2.equity;
    case "transaction":
      return V2.bonds;
    case "portfolio":
      return V2.brand;
    default:
      return V2.subtle;
  }
}

/** Porównanie bez znaków diakrytycznych i bez wielkości liter.
 *  Wcześniej wpisanie poprawnego „wpłata" nie znajdowało nic, bo indeks trzymał
 *  „Wpłata" — a proste `indexOf` po `toLowerCase()` nie składa polskich znaków. */
function zloz(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/gi, "l").toLowerCase();
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const records = useSyncStore((s) => s.records);
  const snapshot = useSyncStore((s) => s.snapshot);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [...PAGES];

    for (const portfolio of snapshot?.portfolios ?? []) {
      items.push({
        id: `pf-${portfolio.id}`,
        kind: "portfolio",
        title: portfolio.name,
        subtitle: `${portfolio.positions} pozycji · ${portfolio.baseCurrency}`,
        href: `/portfolios/${portfolio.id}` as Route,
        tag: "Portfel",
      });
    }

    if (records) {
      for (const instrument of buildInstrumentList(records)) {
        items.push({
          id: `in-${instrument.id}`,
          kind: "instrument",
          title: instrument.symbol || instrument.name,
          subtitle: instrument.name,
          href: "/instruments",
          tag: "Instrument",
        });
      }
      for (const transaction of buildTransactionList(records).slice(0, 200)) {
        // Typ wchodzi do indeksu po polsku i jest widoczny w podtytule — inaczej
        // wpisanie „wpłata" nie znajdowało nic, a wynik nazywał się `cashDeposit`.
        const rodzaj = transactionLabel(transaction.transactionType);
        const label = transaction.instrumentSymbol ?? transaction.instrumentName ?? rodzaj;
        // Gdy transakcja nie ma instrumentu, tytułem JEST jej rodzaj — wtedy nie
        // powtarzamy go w podtytule.
        const czolo = label === rodzaj ? "" : `${rodzaj} · `;
        items.push({
          id: `tx-${transaction.id}`,
          kind: "transaction",
          title: `${label}`,
          subtitle: `${czolo}${transaction.date.slice(0, 10)} · ${transaction.portfolioName}`,
          href: "/transactions",
          tag: "Transakcja",
        });
      }
    }

    return items;
  }, [records, snapshot]);

  const results = useMemo(() => {
    const q = zloz(query.trim());
    if (!q) return index.filter((item) => item.kind === "page" || item.kind === "portfolio").slice(0, 8);
    const scored = index
      .map((item) => {
        const haystack = zloz(`${item.title} ${item.subtitle} ${item.tag}`);
        const idx = haystack.indexOf(q);
        return idx === -1 ? null : { item, score: idx };
      })
      .filter((entry): entry is { item: SearchResult; score: number } => entry !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 12);
    return scored.map((entry) => entry.item);
  }, [index, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      // Po zamknięciu ognisko wracało na <body>, więc klawiatura lądowała na
      // początku dokumentu zamiast tam, skąd paleta została otwarta.
      return () => {
        window.clearTimeout(id);
        returnFocusRef.current?.focus?.();
      };
    }
  }, [open]);

  if (!open) return null;

  const go = (item: SearchResult | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: v2Mix(V2.ink, 0.32),
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Szukaj w Zecce"
        style={{
          width: "min(560px, 92vw)",
          background: V2.card,
          borderRadius: 16,
          border: `0.5px solid ${V2.spec}`,
          boxShadow: `0 24px 60px ${v2Mix(V2.ink, 0.28)}`,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `0.5px solid ${V2.line}` }}>
          <span style={{ fontSize: 15, color: V2.subtle }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            aria-label="Szukaj instrumentu, transakcji lub portfela"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="paleta-wyniki"
            aria-activedescendant={results.length > 0 ? `paleta-wynik-${active}` : undefined}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[active]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Szukaj instrumentu, transakcji, portfela…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: UI,
              fontSize: 15,
              color: V2.ink,
            }}
          />
          <span style={{ fontFamily: MONO, fontSize: 10, color: V2.subtle, padding: "2px 6px", borderRadius: 4, background: v2Mix(V2.ink, 0.05) }}>ESC</span>
        </div>

        {/* Strzałki przesuwały wyłącznie podświetlenie w stanie Reacta — czytnik
            ekranu nie wiedział, na czym stoi kursor, a Enter przenosił tam, gdzie
            użytkownik nigdy nie został zaprowadzony. */}
        <div
          id="paleta-wyniki"
          role="listbox"
          aria-label="Wyniki wyszukiwania"
          style={{ maxHeight: "52vh", overflowY: "auto", padding: 6 }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "26px 16px", textAlign: "center", color: V2.subtle, fontFamily: UI, fontSize: 13 }}>
              Brak wyników dla „{query}”.
            </div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                id={`paleta-wynik-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: i === active ? v2Mix(V2.brand, 0.1) : "transparent",
                  fontFamily: UI,
                }}
              >
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: ".04em",
                    textTransform: "uppercase",
                    color: tagColor(item.kind),
                    background: v2Mix(tagColor(item.kind), 0.13),
                    padding: "3px 7px",
                    borderRadius: 5,
                    flexShrink: 0,
                    width: 78,
                    textAlign: "center",
                  }}
                >
                  {item.tag}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: V2.ink, fontFamily: SERIF, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.title}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: V2.subtle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.subtitle}
                  </span>
                </span>
                <span style={{ fontSize: 13, color: V2.subtle, flexShrink: 0 }}>↵</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
