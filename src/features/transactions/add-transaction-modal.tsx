"use client";

import { createPortal } from "react-dom";
import { useState, useEffect, useMemo, useRef, useId, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Bitcoin,
  Briefcase,
  Building2,
  CircleDollarSign,
  FilePenLine,
  FileText,
  Landmark,
  LineChart,
  Lock,
  Percent,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSyncStore } from "@/sync/store/sync-store";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import {
  getTelemetryService,
  TelemetryEvent,
  telemetrySnakeCased,
} from "@/lib/telemetry";
import {
  makeTransactionPayload,
  swiftReferenceSeconds,
} from "@/sync/records/macos-payloads";
import { buildInvestorDataSnapshot, buildPortfolioDetail } from "@/sync/records/investor-snapshot";
import { isFakeSyncEnabled } from "@/lib/env";
import { TYPOGRAPHY } from "@/lib/design-tokens";
import { parseAmount } from "@/lib/parse-amount";
import { V2, v2Mix } from "@/lib/v2-design";
import {
  InstrumentEditorModal,
  type SavedInstrumentDraft,
} from "@/features/instruments/instrument-editor-modal";
import {
  showsTaxField as showsTaxFieldRule,
  showsFXSettlement as showsFXSettlementRule,
  fxRateToBaseForSave,
} from "./transaction-rules";

// Fetches the NBP Table A mid rate (PLN per 1 unit of `code`) on `date`. The
// API applies forward-fill server-side (latest published fixing on/before the
// date), matching the native `resolveFXRate` forward-fill. Returns `null` when
// unavailable (offline / no data) so the caller can fall back to manual entry.
async function fetchNbpRateForDate(code: string, date: string): Promise<number | null> {
  try {
    const response = await fetch(
      `/api/market-data/fx?code=${encodeURIComponent(code)}&date=${encodeURIComponent(date)}`,
    );
    const body = await response.json();
    if (!response.ok) return null;
    const rate = (body?.data as { rate?: number } | undefined)?.rate;
    return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

const INK = V2.ink;
const MUTED = v2Mix(V2.ink, 0.58);
const SUBTLE = v2Mix(V2.ink, 0.4);
const LINE_SOFT = V2.line2;
const LOSS = V2.loss;
const AMBER = V2.gold;
const PAPER = V2.card;
const SERIF = TYPOGRAPHY.serif;

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

// Which instrument kinds are valid for each transaction type. `null` = no
// instrument picker. This drives the smart filtering (issues 20–23):
//  · dywidenda → tylko akcje/ETF
//  · kupon/wykup obligacji → tylko obligacje
//  · otwarcie/zamknięcie lokaty → tylko lokaty
const TX_TYPES = [
  { value: "buy",               label: "Zakup",                group: "instruments", tone: V2.equity,  icon: ShoppingCart,      needsInstrument: true,  needsQty: true,  kinds: ["stock", "etf", "treasuryBond", "listedBond", "crypto"], heldOnly: false },
  { value: "sell",              label: "Sprzedaż",             group: "instruments", tone: V2.loss,    icon: ShoppingCart,      needsInstrument: true,  needsQty: true,  kinds: ["stock", "etf", "treasuryBond", "listedBond", "crypto"], heldOnly: true  },
  { value: "dividend",          label: "Dywidenda",            group: "income",      tone: V2.profit,  icon: CircleDollarSign, needsInstrument: true,  needsQty: false, kinds: ["stock", "etf"], heldOnly: false },
  { value: "interest",          label: "Odsetki",              group: "income",      tone: V2.gold,    icon: Percent,          needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "bondCoupon",        label: "Kupon obligacji",      group: "income",      tone: V2.bonds,   icon: ReceiptText,      needsInstrument: true,  needsQty: false, kinds: ["treasuryBond", "listedBond"], heldOnly: true  },
  { value: "bondRedemption",    label: "Wykup obligacji",      group: "income",      tone: V2.bonds,   icon: ReceiptText,      needsInstrument: true,  needsQty: true,  kinds: ["treasuryBond", "listedBond"], heldOnly: true  },
  { value: "depositOpen",       label: "Otwarcie lokaty",      group: "deposits",    tone: V2.deposit, icon: Landmark,         needsInstrument: true,  needsQty: false, kinds: ["deposit"], heldOnly: false },
  { value: "depositClose",      label: "Zamknięcie lokaty",    group: "deposits",    tone: V2.deposit, icon: Lock,             needsInstrument: true,  needsQty: false, kinds: ["deposit"], heldOnly: true  },
  { value: "cashDeposit",       label: "Wpłata gotówki",       group: "transfers",   tone: V2.profit,  icon: Banknote,         needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "cashWithdrawal",    label: "Wypłata gotówki",      group: "transfers",   tone: V2.loss,    icon: Banknote,         needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "fxConversion",      label: "Przewalutowanie",      group: "transfers",   tone: V2.cash,    icon: ArrowLeftRight,   needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "accountTransferIn", label: "Transfer między portfelami", group: "transfers", tone: V2.equity, icon: ArrowLeftRight, needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "transferIn",        label: "Transfer instrumentu IN", group: "transfers", tone: V2.profit, icon: Briefcase,        needsInstrument: true,  needsQty: true,  kinds: ["stock", "etf", "treasuryBond", "listedBond", "crypto"], heldOnly: false },
  { value: "fee",               label: "Opłata",               group: "other",       tone: V2.loss,    icon: ReceiptText,      needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "tax",               label: "Podatek",              group: "other",       tone: V2.loss,    icon: Percent,          needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
  { value: "correction",        label: "Korekta gotówki",      group: "other",       tone: V2.subtle,  icon: FilePenLine,      needsInstrument: false, needsQty: false, kinds: null, heldOnly: false },
] as const;

const CURRENCIES = ["PLN", "USD", "EUR", "GBP", "CHF", "CZK"];

type TxTypeValue = (typeof TX_TYPES)[number]["value"];
type TxGroup = (typeof TX_TYPES)[number]["group"];

const TX_GROUPS: Array<{ key: TxGroup; label: string }> = [
  { key: "instruments", label: "Instrumenty" },
  { key: "income", label: "Dochody" },
  { key: "deposits", label: "Lokaty" },
  { key: "transfers", label: "Transfery" },
  { key: "other", label: "Pozostałe" },
];

const ASSET_CLASSES = [
  { key: "etf", label: "ETF", kinds: ["etf"], icon: LineChart, tone: V2.equity },
  { key: "stock", label: "Akcje", kinds: ["stock"], icon: LineChart, tone: V2.equity },
  { key: "bond", label: "Obligacje", kinds: ["treasuryBond", "listedBond"], icon: FileText, tone: V2.bonds },
  { key: "crypto", label: "Kryptowaluta", kinds: ["crypto"], icon: Bitcoin, tone: "#7A55A4" },
  { key: "deposit", label: "Lokata", kinds: ["deposit"], icon: Landmark, tone: V2.deposit },
  { key: "other", label: "Inne aktywa", kinds: ["other"], icon: Building2, tone: V2.cash },
] as const;

function swiftDateToMs(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return APPLE_REFERENCE_DATE_UNIX_MS + value * 1000;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

// ── Styles ───────────────────────────────────────────────────────
const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 10.5,
  fontWeight: 700,
  color: SUBTLE,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  marginBottom: 5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  // Longhand so `selectStyle` (and other spreads) can override paddingLeft
  // without mixing shorthand + longhand (React warns about that on rerender).
  paddingTop: 9,
  paddingRight: 12,
  paddingBottom: 9,
  paddingLeft: 12,
  borderRadius: 9,
  border: "0.5px solid rgba(22,29,24,0.14)",
  background: PAPER,
  fontSize: 13,
  color: INK,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 3px rgba(22,29,24,0.05)",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  cursor: "pointer",
};

function Field({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  // Composite fields (more than one control, e.g. a select next to a button)
  // pass an explicit htmlFor and put a matching id on their primary control.
  // Single-control fields omit it and get an implicit association by wrapping
  // the control in the <label> — interactive content must not be nested in a
  // label, so those cases use htmlFor instead.
  htmlFor?: string;
}) {
  if (htmlFor) {
    return (
      <div>
        <label htmlFor={htmlFor} style={labelStyle}>{label}</label>
        {children}
      </div>
    );
  }
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

const DECIMAL_HINT_KEY = "zecca-web-decimal-hint-seen";

/**
 * One-time hint that Polish amounts use a comma as the decimal separator.
 * Shown once per browser (remembered in localStorage), then dismissed for good.
 */
function DecimalSeparatorHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DECIMAL_HINT_KEY) !== "1") setVisible(true);
    } catch {
      // localStorage unavailable — skip the hint rather than fail.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DECIMAL_HINT_KEY, "1");
    } catch {
      // Ignore: the hint just won't be remembered.
    }
    setVisible(false);
  };

  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        border: `0.5px solid ${LINE_SOFT}`,
        background: v2Mix(V2.card, 0.68),
        borderRadius: 10,
        padding: "9px 12px",
        marginBottom: 12,
        fontSize: 12.5,
        color: MUTED,
        lineHeight: 1.4,
      }}
    >
      <span style={{ flex: 1 }}>
        Wskazówka: kwoty i liczby zapisuj z <strong>przecinkiem</strong> jako
        separatorem dziesiętnym (np. 1234,56). Nie używaj separatora tysięcy.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Zamknij wskazówkę"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: SUBTLE,
          fontSize: 16,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function IconBadge({
  icon: Icon,
  color,
  selected = false,
}: {
  icon: LucideIcon;
  color: string;
  selected?: boolean;
}) {
  return (
    <span
      style={{
        width: selected ? 36 : 31,
        height: selected ? 36 : 31,
        borderRadius: 9,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        background: v2Mix(color, selected ? 0.18 : 0.12),
        boxShadow: selected ? `inset 0 0 0 0.5px ${v2Mix(color, 0.16)}` : "none",
        flex: "0 0 auto",
      }}
    >
      <Icon size={selected ? 19 : 16} strokeWidth={2.15} />
    </span>
  );
}

