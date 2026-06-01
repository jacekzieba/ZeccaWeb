#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const [, , leftPath, rightPath, toleranceArg] = process.argv;
const tolerance = toleranceArg == null ? 0.01 : Number(toleranceArg);

if (!leftPath || !rightPath || !Number.isFinite(tolerance)) {
  console.error("Usage: node scripts/compare-parity-snapshot.mjs <left.json> <right.json> [numericTolerance]");
  process.exit(2);
}

const left = JSON.parse(readFileSync(resolve(leftPath), "utf8"));
const right = JSON.parse(readFileSync(resolve(rightPath), "utf8"));
const diffs = [];

compare(normalizeSnapshot(left), normalizeSnapshot(right), "$");

if (diffs.length > 0) {
  console.error(`Parity snapshots differ (${diffs.length} difference${diffs.length === 1 ? "" : "s"}):`);
  for (const diff of diffs.slice(0, 80)) {
    console.error(`- ${diff}`);
  }
  if (diffs.length > 80) {
    console.error(`... ${diffs.length - 80} more differences omitted`);
  }
  process.exit(1);
}

console.log("Parity snapshots match.");

function compare(a, b, path) {
  if (typeof a === "number" || typeof b === "number") {
    if (typeof a !== "number" || typeof b !== "number") {
      diffs.push(`${path}: type mismatch ${typeof a} !== ${typeof b}`);
      return;
    }

    if (Number.isNaN(a) || Number.isNaN(b) || Math.abs(a - b) > tolerance) {
      diffs.push(`${path}: ${a} !== ${b} (tolerance ${tolerance})`);
    }
    return;
  }

  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    if (a !== b) {
      diffs.push(`${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
    }
    return;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      diffs.push(`${path}: array/object mismatch`);
      return;
    }

    if (a.length !== b.length) {
      diffs.push(`${path}: length ${a.length} !== ${b.length}`);
    }

    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      compare(a[index], b[index], `${path}[${index}]`);
    }
    return;
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of [...keys].sort()) {
    if (!(key in a)) {
      diffs.push(`${path}.${key}: missing from left`);
      continue;
    }

    if (!(key in b)) {
      diffs.push(`${path}.${key}: missing from right`);
      continue;
    }

    compare(a[key], b[key], `${path}.${key}`);
  }
}

function normalizeSnapshot(snapshot) {
  return {
    schema: "investor-parity-comparable/v1",
    recordSummary: {
      totalRecords: snapshot.recordSummary?.totalRecords ?? 0,
      byType: normalizeByType(snapshot.recordSummary?.byType ?? {}),
    },
    totals: {
      totalValue: snapshot.totals?.totalValue,
      cash: snapshot.totals?.cash,
      monthlyChange: snapshot.totals?.monthlyChange,
      income: snapshot.totals?.income,
      valuationPointCount: snapshot.totals?.valuationPointCount,
      firstValuationPoint: normalizeValuePoint(snapshot.totals?.firstValuationPoint),
      lastValuationPoint: normalizeValuePoint(snapshot.totals?.lastValuationPoint),
    },
    portfolios: (snapshot.portfolios ?? []).map((portfolio) => ({
      id: normalizeID(portfolio.id),
      name: portfolio.name,
      baseCurrency: portfolio.baseCurrency,
      value: portfolio.value,
      positions: portfolio.positions,
      cashValue: portfolio.cashValue,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    instruments: (snapshot.instruments ?? []).map((instrument) => ({
      id: normalizeID(instrument.id),
      symbol: instrument.symbol,
      name: instrument.name,
      currency: instrument.currency,
      kind: instrument.kind,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    transactions: (snapshot.transactions ?? []).map((transaction) => ({
      id: normalizeID(transaction.id),
      date: dateOnly(transaction.date),
      portfolioID: normalizeID(transaction.portfolioID ?? transaction.portfolioId),
      instrumentID: normalizeID(transaction.instrumentID ?? transaction.instrumentId),
      type: transaction.type ?? transaction.transactionType,
      grossAmount: transaction.grossAmount,
      currency: transaction.currency,
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

function normalizeByType(byType) {
  const result = {};
  for (const [key, value] of Object.entries(byType)) {
    result[key] = value;
  }
  return result;
}

function normalizeValuePoint(point) {
  if (!point) return null;
  return {
    date: dateOnly(point.date),
    value: point.value,
  };
}

function normalizeID(value) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function dateOnly(value) {
  if (typeof value !== "string") return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
