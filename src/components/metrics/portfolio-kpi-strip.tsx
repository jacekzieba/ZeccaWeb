"use client";

import type { SectionSize } from "@/components/customize/section-customization";
import type { CashflowSummary, PortfolioMetrics } from "@/domain/models/investor-data";
import { V2 } from "@/lib/v2-design";
import { currencyLabel } from "@/lib/money";
import { MetricTiles } from "@/components/layout/metric-tiles";

function fmt(n: number, d = 0) {
  return n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtSigned(n: number, d = 0) {
  return `${n >= 0 ? "+" : ""}${fmt(n, d)}`;
}
function fmtPct(n: number, d = 2) {
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("pl-PL", { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}

export type KpiTileId =
  | "kpiUnrealized"
  | "kpiXirr"
  | "kpiTwr"
  | "kpiCagr"
  | "kpiRealReturn"
  | "kpiMaxDd"
  | "kpiRealized"
  | "kpiInvested"
  | "kpiDividends"
  | "kpiOpenPositions";

/** Metadata for each KPI tile — used to register them as individually
 * toggleable dashboard sections. */
export const KPI_TILE_META: { id: KpiTileId; label: string; desc: string; sizePresets: SectionSize[] }[] = [
  { id: "kpiUnrealized", label: "Zysk niezrealizowany", desc: "Wartość ponad zainwestowany kapitał.", sizePresets: [{ width: 1 }] },
  { id: "kpiXirr", label: "MWR · XIRR", desc: "Roczny zwrot ważony kapitałem.", sizePresets: [{ width: 1 }] },
  { id: "kpiTwr", label: "Zwrot (TWR)", desc: "Zwrot całkowity, bez wpłat.", sizePresets: [{ width: 1 }] },
  { id: "kpiCagr", label: "CAGR", desc: "Annualizowany zwrot ważony czasem.", sizePresets: [{ width: 1 }] },
  { id: "kpiRealReturn", label: "Wynik realny", desc: "Roczny zwrot po inflacji.", sizePresets: [{ width: 1 }] },
  { id: "kpiMaxDd", label: "Maks. obsunięcie", desc: "Największy spadek od szczytu.", sizePresets: [{ width: 1 }] },
  { id: "kpiRealized", label: "Zysk zrealizowany", desc: "Wynik z zamkniętych pozycji.", sizePresets: [{ width: 1 }] },
  { id: "kpiInvested", label: "Zainwestowany kapitał", desc: "Wpłaty netto.", sizePresets: [{ width: 1 }] },
  { id: "kpiDividends", label: "Dywidendy", desc: "Suma otrzymanych dywidend.", sizePresets: [{ width: 1 }] },
  { id: "kpiOpenPositions", label: "Otwarte pozycje", desc: "Liczba aktywnych pozycji.", sizePresets: [{ width: 1 }] },
];

export const KPI_HELP_HREFS: Partial<Record<KpiTileId, string>> = {
  kpiUnrealized: "/faq#metryki-zysk",
  kpiXirr: "/faq#metryki-xirr",
  kpiTwr: "/faq#metryki-twr",
  kpiCagr: "/faq#metryki-cagr",
  kpiRealReturn: "/faq#metryki-wynik-realny",
  kpiMaxDd: "/faq#metryki-obsuniecie",
  kpiRealized: "/faq#metryki-zysk",
  kpiInvested: "/faq#metryki-wartosc-vs-wplaty",
};

export type KpiTile = {
  id: KpiTileId;
  label: string;
  value: string;
  sub?: string;
  color: string;
  helpHref?: string;
  /** Jeden wyróżniony wskaźnik na rejestr — patrz komentarz w getKpiTiles. */
  featured?: boolean;
};

export type PortfolioKpiInput = {
  metrics: PortfolioMetrics;
  cashflows: CashflowSummary;
  totalValue: number;
  openPositions: number;
  currency: string;
};

/** Computes every KPI tile from values the snapshot already produces. Single
 * source of truth for the Portfel strip and the per-tile Dashboard sections. */
export function getKpiTiles(input: PortfolioKpiInput): KpiTile[] {
  const { metrics, cashflows, openPositions, currency } = input;
  const xirr = metrics.xirrPct;
  // Wcześniej każda liczba ≥0 była na zielono — osiem kafelków tym samym
  // odcieniem obok siebie nie różniło się niczym poza treścią etykiety, a sam
  // kolor przestawał cokolwiek wyróżniać (zob. dashboard: sync-status dot był
  // tym samym zielonym tokenem z zupełnie innego powodu). Jeden wskaźnik —
  // MWR/XIRR, "jak faktycznie pracowały Twoje pieniądze" — zostaje kolorowy
  // i wyróżniony (featured); reszta przechodzi na neutralny ink, znak +/-
  // w tekście nadal mówi, w którą stronę. Obsunięcie zostaje czerwone celowo:
  // to sygnał ryzyka, nie rutynowy wynik, warto żeby się wybijał.
  const tiles: KpiTile[] = [
    { id: "kpiUnrealized", label: "Zysk niezrealizowany", value: `${fmtSigned(metrics.unrealizedPnl)} ${currencyLabel(currency)}`, sub: `${fmtPct(metrics.unrealizedPnlPct)} od zakupu`, color: V2.ink },
    { id: "kpiXirr", label: "MWR · XIRR", value: xirr == null ? "—" : fmtPct(xirr), sub: "rocznie", color: (xirr ?? 0) >= 0 ? V2.profit : V2.loss, featured: true },
    { id: "kpiTwr", label: "Zwrot (TWR)", value: fmtPct(metrics.totalReturnPct), sub: "bez wpłat", color: V2.ink },
    { id: "kpiCagr", label: "CAGR", value: fmtPct(metrics.cagrPct), sub: "rocznie, TWR", color: V2.ink },
    { id: "kpiRealReturn", label: "Wynik realny", value: fmtPct(metrics.realReturnPct), sub: "rocznie, po inflacji", color: V2.ink },
    { id: "kpiMaxDd", label: "Maks. obsunięcie", value: `${fmt(metrics.maxDrawdownPct, 2)}%`, sub: "od szczytu", color: V2.loss },
    { id: "kpiRealized", label: "Zysk zrealizowany", value: `${fmtSigned(metrics.realizedPnl)} ${currencyLabel(currency)}`, sub: "zamknięte pozycje", color: V2.ink },
    { id: "kpiInvested", label: "Zainwestowany kapitał", value: `${fmt(metrics.netInvested)} ${currencyLabel(currency)}`, color: V2.ink },
    { id: "kpiDividends", label: "Dywidendy", value: `+${fmt(cashflows.dividends)} ${currencyLabel(currency)}`, color: V2.ink },
    { id: "kpiOpenPositions", label: "Otwarte pozycje", value: String(openPositions), color: V2.ink },
  ];

  return tiles.map((tile) => ({ ...tile, helpHref: KPI_HELP_HREFS[tile.id] }));
}

/* ── Rejestr KPI na szynie ───────────────────────────────────────────────────
   Kierunek „Próba": każda liczba ma źródło, jednostkę i moment sprawdzenia.
   Na szynie stoją wyłącznie rzeczy weryfikowalne — nigdy hasło marketingowe.
   Słownik cech jest ten sam co w rejestrze na landingu, żeby strona i produkt
   mówiły o liczbach tym samym językiem.
   Specyfikacja: docs/superpowers/specs/2026-08-05-design-system-proba-design.md */

export const KPI_MARKS: Record<KpiTileId, { source: string; detail: string }> = {
  kpiUnrealized: { source: "FIFO", detail: "wg kosztu nabycia" },
  kpiXirr: { source: "Liczone lokalnie", detail: "na Twoim urządzeniu" },
  kpiTwr: { source: "Liczone lokalnie", detail: "bez wpłat" },
  kpiCagr: { source: "Liczone lokalnie", detail: "rocznie, TWR" },
  kpiRealReturn: { source: "Inflacja GUS", detail: "wskaźnik CPI" },
  kpiMaxDd: { source: "Seria wycen", detail: "od szczytu" },
  kpiRealized: { source: "FIFO", detail: "zamknięte pozycje" },
  kpiInvested: { source: "Transakcje", detail: "od pierwszej wpłaty" },
  kpiDividends: { source: "Transakcje", detail: "wpływy z dywidend" },
  kpiOpenPositions: { source: "Pozycje", detail: "liczba obserwacji" },
};

/** Wskaźniki jako kafelki z cechą źródła.
 *
 * Wcześniej stały w rejestrze wierszy na szynie — przy dziesięciu pozycjach
 * czytało się to jak jedna bryła. Cecha przenosi się do kafelka i stoi nad nazwą
 * wskaźnika: reguła „każda liczba ma źródło" zostaje, zmienia się nośnik. */
export function KpiRegister({ tiles }: { tiles: KpiTile[] }) {
  if (!tiles.length) return null;
  return (
    <MetricTiles
      rows={tiles.map((tile) => ({
        key: tile.id,
        source: KPI_MARKS[tile.id].source,
        detail: KPI_MARKS[tile.id].detail,
        label: tile.label,
        value: tile.value,
        color: tile.color,
        sub: tile.sub,
        helpHref: tile.helpHref,
        featured: tile.featured,
      }))}
    />
  );
}
