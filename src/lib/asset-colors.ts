import { token } from "@/design/tokens";

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
};

export function assetClassColor(label: string): string {
  return ASSET_CLASS_COLOR[label] ?? token("inkMuted");
}

/** Kolor kropki portfela — stabilny i wyprowadzony z jego tożsamości.
 *
 * Kropki były przypisywane po indeksie (`index === 0 ? akcent : obligacje`), więc
 * trzy konta dostawały dwie barwy, dwie identyczne, a pierwsze — bursztyn, czyli
 * akcent w danych. Dołożenie portfela przesuwało kolory na sąsiadów.
 *
 * Paleta jest chłodna i celowo nie zawiera bursztynu ani zieleni kierunku:
 * kropka rozróżnia konta, nie mówi nic o wzroście ani o źródle.
 */
const DOT_PALETTE = [
  token("assetEquity"),
  token("assetCash"),
  token("assetCrypto"),
  token("assetDeposit"),
  token("assetBonds"),
];

export function portfolioDotColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return DOT_PALETTE[hash % DOT_PALETTE.length];
}
