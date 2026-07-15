export const NATIVE_PORTFOLIO_TYPES = [
  "IKE",
  "IKZE",
  "Rachunek zwykły",
  "Bank",
  "Własny",
] as const;

const LEGACY_TYPE_MAP: Record<string, string> = {
  ike: "IKE",
  ikze: "IKZE",
  taxable: "Rachunek zwykły",
  bank: "Bank",
  custom: "Własny",
};

export function normalizePortfolioType(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "Własny";
  return LEGACY_TYPE_MAP[trimmed.toLowerCase()] ?? trimmed;
}
