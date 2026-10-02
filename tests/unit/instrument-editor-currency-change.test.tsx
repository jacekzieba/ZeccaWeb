import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { makeRecord } from "./helpers/records";
import { InstrumentEditorModal } from "@/features/instruments/instrument-editor-modal";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";
import { announce } from "@/components/feedback/status-announcer";

// Zmiana waluty instrumentu (np. VWRL.NL z USD na EUR): symbol notowań
// i waluta starych zakupów/sprzedaży muszą pójść za nią, inaczej cena
// przychodzi z innej linii giełdowej, a koszt liczy się po złym kursie.
// Odpowiednik natywnego InstrumentCurrencyChangeTests.

const store = vi.hoisted(() => ({
  state: {
    records: [] as DecryptedRecord[],
    userDataKey: {} as CryptoKey,
    supabase: {} as unknown,
    publicDemo: false,
    setSync: vi.fn(),
  },
}));

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: typeof store.state) => unknown) => selector(store.state),
}));

vi.mock("@/sync/records/record-writer", () => ({
  refreshSyncStore: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock("@/components/feedback/status-announcer", () => ({
  announce: vi.fn(),
}));

const VWRL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PORTFOLIO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BASE = "2026-09-30T10:00:00.000Z";

function trade(
  id: string,
  type: string,
  currency: string,
  extra: Record<string, unknown> = {},
  instrumentID = VWRL,
) {
  return makeRecord(
    "transaction",
    id,
    {
      recordType: "transaction",
      id,
      date: 780_000_000,
      portfolioID: PORTFOLIO,
      instrumentID,
      transactionType: type,
      quantity: 83,
      price: 160.46,
      grossAmount: 13_318.18,
      currency,
      fees: 0,
      taxes: 0,
      fxRateToBase: 3.71,
      notes: "",
      ...extra,
    },
    BASE,
  );
}

const buy = trade("11111111-0000-4000-8000-000000000001", "buy", "USD");
const sell = trade("11111111-0000-4000-8000-000000000002", "sell", "USD", { quantity: 3 });
const dividendPLN = trade("11111111-0000-4000-8000-000000000003", "dividend", "PLN", { quantity: null, price: null });
const dividendUSD = trade("11111111-0000-4000-8000-000000000004", "dividend", "USD", { quantity: null, price: null });
const otherBuy = trade("11111111-0000-4000-8000-000000000005", "buy", "USD", {}, OTHER);

const vwrlDraft = {
  id: VWRL,
  symbol: "VWRL.NL",
  name: "Vanguard FTSE All-World",
  kind: "etf",
  currency: "USD",
  category: null,
  exchange: "LSE",
  isin: "IE00B3RBWM25",
  marketDataID: "VWRL",
  updatedAt: BASE,
};

function pickCurrency(code: string) {
  fireEvent.click(screen.getByLabelText("Waluta"));
  fireEvent.mouseDown(screen.getByText(code));
}

function savedPayloads(recordType: string) {
  return vi
    .mocked(saveRecord)
    .mock.calls.filter((call) => call[2] === recordType)
    .map((call) => ({ payload: call[3] as Record<string, unknown>, options: call[4] }));
}

describe("InstrumentEditorModal currency change", () => {
  beforeEach(() => {
    store.state.records = [buy, sell, dividendPLN, dividendUSD, otherBuy];
    store.state.setSync = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockImplementation(async () => ({
      records: store.state.records,
      snapshot: null as never,
      summary: null as never,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("re-derives the untouched Yahoo symbol for the new currency", async () => {
    const onClose = vi.fn();
    render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={onClose} />);

    pickCurrency("EUR");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(savedPayloads("asset")).toHaveLength(1));
    expect(savedPayloads("asset")[0]!.payload).toMatchObject({ currency: "EUR", marketDataID: "VWRL.AS" });
  });

  it("keeps a Yahoo symbol typed in this edit", async () => {
    render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={vi.fn()} />);

    pickCurrency("EUR");
    fireEvent.change(screen.getByLabelText("Ticker Yahoo"), { target: { value: "vwrl.mi" } });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(savedPayloads("asset")).toHaveLength(1));
    expect(savedPayloads("asset")[0]!.payload).toMatchObject({ marketDataID: "VWRL.MI" });
  });

  it("offers to retag only this instrument's buys and sells, keeping price and FX rate", async () => {
    // Zakupy po zapisie instrumentu mają świeższe znaczniki — to one są
    // podstawą strażnika konfliktów, nie te sprzed otwarcia edytora.
    const freshBuy = { ...buy, updatedAt: "2026-10-01T08:00:00.000Z" };
    vi.mocked(refreshSyncStore).mockResolvedValueOnce({
      records: [freshBuy, sell, dividendPLN, dividendUSD, otherBuy],
      snapshot: null as never,
      summary: null as never,
    });
    const onClose = vi.fn();
    render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={onClose} />);

    pickCurrency("EUR");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Zmienić też walutę transakcji?" });
    expect(dialog.textContent).toContain("Instrument jest w EUR, a 2 zakupów lub sprzedaży zapisano w USD.");
    expect(screen.getByRole("button", { name: "Zostaw transakcje w USD" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Zmień 2 na EUR" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const trades = savedPayloads("transaction");
    expect(trades.map((t) => t.payload.id)).toEqual([buy.id, sell.id]);
    expect(trades[0]!.payload).toMatchObject({
      currency: "EUR",
      price: 160.46,
      quantity: 83,
      grossAmount: 13_318.18,
      fxRateToBase: 3.71,
    });
    expect(trades[0]!.options).toEqual({ baseUpdatedAt: freshBuy.updatedAt, recordId: freshBuy.id });
    expect(trades[1]!.payload).toMatchObject({ currency: "EUR", quantity: 3 });
    expect(trades[1]!.options).toMatchObject({ baseUpdatedAt: BASE, recordId: expect.any(String) });
    expect(store.state.setSync).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenCalledWith("Zmieniono walutę 2 transakcji na EUR.");
  });

  it("leaves transactions alone when the user keeps them in the old currency", async () => {
    const onClose = vi.fn();
    render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={onClose} />);

    pickCurrency("EUR");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
    fireEvent.click(await screen.findByRole("button", { name: "Zostaw transakcje w USD" }));

    expect(onClose).toHaveBeenCalled();
    expect(savedPayloads("transaction")).toHaveLength(0);
  });

  it("asks whenever trades disagree with the instrument, even without a currency change", async () => {
    // Instrument już przestawiony na EUR, zakupy wciąż w USD (native 3404cfff).
    render(
      <InstrumentEditorModal
        open
        initialValue={{ ...vwrlDraft, currency: "EUR", marketDataID: "VWRL.AS" }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    expect(await screen.findByRole("button", { name: "Zmień 2 na EUR" })).toBeTruthy();
    expect(savedPayloads("asset")[0]!.payload).toMatchObject({ marketDataID: "VWRL.AS" });
  });

  it("keeps the question open when the saved instrument comes back from the store", async () => {
    // Strona instrumentów po setSync podaje nowy obiekt instrumentu — to nie
    // może zgasić pytania, zanim użytkownik odpowie.
    const onClose = vi.fn();
    const { rerender } = render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={onClose} />);

    pickCurrency("EUR");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
    await screen.findByRole("button", { name: "Zmień 2 na EUR" });

    rerender(
      <InstrumentEditorModal
        open
        initialValue={{ ...vwrlDraft, currency: "EUR", marketDataID: "VWRL.AS", updatedAt: "2026-10-01T09:00:00.000Z" }}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("button", { name: "Zmień 2 na EUR" })).toBeTruthy();
  });

  it("closes right away when trades already match the instrument", async () => {
    store.state.records = [dividendPLN, otherBuy];
    const onClose = vi.fn();
    render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={onClose} />);

    pickCurrency("EUR");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("reports trades that could not be retagged instead of hiding the failure", async () => {
    vi.mocked(saveRecord).mockImplementation(async (_supabase, _key, _type, payload) => {
      if (payload.id === sell.id) {
        throw new Error("Rekord zmienił się na innym urządzeniu. Odśwież dane i ponów zmianę.");
      }
      return { queued: false };
    });
    const onClose = vi.fn();
    render(<InstrumentEditorModal open initialValue={vwrlDraft} onClose={onClose} />);

    pickCurrency("EUR");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
    fireEvent.click(await screen.findByRole("button", { name: "Zmień 2 na EUR" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(savedPayloads("transaction").map((t) => t.payload.id)).toEqual([buy.id, sell.id]);
    expect(announce).toHaveBeenCalledWith(
      "Nie udało się zmienić waluty 1 z 2 transakcji: Rekord zmienił się na innym urządzeniu. Odśwież dane i ponów zmianę.",
    );
    // Ta, która się zapisała, ma trafić do widoku.
    expect(store.state.setSync).toHaveBeenCalledTimes(2);
  });
});
