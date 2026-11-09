import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fetchTreasuryBondParams } from "@/market-data/providers/treasury-bond-params";

it.skipIf(process.env.ZECCA_BOND_LIVE_CHECK !== "1")("historical issuer pages still match reviewed fields", async () => {
  const issues = JSON.parse(readFileSync(resolve(process.cwd(), "tests/fixtures/bond-pages/manifest.json"), "utf8")) as {
    code: string; firstPeriodRate: number; marginOverBase: number; earlyRedemptionFee: number;
  }[];
  await Promise.all(issues.map(async issue => {
    expect(await fetchTreasuryBondParams(issue.code), issue.code).toMatchObject({
      firstPeriodRate: issue.firstPeriodRate, marginOverBase: issue.marginOverBase, earlyRedemptionFee: issue.earlyRedemptionFee,
    });
  }));
}, 60000);
