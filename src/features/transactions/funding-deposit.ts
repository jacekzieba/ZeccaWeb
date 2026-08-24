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
