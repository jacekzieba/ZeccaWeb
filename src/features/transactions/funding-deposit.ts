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

/** The note the Add Transaction screen puts on a funding deposit. */
export function fundingDepositNote(symbol: string | null | undefined): string {
  return symbol ? `${FUNDING_DEPOSIT_NOTE_PREFIX} ${symbol}` : FUNDING_DEPOSIT_NOTE_PREFIX;
}

type TradePayload = {
  date?: unknown;
  portfolioID?: unknown;
  instrumentID?: unknown;
  transactionType?: unknown;
  currency?: unknown;
  grossAmount?: unknown;
  fees?: unknown;
  fxRateToBase?: unknown;
  notes?: unknown;
  symbol?: unknown;
};

/**
 * For buys about to be deleted, the live funding deposits that were created
 * with them. There is no stored link between the two records (adding one would
 * change the sync contract shared with the native apps), so this matches by
 * content and errs on the side of offering nothing:
 *
 * - exact: same portfolio and date, this screen's note, and exactly the amount
 *   `fundingDepositForTrade` yields;
 * - fallback, for a buy whose amount was edited afterwards: same portfolio and
 *   date and the note names the buy's symbol, when that pair is unique;
 * - never when several identical buys compete for fewer deposits, since then
 *   it is unknowable which buy was funded;
 * - a deposit entered by hand carries another note and is never touched, and
 *   each deposit is claimed by at most one buy.
 */
export function fundingDepositIdsForBuys(
  records: DecryptedRecord[],
  buyIds: string[],
): string[] {
  const live = records.filter((record) => !record.deletedAt);
  const transactions = live.filter((record) => record.envelope.type === "transaction");
  const payloadOf = (record: DecryptedRecord) => record.envelope.payload as TradePayload;
  const symbolOf = (instrumentID: unknown) => {
    const asset = live.find(
      (record) => record.envelope.type === "asset" && record.id === instrumentID,
    );
    return asset ? String(payloadOf(asset).symbol ?? "") : "";
  };

  const candidates = transactions.filter((record) => {
    const payload = payloadOf(record);
    return (
      payload.transactionType === "cashDeposit" &&
      typeof payload.notes === "string" &&
      payload.notes.startsWith(FUNDING_DEPOSIT_NOTE_PREFIX)
    );
  });
  const buys = transactions.filter((record) => payloadOf(record).transactionType === "buy");

  const fundingOf = (payload: TradePayload) =>
    fundingDepositForTrade({
      transactionType: String(payload.transactionType),
      currency: String(payload.currency),
      grossAmount: Number(payload.grossAmount),
      fees: Number(payload.fees ?? 0),
      fxRateToBase: typeof payload.fxRateToBase === "number" ? payload.fxRateToBase : null,
    });
  const sameDay = (a: TradePayload, b: TradePayload) =>
    a.portfolioID === b.portfolioID && a.date === b.date;
  const sameAmount = (
    deposit: TradePayload,
    funding: { currency: string; grossAmount: number },
  ) =>
    deposit.currency === funding.currency &&
    Math.abs(Number(deposit.grossAmount) - funding.grossAmount) < 0.005;

  const claimed = new Set<string>();
  for (const buyId of buyIds) {
    const buy = buys.find((record) => record.id === buyId);
    if (!buy) continue;
    const payload = payloadOf(buy);
    const funding = fundingOf(payload);
    if (!funding) continue;

    const exact = candidates.filter(
      (c) => sameDay(payloadOf(c), payload) && sameAmount(payloadOf(c), funding),
    );
    const rivals = buys.filter((other) => {
      const otherPayload = payloadOf(other);
      const otherFunding = fundingOf(otherPayload);
      return (
        sameDay(otherPayload, payload) &&
        otherFunding !== null &&
        otherFunding.currency === funding.currency &&
        Math.abs(otherFunding.grossAmount - funding.grossAmount) < 0.005
      );
    });

    if (exact.length > 0) {
      if (exact.length < rivals.length) continue;
      const match = exact.find((c) => !claimed.has(c.id));
      if (match) claimed.add(match.id);
      continue;
    }

    const symbol = symbolOf(payload.instrumentID);
    if (!symbol) continue;
    const bySymbol = candidates.filter(
      (c) =>
        sameDay(payloadOf(c), payload) &&
        String(payloadOf(c).notes).trim() === fundingDepositNote(symbol),
    );
    const sameSymbolBuys = buys.filter((other) => {
      const otherPayload = payloadOf(other);
      return sameDay(otherPayload, payload) && otherPayload.instrumentID === payload.instrumentID;
    });
    if (bySymbol.length === 1 && sameSymbolBuys.length === 1 && !claimed.has(bySymbol[0].id)) {
      claimed.add(bySymbol[0].id);
    }
  }

  return [...claimed];
}
