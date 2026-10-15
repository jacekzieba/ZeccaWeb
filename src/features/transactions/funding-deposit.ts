import type { DecryptedRecord } from "@/sync/records/encrypted-records";

/** Prefix of the note the Add Transaction screen puts on a funding deposit. */
export const FUNDING_DEPOSIT_NOTE_PREFIX = "Zasilenie pod zakup";

/**
 * Web-only convenience for the Add Transaction screen: the cash deposit that
 * exactly offsets a buy's drain on the ledger, so a portfolio whose funding was
 * never recorded doesn't drift into a phantom debit.
 *
 * Deliberately NOT in `transaction-rules` — that module is a lockstep mirror of
 * the native `TransactionEditorLogic` and must not grow web-only decisions. The
 * record this produces is an ordinary `cashDeposit`, so the native apps read it
 * without any change.
 *
 * The amount and currency mirror `addCashForTrade` and the `buy` branch of
 * `applyTransaction` in `sync/records/investor-snapshot`: a buy costs gross plus
 * fees, and settles in PLN when a foreign trade carries an FX rate. Diverge from
 * those and the balance lands near zero instead of on it.
 */
export function fundingDepositForTrade(args: {
  transactionType: string;
  currency: string;
  grossAmount: number;
  fees: number;
  fxRateToBase: number | null;
}): { currency: string; grossAmount: number } | null {
  if (args.transactionType !== "buy") {
    return null;
  }

  const cost = args.grossAmount + args.fees;

  if (args.currency !== "PLN" && args.fxRateToBase) {
    return { currency: "PLN", grossAmount: cost * args.fxRateToBase };
  }

  return { currency: args.currency, grossAmount: cost };
}

type TradePayload = {
  date?: unknown;
  portfolioID?: unknown;
  transactionType?: unknown;
  currency?: unknown;
  grossAmount?: unknown;
  fees?: unknown;
  fxRateToBase?: unknown;
  notes?: unknown;
};

/**
 * For buys about to be deleted, the live funding deposits that were created
 * with them (same portfolio and date, the note this screen writes, and exactly
 * the amount `fundingDepositForTrade` yields). There is no stored link between
 * the two records, so this is a match by content; a deposit the user typed by
 * hand carries another note and is never touched. Each deposit is claimed by
 * at most one buy.
 */
export function fundingDepositIdsForBuys(
  records: DecryptedRecord[],
  buyIds: string[],
): string[] {
  const live = records.filter(
    (record) => !record.deletedAt && record.envelope.type === "transaction",
  );
  const payloadOf = (record: DecryptedRecord) => record.envelope.payload as TradePayload;

  const candidates = live.filter((record) => {
    const payload = payloadOf(record);
    return (
      payload.transactionType === "cashDeposit" &&
      typeof payload.notes === "string" &&
      payload.notes.startsWith(FUNDING_DEPOSIT_NOTE_PREFIX)
    );
  });

  const claimed = new Set<string>();
  for (const buyId of buyIds) {
    const buy = live.find((record) => record.id === buyId);
    if (!buy) continue;
    const payload = payloadOf(buy);
    const funding = fundingDepositForTrade({
      transactionType: String(payload.transactionType),
      currency: String(payload.currency),
      grossAmount: Number(payload.grossAmount),
      fees: Number(payload.fees ?? 0),
      fxRateToBase: typeof payload.fxRateToBase === "number" ? payload.fxRateToBase : null,
    });
    if (!funding) continue;

    const match = candidates.find((candidate) => {
      if (claimed.has(candidate.id)) return false;
      const deposit = payloadOf(candidate);
      return (
        deposit.portfolioID === payload.portfolioID &&
        deposit.date === payload.date &&
        deposit.currency === funding.currency &&
        Math.abs(Number(deposit.grossAmount) - funding.grossAmount) < 0.005
      );
    });
    if (match) claimed.add(match.id);
  }

  return [...claimed];
}
