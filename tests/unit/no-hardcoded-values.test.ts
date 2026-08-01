import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Katalogi objęte bramką. Rośnie wraz z migracją. */
const MIGRATED = ["src/design", "src/lib"];

const ALLOWED = new Set(["src/design/tokens.ts", "src/design/tokens.css"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx|css)$/.test(full) ? [full] : [];
  });
}

const files = MIGRATED.flatMap(walk).filter((f) => !ALLOWED.has(f));

describe("bramka wartosci zahardkodowanych", () => {
  it.each(files)("%s nie zawiera literalu hex", (file) => {
    const hits = readFileSync(file, "utf8").match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hits, `znaleziono: ${hits.join(", ")}`).toHaveLength(0);
  });

  it.each(files)("%s nie zawiera promienia spoza tokenow", (file) => {
    const src = readFileSync(file, "utf8");
    const hits = [
      ...(src.match(/border(?:-[a-z]+)*-radius:\s*\d+px/g) ?? []),
      ...(src.match(/border(?:[A-Z][a-z]+)*Radius:\s*["']?\d+/g) ?? []),
    ];
    expect(hits, `znaleziono: ${hits.join(", ")}`).toHaveLength(0);
  });
});
