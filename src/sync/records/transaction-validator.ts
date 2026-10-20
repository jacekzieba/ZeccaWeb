// Port natywnego `TransactionValidator` (Zecca, InvestorDomain) z domyślnym
// kontekstem, czyli tym, którym aplikacja sprawdza rekordy z synchronizacji.
// Transakcja, która go nie przejdzie, trafia w aplikacji do kwarantanny i znika
// z portfela na iOS i macOS, choć web ją pokazuje. Dlatego web sprawdza każdą
// transakcję tym samym zestawem reguł przed zapisem (`saveRecord`).
// Wspólny sędzia: fixtura `sync_admission_cases.json` z repo natywnego.

export type TransactionValidationIssue = { field: string; message: string };

const KNOWN_TYPES = new Set([
  "buy",
  "sell",
  "dividend",
  "bondCoupon",
  "bondRedemption",
  "depositOpen",
  "depositClose",
  "cashDeposit",
  "cashWithdrawal",
  "fee",
  "tax",
  "transferIn",
  "transferOut",
  "interest",
  "accountTransferIn",
  "fxConversion",
  "correction",
]);

type Payload = Record<string, unknown>;

export function validateTransactionPayload(payload: Payload): TransactionValidationIssue[] {
  const type = payload.transactionType;
  if (typeof type !== "string" || !KNOWN_TYPES.has(type)) {
    return [issue("transactionType", "Nieznany typ transakcji.")];
  }

  const issues: TransactionValidationIssue[] = [];
  const currency = normalizedCurrency(payload.currency);
  if (!currency || currency === "?") issues.push(issue("currency", "Brakuje poprawnej waluty transakcji."));
  // Brak pola natywny dekoder czyta jako 0.
  const fees = numberOr(payload.fees, 0);
  const taxes = numberOr(payload.taxes, 0);
  if (fees === null || fees < 0) issues.push(issue("fees", "Prowizja nie może być ujemna."));
  if (taxes === null || taxes < 0) issues.push(issue("taxes", "Podatek nie może być ujemny."));

  switch (type) {
    case "buy":
    case "sell":
      issues.push(
        ...knownInstrument(payload),
        ...positive(payload.quantity, "quantity", "Brakuje liczby jednostek."),
        ...positive(payload.price, "price", "Brakuje ceny jednostkowej."),
        ...positiveAmount(payload),
      );
      break;
    case "dividend":
    case "bondCoupon":
    case "depositOpen":
    case "depositClose":
      issues.push(...knownInstrument(payload), ...positiveAmount(payload));
      break;
    case "bondRedemption":
      issues.push(
        ...knownInstrument(payload),
        ...positiveAmount(payload),
        ...positive(payload.quantity, "quantity", "Brakuje liczby wykupionych jednostek."),
      );
      break;
    case "cashDeposit":
    case "cashWithdrawal":
    case "fee":
    case "tax":
    case "transferIn":
    case "interest":
      issues.push(...positiveAmount(payload));
      break;
    case "transferOut":
      if (payload.transferKind === "asset") {
        issues.push(...knownInstrument(payload));
        const lotQuantity = lots(payload).reduce((sum, lot) => sum + (typeof lot.quantity === "number" ? lot.quantity : 0), 0);
        const quantity = lotQuantity > 0 ? lotQuantity : payload.quantity;
        issues.push(...positive(quantity, "quantity", "Transfer aktywów wymaga liczby jednostek."));
      }
      issues.push(...positiveAmount(payload));
      break;
    case "accountTransferIn":
      issues.push(...accountTransfer(payload));
      break;
    case "fxConversion":
      issues.push(...fxConversion(payload, currency));
      break;
    case "correction": {
      const amount = payload.grossAmount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || Math.abs(amount) <= 0.0000001) {
        issues.push(issue("grossAmount", "Korekta musi mieć niezerową kwotę."));
      }
      break;
    }
  }
  return issues;
}

/** Ten sam tekst co natywny `TransactionValidationError.errorDescription`. */
export function transactionValidationMessage(issues: TransactionValidationIssue[]) {
  return `Nie zapisano transakcji: ${issues.map((item) => item.message).join("; ")}`;
}

export class TransactionValidationError extends Error {
  constructor(readonly issues: TransactionValidationIssue[]) {
    super(transactionValidationMessage(issues));
    this.name = "TransactionValidationError";
  }
}

function accountTransfer(payload: Payload): TransactionValidationIssue[] {
  // Nieznany rodzaj natywny dekoder czyta jak brak rodzaju, czyli gotówkę.
  if (payload.transferKind !== "asset") return positiveAmount(payload);
  const issues = knownInstrument(payload);
  const transferLots = lots(payload);
  if (transferLots.length === 0) {
    issues.push(
      ...positive(payload.quantity, "quantity", "Transfer aktywów wymaga liczby jednostek."),
      ...positive(payload.price, "price", "Transfer aktywów wymaga ceny lub kosztu nabycia."),
    );
    return issues;
  }
  transferLots.forEach((lot, index) => {
    if (!isPositive(lot.quantity)) {
      issues.push(issue(`transferLots[${index}].quantity`, "Lot transferu aktywów ma niepoprawną liczbę jednostek."));
    }
    if (!isPositive(lot.unitCost)) {
      issues.push(issue(`transferLots[${index}].unitCost`, "Lot transferu aktywów ma niepoprawny koszt jednostkowy."));
    }
    if (!normalizedCurrency(lot.currency) || lot.currency === "?") {
      issues.push(issue(`transferLots[${index}].currency`, "Lot transferu aktywów ma niepoprawną walutę."));
    }
  });
  return issues;
}

function fxConversion(payload: Payload, sourceCurrency: string): TransactionValidationIssue[] {
  const issues = positiveAmount(payload);
  const targetCurrency = normalizedCurrency(payload.targetCurrency);
  if (payload.targetGrossAmount != null) {
    issues.push(...positive(payload.targetGrossAmount, "targetGrossAmount", "Brakuje kwoty docelowej konwersji FX."));
    if (!targetCurrency || targetCurrency === "?") {
      issues.push(issue("targetCurrency", "Brakuje waluty docelowej konwersji FX."));
    }
    if (sourceCurrency && sourceCurrency === targetCurrency) {
      issues.push(issue("targetCurrency", "Waluta źródłowa i docelowa konwersji FX muszą być różne."));
    }
  } else if (!isPositive(payload.fxRateToBase)) {
    issues.push(issue("fxRateToBase", "Stara konwersja FX wymaga dodatniego kursu do PLN."));
  }
  return issues;
}

function knownInstrument(payload: Payload): TransactionValidationIssue[] {
  return typeof payload.instrumentID === "string" && payload.instrumentID
    ? []
    : [issue("instrumentID", "Brakuje instrumentu dla transakcji.")];
}

function positiveAmount(payload: Payload) {
  return positive(payload.grossAmount, "grossAmount", "Kwota transakcji musi być dodatnia.");
}

function positive(value: unknown, field: string, message: string) {
  return isPositive(value) ? [] : [issue(field, message)];
}

function isPositive(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function numberOr(value: unknown, fallback: number) {
  if (value == null) return fallback;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lots(payload: Payload): Record<string, unknown>[] {
  return Array.isArray(payload.transferLots) ? (payload.transferLots as Record<string, unknown>[]) : [];
}

function normalizedCurrency(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function issue(field: string, message: string): TransactionValidationIssue {
  return { field, message };
}
