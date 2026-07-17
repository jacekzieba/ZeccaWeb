import { describe, expect, it } from "vitest";
import {
  parseNbpCurrentReferenceRateXml,
  parseNbpReferenceRateArchiveXml,
} from "@/market-data/providers/nbp-reference-rates";
import { NBP_REFERENCE_RATES, bondPeriodRate } from "@/domain/valuation/bond-rates";

const ARCHIVE_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<stopy_procentowe_archiwum data_publikacji="2015-03-04">
    <pozycje obowiazuje_od="2025-10-09">
        <pozycja id="ref" oprocentowanie="4,50" />
        <pozycja id="lom" oprocentowanie="5,00" />
    </pozycje>
    <pozycje obowiazuje_od="2025-11-06">
        <pozycja id="ref" oprocentowanie="4,25" />
        <pozycja id="lom" oprocentowanie="4,75" />
    </pozycje>
    <pozycje obowiazuje_od="2026-03-05">
        <pozycja id="ref" oprocentowanie="3,75" />
    </pozycje>
</stopy_procentowe_archiwum>`;

const CURRENT_SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<stopy_procentowe data_publikacji="2026-03-05">
    <tabela id="stoproc" naglowek="Stopa procentowa:" header="NBP base rates:">
        <pozycja
            id="ref"
            nazwa="Stopa referencyjna"
            name="Reference rate (minimum money market intervention rate)"
            odnosnik="1"
            oprocentowanie="3,75"
            trend = "spadek"
            obowiazuje_od="2026-03-05" />
        <pozycja id="lom" nazwa="Stopa lombardowa" oprocentowanie="4,25" obowiazuje_od="2026-03-05" />
    </tabela>
</stopy_procentowe>`;

describe("parseNbpReferenceRateArchiveXml", () => {
  it("extracts only the reference-rate positions, sorted by effective date", () => {
    const changes = parseNbpReferenceRateArchiveXml(ARCHIVE_SAMPLE);
    expect(changes).toEqual([
      { provider: "nbp", effectiveDate: "2025-10-09", rate: 4.5 },
      { provider: "nbp", effectiveDate: "2025-11-06", rate: 4.25 },
      { provider: "nbp", effectiveDate: "2026-03-05", rate: 3.75 },
    ]);
  });

  it("returns an empty list for XML without reference positions", () => {
    expect(parseNbpReferenceRateArchiveXml("<stopy_procentowe_archiwum/>")).toEqual([]);
  });
});

describe("parseNbpCurrentReferenceRateXml", () => {
  it("extracts the current reference rate with its effective date", () => {
    expect(parseNbpCurrentReferenceRateXml(CURRENT_SAMPLE)).toEqual({
      provider: "nbp",
      effectiveDate: "2026-03-05",
      rate: 3.75,
    });
  });

  it("returns null when the ref position is missing", () => {
    expect(parseNbpCurrentReferenceRateXml("<stopy_procentowe/>")).toBeNull();
  });
});

describe("NBP_REFERENCE_RATES fallback table", () => {
  it("includes the 2025-11-06 cut to 4.25% missed by the legacy table", () => {
    const november = NBP_REFERENCE_RATES.find(
      (observation) => observation.date.toISOString().slice(0, 10) === "2025-11-06",
    );
    expect(november?.rate).toBe(4.25);
  });

  it("prices a ROR-style period starting between the Nov and Dec 2025 decisions at 4.25% + margin", () => {
    const rate = bondPeriodRate(
      { firstPeriodRate: 5.75, subsequentBase: "stopa referencyjna NBP", marginOverBase: 0 },
      3,
      new Date("2025-11-20T00:00:00.000Z"),
    );
    expect(rate).toBe(4.25);
  });
});
