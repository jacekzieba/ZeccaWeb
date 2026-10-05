import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import {
  PathnameContext,
  PathParamsContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Analityka na webie wymaga zgody (opt-in). Testy idą przez publiczne wejścia:
// bramkę w root layoucie, magazyn zgody (to samo, co przełącznik w Ustawieniach)
// i serwis telemetrii — a sprawdzają to, co faktycznie wychodzi: skrypty Vercel
// w <head>, haki beforeSend w ich kolejkach i wywołania SDK TelemetryDeck.

const td = vi.hoisted(() => ({ signal: vi.fn(async () => undefined) }));

vi.mock("@telemetrydeck/sdk", () => ({
  default: class {
    signal = td.signal;
  },
}));

// Komponenty Vercel czytają parametry trasy z kontekstu routera Next. Bez niego
// Speed Insights dostaje route=null i (słusznie) nic nie wstrzykuje.
function Router({ children }: { children: ReactNode }) {
  return (
    <PathnameContext.Provider value="/">
      <SearchParamsContext.Provider value={new URLSearchParams()}>
        <PathParamsContext.Provider value={{}}>{children}</PathParamsContext.Provider>
      </SearchParamsContext.Provider>
    </PathnameContext.Provider>
  );
}

function renderInApp(ui: ReactElement) {
  return render(ui, { wrapper: Router });
}

type VercelWindow = Window & {
  va?: unknown;
  vaq?: unknown[][];
  si?: unknown;
  siq?: unknown[][];
};

const KEY = "zecca-web-analytics-consent-v1";

// Świeże moduły w każdym teście: serwis telemetrii to singleton na kartę.
async function load() {
  const consent = await import("@/lib/analytics-consent");
  const { AnalyticsConsentGate } = await import(
    "@/features/telemetry/analytics-consent-gate"
  );
  const { TelemetryBootstrap } = await import(
    "@/features/telemetry/telemetry-bootstrap"
  );
  const telemetry = await import("@/lib/telemetry");
  const { useSyncStore } = await import("@/sync/store/sync-store");
  const { AnalyticsConsentReset } = await import(
    "@/components/layout/analytics-consent-reset"
  );
  return {
    ...consent,
    AnalyticsConsentGate,
    AnalyticsConsentReset,
    TelemetryBootstrap,
    ...telemetry,
    useSyncStore,
  };
}

function vercelScripts() {
  return document.head.querySelectorAll('script[src*="vercel"]');
}

function beforeSendHooks() {
  const w = window as VercelWindow;
  return [...(w.vaq ?? []), ...(w.siq ?? [])]
    .filter(([command]) => command === "beforeSend")
    .map(([, hook]) => hook as (event: object) => object | null);
}

beforeEach(() => {
  vi.resetModules();
  // Node 22+ ma własny, niedziałający bez pliku localStorage, który zasłania
  // jsdomowy — jak w hydration-gate.test.tsx podstawiamy prosty magazyn.
  const store: Record<string, string> = {};
  const mock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
  };
  Object.defineProperty(window, "localStorage", { value: mock, writable: true, configurable: true });
});

afterEach(() => {
  cleanup();
  document.body.style.paddingBottom = "";
  vi.unstubAllEnvs();
  td.signal.mockClear();
  document.head.querySelectorAll("script").forEach((script) => script.remove());
  const w = window as VercelWindow;
  delete w.va;
  delete w.vaq;
  delete w.si;
  delete w.siq;
});

