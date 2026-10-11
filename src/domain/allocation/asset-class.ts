import type { AssetClassKey } from "@/features/portfolios/asset-classes";

/** Mirrors native `InstrumentKind.assetClass`; unknown kinds fall back to "other". */
export function kindToAssetClass(kind: string | undefined): AssetClassKey {
  switch (kind) {
    case "stock":
    case "etf":
      return "equity";
    case "treasuryBond":
    case "listedBond":
      return "bonds";
    case "crypto":
      return "crypto";
    case "deposit":
      return "deposit";
    case "cash":
      return "cash";
    default:
      return "other";
  }
}
