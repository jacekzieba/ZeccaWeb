// Polski skład nie zostawia jednoliterowych spójników na końcu wiersza.
// Zamiast poprawiać to ręcznie w copy.ts, wiążemy je twardą spacją przy
// renderowaniu — tekst w copy.ts zostaje czytelny do edycji.

const SINGLE_LETTERS = "aiouwzAIOUWZ";

/** Wiąże jednoliterowe słowa z następnym wyrazem. Nie rusza treści w tagach. */
export function bindOrphans(html: string): string {
  return html.replace(
    /(^|[\s>(„"'])([aiouwzAIOUWZ])\s+(?=[^\s<])/g,
    (match, before, letter) => `${before}${letter} `,
  );
}

export function hasOrphanLetters(text: string): boolean {
  return new RegExp(`(^|\\s)[${SINGLE_LETTERS}]\\s`).test(text);
}
