import { V2 } from "@/lib/v2-design";

/** Asset-class keys used by macOS in the account `targetAllocation` record.
 * Order matches the macOS "Alokacja docelowa" dialog. */
export type AssetClassKey =
  | "equity"
  | "bonds"
  | "crypto"
  | "other"
  | "deposit"
  | "cash";

export type AssetClassDef = {
  key: AssetClassKey;
  label: string;
  color: string;
};

/** The full, ordered set of supported asset classes. Mirrors the macOS app so
 * web and macOS read/write the same per-portfolio `targetAllocation` payload. */
export const ASSET_CLASSES: readonly AssetClassDef[] = [
  { key: "equity", label: "Akcje / ETF", color: V2.equity },
  { key: "bonds", label: "Obligacje", color: V2.bonds },
  { key: "crypto", label: "Kryptowaluty", color: V2.crypto },
  { key: "other", label: "Inne aktywa", color: "#6F6353" },
  { key: "deposit", label: "Lokaty", color: V2.deposit },
  { key: "cash", label: "Gotówka", color: V2.cash },
];

/** A zeroed allocation over every supported class. */
export function emptyAllocation(): Record<AssetClassKey, number> {
  return ASSET_CLASSES.reduce(
    (acc, { key }) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<AssetClassKey, number>,
  );
}

/** Normalize a raw payload allocation to the known keys, clamping each share to
 * 0–100 and dropping unknown keys. Missing keys become 0. */
export function readAllocation(
  raw: Record<string, number> | undefined | null,
): Record<AssetClassKey, number> {
  const result = emptyAllocation();
  if (!raw) return result;
  for (const { key } of ASSET_CLASSES) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = Math.max(0, Math.min(100, value));
    }
  }
  return result;
}

/** Sum of all class shares, in percent. */
export function sumAllocation(alloc: Record<string, number>): number {
  return ASSET_CLASSES.reduce((total, { key }) => total + (alloc[key] || 0), 0);
}
