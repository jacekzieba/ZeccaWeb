type Dated = { label: string; date?: string };

const YEAR_SPAN_DAYS = 330;

/**
 * Etykieta osi czasu: gdy seria obejmuje niemal rok lub więcej, krótka etykieta
 * dnia („15 paź”) dostaje rok („15 paź ’25”) — inaczej początek i koniec osi
 * mają ten sam podpis i nie wiadomo, który jest który.
 */
export function axisLabeler(points: Dated[]): (point: Dated) => string {
  const first = points[0]?.date;
  const last = points[points.length - 1]?.date;
  if (!first || !last) return (point) => point.label;
  const spanDays = (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000;
  if (!(spanDays >= YEAR_SPAN_DAYS)) return (point) => point.label;
  return (point) => (point.date ? `${point.label} ’${point.date.slice(2, 4)}` : point.label);
}