describe("pytanie o zgodę", () => {
  it("bez decyzji pokazuje pytanie i nie ładuje skryptów Vercel", async () => {
    const { AnalyticsConsentGate } = await load();
    renderInApp(<AnalyticsConsentGate />);

    const prompt = screen.getByRole("region", { name: "Pomóż ulepszać Zecca" });
    expect(prompt).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zgadzam się" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nie, dziękuję" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /polityce prywatności/i }).getAttribute("href"),
    ).toBe("/privacy-policy");
    expect(vercelScripts()).toHaveLength(0);
  });

  it("po „Zgadzam się” zapisuje zgodę, chowa pytanie i ładuje Analytics + Speed Insights", async () => {
    const { AnalyticsConsentGate } = await load();
    renderInApp(<AnalyticsConsentGate />);

    fireEvent.click(screen.getByRole("button", { name: "Zgadzam się" }));

    expect(window.localStorage.getItem(KEY)).toBe("granted");
    expect(screen.queryByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeNull();
    expect(vercelScripts()).toHaveLength(2);
  });

  it("po „Nie, dziękuję” zapisuje odmowę, chowa pytanie i nic nie ładuje", async () => {
    const { AnalyticsConsentGate } = await load();
    renderInApp(<AnalyticsConsentGate />);

    fireEvent.click(screen.getByRole("button", { name: "Nie, dziękuję" }));

    expect(window.localStorage.getItem(KEY)).toBe("denied");
    expect(screen.queryByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeNull();
    expect(vercelScripts()).toHaveLength(0);
  });

  it.each(["granted", "denied"])(
    "po zapisanej decyzji (%s) nie pyta ponownie",
    async (choice) => {
      window.localStorage.setItem(KEY, choice);
      const { AnalyticsConsentGate } = await load();
      renderInApp(<AnalyticsConsentGate />);

      expect(screen.queryByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeNull();
      expect(vercelScripts()).toHaveLength(choice === "granted" ? 2 : 0);
    },
  );

  it("w buildach e2e / fake sync (telemetria wyłączona na sztywno) nie pyta i nie ładuje", async () => {
    vi.stubEnv("NEXT_PUBLIC_TELEMETRY_DISABLED", "1");
    const { AnalyticsConsentGate } = await load();
    const { unmount } = renderInApp(<AnalyticsConsentGate />);
    expect(screen.queryByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeNull();
    unmount();

    window.localStorage.setItem(KEY, "granted");
    renderInApp(<AnalyticsConsentGate />);
    expect(vercelScripts()).toHaveLength(0);
  });
});

describe("wycofanie zgody (przełącznik w Ustawieniach)", () => {
  it("odcina Vercel Analytics i Speed Insights bez przeładowania strony", async () => {
    window.localStorage.setItem(KEY, "granted");
    const { AnalyticsConsentGate, setAnalyticsConsent } = await load();
    renderInApp(<AnalyticsConsentGate />);

    const hooks = beforeSendHooks();
    // Po jednym haku z Analytics i Speed Insights (komponent i inject rejestrują ten sam).
    expect(hooks.length).toBeGreaterThanOrEqual(2);
    const event = { type: "pageview", url: "https://zecca.pl/" };
    for (const hook of hooks) expect(hook(event)).toEqual(event);

    // Skrypt raz wczytany zostaje w pamięci karty — dlatego każde zdarzenie
    // przechodzi przez beforeSend, który po wycofaniu zgody je odrzuca.
    act(() => setAnalyticsConsent("denied"));

    for (const hook of hooks) expect(hook(event)).toBeNull();
    expect(screen.queryByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeNull();
  });

  it("wycofanie w innej karcie też odcina analitykę", async () => {
    window.localStorage.setItem(KEY, "granted");
    const { AnalyticsConsentGate, hasAnalyticsConsent } = await load();
    renderInApp(<AnalyticsConsentGate />);

    window.localStorage.setItem(KEY, "denied");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });

    expect(hasAnalyticsConsent()).toBe(false);
    for (const hook of beforeSendHooks()) expect(hook({ type: "pageview" })).toBeNull();
  });
});

describe("adresy wysyłane do Vercel", () => {
  it("ze zgodą zastępuje UUID przez :id i obcina query oraz hash", async () => {
    window.localStorage.setItem(KEY, "granted");
    const { AnalyticsConsentGate } = await load();
    renderInApp(<AnalyticsConsentGate />);

    const url =
      "https://zecca.pl/portfolios/3f2b8c1e-9a4d-4c2b-8e1f-0a9b8c7d6e5f?tab=holdings#x";
    for (const hook of beforeSendHooks()) {
      expect(hook({ type: "pageview", url })).toEqual({
        type: "pageview",
        url: "https://zecca.pl/portfolios/:id",
      });
    }
  });
});

describe("publiczna kontrolka „zmień zgodę” (stopka, polityka prywatności)", () => {
  it("wycofuje zgodę jednym kliknięciem: analityka staje, pytanie wraca", async () => {
    window.localStorage.setItem(KEY, "granted");
    const {
      AnalyticsConsentGate,
      AnalyticsConsentReset,
      TelemetryBootstrap,
      getTelemetryService,
      TelemetryEvent,
    } = await load();
    renderInApp(
      <>
        <AnalyticsConsentGate />
        <TelemetryBootstrap />
        <AnalyticsConsentReset />
      </>,
    );
    const hooks = beforeSendHooks();
    expect(hooks.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Zmień decyzję o statystykach użycia" }),
    );

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(screen.getByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeTruthy();
    for (const hook of hooks) expect(hook({ type: "pageview", url: "https://zecca.pl/" })).toBeNull();
    getTelemetryService().signal(TelemetryEvent.dashboardViewed);
    expect(td.signal).not.toHaveBeenCalledWith(TelemetryEvent.dashboardViewed, expect.anything());
  });

  it("działa też dla przycisku ze statycznego HTML landingu", async () => {
    window.localStorage.setItem(KEY, "denied");
    const { AnalyticsConsentGate } = await load();
    const container = document.createElement("div");
    container.innerHTML =
      '<button type="button" class="consent-reset" data-analytics-consent-reset>Zmień zgodę na statystyki</button>';
    document.body.appendChild(container);
    renderInApp(<AnalyticsConsentGate />);
    expect(screen.queryByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Zmień zgodę na statystyki" }));

    expect(screen.getByRole("region", { name: "Pomóż ulepszać Zecca" })).toBeTruthy();
    container.remove();
  });
});

describe("układ pytania", () => {
  it("póki pytanie jest widoczne, <body> ma dolne dopełnienie; po decyzji znika", async () => {
    const { AnalyticsConsentGate } = await load();
    renderInApp(<AnalyticsConsentGate />);
    expect(document.body.style.paddingBottom).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Nie, dziękuję" }));

    expect(document.body.style.paddingBottom).toBe("");
  });
});

describe("TelemetryDeck", () => {
  it("nie wysyła sygnałów przed zgodą, wysyła po zgodzie, przestaje po wycofaniu", async () => {
    const { TelemetryBootstrap, getTelemetryService, TelemetryEvent, setAnalyticsConsent } =
      await load();
    render(<TelemetryBootstrap />);

    getTelemetryService().signal(TelemetryEvent.dashboardViewed);
    expect(td.signal).not.toHaveBeenCalled();

    act(() => setAnalyticsConsent("granted"));
    getTelemetryService().signal(TelemetryEvent.dashboardViewed);
    expect(td.signal).toHaveBeenCalledWith(
      TelemetryEvent.dashboardViewed,
      expect.objectContaining({ platform: "web" }),
    );

    td.signal.mockClear();
    act(() => setAnalyticsConsent("denied"));
    getTelemetryService().signal(TelemetryEvent.dashboardViewed);
    expect(td.signal).not.toHaveBeenCalled();
  });

  it("sprawdza zapisaną zgodę przy każdym sygnale, nie tylko flagę z bootstrapu", async () => {
    window.localStorage.setItem(KEY, "granted");
    const { TelemetryBootstrap, getTelemetryService, TelemetryEvent } = await load();
    render(<TelemetryBootstrap />);

    // Decyzja zmieniona poza magazynem (np. inna karta, zanim przyszło
    // zdarzenie storage) — bramka w serwisie jest jeszcze otwarta.
    window.localStorage.setItem(KEY, "denied");
    getTelemetryService().signal(TelemetryEvent.dashboardViewed);

    expect(td.signal).not.toHaveBeenCalled();
  });

  it("app_launched czeka na ustawienia (sync_mode); stara flaga z synchronizacji nie zastępuje zgody tej przeglądarki", async () => {
    window.localStorage.setItem(KEY, "granted");
    const { TelemetryBootstrap, TelemetryEvent, useSyncStore } = await load();
    render(<TelemetryBootstrap />);
    expect(td.signal).not.toHaveBeenCalled();

    act(() => {
      useSyncStore.setState({
        snapshot: {
          settings: {
            telemetryEnabled: false,
            hasAcknowledgedPrivacyDisclosure: true,
            syncMode: "supabase",
          },
        } as never,
      });
    });

    expect(td.signal).toHaveBeenCalledTimes(1);
    expect(td.signal).toHaveBeenCalledWith(
      TelemetryEvent.appLaunched,
      expect.objectContaining({ sync_mode: "supabase" }),
    );
  });

  it("bez zgody zsynchronizowana flaga telemetryEnabled=true niczego nie otwiera", async () => {
    const { TelemetryBootstrap, getTelemetryService, TelemetryEvent, useSyncStore } =
      await load();
    render(<TelemetryBootstrap />);

    act(() => {
      useSyncStore.setState({
        snapshot: {
          settings: {
            telemetryEnabled: true,
            hasAcknowledgedPrivacyDisclosure: true,
            syncMode: "supabase",
          },
        } as never,
      });
    });
    getTelemetryService().signal(TelemetryEvent.dashboardViewed);

    expect(td.signal).not.toHaveBeenCalled();
  });
});
