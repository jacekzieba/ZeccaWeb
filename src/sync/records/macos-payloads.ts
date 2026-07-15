const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

export function swiftReferenceSeconds(date: Date) {
  return (date.getTime() - APPLE_REFERENCE_DATE_UNIX_MS) / 1000;
}

export function nowSwiftReferenceSeconds() {
  return swiftReferenceSeconds(new Date());
}

/**
 * Build a `settings` payload by merging consent overrides onto the existing
 * record. Spreading `existing` preserves fields web does not manage (tax flags,
 * fx provider, language, …) so a web write never clobbers native-only settings.
 */
export function makeSettingsPayload(input: {
  id: string;
  existing?: Record<string, unknown> | null;
  telemetryEnabled?: boolean;
  hasAcknowledgedPrivacyDisclosure?: boolean;
  appLanguage?: "pl" | "en";
  updatedAt?: number | string;
}) {
  return {
    ...(input.existing ?? {}),
    id: input.id,
    recordType: "settings",
    ...(input.telemetryEnabled !== undefined
      ? { telemetryEnabled: input.telemetryEnabled }
      : {}),
    ...(input.hasAcknowledgedPrivacyDisclosure !== undefined
      ? { hasAcknowledgedPrivacyDisclosure: input.hasAcknowledgedPrivacyDisclosure }
      : {}),
    ...(input.appLanguage !== undefined ? { appLanguage: input.appLanguage } : {}),
    updatedAt: input.updatedAt ?? nowSwiftReferenceSeconds(),
  };
}

export function makeAccountPayload(input: {
  id: string;
  name: string;
  baseCurrency: string;
  accountType?: string;
  colorHex?: string;
  targetAllocation?: Record<string, number>;
}) {
  return {
    id: input.id,
    recordType: "account",
    name: input.name,
    accountType: input.accountType ?? "custom",
    baseCurrency: input.baseCurrency,
    colorHex: input.colorHex ?? "#7EA16B",
    targetAllocation: input.targetAllocation ?? {},
  };
}

export function makeAssetPayload(input: {
  id: string;
  kind: string;
  symbol: string;
  name: string;
  currency: string;
  category?: string | null;
  exchange?: string | null;
  country?: string | null;
  isin?: string | null;
  marketDataID?: string | null;
}) {
  return {
    id: input.id,
    recordType: "asset",
    kind: input.kind,
    symbol: input.symbol,
    name: input.name,
    currency: input.currency,
    exchange: input.exchange ?? null,
    country: input.country ?? null,
    isin: input.isin ?? null,
    category: input.category ?? null,
    marketDataID: input.marketDataID ?? null,
    bondParams: null,
    listedBondParams: null,
    depositParams: null,
  };
}

export function makeTransactionPayload(input: {
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
  externalImportID?: string | null;
  sourcePortfolioID?: string | null;
  transferKind?: string | null;
  transferSourceKind?: string | null;
  contributionTreatment?: string | null;
  transferCostBasisMode?: string | null;
  transferLots?: unknown[] | null;
  createdAt?: number | string;
  updatedAt?: number | string;
}) {
  const now = nowSwiftReferenceSeconds();

  return {
    id: input.id,
    recordType: "transaction",
    date: input.date,
    bookingDate: null,
    portfolioID: input.portfolioID,
    instrumentID: input.instrumentID ?? null,
    transactionType: input.transactionType,
    quantity: input.quantity ?? null,
    price: input.price ?? null,
    grossAmount: input.grossAmount,
    currency: input.currency,
    fees: input.fees,
    taxes: input.taxes,
    fxRateToBase: input.fxRateToBase ?? null,
    targetCurrency: input.targetCurrency ?? null,
    targetGrossAmount: input.targetGrossAmount ?? null,
    notes: input.notes ?? "",
    externalImportID: input.externalImportID ?? null,
    sourcePortfolioID: input.sourcePortfolioID ?? null,
    transferKind: input.transferKind ?? null,
    transferSourceKind: input.transferSourceKind ?? null,
    contributionTreatment: input.contributionTreatment ?? null,
    transferCostBasisMode: input.transferCostBasisMode ?? null,
    transferLots: input.transferLots ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

export function makeManualValuationPayload(input: {
  id: string;
  instrumentID: string;
  date: number | string;
  value: number;
  currency: string;
  note?: string;
  createdAt?: number | string;
  updatedAt?: number | string;
}) {
  const now = nowSwiftReferenceSeconds();

  return {
    id: input.id,
    recordType: "manualValuation",
    instrumentID: input.instrumentID,
    date: input.date,
    value: input.value,
    currency: input.currency,
    note: input.note ?? "",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
