import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec Skarbca §6: „Cienie nie istnieją — głębię niesie powierzchnia i krawędź.”
// design-tokens.test.ts pilnuje tylko tokens.css; komponenty malują cień inline
// (boxShadow), więc bez tego testu dryf wraca po jednym „drobnym” dodatku.
//
// Dozwolone są wyłącznie formy bez rozmycia: włosowy błysk `inset 0 1px 0`,
// pierścień zaznaczenia `inset 0 0 0`, znacznik krawędzi `inset 2px 0 0`
// i zaciemnienie overlayu `0 0 0 9999px`.
const ALLOWED = [/inset 0 (0\.5|1)px 0(?!\s*\d)/, /inset 0 0 0/, /inset 2px 0 0/, /0 0 0 9999px/];
const DROP = /-?\d+(\.\d+)?(px)?\s+-?\d+(\.\d+)?(px)?\s+\d+(\.\d+)?px/; // x y blur (zero bez jednostki też)

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("komponenty nie malują cieni", () => {
  it("żaden boxShadow w src/ nie ma rozmycia (offset + blur)", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      readFileSync(file, "utf8").split("\n").forEach((line, i) => {
        if (!/boxShadow|box-shadow/.test(line)) return;
        let rest = line;
        for (const ok of ALLOWED) rest = rest.replace(new RegExp(ok, "g"), "");
        if (DROP.test(rest)) offenders.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
