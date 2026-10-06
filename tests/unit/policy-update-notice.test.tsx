import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Polityka prywatności obiecuje informację w aplikacji o istotnych zmianach.
// Powiadomienie ma się pokazać raz na przeglądarkę i wersję polityki: po
// „Rozumiem” znika także po przeładowaniu, a nowa data polityki = nowy klucz.
// Testy idą przez komponent i zapisany klucz w localStorage; „przeładowanie”
// to świeży import modułów (vi.resetModules w beforeEach i w reload()).

const KEY = "zecca-web-policy-notice-2026-10-06";

function memoryStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => { delete store[k]; }); },
  };
}

function throwingStorage() {
  const fail = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  return { getItem: fail, setItem: fail, removeItem: fail, clear: fail };
}

function useStorage(storage: object) {
  Object.defineProperty(window, "localStorage", { value: storage, writable: true, configurable: true });
}

async function load() {
  const { PolicyUpdateNotice } = await import("@/components/layout/policy-update-notice");
  return PolicyUpdateNotice;
}

async function reload() {
  cleanup();
  vi.resetModules();
  return load();
}

function notice() {
  return screen.queryByRole("region", { name: "Zmiany w polityce prywatności" });
}

beforeEach(() => {
  vi.resetModules();
  // Node 22+ ma własny localStorage, który zasłania jsdomowy (jak w
  // analytics-consent.test.tsx) — podstawiamy prosty magazyn.
  useStorage(memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("powiadomienie o zmianie polityki prywatności", () => {
  it("bez wcześniejszego „Rozumiem” pokazuje datę, zmiany, odnośnik i przycisk", async () => {
    const PolicyUpdateNotice = await load();
    render(<PolicyUpdateNotice />);

    const region = notice();
    expect(region).not.toBeNull();
    expect(region?.textContent).toContain(
      "Zaktualizowaliśmy politykę prywatności (6 października 2026): statystyki użycia tylko za Twoją zgodą, dokładniejszy opis danych i dostawców.",
    );
    expect(screen.getByRole("link", { name: "Przeczytaj zmiany" }).getAttribute("href")).toBe("/privacy-policy");
    expect(screen.getByRole("button", { name: "Rozumiem" })).toBeTruthy();
  });

  it("nie kradnie fokusu przy pokazaniu", async () => {
    const PolicyUpdateNotice = await load();
    render(<PolicyUpdateNotice />);

    expect(notice()).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("po „Rozumiem” znika, zapisuje wersję i nie wraca po przeładowaniu", async () => {
    let PolicyUpdateNotice = await load();
    render(<PolicyUpdateNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Rozumiem" }));

    expect(notice()).toBeNull();
    expect(window.localStorage.getItem(KEY)).not.toBeNull();

    PolicyUpdateNotice = await reload();
    render(<PolicyUpdateNotice />);
    expect(notice()).toBeNull();
  });

  it("po „Rozumiem” przenosi fokus na treść strony, a nie gubi go na <body>", async () => {
    const PolicyUpdateNotice = await load();
    render(
      <main tabIndex={-1}>
        <PolicyUpdateNotice />
      </main>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rozumiem" }));

    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("zamknięcie poprzedniej wersji polityki nie ukrywa powiadomienia o nowej", async () => {
    window.localStorage.setItem("zecca-web-policy-notice-2026-07-12", "1");
    const PolicyUpdateNotice = await load();
    render(<PolicyUpdateNotice />);

    expect(notice()).not.toBeNull();
  });

  it("gdy localStorage rzuca: pokazuje, „Rozumiem” chowa do końca karty, po przeładowaniu wraca", async () => {
    useStorage(throwingStorage());
    let PolicyUpdateNotice = await load();
    render(<PolicyUpdateNotice />);
    expect(notice()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Rozumiem" }));
    expect(notice()).toBeNull();

    // Ta sama karta (ten sam moduł), np. przejście na inny ekran aplikacji.
    cleanup();
    render(<PolicyUpdateNotice />);
    expect(notice()).toBeNull();

    PolicyUpdateNotice = await reload();
    render(<PolicyUpdateNotice />);
    expect(notice()).not.toBeNull();
  });

  it("gdy tylko zapis rzuca (pełny magazyn), „Rozumiem” i tak chowa powiadomienie", async () => {
    useStorage({
      ...memoryStorage(),
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });
    const PolicyUpdateNotice = await load();
    render(<PolicyUpdateNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Rozumiem" }));

    expect(notice()).toBeNull();
  });

  it("serwer nic nie renderuje, a hydratacja przechodzi bez błędu i dopiero potem pokazuje", async () => {
    const PolicyUpdateNotice = await load();
    const html = renderToString(<PolicyUpdateNotice />);
    expect(html).toBe("");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args.join(" ")));
    await act(async () => {
      hydrateRoot(container, <PolicyUpdateNotice />, {
        onRecoverableError: (error) => errors.push(String(error)),
      });
    });

    expect(errors).toEqual([]);
    expect(container.textContent).toContain("Zaktualizowaliśmy politykę prywatności");
    container.remove();
  });

  it("strona polityki pokazuje tę samą datę wejścia w życie co powiadomienie", async () => {
    const { default: PrivacyPolicyPage } = await import("../../app/privacy-policy/page");
    render(<PrivacyPolicyPage />);

    expect(screen.getByText("Data wejścia w życie:").parentElement?.textContent).toContain("6 października 2026");
  });
});