export type TransactionEditorDraft = {
  id: string;
  date: string;
  portfolioId: string;
  instrumentId: string | null;
  transactionType: string;
  quantity: number | null;
  price: number | null;
  grossAmount: number;
  currency: string;
  fees: number;
  taxes: number;
  fxRateToBase?: number | null;
  targetCurrency?: string | null;
  targetGrossAmount?: number | null;
  notes?: string;
  sourcePortfolioId?: string | null;
  transferKind?: string | null;
  contributionTreatment?: string | null;
  updatedAt: string;
};

type InstrumentOption = {
  id: string;
  symbol: string;
  name: string;
  kind: string;
  currency: string;
  maturityMs: number | null;
  issueMs: number | null;
};

export function AddTransactionModal({
  open: controlledOpen,
  initialValue,
  onClose,
}: {
  open?: boolean;
  initialValue?: TransactionEditorDraft | null;
  onClose?: () => void;
}) {
  const globalOpen = useSyncStore((s) => s.addTransactionOpen);
  const close = useSyncStore((s) => s.closeAddTransaction);
  const records = useSyncStore((s) => s.records);
  const userDataKey = useSyncStore((s) => s.userDataKey);
  const supabase = useSyncStore((s) => s.supabase);
  const publicDemo = useSyncStore((s) => s.publicDemo);
  const setSync = useSyncStore((s) => s.setSync);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const open = controlledOpen ?? globalOpen;
  const isEditing = Boolean(initialValue);

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [txType, setTxType] = useState<TxTypeValue>("buy");
  const [portfolioId, setPortfolioId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const instrumentFieldId = useId();
  const [date, setDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [grossAmount, setGrossAmount] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [fees, setFees] = useState("0");
  const [taxes, setTaxes] = useState("0");
  const [assetClass, setAssetClass] = useState("all");
  const [targetCurrency, setTargetCurrency] = useState("USD");
  const [targetGrossAmount, setTargetGrossAmount] = useState("");
  const [fxRateToBase, setFxRateToBase] = useState("");
  const [settleInPLN, setSettleInPLN] = useState(true);
  const [fxRateLoading, setFxRateLoading] = useState(false);
  const [fxRateFetchFailed, setFxRateFetchFailed] = useState(false);
  const [sourcePortfolioId, setSourcePortfolioId] = useState("");
  const [transferKind, setTransferKind] = useState<"cash" | "asset">("cash");
  const [countAsContribution, setCountAsContribution] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instrumentEditorOpen, setInstrumentEditorOpen] = useState(false);
  const [inlineInstrument, setInlineInstrument] = useState<InstrumentOption | null>(null);

  useEffect(() => {
    if (!open) return;

    const nextType = TX_TYPES.some((type) => type.value === initialValue?.transactionType)
      ? (initialValue?.transactionType as TxTypeValue)
      : "buy";
    setTxType(nextType);
    setPortfolioId(initialValue?.portfolioId ?? "");
    setInstrumentId(initialValue?.instrumentId ?? "");
    setDate(initialValue?.date.slice(0, 10) ?? today);
    setQuantity(initialValue?.quantity != null ? String(initialValue.quantity) : "");
    setPrice(initialValue?.price != null ? String(initialValue.price) : "");
    setGrossAmount(initialValue ? String(initialValue.grossAmount) : "");
    setCurrency(initialValue?.currency ?? "PLN");
    setFees(initialValue ? String(initialValue.fees) : "0");
    setTaxes(initialValue ? String(initialValue.taxes) : "0");
    setAssetClass("all");
    setTargetCurrency(initialValue?.targetCurrency ?? "USD");
    setTargetGrossAmount(initialValue?.targetGrossAmount != null ? String(initialValue.targetGrossAmount) : "");
    setFxRateToBase(initialValue?.fxRateToBase != null ? String(initialValue.fxRateToBase) : "");
    // For a foreign buy/sell being edited, PLN settlement is implied by a stored
    // rate; a null rate means it was settled in the foreign currency. New/other
    // transactions default to PLN settlement (native default).
    const editingForeignBuySell =
      Boolean(initialValue) &&
      (initialValue?.transactionType === "buy" || initialValue?.transactionType === "sell") &&
      (initialValue?.currency ?? "PLN").trim().toUpperCase() !== "PLN";
    setSettleInPLN(editingForeignBuySell ? initialValue?.fxRateToBase != null : true);
    setFxRateLoading(false);
    setFxRateFetchFailed(false);
    setSourcePortfolioId(initialValue?.sourcePortfolioId ?? "");
    setTransferKind(initialValue?.transferKind === "asset" ? "asset" : "cash");
    setCountAsContribution(
      initialValue?.contributionTreatment === "countAsContribution",
    );
    setNotes(initialValue?.notes ?? "");
    setSaving(false);
    setError(null);
    setInstrumentEditorOpen(false);
    setInlineInstrument(null);
  }, [initialValue, open, today]);

  // Derive portfolio list from records
  const portfolios = useMemo(() => {
    if (!records) return [];
    const seen = new Map<string, { name: string; accountType: string | null }>();
    for (const r of records) {
      if (r.deletedAt) continue;
      if (r.envelope.type === "account") {
        const p = r.envelope.payload as { id: string; name: string; accountType?: string | null };
        seen.set(p.id, { name: p.name, accountType: p.accountType ?? null });
      }
    }
    return [...seen.entries()].map(([id, value]) => ({ id, name: value.name, accountType: value.accountType }));
  }, [records]);

  const instruments = useMemo<InstrumentOption[]>(() => {
    const seen = new Map<string, InstrumentOption>();
    if (records) {
      for (const r of records) {
        if (r.deletedAt) continue;
        if (r.envelope.type === "asset") {
          const a = r.envelope.payload as {
            id: string;
            symbol: string;
            name: string;
            kind?: string;
            currency?: string;
            bondParams?: { issueDate?: number | string; maturityDate?: number | string } | null;
          };
          seen.set(a.id, {
            id: a.id,
            symbol: a.symbol,
            name: a.name,
            kind: a.kind ?? "stock",
            currency: a.currency ?? "PLN",
            maturityMs: swiftDateToMs(a.bondParams?.maturityDate),
            issueMs: swiftDateToMs(a.bondParams?.issueDate),
          });
        }
      }
    }
    if (inlineInstrument && !seen.has(inlineInstrument.id)) {
      seen.set(inlineInstrument.id, inlineInstrument);
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [inlineInstrument, records]);

  // Set default portfolio when list loads
  useEffect(() => {
    if (portfolios.length > 0 && !portfolioId) {
      setPortfolioId(portfolios[0].id);
    }
  }, [portfolios, portfolioId]);

  const txDef = TX_TYPES.find((t) => t.value === txType) ?? TX_TYPES[0];
  const TxIcon = txDef.icon;

  // Belka-tax visibility and FX-settlement visibility, keyed off the selected
  // portfolio's type and the transaction currency — parity with the native
  // `TransactionEditorLogic` rules.
  const portfolioType = portfolios.find((p) => p.id === portfolioId)?.accountType ?? null;
  const showsTax = showsTaxFieldRule(txType, portfolioType);
  const showsFX = showsFXSettlementRule(txType, currency);

  const assetClassOptions = useMemo(() => {
    if (!txDef.kinds) return [];
    const allowedKinds = new Set<string>(txDef.kinds);
    return ASSET_CLASSES.filter((asset) =>
      asset.kinds.some((kind) => allowedKinds.has(kind)),
    );
  }, [txDef.kinds]);

  const newInstrumentDefaultKind = useMemo(() => {
    if (!txDef.kinds) return "stock";
    const allowedKinds = new Set<string>(txDef.kinds);

    if (assetClass !== "all") {
      const selected = ASSET_CLASSES.find((item) => item.key === assetClass);
      const matchingKind = selected?.kinds.find((kind) => allowedKinds.has(kind));
      if (matchingKind) return matchingKind;
    }

    return txDef.kinds[0] ?? "stock";
  }, [assetClass, txDef.kinds]);

  const newInstrumentDefaultValue = useMemo(
    () => ({
      kind: newInstrumentDefaultKind,
      currency,
    }),
    [currency, newInstrumentDefaultKind],
  );

  useEffect(() => {
    setAssetClass("all");
    setInstrumentId("");
  }, [txType]);

  // Instruments currently held in the selected portfolio (for sell / redemption
  // / deposit-close, where you can only act on something you actually hold).
  const heldInstrumentIds = useMemo(() => {
    if (!records || !portfolioId) return new Set<string>();
    const detail = buildPortfolioDetail(records, portfolioId, {
      asOf: new Date(),
      useLatestTransactionFxRate: true,
      useMarketQuotes: true,
    });
    return new Set((detail?.holdings ?? []).filter((h) => h.quantity > 0).map((h) => h.instrumentId));
  }, [records, portfolioId]);

  // The instrument picker, narrowed to what makes sense for the chosen type.
  const availableInstruments = useMemo<InstrumentOption[]>(() => {
    if (!txDef.needsInstrument || txDef.kinds == null) return instruments;
    const allowed = new Set<string>(txDef.kinds);
    let list = instruments.filter((inst) => allowed.has(inst.kind));

    if (assetClass !== "all") {
      const selected = ASSET_CLASSES.find((item) => item.key === assetClass);
      if (selected) {
        const selectedKinds = new Set<string>(selected.kinds);
        list = list.filter((inst) => selectedKinds.has(inst.kind));
      }
    }

    if (txDef.heldOnly) {
      list = list.filter((inst) => heldInstrumentIds.has(inst.id));
    }

    // Buying bonds: a treasury-bond emission is only open for ~a month, so
    // matured series (and ones whose emission window closed well before the
    // chosen date) can no longer be purchased — hide them (issue 20).
    if (txType === "buy") {
      const dateMs = new Date(date).getTime();
      const EMISSION_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
      list = list.filter((inst) => {
        if (inst.kind !== "treasuryBond" && inst.kind !== "listedBond") return true;
        if (inst.maturityMs != null && inst.maturityMs < dateMs) return false;
        if (inst.issueMs != null && dateMs - inst.issueMs > EMISSION_WINDOW_MS) return false;
        return true;
      });
    }

    return list;
  }, [instruments, txDef, txType, date, heldInstrumentIds, assetClass]);

  // Clear a selection that is no longer valid for the current filter.
  useEffect(() => {
    if (instrumentId && !availableInstruments.some((inst) => inst.id === instrumentId)) {
      setInstrumentId("");
    }
  }, [availableInstruments, instrumentId]);

  function handleInlineInstrumentSaved(instrument: SavedInstrumentDraft) {
    const option: InstrumentOption = {
      id: instrument.id,
      symbol: instrument.symbol,
      name: instrument.name,
      kind: instrument.kind,
      currency: instrument.currency,
      maturityMs: null,
      issueMs: null,
    };
    setInlineInstrument(option);

    if (!txDef.needsInstrument || txDef.kinds == null) {
      return;
    }

    const allowedKinds = new Set<string>(txDef.kinds);
    if (!allowedKinds.has(option.kind)) {
      setError("Dodano instrument, ale jego klasa nie pasuje do wybranego typu transakcji.");
      return;
    }

    if (txDef.heldOnly) {
      setError("Dodano instrument, ale ten typ transakcji wymaga instrumentu już posiadanego w tym portfelu.");
      return;
    }

    if (assetClass !== "all") {
      const selected = ASSET_CLASSES.find((item) => item.key === assetClass);
      const selectedKinds = new Set<string>(selected?.kinds ?? []);
      if (!selectedKinds.has(option.kind)) {
        setAssetClass("all");
      }
    }

    setInstrumentId(option.id);
    if ((txType === "buy" || txType === "sell") && option.currency !== currency) {
      setCurrency(option.currency);
    }
    setError(null);
  }

  // Auto-compute grossAmount from qty * price for buy/sell
  useEffect(() => {
    if (txDef.needsQty && quantity && price) {
      const qty = parseAmount(quantity);
      const unit = parseAmount(price);
      if (qty != null && unit != null) {
        const computed = qty * unit;
        if (Number.isFinite(computed)) setGrossAmount(computed.toFixed(2));
      }
    }
  }, [quantity, price, txDef.needsQty]);

  // When a buy/sell instrument is chosen, align the transaction currency with
  // the instrument's native currency (parity with native
  // `currencyForSelectedInstrument`). This is what makes the FX-settlement
  // block appear for a foreign-denominated instrument.
  useEffect(() => {
    if (txType !== "buy" && txType !== "sell") return;
    if (!instrumentId) return;
    const selected = instruments.find((inst) => inst.id === instrumentId);
    if (selected && selected.currency && selected.currency !== currency) {
      setCurrency(selected.currency);
    }
  }, [instrumentId, instruments, txType, currency]);

  // Reset the tax field to 0 when it becomes hidden (e.g. switching to a
  // non-taxed type). The save boundary independently forces 0 when hidden, so
  // this is only a UI convenience.
  useEffect(() => {
    if (!showsTax) setTaxes("0");
  }, [showsTax]);

  // Auto-fetch the NBP mid rate for the transaction currency on the transaction
  // date when settling in PLN. Race-safe: the cleanup flag discards a response
  // whose currency/date/mode no longer match (a late reply for an old currency
  // must not overwrite the field). `fxSignatureRef` distinguishes a
  // currency/date change (force overwrite) from merely re-showing the block or
  // toggling settlement (soft — keep a manually entered value).
  const fxSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showsFX || !settleInPLN) return;
    const signature = `${currency}|${date}`;
    const currencyOrDateChanged = fxSignatureRef.current !== signature;
    // Soft refresh (block re-shown / toggled back to PLN) must not clobber an
    // existing value; only a currency/date change forces an overwrite.
    if (!currencyOrDateChanged && fxRateToBase.trim() !== "") return;
    fxSignatureRef.current = signature;

    let cancelled = false;
    setFxRateLoading(true);
    setFxRateFetchFailed(false);
    fetchNbpRateForDate(currency, date).then((rate) => {
      if (cancelled) return;
      setFxRateLoading(false);
      if (rate != null) {
        setFxRateToBase(rate.toFixed(4));
      } else {
        setFxRateFetchFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // fxRateToBase is intentionally read but not a dependency — it must not
    // re-trigger the fetch when we write the fetched value back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showsFX, settleInPLN, currency, date]);

  const recentTransactions = useMemo(() => {
    if (!records) return [];
    return records
      .filter((record) => !record.deletedAt && record.envelope.type === "transaction")
      .map((record) => {
        const payload = record.envelope.payload as {
          transactionType: string;
          grossAmount?: number;
          currency?: string;
        };
        const definition = TX_TYPES.find((type) => type.value === payload.transactionType);
        return {
          type: definition?.value ?? null,
          label: definition?.label ?? payload.transactionType,
          amount: payload.grossAmount ?? 0,
          currency: payload.currency ?? "PLN",
          color: definition?.tone ?? V2.subtle,
          updatedAt: record.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 2);
  }, [records]);

  const gross = parseAmount(grossAmount) ?? 0;
  const feeValue = parseAmount(fees) ?? 0;
  const taxValue = parseAmount(taxes) ?? 0;
  const totalAmount =
    txType === "buy" || txType === "depositOpen" || txType === "cashWithdrawal" || txType === "fxConversion"
      ? gross + feeValue + taxValue
      : txType === "fee" || txType === "tax"
        ? gross
        : Math.max(gross - feeValue - taxValue, 0);
  const totalLabel =
    txType === "buy" || txType === "depositOpen" || txType === "cashWithdrawal" || txType === "fxConversion" || txType === "fee" || txType === "tax"
      ? "Suma do zapłaty"
      : "Suma wpływu";
  const submitLabel = saving
    ? "Zapisuję..."
    : isEditing
      ? "Zapisz zmiany"
      : `Dodaj ${txDef.label.toLowerCase()}`;
  const selectedPortfolioName = portfolios.find((portfolio) => portfolio.id === portfolioId)?.name ?? "Portfel";

  function reset() {
    setTxType("buy");
    setInstrumentId("");
    setDate(today);
    setQuantity("");
    setPrice("");
    setGrossAmount("");
    setCurrency("PLN");
    setFees("0");
    setTaxes("0");
    setAssetClass("all");
    setTargetCurrency("USD");
    setTargetGrossAmount("");
    setFxRateToBase("");
    setSettleInPLN(true);
    setFxRateLoading(false);
    setFxRateFetchFailed(false);
    setSourcePortfolioId("");
    setTransferKind("cash");
    setCountAsContribution(false);
    setNotes("");
    setError(null);
    setSaving(false);
    setInstrumentEditorOpen(false);
    setInlineInstrument(null);
  }

  function handleClose() {
    reset();
    if (onClose) {
      onClose();
    } else {
      close();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userDataKey || !supabase) {
      setError("Brak klucza danych. Odblokuj dane w panelu synchronizacji.");
      return;
    }
    if (!portfolioId) {
      setError("Wybierz portfel.");
      return;
    }
    if (txType === "accountTransferIn" && sourcePortfolioId === portfolioId) {
      setError("Portfel źródłowy i docelowy muszą być różne.");
      return;
    }
    if (txType === "fxConversion" && (!targetCurrency || !targetGrossAmount)) {
      setError("Podaj walutę docelową i kwotę po przewalutowaniu.");
      return;
    }

    // Validate every numeric field through the shared parser before saving.
    // `null` means empty / non-finite (NaN, ±Inf) / over the 1e12 magnitude cap —
    // such values must never reach the sync payload (parity with native Faza 1.4).
    const grossValue = parseAmount(grossAmount);
    if (grossValue == null) {
      setError("Podaj poprawną kwotę.");
      return;
    }

    const feeAmount = fees.trim() ? parseAmount(fees) : 0;
    if (feeAmount == null) {
      setError("Podaj poprawną wartość opłat.");
      return;
    }

    // Belka tax. CRITICAL: when the field is hidden (IKE/IKZE, or a non-taxed
    // type) the saved tax MUST be 0, enforced here at the save boundary — not
    // only by hiding the UI — so flipping the portfolio to IKE/IKZE after
    // typing an amount can never persist a non-zero value (native parity).
    let taxAmount = 0;
    if (showsTax && taxes.trim()) {
      const parsedTax = parseAmount(taxes);
      if (parsedTax == null) {
        setError("Podaj poprawną wartość podatku.");
        return;
      }
      taxAmount = parsedTax;
    }

    // FX settlement. For a foreign buy/sell in PLN mode a positive rate is
    // required; in foreign mode fxRateToBase is null (cash settles from the FX
    // pool). Other types keep the optional generic rate field.
    let fxRateValue: number | null = null;
    if (showsFX) {
      const parsedRate = parseAmount(fxRateToBase);
      if (settleInPLN && (parsedRate == null || !(parsedRate > 0))) {
        setError(`Podaj kurs ${currency}/PLN dla rozliczenia w PLN.`);
        return;
      }
      fxRateValue = fxRateToBaseForSave({ type: txType, currency, settleInPLN, rate: parsedRate });
    } else if (fxRateToBase.trim()) {
      fxRateValue = parseAmount(fxRateToBase);
      if (fxRateValue == null) {
        setError("Podaj poprawny kurs wymiany.");
        return;
      }
    }

    let quantityValue: number | null = null;
    if (txDef.needsQty && quantity.trim()) {
      quantityValue = parseAmount(quantity);
      if (quantityValue == null) {
        setError("Podaj poprawną ilość.");
        return;
      }
    }

    let priceValue: number | null = null;
    if (price.trim()) {
      priceValue = parseAmount(price);
      if (priceValue == null) {
        setError("Podaj poprawną cenę.");
        return;
      }
    }

    let targetGrossValue: number | null = null;
    if (txType === "fxConversion") {
      targetGrossValue = parseAmount(targetGrossAmount);
      if (targetGrossValue == null) {
        setError("Podaj poprawną kwotę po przewalutowaniu.");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const id = initialValue?.id ?? crypto.randomUUID();
      const dateSeconds = swiftReferenceSeconds(new Date(date));

      const payload = makeTransactionPayload({
        id,
        date: dateSeconds,
        portfolioID: portfolioId,
        transactionType: txType,
        grossAmount: grossValue,
        currency,
        fees: feeAmount,
        taxes: taxAmount,
        fxRateToBase: fxRateValue,
        targetCurrency: txType === "fxConversion" ? targetCurrency : null,
        targetGrossAmount: txType === "fxConversion" ? targetGrossValue : null,
        notes,
        sourcePortfolioID: txType === "accountTransferIn" && sourcePortfolioId ? sourcePortfolioId : null,
        transferKind: txType === "accountTransferIn" ? transferKind : null,
        contributionTreatment:
          txType === "accountTransferIn"
            ? countAsContribution
              ? "countAsContribution"
              : "ignoreForContributions"
            : null,
        instrumentID: txDef.needsInstrument && instrumentId ? instrumentId : null,
        quantity: quantityValue,
        price: priceValue,
      });

      if (isFakeSyncEnabled() && records) {
        const now = new Date().toISOString();
        const nextRecords = [
          ...records.filter((record) => record.id !== id),
          {
            id,
            deviceId: "fake-sync-web",
            updatedAt: now,
            deletedAt: null,
            envelope: {
              type: "transaction" as const,
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
      } else {
        const result = await saveRecord(
          supabase,
          userDataKey,
          "transaction",
          payload,
          { baseUpdatedAt: initialValue?.updatedAt ?? null },
        );

        if (!result.queued) {
          const { records: newRecords, snapshot } = await refreshSyncStore(supabase, userDataKey);
          setSync(newRecords, snapshot);
        }
      }

      if (!initialValue) {
        getTelemetryService().signal(TelemetryEvent.transactionAdded, {
          type: telemetrySnakeCased(txType),
          entry_method: "manual",
        });
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać transakcji.");
      setSaving(false);
    }
  }

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="transaction-modal-shell"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={handleClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(22,29,24,0.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      <div
        className="transaction-modal-panel"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 1000,
          height: "min(760px, calc(100vh - 32px))",
          overflow: "hidden",
          background: PAPER,
          borderRadius: 22,
          boxShadow: "0 24px 64px rgba(22,29,24,0.22), inset 0 0.5px 0 rgba(255,255,255,0.8)",
          border: "0.5px solid rgba(255,255,255,0.7)",
          display: "grid",
          gridTemplateColumns: "248px minmax(0, 1fr)",
        }}
      >
        <aside
          className="transaction-modal-sidebar"
          style={{
            minWidth: 0,
            overflowY: "auto",
            padding: "20px 16px",
            background: v2Mix(V2.card2, 0.64),
            borderRight: `0.5px solid ${LINE_SOFT}`,
          }}
        >
          {recentTransactions.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={labelStyle}>Ostatnie</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {recentTransactions.map((recent, index) => (
                  <button
                    key={`${recent.label}-${index}`}
                    type="button"
                    onClick={() => recent.type && setTxType(recent.type)}
                    style={{
                      border: "none",
                      background: "transparent",
                      display: "grid",
                      gridTemplateColumns: "9px 1fr",
                      gap: 8,
                      alignItems: "center",
                      padding: "5px 8px",
                      borderRadius: 8,
                      color: INK,
                      cursor: recent.type ? "pointer" : "default",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: recent.color }} />
                    <span>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>{recent.label}</span>
                      <span style={{ display: "block", marginTop: 1, fontSize: 12, color: MUTED }}>
                        {recent.amount.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} {recent.currency}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {TX_GROUPS.map((group) => (
            <div key={group.key} style={{ marginTop: 16 }}>
              <div style={labelStyle}>{group.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {TX_TYPES.filter((type) => type.group === group.key).map((type) => {
                  const Icon = type.icon;
                  const selected = txType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setTxType(type.value)}
                      style={{
                        position: "relative",
                        border: "none",
                        borderRadius: 10,
                        padding: "7px 9px",
                        background: selected ? v2Mix(V2.ink, 0.07) : "transparent",
                        color: INK,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        fontFamily: "inherit",
                      }}
                    >
                      {selected && (
                        <span
                          style={{
                            position: "absolute",
                            left: -16,
                            top: 10,
                            bottom: 10,
                            width: 3,
                            borderRadius: 99,
                            background: type.tone,
                          }}
                        />
                      )}
                      <IconBadge icon={Icon} color={type.tone} />
                      <span style={{ minWidth: 0, fontSize: 14, fontWeight: selected ? 800 : 500, lineHeight: 1.2 }}>
                        {type.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className="transaction-modal-main" style={{ minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              padding: "20px 28px 18px",
              borderBottom: `0.5px solid ${LINE_SOFT}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <IconBadge icon={TxIcon} color={txDef.tone} selected />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1.1 }}>
                  {isEditing ? `Edytuj: ${txDef.label}` : txDef.label}
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
                  {selectedPortfolioName} · {txDef.needsInstrument ? "Instrumenty" : "Gotówka i rozliczenia"}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Zamknij"
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                border: "none",
                background: "rgba(22,29,24,0.10)",
                color: MUTED,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
              }}
            >
              <X size={17} strokeWidth={2.4} />
            </button>
          </header>

          {!userDataKey && (
            <div style={{ padding: "12px 28px", background: `${AMBER}12`, borderBottom: `0.5px solid ${LINE_SOFT}` }}>
              <div style={{ fontSize: 12, color: AMBER, fontWeight: 700 }}>
                {publicDemo
                  ? "Tryb demo — możesz obejrzeć cały formularz, ale zapis transakcji jest wyłączony."
                  : "Odblokuj dane w panelu synchronizacji, żeby zapisywać transakcje."}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
            <div className="transaction-modal-content" style={{ padding: "22px 28px", overflowY: "auto", flex: 1 }}>
              {assetClassOptions.length > 0 && (
                <section style={{ marginBottom: 20 }}>
                  <div style={labelStyle}>Klasa aktywów</div>
                  <div className="transaction-asset-grid">
                    <button
                      type="button"
                      onClick={() => setAssetClass("all")}
                      style={{
                        minHeight: 62,
                        borderRadius: 12,
                        border: `0.5px solid ${assetClass === "all" ? v2Mix(txDef.tone, 0.35) : LINE_SOFT}`,
                        background: assetClass === "all" ? v2Mix(txDef.tone, 0.08) : v2Mix(V2.card, 0.68),
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 13px",
                        color: INK,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 14,
                        fontWeight: 800,
                        textAlign: "left",
                      }}
                    >
                      <IconBadge icon={Briefcase} color={txDef.tone} />
                      Wszystkie
                    </button>
                    {assetClassOptions.map((asset) => {
                      const Icon = asset.icon;
                      const selected = assetClass === asset.key;
                      return (
                        <button
                          key={asset.key}
                          type="button"
                          onClick={() => setAssetClass(asset.key)}
                          style={{
                            minHeight: 62,
                            borderRadius: 12,
                            border: `0.5px solid ${selected ? v2Mix(asset.tone, 0.35) : LINE_SOFT}`,
                            background: selected ? v2Mix(asset.tone, 0.08) : v2Mix(V2.card, 0.68),
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 13px",
                            color: INK,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: 14,
                            fontWeight: 800,
                            textAlign: "left",
                          }}
                        >
                          <IconBadge icon={Icon} color={asset.tone} />
                          {asset.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <DecimalSeparatorHint />

              <div className="transaction-form-grid">
                <Field label="Data">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} required />
                </Field>
                <Field label="Portfel">
                  <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)} style={selectStyle} required>
                    {portfolios.length === 0 && <option value="">—</option>}
                    {portfolios.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {txType === "accountTransferIn" && (
                <div style={{ marginTop: 15 }}>
                  <Field label="Portfel źródłowy">
                    <select value={sourcePortfolioId} onChange={(e) => setSourcePortfolioId(e.target.value)} style={selectStyle}>
                      <option value="">— zewnętrzny / nieznany —</option>
                      {portfolios
                        .filter((p) => p.id !== portfolioId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </Field>
                  <label
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      marginTop: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={countAsContribution}
                      onChange={(e) => setCountAsContribution(e.target.checked)}
                      style={{ marginTop: 2, accentColor: INK }}
                    />
                    <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.35 }}>
                      <span style={{ fontWeight: 700, color: INK }}>Licz jako nową wpłatę</span>
                      <br />
                      Domyślnie transfer między własnymi portfelami jest neutralny dla
                      „wpłat” (nie zawyża zainwestowanego kapitału). Zaznacz, jeśli to
                      faktycznie nowy kapitał z zewnątrz. Wynik (TWR/XIRR) jest
                      neutralizowany tak czy inaczej.
                    </span>
                  </label>
                </div>
              )}

              {txDef.needsInstrument && (
                <div style={{ marginTop: 15 }}>
                  <Field label="Instrument" htmlFor={instrumentFieldId}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                      <div style={{ position: "relative" }}>
                        <Search size={16} strokeWidth={2.1} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
                        <select
                          id={instrumentFieldId}
                          value={instrumentId}
                          onChange={(e) => setInstrumentId(e.target.value)}
                          style={{ ...selectStyle, paddingLeft: 34 }}
                        >
                          <option value="">
                            {availableInstruments.length === 0
                              ? (txDef.heldOnly ? "— brak pozycji w tym portfelu —" : "— brak pasujących instrumentów —")
                              : "— brak / gotówka —"}
                          </option>
                          {availableInstruments.map((inst) => (
                            <option key={inst.id} value={inst.id}>{inst.symbol} · {inst.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInstrumentEditorOpen(true)}
                        disabled={txDef.heldOnly}
                        title={
                          txDef.heldOnly
                            ? "Ten typ transakcji wymaga instrumentu już posiadanego w portfelu."
                            : "Dodaj instrument bez opuszczania transakcji"
                        }
                        style={{
                          height: 36,
                          padding: "0 13px",
                          border: "none",
                          borderRadius: 10,
                          background: txDef.heldOnly ? v2Mix(V2.ink, 0.04) : v2Mix(V2.ink, 0.07),
                          color: txDef.heldOnly ? SUBTLE : INK,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                          cursor: txDef.heldOnly ? "not-allowed" : "pointer",
                        }}
                      >
                        <Plus size={15} strokeWidth={2.3} />
                        Nowy
                      </button>
                    </div>
                  </Field>
                </div>
              )}

              {txType === "fxConversion" && (
                <div className="transaction-form-grid" style={{ marginTop: 15 }}>
                  <Field label="Kwota docelowa">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={targetGrossAmount}
                      onChange={(e) => setTargetGrossAmount(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Waluta docelowa">
                    <select value={targetCurrency} onChange={(e) => setTargetCurrency(e.target.value)} style={selectStyle}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {txDef.needsQty && (
                <div className="transaction-numeric-grid" style={{ marginTop: 15 }}>
                  <Field label="Liczba">
                    <input type="number" step="any" min="0" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Kurs / cena">
                    <input type="number" step="any" min="0" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Kwota (brutto)">
                    <input type="number" step="any" min="0" placeholder="0.00" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} style={inputStyle} required />
                  </Field>
                  <Field label="Waluta">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={selectStyle}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {!txDef.needsQty && (
                <div className="transaction-form-grid" style={{ marginTop: 15 }}>
                  <Field label={txType === "fxConversion" ? "Kwota źródłowa" : "Kwota (brutto)"}>
                    <input type="number" step="any" min="0" placeholder="0.00" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} style={inputStyle} required />
                  </Field>
                  <Field label="Waluta">
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={selectStyle}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {showsFX && (
                <section style={{ marginTop: 18 }}>
                  <div style={labelStyle}>Rozliczenie</div>
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      padding: 3,
                      borderRadius: 11,
                      background: v2Mix(V2.ink, 0.06),
                      width: "fit-content",
                    }}
                  >
                    {[
                      { value: true, label: "PLN" },
                      { value: false, label: currency },
                    ].map((option) => {
                      const selected = settleInPLN === option.value;
                      return (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => setSettleInPLN(option.value)}
                          style={{
                            border: "none",
                            borderRadius: 8,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            color: selected ? INK : MUTED,
                            background: selected ? PAPER : "transparent",
                            boxShadow: selected ? "0 1px 3px rgba(22,29,24,0.12)" : "none",
                          }}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>

                  {settleInPLN ? (
                    <div style={{ marginTop: 12 }}>
                      <Field label={`Kurs ${currency}/PLN (średni NBP)`}>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.0000"
                          value={fxRateToBase}
                          onChange={(e) => {
                            setFxRateFetchFailed(false);
                            setFxRateToBase(e.target.value);
                          }}
                          style={inputStyle}
                        />
                      </Field>
                      <div style={{ marginTop: 6, fontSize: 12, color: fxRateFetchFailed ? LOSS : MUTED, lineHeight: 1.35 }}>
                        {fxRateLoading
                          ? "Pobieram kurs NBP…"
                          : fxRateFetchFailed
                            ? "Nie udało się pobrać kursu — wpisz ręcznie."
                            : `Ile PLN za 1 ${currency} w dniu transakcji. Możesz poprawić.`}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 12, color: MUTED, lineHeight: 1.35 }}>
                      Rozliczenie w {currency} — gotówka schodzi z salda w tej walucie, bez przeliczenia na PLN.
                    </div>
                  )}
                </section>
              )}

              <details style={{ marginTop: 18 }}>
                <summary style={{ cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 700, userSelect: "none" }}>
                  {showsTax ? "Prowizja, podatek, notatka" : "Prowizja, notatka"}
                </summary>
                <div className="transaction-form-grid" style={{ marginTop: 12 }}>
                  <Field label="Prowizja">
                    <input type="number" step="any" min="0" value={fees} onChange={(e) => setFees(e.target.value)} style={inputStyle} />
                  </Field>
                  {showsTax && (
                    <Field label="Podatek">
                      <input type="number" step="any" min="0" value={taxes} onChange={(e) => setTaxes(e.target.value)} style={inputStyle} />
                    </Field>
                  )}
                  {/* The dedicated FX-settlement block owns fxRateToBase for
                      foreign buy/sell; the generic field stays for other types. */}
                  {!showsFX && (
                    <Field label="Kurs do PLN">
                      <input type="number" step="any" min="0" placeholder="opcjonalnie" value={fxRateToBase} onChange={(e) => setFxRateToBase(e.target.value)} style={inputStyle} />
                    </Field>
                  )}
                  <Field label="Notatka">
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </details>

              {error && (
                <div style={{ fontSize: 12, color: LOSS, padding: "9px 12px", borderRadius: 10, background: `${LOSS}10`, marginTop: 16, fontWeight: 700 }}>
                  {error}
                </div>
              )}
            </div>

            <footer
              className="transaction-modal-footer"
              style={{
                padding: "17px 28px 19px",
                borderTop: `0.5px solid ${LINE_SOFT}`,
                background: v2Mix(V2.card2, 0.4),
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
              }}
            >
              <div>
                <div style={labelStyle}>{totalLabel}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                  <span style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                    {totalAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: 17, color: MUTED, fontWeight: 600 }}>{currency}</span>
                </div>
              </div>
              <div className="transaction-modal-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  className="transaction-modal-cancel"
                  type="button"
                  onClick={handleClose}
                  style={{
                    height: 39,
                    padding: "0 18px",
                    borderRadius: 999,
                    border: "none",
                    background: v2Mix(V2.ink, 0.08),
                    color: INK,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Anuluj
                </button>
                <button
                  className="transaction-modal-submit"
                  type="submit"
                  disabled={saving || !userDataKey}
                  style={{
                    height: 39,
                    padding: "0 21px",
                    borderRadius: 999,
                    border: "none",
                    background: saving || !userDataKey ? "rgba(22,29,24,0.12)" : txDef.tone,
                    color: saving || !userDataKey ? SUBTLE : "#fff",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: saving || !userDataKey ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    boxShadow: saving || !userDataKey ? "none" : `0 6px 16px ${v2Mix(txDef.tone, 0.22)}`,
                    transition: "all .15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {submitLabel}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </div>
      <InstrumentEditorModal
        open={instrumentEditorOpen}
        initialValue={null}
        defaultValue={newInstrumentDefaultValue}
        onSaved={handleInlineInstrumentSaved}
        onClose={() => setInstrumentEditorOpen(false)}
        zIndex={240}
      />
    </div>
  );

  return createPortal(modal, document.body);
}
