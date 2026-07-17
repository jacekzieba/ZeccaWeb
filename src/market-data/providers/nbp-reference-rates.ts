import type { ReferenceRateChange } from "@/market-data/types";

// Historia podstawowych stóp procentowych NBP. Natywna appka scrapuje stronę
// nbp.pl (za ochroną Incapsula, więc w praktyce często spada do fallbacku);
// web korzysta z oficjalnych, niechronionych XML-i na static.nbp.pl:
//  - archiwum: każda zmiana stóp od 1998 r. (`obowiazuje_od` + pozycja id="ref"),
//  - bieżący:  aktualna stopa z datą obowiązywania (na wypadek, gdyby archiwum
//    nie zostało jeszcze zaktualizowane po świeżej decyzji RPP).
const NBP_ARCHIVE_XML_URL =
  "https://static.nbp.pl/dane/stopy/stopy_procentowe_archiwum.xml";
const NBP_CURRENT_XML_URL =
  "https://static.nbp.pl/dane/stopy/stopy_procentowe.xml";

export async function fetchNbpReferenceRates(): Promise<ReferenceRateChange[]> {
  const [archiveResult, currentResult] = await Promise.allSettled([
    fetchXml(NBP_ARCHIVE_XML_URL),
    fetchXml(NBP_CURRENT_XML_URL),
  ]);

  const archive =
    archiveResult.status === "fulfilled"
      ? parseNbpReferenceRateArchiveXml(archiveResult.value)
      : [];
  const current =
    currentResult.status === "fulfilled"
      ? parseNbpCurrentReferenceRateXml(currentResult.value)
      : null;

  const merged = mergeReferenceRates(archive, current);
  if (merged.length === 0) {
    const reason =
      archiveResult.status === "rejected"
        ? String(archiveResult.reason)
        : "no parseable reference rates";
    throw new Error(`NBP reference rates unavailable: ${reason}`);
  }
  return merged;
}

async function fetchXml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: "application/xml,text/xml" },
    next: { revalidate: 6 * 60 * 60 },
  });
  if (!response.ok) {
    throw new Error(`NBP returned ${response.status} for ${url}.`);
  }
  return response.text();
}

/**
 * Parsuje archiwum stóp: bloki `<pozycje obowiazuje_od="RRRR-MM-DD">` z
 * pozycją `id="ref"`. Regex zamiast parsera DOM, bo route działa w Node bez
 * DOMParser, a format pliku jest stabilny (publikowany od 2015 r.).
 */
export function parseNbpReferenceRateArchiveXml(xml: string): ReferenceRateChange[] {
  const changes: ReferenceRateChange[] = [];
  const blockPattern = /<pozycje[^>]*obowiazuje_od="(\d{4}-\d{2}-\d{2})"[^>]*>([\s\S]*?)<\/pozycje>/g;

  for (const block of xml.matchAll(blockPattern)) {
    const rate = referenceRateFromPositions(block[2]);
    if (rate != null) {
      changes.push({ provider: "nbp", effectiveDate: block[1], rate });
    }
  }

  return changes.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

/** Parsuje bieżący plik stóp: pozycja `id="ref"` z `oprocentowanie` i `obowiazuje_od`. */
export function parseNbpCurrentReferenceRateXml(xml: string): ReferenceRateChange | null {
  const positions = matchRefPositions(xml);
  for (const position of positions) {
    const date = /obowiazuje_od="(\d{4}-\d{2}-\d{2})"/.exec(position)?.[1];
    const rate = parseRateAttribute(position);
    if (date && rate != null) {
      return { provider: "nbp", effectiveDate: date, rate };
    }
  }
  return null;
}

function referenceRateFromPositions(blockBody: string): number | null {
  const positions = matchRefPositions(blockBody);
  for (const position of positions) {
    const rate = parseRateAttribute(position);
    if (rate != null) return rate;
  }
  return null;
}

function matchRefPositions(xml: string): string[] {
  return [...xml.matchAll(/<pozycja\b[^>]*\/?>/g)]
    .map((match) => match[0])
    .filter((tag) => /\bid="ref"/.test(tag));
}

function parseRateAttribute(tag: string): number | null {
  const raw = /oprocentowanie="([\d,.]+)"/.exec(tag)?.[1];
  if (!raw) return null;
  const rate = Number(raw.replace(",", "."));
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

function mergeReferenceRates(
  archive: ReferenceRateChange[],
  current: ReferenceRateChange | null,
): ReferenceRateChange[] {
  if (!current) return archive;
  const known = new Set(archive.map((change) => change.effectiveDate));
  if (known.has(current.effectiveDate)) return archive;
  return [...archive, current].sort((a, b) =>
    a.effectiveDate.localeCompare(b.effectiveDate),
  );
}
