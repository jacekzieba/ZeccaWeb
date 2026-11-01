#!/usr/bin/env node
// Migracje Supabase mają jedno źródło: repo natywne (Zecca/supabase/migrations).
// Bez argumentów kopiuje je do supabase/migrations; z --check tylko porównuje
// (kod wyjścia 1 przy różnicy). Ścieżka repo: ~/Desktop/Zecca lub NATIVE_REPO.
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const repo = process.env.NATIVE_REPO ?? join(homedir(), "Desktop", "Zecca");
const source = join(repo, "supabase", "migrations");
const target = join("supabase", "migrations");
const check = process.argv.includes("--check");

if (!existsSync(source)) {
  console.error(`Brak ${source} — ustaw NATIVE_REPO`);
  process.exit(2);
}

const sql = (dir) => readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
const wanted = sql(source);
const present = sql(target);
let drift = false;

for (const name of present.filter((file) => !wanted.includes(file))) {
  drift = true;
  console.error(`nadmiarowa migracja: ${name}`);
  if (!check) rmSync(join(target, name));
}
for (const name of wanted) {
  const to = join(target, name);
  const same = existsSync(to) && readFileSync(join(source, name), "utf8") === readFileSync(to, "utf8");
  if (same) continue;
  drift = true;
  console.error(`${existsSync(to) ? "różna treść" : "brakująca"}: ${name}`);
  if (!check) copyFileSync(join(source, name), to);
}

if (check && drift) process.exit(1);
console.log(check ? "Migracje zgodne z repo natywnym." : "Migracje zsynchronizowane z repo natywnym.");
