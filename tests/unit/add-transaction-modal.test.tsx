import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RecordType } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { makeRecord } from "./helpers/records";
import { AddTransactionModal } from "@/features/transactions/add-transaction-modal";
import { refreshSyncStore, saveRecord } from "@/sync/records/record-writer";

const store = vi.hoisted(() => ({
  state: {
    records: [] as DecryptedRecord[],
    snapshot: null as unknown,
    userDataKey: {} as CryptoKey,
    supabase: {} as unknown,
    setSync: vi.fn(),
    addTransactionOpen: false,
    closeAddTransaction: vi.fn(),
  },
}));

vi.mock("@/sync/store/sync-store", () => ({
  useSyncStore: (selector: (state: typeof store.state) => unknown) =>
    selector(store.state),
}));

vi.mock("@/sync/records/record-writer", () => ({
  refreshSyncStore: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  getTelemetryService: () => ({ signal: vi.fn() }),
  TelemetryEvent: { transactionAdded: "transaction_added" },
  telemetrySnakeCased: (value: string) => value,
}));

const accountID = "11111111-1111-4111-8111-111111111111";
const newAssetID = "22222222-2222-4222-8222-222222222229";

// The Select component (src/components/ui/select.tsx) renders its own
// listbox instead of a native <select>, so picking an option is "open, then
// mousedown the option" rather than firing a "change" event. mousedown (not
// click) matches the component's own commit handler — see its comment on why
// a plain click there can retarget to the trigger button instead.
function pickOption(labelText: string, optionText: string) {
  fireEvent.click(screen.getByLabelText(labelText));
  fireEvent.mouseDown(screen.getByText(optionText));
}

const record = (
  type: RecordType,
  id: string,
  payload: unknown,
  updatedAt = "2026-05-15T10:00:00.000Z",
) => makeRecord(type, id, payload, updatedAt);

const accountRecord = record("account", accountID, {
  recordType: "account",
  id: accountID,
  name: "Maklerski",
  accountType: "custom",
  baseCurrency: "PLN",
});

const newAssetRecord = record("asset", newAssetID, {
  recordType: "asset",
  id: newAssetID,
  kind: "stock",
  symbol: "AAPL",
  name: "Apple Inc.",
  currency: "PLN",
});

