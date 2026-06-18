import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InstrumentCandidate } from "@/market-data/types";
import { InstrumentEditorModal } from "@/features/instruments/instrument-editor-modal";

// The modal only needs read access to the sync store for rendering; the search
// autocomplete path under test does not touch Supabase, so we stub the store
// and record writers to keep the component test free of network/crypto deps.
vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: unknown) => unknown) =>
    selector({ userDataKey: null, supabase: null, setSync: vi.fn() }),
}));

vi.mock("@/sync/records/record-writer", () => ({
  refreshSyncStore: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock("@/sync/records/macos-payloads", () => ({
  makeAssetPayload: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function searchResponse(data: InstrumentCandidate[]) {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function symbolInput() {
  return screen.getByPlaceholderText("np. VWCE, BTC, EDO1033") as HTMLInputElement;
}

function nameInput() {
  return screen.getByPlaceholderText("np. Vanguard FTSE All-World") as HTMLInputElement;
}

describe("InstrumentEditorModal Yahoo autocomplete", () => {
  it("debounces the query then lets the user pick a listing to fill the fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      searchResponse([
        {
          provider: "yahoo",
          symbol: "VWCE.DE",
          name: "Vanguard FTSE All-World UCITS ETF",
          exchange: "XETRA",
          currency: "EUR",
          kind: "etf",
        },
        {
          provider: "yahoo",
          symbol: "VWCE.L",
          name: "Vanguard FTSE All-World UCITS ETF",
          exchange: "LSE",
          currency: "GBP",
          kind: "etf",
        },
      ]),
    );

    render(<InstrumentEditorModal open initialValue={null} onClose={vi.fn()} />);
    fireEvent.change(symbolInput(), { target: { value: "VWCE" } });

    const option = await screen.findByText("VWCE.L");
    // A single debounced request covers the typed query.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("q=VWCE");

    fireEvent.click(option);

    expect(symbolInput().value).toBe("VWCE.L");
    expect(nameInput().value).toBe("Vanguard FTSE All-World UCITS ETF");
    // GBP is a known currency, so it is applied automatically.
    expect(screen.getByDisplayValue("GBP")).toBeTruthy();
  });

  it("auto-applies a single candidate without showing a list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      searchResponse([
        {
          provider: "yahoo",
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          currency: "USD",
          kind: "stock",
        },
      ]),
    );

    render(<InstrumentEditorModal open initialValue={null} onClose={vi.fn()} />);
    fireEvent.change(symbolInput(), { target: { value: "AAPL" } });

    await waitFor(() => expect(nameInput().value).toBe("Apple Inc."));
    expect(symbolInput().value).toBe("AAPL");
    expect(screen.getByDisplayValue("USD")).toBeTruthy();
  });
});
