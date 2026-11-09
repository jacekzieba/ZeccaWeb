import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { makeAssetPayload } from "@/sync/records/macos-payloads";
import type { WriteRecordPayload } from "@/sync/records/record-writer";

export type BondImportPreview = {
  newInstrumentPayloads?: WriteRecordPayload[];
  updatedInstrumentPayloads?: WriteRecordPayload[];
  bondUpdateBaseVersions?: Record<string, string>;
  referencedBondCodes?: string[];
  bondRefreshFailures?: string[];
};

async function loadParams(code: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(`/api/market-data/bond-params?code=${encodeURIComponent(code)}`);
  if (!response.ok) return null;
  const body = await response.json() as { data?: Record<string, unknown> };
  return body.data ?? null;
}

function withParams(payload: WriteRecordPayload, params: Record<string, unknown>): WriteRecordPayload {
  return makeAssetPayload({
    existing: payload, id: payload.id, kind: String(payload.kind), symbol: String(payload.symbol),
    name: String(payload.name), currency: String(payload.currency),
    exchange: payload.exchange as string | null, country: payload.country as string | null,
    isin: payload.isin as string | null, category: payload.category as string | null,
    marketDataID: payload.marketDataID as string | null, bondParams: params,
  });
}

/** Preview only: existing records are never mutated until the user commits. */
export async function enrichTreasuryBondParams<T extends BondImportPreview>(
  preview: T,
  records: readonly DecryptedRecord[] | null,
  lookup = loadParams,
): Promise<T & { updatedInstrumentPayloads: WriteRecordPayload[]; bondUpdateBaseVersions: Record<string, string>; bondRefreshFailures: string[] }> {
  const existing = (records ?? []).filter(record => !record.deletedAt && record.envelope.type === "asset")
    .map(record => record.envelope.payload as WriteRecordPayload)
    .filter(payload => payload.kind === "treasuryBond" && preview.referencedBondCodes?.includes(String(payload.symbol).toUpperCase()));
  const updatedInstrumentPayloads: WriteRecordPayload[] = [];
  const bondRefreshFailures: string[] = [];
  const bondUpdateBaseVersions: Record<string, string> = {};
  const newInstrumentPayloads = await Promise.all((preview.newInstrumentPayloads ?? []).map(async payload => {
    if (payload.kind !== "treasuryBond" || payload.bondParams || typeof payload.symbol !== "string") return payload;
    try {
      const params = await lookup(payload.symbol);
      if (!params) bondRefreshFailures.push(payload.symbol);
      return params ? withParams(payload, params) : payload;
    } catch { bondRefreshFailures.push(String(payload.symbol)); return payload; }
  }));
  await Promise.all(existing.map(async payload => {
    try {
      const params = await lookup(String(payload.symbol));
      if (!params) { bondRefreshFailures.push(String(payload.symbol)); return; }
      const refreshed = withParams(payload, params);
      const previous = (payload.bondParams ?? {}) as Record<string, unknown>;
      const next = refreshed.bondParams as Record<string, unknown>;
      if (Object.keys(next).some(key => previous[key] !== next[key])) {
        updatedInstrumentPayloads.push(refreshed);
        bondUpdateBaseVersions[payload.id] = records!.find(record => record.id === payload.id)!.updatedAt;
      }
    } catch { bondRefreshFailures.push(String(payload.symbol)); }
  }));
  updatedInstrumentPayloads.sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
  return { ...preview, newInstrumentPayloads, updatedInstrumentPayloads, bondUpdateBaseVersions, bondRefreshFailures: bondRefreshFailures.sort() };
}
