import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ImportProgressIndicator } from "@/features/import/import-progress";

afterEach(cleanup);

describe("ImportProgressIndicator", () => {
  it("announces the current import stage and exposes bounded progress", () => {
    render(
      <ImportProgressIndicator
        label="Analizowanie danych…"
        value={72}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Analizowanie danych…");
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar.getAttribute("aria-valuenow")).toBe("72");
    expect(progressbar.getAttribute("aria-valuetext")).toBe("Analizowanie danych…");
  });

  it("clamps out-of-range values before rendering them", () => {
    render(
      <ImportProgressIndicator
        label="Kończenie importu…"
        value={130}
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
