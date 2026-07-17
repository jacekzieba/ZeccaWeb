import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import type { LegalLimits } from "@/market-data/types";

const APPLE_REFERENCE_DATE_UNIX_MS = Date.UTC(2001, 0, 1);

function toDate(value: unknown): Date | null {
  if (typeof value === "number") {
    return new Date(APPLE_REFERENCE_DATE_UNIX_MS + value * 1000);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** Normalises an accountType to "IKE" | "IKZE" | null, case-insensitively —
 * real sync sends the display strings while fake sync uses lowercase codes. */
function wrapperType(accountType: unknown): "IKE" | "IKZE" | null {
  const t = typeof accountType === "string" ? accountType.trim().toUpperCase() : "";
  return t === "IKE" || t === "IKZE" ? t : null;
}

export type IkeIkzeUsage = {
  type: "IKE" | "IKZE";
  contributed: number;
  limit: number;
  /** 0..1, clamped — a cap can legitimately be exceeded by a mis-booked deposit. */
  ratio: number;
};

/**
 * Sums this calendar year's cash contributions into IKE/IKZE accounts and pairs
 * them with the statutory caps. Only `cashDeposit` counts as a contribution
 * (buys/transfers move existing capital, not fresh IKE/IKZE payments). IKE/IKZE
 * are PLN wrappers, so amounts are taken at face value in PLN.
 */
export function computeIkeIkzeUsage(
  records: DecryptedRecord[] | null,
  limits: LegalLimits | null,
  now: Date = new Date(),
): IkeIkzeUsage[] {
  if (!records || !limits) return [];

  const typeByPortfolio = new Map<string, "IKE" | "IKZE">();
  for (const record of records) {
    if (record.deletedAt || record.envelope.type !== "account") continue;
    const payload = record.envelope.payload as { id?: string; accountType?: unknown };
    const type = wrapperType(payload.accountType);
    if (payload.id && type) typeByPortfolio.set(payload.id, type);
  }

  const year = now.getUTCFullYear();
  const contributed: Record<"IKE" | "IKZE", number> = { IKE: 0, IKZE: 0 };

  for (const record of records) {
    if (record.deletedAt || record.envelope.type !== "transaction") continue;
    const payload = record.envelope.payload as {
      portfolioID?: string;
      transactionType?: string;
      grossAmount?: number;
      date?: unknown;
    };
    if (payload.transactionType !== "cashDeposit" || !payload.portfolioID) continue;
    const type = typeByPortfolio.get(payload.portfolioID);
    if (!type) continue;
    const date = toDate(payload.date);
    if (!date || date.getUTCFullYear() !== year) continue;
    contributed[type] += payload.grossAmount ?? 0;
  }

  const result: IkeIkzeUsage[] = [];
  for (const type of ["IKE", "IKZE"] as const) {
    if (!typeByPortfolio.size) break;
    const hasAccount = [...typeByPortfolio.values()].includes(type);
    if (!hasAccount) continue;
    const limit = type === "IKE" ? limits.ike : limits.ikze;
    const ratio = limit > 0 ? Math.min(1, Math.max(0, contributed[type] / limit)) : 0;
    result.push({ type, contributed: contributed[type], limit, ratio });
  }

  return result;
}
