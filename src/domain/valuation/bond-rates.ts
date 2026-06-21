/**
 * Oprocentowanie detalicznych obligacji skarbowych indeksowanych inflacją
 * (ROS, ROD, COI, EDO ...).
 *
 * W pierwszym rocznym okresie odsetkowym obowiązuje stała stopa emisyjna
 * (`firstPeriodRate`). W każdym kolejnym okresie stopa = inflacja + marża, gdzie
 * „inflacja" to roczny wskaźnik cen towarów i usług konsumpcyjnych (CPI r/r)
 * ogłaszany przez GUS **w miesiącu poprzedzającym pierwszy miesiąc danego okresu
 * odsetkowego**. GUS publikuje wskaźnik danego miesiąca ~15. dnia miesiąca
 * następnego, więc wskaźnik „ogłoszony w miesiącu M-1" dotyczy miesiąca M-2
 * względem startu okresu. Ujemna inflacja liczona jest jako zero.
 *
 * Wartości zweryfikowane wstecznie względem oficjalnych wartości bieżących
 * obligacji (obligacjeskarbowe.pl) dla emisji ROS1228, ROS0229, ROS1129, ROD0338.
 * Źródło danych CPI: komunikaty GUS (stat.gov.pl). Tabelę należy uzupełniać o
 * kolejne miesiące w miarę publikacji odczytów.
 */

/** Roczny wskaźnik CPI GUS (r/r, w %). Klucz: "RRRR-MM". */
export const CPI_YOY: Record<string, number> = {
  "2021-01": 2.6, "2021-02": 2.4, "2021-03": 3.2, "2021-04": 4.3,
  "2021-05": 4.7, "2021-06": 4.4, "2021-07": 5.0, "2021-08": 5.5,
  "2021-09": 5.9, "2021-10": 6.8, "2021-11": 7.8, "2021-12": 8.6,
  "2022-01": 9.4, "2022-02": 8.5, "2022-03": 11.0, "2022-04": 12.4,
  "2022-05": 13.9, "2022-06": 15.5, "2022-07": 15.6, "2022-08": 16.1,
  "2022-09": 17.2, "2022-10": 17.9, "2022-11": 17.5, "2022-12": 16.6,
  "2023-01": 16.6, "2023-02": 18.4, "2023-03": 16.1, "2023-04": 14.7,
  "2023-05": 13.0, "2023-06": 11.5, "2023-07": 10.8, "2023-08": 10.1,
  "2023-09": 8.2, "2023-10": 6.6, "2023-11": 6.6, "2023-12": 6.2,
  "2024-01": 3.9, "2024-02": 2.8, "2024-03": 2.0, "2024-04": 2.4,
  "2024-05": 2.5, "2024-06": 2.6, "2024-07": 4.2, "2024-08": 4.3,
  "2024-09": 4.9, "2024-10": 5.0, "2024-11": 4.7, "2024-12": 4.7,
  "2025-01": 5.3, "2025-02": 5.4, "2025-03": 4.9, "2025-04": 4.3,
  "2025-05": 4.0, "2025-06": 4.1, "2025-07": 3.1, "2025-08": 2.9,
  "2025-09": 2.9, "2025-10": 2.8, "2025-11": 2.4, "2025-12": 2.4,
};

export type CpiSeries = Record<string, number>;

/**
 * Wskaźnik inflacji (CPI r/r, %) przyjmowany do ustalenia oprocentowania okresu
 * rozpoczynającego się w dniu `periodStart` — odczyt z miesiąca (periodStart − 2).
 * Zwraca `null`, gdy brak danych dla wymaganego miesiąca.
 */
export function inflationReferenceRate(
  periodStart: Date,
  cpi: CpiSeries = CPI_YOY,
): number | null {
  const ref = new Date(
    Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 2, 1),
  );
  const key = `${ref.getUTCFullYear()}-${String(ref.getUTCMonth() + 1).padStart(2, "0")}`;
  const value = cpi[key];
  return typeof value === "number" ? value : null;
}

export type BondRateParams = {
  firstPeriodRate: number;
  /** "stałe" => kupon stały (marża jako pełna stopa); inaczej indeksacja inflacją. */
  subsequentBase: string;
  marginOverBase: number;
};

/**
 * Roczna stopa procentowa danego okresu odsetkowego (w %).
 * Okres 0 = stopa emisyjna; kolejne okresy = inflacja + marża (lub stały kupon).
 */
export function bondPeriodRate(
  params: BondRateParams,
  periodIndex: number,
  periodStart: Date,
  cpi: CpiSeries = CPI_YOY,
): number {
  if (periodIndex === 0) {
    return params.firstPeriodRate;
  }

  if (params.subsequentBase === "stałe") {
    return params.marginOverBase;
  }

  const inflation = inflationReferenceRate(periodStart, cpi);
  // Brak danych CPI dla okresu => awaryjnie sama marża (jak dotychczas),
  // zamiast zerować całą stopę.
  if (inflation == null) {
    return Math.max(0, params.marginOverBase);
  }

  return Math.max(0, inflation) + params.marginOverBase;
}