describe("AddTransactionModal inline instrument creation", () => {
  beforeEach(() => {
    store.state.records = [accountRecord];
    store.state.snapshot = null;
    store.state.setSync = vi.fn((records: DecryptedRecord[], snapshot: unknown) => {
      store.state.records = records;
      store.state.snapshot = snapshot;
    });
    store.state.closeAddTransaction = vi.fn();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(newAssetID);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [accountRecord, newAssetRecord],
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    // Vitest 4: restoreAllMocks przywraca już tylko spyOn — historię
    // i implementacje vi.fn() czyści resetAllMocks.
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("adds a missing instrument without leaving the transaction form", async () => {
    render(<AddTransactionModal open initialValue={null} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Nowy" })).toBeTruthy();
    });

    expect(screen.queryByRole("link", { name: "Nowy" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nowy" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Dodaj instrument" })).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText("np. VWCE, BTC"), {
      target: { value: "AAPL" },
    });
    fireEvent.change(screen.getByPlaceholderText("np. Vanguard FTSE All-World"), {
      target: { value: "Apple Inc." },
    });
    fireEvent.change(screen.getByLabelText("Ticker Yahoo"), {
      target: { value: "AAPL" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj instrument" }));

    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
        "asset",
        expect.objectContaining({
          id: newAssetID,
          recordType: "asset",
          symbol: "AAPL",
          name: "Apple Inc.",
          marketDataID: "AAPL",
        }),
        { baseUpdatedAt: null },
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Instrument").textContent).toContain("AAPL · Apple Inc.");
    });
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeTruthy();
  });
});

describe("AddTransactionModal funding deposit", () => {
  const buyID = "55555555-5555-4555-8555-555555555551";
  const depositID = "55555555-5555-4555-8555-555555555552";

  beforeEach(() => {
    store.state.records = [accountRecord, newAssetRecord];
    store.state.snapshot = null;
    store.state.setSync = vi.fn();
    store.state.closeAddTransaction = vi.fn();
    let issued = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
      () => (issued++ === 0 ? buyID : depositID) as `${string}-${string}-${string}-${string}-${string}`,
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [accountRecord, newAssetRecord],
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    // Vitest 4: restoreAllMocks przywraca już tylko spyOn — historię
    // i implementacje vi.fn() czyści resetAllMocks.
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  // Quantity x price auto-fills the gross amount, so this lands on 1000 gross
  // + 12.5 fees — the 1012.5 the funding deposit has to cancel.
  const fillBuy = () => {
    render(<AddTransactionModal open initialValue={null} onClose={vi.fn()} />);
    // The account record is the only portfolio, so it's already auto-selected.
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Prowizja"), { target: { value: "12.5" } });
  };

  it("writes a matching cash deposit when the funding box is checked", async () => {
    fillBuy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Dopisz wpłatę gotówki/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dodaj zakup" }));

    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
        "transaction",
        expect.objectContaining({
          id: depositID,
          transactionType: "cashDeposit",
          portfolioID: accountID,
          grossAmount: 1012.5,
          currency: "PLN",
        }),
        { baseUpdatedAt: null },
      );
    });
  });

  it("writes only the trade when the funding box is left alone", async () => {
    fillBuy();

    fireEvent.click(screen.getByRole("button", { name: "Dodaj zakup" }));

    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(saveRecord).mock.calls[0]?.[3]).toMatchObject({
      transactionType: "buy",
    });
  });

  it("offers no funding box while editing an existing trade", async () => {
    render(
      <AddTransactionModal
        open
        initialValue={{
          id: buyID,
          portfolioId: accountID,
          instrumentId: null,
          date: "2026-05-10",
          transactionType: "buy",
          quantity: 10,
          price: 100,
          grossAmount: 1000,
          currency: "PLN",
          fees: 0,
          taxes: 0,
          updatedAt: "2026-05-10T10:00:00.000Z",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox", { name: /Dopisz wpłatę gotówki/ })).toBeNull();
  });
});

/**
 * Native `TransactionValidator.validateInstrumentTransaction` rejects a buy
 * without an instrument, a positive quantity or a positive price. Without the
 * same check here the web saves a record the native ledger then skips
 * entirely — and, with the funding box ticked, a deposit with no purchase
 * behind it.
 */
describe("AddTransactionModal buy validation", () => {
  beforeEach(() => {
    store.state.records = [accountRecord, newAssetRecord];
    store.state.snapshot = null;
    store.state.setSync = vi.fn();
    store.state.closeAddTransaction = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [accountRecord, newAssetRecord],
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    // Vitest 4: restoreAllMocks przywraca już tylko spyOn — historię
    // i implementacje vi.fn() czyści resetAllMocks.
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const openBuyForm = () => {
    render(<AddTransactionModal open initialValue={null} onClose={vi.fn()} />);
    // The account record is the only portfolio, so it's already auto-selected.
  };

  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Dodaj zakup" }));

  it("refuses a buy without an instrument", async () => {
    openBuyForm();
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "100" } });

    submit();

    await waitFor(() => {
      expect(screen.getByText("Brakuje instrumentu dla transakcji.")).toBeTruthy();
    });
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("refuses a buy without a quantity", async () => {
    openBuyForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Kwota (brutto)"), { target: { value: "1000" } });

    submit();

    await waitFor(() => {
      expect(screen.getByText("Brakuje liczby jednostek.")).toBeTruthy();
    });
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("refuses a buy without a price", async () => {
    openBuyForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Kwota (brutto)"), { target: { value: "1000" } });

    submit();

    await waitFor(() => {
      expect(screen.getByText("Brakuje ceny jednostkowej.")).toBeTruthy();
    });
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("saves a buy that carries all three", async () => {
    openBuyForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "100" } });

    submit();

    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
        "transaction",
        expect.objectContaining({
          transactionType: "buy",
          instrumentID: newAssetID,
          quantity: 10,
          price: 100,
          grossAmount: 1_000,
        }),
        { baseUpdatedAt: null },
      );
    });
  });
});

/**
 * Native `TransactionValidator.validateInstrumentTransaction` rejects a sell
 * without an instrument, a positive quantity or a positive price — it treats
 * .buy and .sell identically. Without the same check here the web saves a
 * record the native ledger then skips entirely, leaving the position open on
 * macOS/iOS while the web had already booked the proceeds.
 */
describe("AddTransactionModal sell validation", () => {
  const depositID = "55555555-5555-4555-8555-555555555553";
  const buyID = "55555555-5555-4555-8555-555555555554";

  // A sell only offers instruments the portfolio actually holds, so the buy
  // below is what puts AAPL in the picker.
  const holdingRecords = [
    accountRecord,
    newAssetRecord,
    record("transaction", depositID, {
      recordType: "transaction",
      id: depositID,
      date: "2026-05-01T10:00:00.000Z",
      portfolioID: accountID,
      transactionType: "cashDeposit",
      grossAmount: 5_000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
    record("transaction", buyID, {
      recordType: "transaction",
      id: buyID,
      date: "2026-05-02T10:00:00.000Z",
      portfolioID: accountID,
      instrumentID: newAssetID,
      transactionType: "buy",
      quantity: 10,
      price: 100,
      grossAmount: 1_000,
      currency: "PLN",
      fees: 0,
      taxes: 0,
    }),
  ];

  beforeEach(() => {
    store.state.records = holdingRecords;
    store.state.snapshot = null;
    store.state.setSync = vi.fn();
    store.state.closeAddTransaction = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: holdingRecords,
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    // Vitest 4: restoreAllMocks przywraca już tylko spyOn — historię
    // i implementacje vi.fn() czyści resetAllMocks.
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const openSellForm = () => {
    render(<AddTransactionModal open initialValue={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Sprzedaż/ }));
    // The account record is the only portfolio, so it's already auto-selected.
  };

  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Dodaj sprzedaż" }));

  it("refuses a sell without an instrument", async () => {
    openSellForm();
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "300" } });

    submit();

    await waitFor(() => {
      expect(screen.getByText("Brakuje instrumentu dla transakcji.")).toBeTruthy();
    });
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("refuses a sell without a quantity", async () => {
    openSellForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Kwota (brutto)"), { target: { value: "1200" } });

    submit();

    await waitFor(() => {
      expect(screen.getByText("Brakuje liczby jednostek.")).toBeTruthy();
    });
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("refuses a sell without a price", async () => {
    openSellForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Kwota (brutto)"), { target: { value: "1200" } });

    submit();

    await waitFor(() => {
      expect(screen.getByText("Brakuje ceny jednostkowej.")).toBeTruthy();
    });
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("nie ostrzega, gdy sprzedaż mieści się w posiadanym stanie", () => {
    openSellForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "10" } });
    expect(screen.queryByTestId("oversell-warning")).toBeNull();
  });

  it("ostrzega przy sprzedaży ponad stan, ale pozwala zapisać", async () => {
    openSellForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "300" } });

    const warning = screen.getByTestId("oversell-warning");
    expect(warning.textContent).toContain("Sprzedaż 15 szt., a dostępne 10");
    expect(warning.textContent).toContain("Możesz zapisać mimo to");

    submit();
    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
        "transaction",
        expect.objectContaining({ transactionType: "sell", quantity: 15, price: 300 }),
        { baseUpdatedAt: null },
      );
    });
  });

  it("saves a sell that carries all three", async () => {
    openSellForm();
    pickOption("Instrument", "AAPL · Apple Inc.");
    fireEvent.change(screen.getByLabelText("Liczba"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Kurs / cena"), { target: { value: "300" } });

    submit();

    await waitFor(() => {
      expect(saveRecord).toHaveBeenCalledWith(
        store.state.supabase,
        store.state.userDataKey,
        "transaction",
        expect.objectContaining({
          transactionType: "sell",
          instrumentID: newAssetID,
          quantity: 4,
          price: 300,
          grossAmount: 1_200,
        }),
        { baseUpdatedAt: null },
      );
    });
  });
});

