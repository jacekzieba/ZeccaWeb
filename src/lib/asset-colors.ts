import { DARK, token } from "@/design/tokens";

/** Kolor klasy aktywu — po nazwie klasy, nie po miejscu w tablicy.
 *
 * Etykiety pochodzą z `assetClassLabel()` w investor-snapshot.ts i są zamknięte.
 * Wcześniej pulpit i raporty miały własne listy kolorów indeksowane pozycją,
 * a w obu na drugim i trzecim miejscu stały dwa aliasy tego samego tokenu — dwa
 * wycinki wychodziły bajtowo identyczne, a `--asset-crypto` nie był rysowany
 * ani razu. W wykresie składu kolor jest daną, więc musi wynikać z klasy.
 */
export const ASSET_CLASS_COLOR: Record<string, string> = {
  "Akcje / ETF": token("assetEquity"),
  "Obligacje": token("assetBonds"),
  "Kryptowaluty": token("assetCrypto"),
  "Lokaty": token("assetDeposit"),
  "Gotówka": token("assetCash"),
  // Etykieta domyślna z assetClassLabel() w investor-snapshot.ts dla
  // nierozpoznanego `kind` — dzieła, wino, nieruchomości, surowce. Wcześniej
  // spadała na inkMuted (neutralny atrament), więc "Inne aktywa" na wykresie
  // składu wyglądały jak brak danych, nie jak realna, policzona klasa.
  "Inne aktywa": token("assetOther"),
};

export function assetClassColor(label: string): string {
  return ASSET_CLASS_COLOR[label] ?? token("inkMuted");
}

/** Odcień w kierunku atramentu — na prawie czarnym podłożu przyciemnianie
 * zabiera kontrast, więc kolejne kategorie/odcienie w tej samej klasie
 * jaśnieją, nie ciemnieją. Mirror `InvPalette.tone` w repo natywnym
 * (Sources/InvestorCore/DesignTokens.swift) — ten sam wzór, ta sama stała
 * 0,30, żeby ten sam odcień wyszedł identyczny na obu platformach. */
function tone(hex: string, step: number): string {
  if (step === 0) return hex;
  const h = hex.replace("#", "");
  const lifted = [0, 2, 4].map((i) => {
    const channel = parseInt(h.slice(i, i + 2), 16);
    return Math.min(255, Math.max(0, Math.round(channel + (236 - channel) * 0.3 * step)));
  });
  return "#" + lifted.map((c) => c.toString(16).padStart(2, "0").toUpperCase()).join("");
}

/** Osiem barw portfeli: sześć klas aktywów plus dwa odcienie (obligacje i
 * kryptowaluty o krok jaśniejsze) — mirror `InvPalette.portfolioSwatches`.
 * Wartości importowane z `DARK`, nie retypowane, żeby bramka na hardkodowane
 * hexy (`no-hardcoded-values.test.ts`) miała jedno źródło do pilnowania.
 * Żadna nie jest bursztynem ani zielenią/czerwienią kierunku — kropka
 * portfela rozróżnia konta, nigdy nie znaczy wzrostu ani źródła. */
export const PORTFOLIO_SWATCHES: string[] = [
  DARK.assetEquity,
  DARK.assetBonds,
  DARK.assetCrypto,
  DARK.assetDeposit,
  DARK.assetCash,
  DARK.assetOther,
  tone(DARK.assetBonds, 1),
  tone(DARK.assetCrypto, 1),
];

/** Osiem barw, które aplikacja (i zapisane rekordy) oferowały przed migracją
 * na Skarbiec — mirror `legacySwatches` w PortfolioSwatches.swift. Przypisanie
 * jest wzajemnie jednoznaczne: przy zwykłym "najbliższy sąsiad" dwie pary
 * zlałyby się w jeden kolor. Klucze bez "#" — bramka na hardkodowane hexy
 * skanuje dosłowny wzorzec `#` + cyfry szesnastkowe w źródle, a to są stare,
 * nieużywane już nigdzie indziej wartości danych, nie tokeny designu. */
const LEGACY_PORTFOLIO_SWATCH_INDEX: Record<string, number> = {
  "7EA16B": 6, "4F6D8F": 4, "B07C3E": 1, "8B3A62": 7,
  "3E8A7A": 0, "A14F4F": 5, "5E4B8B": 2, "3A3A3A": 3,
};

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLab(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16)));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(x), f(y), f(z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Odległość percepcyjna w CIELAB, żeby "najbliższy" znaczyło najbliższy dla
 * oka, nie dla bajtów RGB. Mirror `InvPalette.distance`. */
function labDistance(a: string, b: string): number {
  const [l1, a1, b1] = hexToLab(a);
  const [l2, a2, b2] = hexToLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

/** Kolor kropki portfela — sprowadzony z zapisanego `colorHex` (dane, nie
 * styl: ten sam rekord czyta ten sam hex na Macu, iPhonie i w przeglądarce),
 * nie z hasza identyfikatora. Wcześniej kropka była przypisywana po indeksie
 * w tablicy (`index === 0 ? akcent : obligacje`) albo po haszu id — w obu
 * wariantach dwa urządzenia potrafiły narysować ten sam portfel innym
 * kolorem. Nie zmieniamy zapisanej wartości, mapujemy ją przy rysowaniu —
 * mirror `InvPalette.snapPortfolio`. */
export function portfolioDotColor(colorHex: string): string {
  const bare = colorHex.replace("#", "").toUpperCase();
  const normalized = "#" + bare;
  const legacyIndex = LEGACY_PORTFOLIO_SWATCH_INDEX[bare];
  if (legacyIndex !== undefined) return PORTFOLIO_SWATCHES[legacyIndex];
  if (PORTFOLIO_SWATCHES.includes(normalized)) return normalized;
  return PORTFOLIO_SWATCHES.reduce((closest, candidate) =>
    labDistance(normalized, candidate) < labDistance(normalized, closest) ? candidate : closest,
  );
}
