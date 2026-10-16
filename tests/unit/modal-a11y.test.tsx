import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PortfolioEditorModal } from "@/features/portfolios/portfolio-editor-modal";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";

// Edytory (portfel, alokacja, instrument, transakcja) były zwykłymi <div>
// w portalu: czytnik nie wiedział, że to okno, Escape nic nie robił, fokus
// zostawał pod spodem, a „×” czytało się jako „razy”.

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: unknown) => unknown) =>
    selector({ userDataKey: {}, supabase: {}, records: [], setSync: vi.fn(), publicDemo: false }),
}));

vi.mock("@/sync/records/record-writer", () => ({
  refreshSyncStore: vi.fn(),
  saveRecord: vi.fn(),
}));

afterEach(cleanup);

describe("edytor jako okno modalne", () => {
  it("jest nazwanym dialogiem z przyciskiem „Zamknij” i fokusem w środku", () => {
    render(<PortfolioEditorModal open initialValue={null} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Dodaj portfel" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("Escape zamyka edytor", () => {
    const onClose = vi.fn();
    render(<PortfolioEditorModal open initialValue={null} onClose={onClose} />);

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape w rozwiniętej liście zamyka listę, nie edytor", () => {
    const onClose = vi.fn();
    render(<PortfolioEditorModal open initialValue={null} onClose={onClose} />);
    const combobox = screen.getByRole("combobox", { name: "Typ portfela" });
    fireEvent.click(combobox);

    fireEvent.keyDown(combobox, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
  });

  it("przy potwierdzeniu nad edytorem Escape zamyka tylko potwierdzenie", () => {
    const onCloseEditor = vi.fn();
    const onCancelConfirm = vi.fn();
    const layers = (confirmOpen: boolean) => (
      <>
        <PortfolioEditorModal open initialValue={null} onClose={onCloseEditor} />
        <ConfirmDialog open={confirmOpen} title="Na pewno?" confirmLabel="Tak" onConfirm={vi.fn()} onCancel={onCancelConfirm} />
      </>
    );
    const { rerender } = render(layers(false));
    rerender(layers(true));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(onCancelConfirm).toHaveBeenCalledTimes(1);
    expect(onCloseEditor).not.toHaveBeenCalled();
  });

  it("potwierdzenie ogłasza też swoją treść", () => {
    render(<ConfirmDialog open title="Usunąć portfel?" body="Transakcje zostaną usunięte." confirmLabel="Usuń" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole("alertdialog", { name: "Usunąć portfel?" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe("Transakcje zostaną usunięte.");
  });
});
