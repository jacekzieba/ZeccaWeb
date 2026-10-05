// Sprawdza wymuszone CSP na wersji produkcyjnej (next build + next start):
// każdy wykonywalny skrypt ma nonce, brak naruszeń, strony się hydratują.
// Uruchamiane w CI — w next dev CSP jest tylko Report-Only.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://127.0.0.1:3200";
const paths = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/faq", "/privacy-policy", "/demo", "/dashboard", "/nie-ma-takiej-strony"];
const browser = await chromium.launch();
let failed = 0;
for (const path of paths) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__cspViolations.push(`${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`));
  });
  const consoleCsp = [];
  page.on("console", (m) => { if (/Content Security Policy|Content-Security-Policy/i.test(m.text())) consoleCsp.push(m.text().slice(0, 200)); });
  const resp = await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const all = [...document.querySelectorAll("*")];
    const hydrated = all.some((el) => Object.keys(el).some((k) => k.startsWith("__reactFiber$")));
    const scripts = [...document.querySelectorAll("script")];
    const exec = scripts.filter((s) => !s.type || s.type === "text/javascript" || s.type === "module");
    return {
      hydrated,
      execScripts: exec.length,
      // Skrypty Vercel Analytics / Speed Insights wstawia createElement z już
      // zaufanego skryptu — 'strict-dynamic' je przepuszcza, nonce nie mają.
      execWithoutNonce: exec.filter((s) => !s.nonce && !s.src.includes("/_vercel/")).length,
      vercel: exec.filter((s) => s.src.includes("/_vercel/")).map((s) => new URL(s.src).pathname),
      violations: window.__cspViolations,
    };
  });
  const csp = resp.headers()["content-security-policy"] ?? "(brak)";
  const scriptSrc = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith("script-src"));
  const ok = info.hydrated && info.violations.length === 0 && consoleCsp.length === 0 && info.execWithoutNonce === 0;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${path} -> ${page.url().replace(base, "")} [${resp.status()}] hydrated=${info.hydrated} scripts=${info.execScripts} bezNonce=${info.execWithoutNonce} vercel=${info.vercel.join(",")} violations=${info.violations.length + consoleCsp.length} | ${scriptSrc?.replace(/nonce-[^']+/, "nonce-…")}`);
  for (const v of [...info.violations, ...consoleCsp].slice(0, 3)) console.log("      ", v);
  await ctx.close();
}
await browser.close();
console.log(failed ? `FAILED: ${failed}` : "ALL OK");
process.exit(failed ? 1 : 0);
