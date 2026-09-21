#!/usr/bin/env node
// Kopiuje (lub sprawdza) fixtury złote z repo natywnego. Domyślna ścieżka repo:
// ~/Desktop/Zecca; nadpisz przez NATIVE_REPO=/ścieżka/do/Zecca.
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const repo = process.env.NATIVE_REPO ?? join(homedir(), "Desktop", "Zecca");
const files = [
  ["Tests/Fixtures/TransactionScenarios/all_transaction_types.json", "all_transaction_types.json"],
  ["Tests/Fixtures/ValuationScenarios/diversified_portfolio.json", "diversified_portfolio.json"],
];
const check = process.argv.includes("--check");
let drift = false;

for (const [from, name] of files) {
  const source = join(repo, from);
  const target = join("tests", "fixtures", "native-golden", name);
  if (!existsSync(source)) {
    console.error(`Brak ${source} — ustaw NATIVE_REPO`);
    process.exit(2);
  }
  if (check) {
    const same = readFileSync(source, "utf8") === readFileSync(target, "utf8");
    console.log(`${same ? "OK   " : "ROZJAZD"} ${name}`);
    drift ||= !same;
  } else {
    copyFileSync(source, target);
    console.log(`skopiowano ${name}`);
  }
}
process.exit(drift ? 1 : 0);
