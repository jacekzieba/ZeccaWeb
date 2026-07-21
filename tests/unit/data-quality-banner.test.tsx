import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DataQualityBanner } from "@/features/sync/data-quality-banner";
import type { SnapshotDiagnostic } from "@/domain/models/investor-data";

afterEach(cleanup);

describe("DataQualityBanner", () => {
  it("renders nothing when there are no diagnostics", () => {
    const { container } = render(<DataQualityBanner diagnostics={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("surfaces the treasury-bond macro gap as an approximate-valuation warning", () => {
    const diagnostics: SnapshotDiagnostic[] = [
      { code: "bond-missing-macro", severity: "info", context: "ROR1234" },
    ];
    const { container } = render(<DataQualityBanner diagnostics={diagnostics} />);

    const banner = container.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    const text = banner?.textContent ?? "";
    expect(text).toContain("wartości mogą być przybliżone");
    expect(text).toContain(
      "Niepełne dane makro do wyceny obligacji (wynik przybliżony): ROR1234.",
    );
  });

  it("dedupes contexts and lists every diagnostic code that is present", () => {
    const diagnostics: SnapshotDiagnostic[] = [
      { code: "bond-missing-macro", severity: "info", context: "ROR1234" },
      { code: "bond-missing-macro", severity: "info", context: "ROR1234" },
      { code: "price-missing", severity: "warning", context: "AAPL" },
      { code: "fx-missing", severity: "warning", context: "USD" },
    ];
    const { container } = render(<DataQualityBanner diagnostics={diagnostics} />);

    const text = container.querySelector('[role="status"]')?.textContent ?? "";
    // Deduped: the repeated ROR1234 context appears once.
    expect(text.match(/ROR1234/g)).toHaveLength(1);
    expect(text).toContain("Brak aktualnej ceny (pominięte w wartości): AAPL.");
    expect(text).toContain("Brak kursu waluty (liczone 1:1 do PLN): USD.");
  });
});
