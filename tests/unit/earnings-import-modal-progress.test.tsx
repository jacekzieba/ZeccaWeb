import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EarningsImportModal } from "@/features/earnings/earnings-import-modal";
import { readSpreadsheet } from "@/features/import/read-spreadsheet";

vi.mock("@/features/import/read-spreadsheet", () => ({
  readSpreadsheet: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("EarningsImportModal file progress", () => {
  it("shows and announces progress while a spreadsheet is being read", async () => {
    vi.mocked(readSpreadsheet).mockReturnValue(new Promise(() => {}));
    render(
      <EarningsImportModal
        earnings={[]}
        burdens={[]}
        onClose={vi.fn()}
        onCommit={vi.fn()}
      />,
    );

    await screen.findByRole("dialog", { name: "Import zarobków" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["spreadsheet"], "earnings.xlsx")],
      },
    });

    const progressbar = await screen.findByRole("progressbar", { name: "Postęp importu pliku" });
    await waitFor(() => {
      expect(progressbar.getAttribute("aria-valuenow")).toBe("25");
    });
    expect(screen.getByRole("status").textContent).toContain("Odczytywanie arkusza…");
    expect(input.disabled).toBe(true);
  });
});