describe("AddTransactionModal — edycja istniejącej transakcji", () => {
  beforeEach(() => {
    store.state.records = [accountRecord, newAssetRecord];
    store.state.snapshot = null;
    store.state.setSync = vi.fn();
    store.state.closeAddTransaction = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [accountRecord, newAssetRecord],
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("zapisuje dywidendę z tym samym instrumentem, gdy użytkownik niczego nie zmienił", async () => {
    // Zmiana typu (domyślnie „buy”) na typ z edytowanej transakcji czyściła
    // wybrany instrument — zapis bez zmian odpinał dywidendę od spółki.
    render(
      <AddTransactionModal
        open
        initialValue={{
          id: "33333333-3333-4333-8333-333333333333",
          portfolioId: accountID,
          instrumentId: newAssetID,
          date: "2026-05-10",
          transactionType: "dividend",
          quantity: null,
          price: null,
          grossAmount: 12.5,
          currency: "PLN",
          fees: 0,
          taxes: 0,
          updatedAt: "2026-05-10T10:00:00.000Z",
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(vi.mocked(saveRecord)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveRecord).mock.calls[0]?.[3]).toMatchObject({
      transactionType: "dividend",
      instrumentID: newAssetID,
    });
  });

  it("edycja sprzedaży, która zamknęła pozycję, zachowuje instrument", async () => {
    // Filtr „tylko posiadane” liczył stan razem z edytowaną sprzedażą: 10 − 10 = 0,
    // więc instrument wypadał z listy i formularz odrzucał zapis.
    const sellID = "44444444-4444-4444-8444-444444444444";
    const tx = (id: string, transactionType: string, date: string) =>
      record("transaction", id, {
        recordType: "transaction",
        id,
        date,
        portfolioID: accountID,
        instrumentID: newAssetID,
        transactionType,
        quantity: 10,
        price: 100,
        grossAmount: 1000,
        currency: "PLN",
        fees: 0,
        taxes: 0,
      });
    store.state.records = [
      accountRecord,
      newAssetRecord,
      tx("55555555-5555-4555-8555-555555555555", "buy", "2026-05-01T00:00:00.000Z"),
      tx(sellID, "sell", "2026-05-10T00:00:00.000Z"),
    ];

    render(
      <AddTransactionModal
        open
        initialValue={{
          id: sellID,
          portfolioId: accountID,
          instrumentId: newAssetID,
          date: "2026-05-10",
          transactionType: "sell",
          quantity: 10,
          price: 100,
          grossAmount: 1000,
          currency: "PLN",
          fees: 0,
          taxes: 0,
          updatedAt: "2026-05-10T10:00:00.000Z",
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(vi.mocked(saveRecord)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveRecord).mock.calls[0]?.[3]).toMatchObject({
      transactionType: "sell",
      instrumentID: newAssetID,
    });
  });

  it("edycja zakupu walutowego zachowuje zapisany kurs rozliczenia", async () => {
    // Pierwsze ustawienie waluty i daty z edytowanej transakcji liczyło się jako
    // „zmiana”, więc kurs z wyciągu brokera był po cichu zastępowany kursem NBP.
    const usdAssetID = "66666666-6666-4666-8666-666666666666";
    store.state.records = [
      accountRecord,
      record("asset", usdAssetID, {
        recordType: "asset",
        id: usdAssetID,
        kind: "stock",
        symbol: "AAPL",
        name: "Apple USD",
        currency: "USD",
      }),
    ];
    vi.mocked(globalThis.fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ data: { rate: 4.1234 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    render(
      <AddTransactionModal
        open
        initialValue={{
          id: "77777777-7777-4777-8777-777777777777",
          portfolioId: accountID,
          instrumentId: usdAssetID,
          date: "2026-05-10",
          transactionType: "buy",
          quantity: 2,
          price: 100,
          grossAmount: 200,
          currency: "USD",
          fees: 0,
          taxes: 0,
          fxRateToBase: 3.95,
          updatedAt: "2026-05-10T10:00:00.000Z",
        }}
        onClose={vi.fn()}
      />,
    );

    // Dajemy szansę ewentualnemu pobraniu kursu, zanim zapiszemy.
    await new Promise((resolve) => setTimeout(resolve, 20));
    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(vi.mocked(saveRecord)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveRecord).mock.calls[0]?.[3]).toMatchObject({ fxRateToBase: 3.95 });
  });
});

describe("AddTransactionModal — domyślna data", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    store.state.records = [accountRecord];
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    process.env.TZ = originalTz;
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("to dzisiejsza data lokalna, nie UTC (00:30 w Warszawie to już nowy dzień)", () => {
    process.env.TZ = "Europe/Warsaw";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-10T22:30:00.000Z")); // 11.05, 00:30 czasu letniego

    render(<AddTransactionModal open initialValue={null} onClose={vi.fn()} />);

    expect((screen.getByLabelText("Data") as HTMLInputElement).value).toBe("2026-05-11");
  });
});

/**
 * Kontrola krzyżowa z natywnym TransactionValidator (audyt 2026-10-20, część 2):
 * transakcję, której on nie przyjmie, aplikacja przy pullu odkłada do
 * kwarantanny. Formularz sprawdzał tylko zakup i sprzedaż, więc np. wpłatę
 * na 0 zł albo ujemną prowizję zapisywał, a na iOS i macOS ich nie było.
 */
describe("AddTransactionModal — reguły natywnego TransactionValidator", () => {
  beforeEach(() => {
    store.state.records = [accountRecord, newAssetRecord];
    store.state.snapshot = null;
    store.state.setSync = vi.fn();
    store.state.closeAddTransaction = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    vi.mocked(saveRecord).mockResolvedValue({ queued: false });
    vi.mocked(refreshSyncStore).mockResolvedValue({
      records: [accountRecord, newAssetRecord],
      snapshot: null as never,
      summary: null as never,
    });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const draft = (overrides: Record<string, unknown>) => ({
    id: "88888888-8888-4888-8888-888888888888",
    portfolioId: accountID,
    instrumentId: null,
    date: "2026-05-10",
    transactionType: "cashDeposit",
    quantity: null,
    price: null,
    grossAmount: 100,
    currency: "PLN",
    fees: 0,
    taxes: 0,
    updatedAt: "2026-05-10T10:00:00.000Z",
    ...overrides,
  });

  it.each([
    ["wpłata na 0 zł", draft({ grossAmount: 0 }), "Kwota transakcji musi być dodatnia."],
    ["wypłata z ujemną kwotą", draft({ transactionType: "cashWithdrawal", grossAmount: -5 }), "Kwota transakcji musi być dodatnia."],
    ["ujemna prowizja", draft({ fees: -1 }), "Prowizja nie może być ujemna."],
    ["dywidenda bez instrumentu", draft({ transactionType: "dividend" }), "Brakuje instrumentu dla transakcji."],
  ])("nie zapisuje: %s", async (_name, initialValue, message) => {
    render(<AddTransactionModal open initialValue={initialValue as never} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(screen.getByText(new RegExp(message.replace(".", "\\.")))).toBeTruthy());
    expect(saveRecord).not.toHaveBeenCalled();
  });

  it("edycja transferu aktywów z aplikacji zachowuje instrument, loty i identyfikator importu", async () => {
    // Formularz nie pokazuje tych pól, a zapis budował rekord od zera: znikały
    // instrument, ilość i loty (aplikacja odkładała rekord do kwarantanny),
    // a także data księgowania i externalImportID (ponowny import dublował).
    const original = {
      recordType: "transaction",
      id: "99999999-9999-4999-8999-999999999999",
      date: 800000000,
      bookingDate: 800086400,
      portfolioID: accountID,
      instrumentID: newAssetID,
      transactionType: "accountTransferIn",
      quantity: 3,
      price: 100,
      grossAmount: 300,
      currency: "PLN",
      fees: 0,
      taxes: 0,
      notes: "",
      externalImportID: "xtb:123",
      sourcePortfolioID: "12121212-1212-4121-8121-121212121212",
      transferKind: "asset",
      transferSourceKind: "brokerAccount",
      transferCostBasisMode: "carryOver",
      transferLots: [{ acquisitionDate: 790000000, quantity: 3, unitCost: 100, currency: "PLN" }],
      createdAt: 800000000,
      updatedAt: 800000000,
    };
    render(
      <AddTransactionModal
        open
        initialValue={draft({
          id: original.id,
          transactionType: "accountTransferIn",
          instrumentId: newAssetID,
          quantity: 3,
          price: 100,
          grossAmount: 300,
          sourcePortfolioId: original.sourcePortfolioID,
          transferKind: "asset",
          notes: "",
          originalPayload: original,
        }) as never}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zapisz zmiany" }));

    await waitFor(() => expect(vi.mocked(saveRecord)).toHaveBeenCalledTimes(1));
    expect(vi.mocked(saveRecord).mock.calls[0]?.[3]).toMatchObject({
      instrumentID: newAssetID,
      quantity: 3,
      price: 100,
      bookingDate: 800086400,
      externalImportID: "xtb:123",
      transferKind: "asset",
      transferSourceKind: "brokerAccount",
      transferCostBasisMode: "carryOver",
      transferLots: original.transferLots,
      createdAt: 800000000,
    });
  });
});
