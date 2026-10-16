import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PortfolioEditorModal } from "@/features/portfolios/portfolio-editor-modal";
import { saveRecord } from "@/sync/records/record-writer";

// Synchronizacja w tle (co 60 s, realtime, po każdej mutacji) zawsze podmienia
// `records` nową tablicą, więc strony budują nowy obiekt szkicu o tej samej
// treści. Edytor nie może przez to gubić tego, co użytkownik już wpisał.

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: unknown) => unknown) =>
    selector({ userDataKey: {}, supabase: {}, records: [], setSync: vi.fn(), publicDemo: false }),
}));

vi.mock("@/sync/records/record-writer", () => ({
  refreshSyncStore: vi.fn(async () => ({ records: [], snapshot: null, summary: null })),
  saveRecord: vi.fn(async () => ({ queued: false })),
}));

const draft = () => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "IKE",
  baseCurrency: "PLN",
  accountType: "IKE",
  updatedAt: "2026-10-01T10:00:00.000Z",
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("edytor a odświeżenie w tle", () => {
  it("nie kasuje wpisanej nazwy, gdy przychodzi ten sam portfel jako nowy obiekt", () => {
    const { rerender } = render(<PortfolioEditorModal open initialValue={draft()} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Nazwa portfela") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "IKE — emerytura" } });

    rerender(<PortfolioEditorModal open initialValue={draft()} onClose={vi.fn()} />);

    expect((screen.getByLabelText("Nazwa portfela") as HTMLInputElement).value).toBe("IKE — emerytura");
  });

  it("zapisuje ze znacznikiem z chwili otwarcia, więc zmiana z innego urządzenia daje konflikt, a nie ciche nadpisanie", async () => {
    const { rerender } = render(<PortfolioEditorModal open initialValue={draft()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nazwa portfela"), { target: { value: "IKE 2" } });

    // Inne urządzenie zmieniło portfel w trakcie edycji.
    rerender(
      <PortfolioEditorModal
        open
        initialValue={{ ...draft(), name: "IKE z telefonu", updatedAt: "2026-10-01T10:05:00.000Z" }}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Zapisz/ }));

    await waitFor(() => expect(vi.mocked(saveRecord)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveRecord).mock.calls[0]?.[4]).toMatchObject({ baseUpdatedAt: "2026-10-01T10:00:00.000Z" });
  });

  it("po zamknięciu i ponownym otwarciu pokazuje aktualne dane", () => {
    const { rerender } = render(<PortfolioEditorModal open initialValue={draft()} onClose={vi.fn()} />);
    rerender(<PortfolioEditorModal open={false} initialValue={null} onClose={vi.fn()} />);
    rerender(<PortfolioEditorModal open initialValue={{ ...draft(), name: "Nowa nazwa" }} onClose={vi.fn()} />);

    expect((screen.getByLabelText("Nazwa portfela") as HTMLInputElement).value).toBe("Nowa nazwa");
  });
});
