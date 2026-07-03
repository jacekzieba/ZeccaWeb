// Całe copy onboardingu mieszka tutaj — do podmiany przez właściciela produktu.

export type IntroCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: { src: string; alt: string } | null;
};

export type TourStep = {
  id: string;
  route: "/dashboard" | "/positions" | "/earnings";
  anchor: string;
  title: string;
  body: string;
  placement: "bottom" | "right";
};

export const INTRO_CARDS: IntroCard[] = [
  {
    id: "intro-welcome",
    eyebrow: "Witaj w Zecca",
    title: "Cały Twój majątek, czytany jak rocznik finansowy.",
    body:
      "Zecca to prywatny tracker inwestycji — akcje i ETF-y, obligacje skarbowe, lokaty i gotówka w jednym miejscu. " +
      "Bez reklam, bez sprzedawania danych. Liczby, które rozumiesz, i wykresy, które mówią prawdę — także po inflacji.",
    image: { src: "/onboarding/intro-hero.png", alt: "Podgląd aplikacji Zecca" },
  },
  {
    id: "intro-privacy",
    eyebrow: "Twoje dane, Twój klucz",
    title: "Nikt nie czyta Twojego portfela. Nawet my.",
    body:
      "Dane wprowadzasz w aplikacji Zecca na macOS lub iOS. Do przeglądarki trafiają zaszyfrowane end-to-end — " +
      "klucz istnieje tylko na Twoich urządzeniach. Serwer widzi wyłącznie zaszyfrowany pakiet.",
    image: { src: "/onboarding/intro-privacy.png", alt: "Szyfrowanie end-to-end" },
  },
];

export const TOUR_STEPS: TourStep[] = [
  {
    id: "tour-kpi",
    route: "/dashboard",
    anchor: "dashboard-hero",
    title: "Liczby, które naprawdę coś znaczą",
    body:
      "Wartość całego portfela, a obok MWR (XIRR) — realna roczna stopa zwrotu z uwzględnieniem wpłat — " +
      "i wynik realny, czyli ile zarabiasz po odjęciu inflacji. Okres historii przełączysz przyciskami 1M–MAX.",
    placement: "bottom",
  },
  {
    id: "tour-instruments",
    route: "/dashboard",
    anchor: "dashboard-instruments",
    title: "Co dokładnie posiadasz",
    body:
      "Każdy instrument z liczbą jednostek, kursem i bieżącą wartością. Kliknięcie otwiera szczegóły — " +
      "skład serii obligacji, historię kursu, transakcje.",
    placement: "bottom",
  },
  {
    id: "tour-portfolios",
    route: "/dashboard",
    anchor: "sidebar-portfolios",
    title: "Każdy portfel pod ręką",
    body:
      "IKE, konto obligacji, rachunek maklerski — portfele z bieżącą wartością zawsze w sidebarze. " +
      "Na dole karta z łączną wartością całego majątku.",
    placement: "right",
  },
  {
    id: "tour-positions",
    route: "/positions",
    anchor: "positions-table",
    title: "Każda złotówka ma swoją historię",
    body:
      "Pozycje pokazują pełny skład portfela z zyskiem/stratą liczonym od realnych transakcji zakupu. " +
      "Obok, w zakładce Transakcje, cała historia: zakupy, sprzedaże, dywidendy i odsetki.",
    placement: "bottom",
  },
  {
    id: "tour-earnings",
    route: "/earnings",
    anchor: "earnings-summary",
    title: "Pełny obraz — nie tylko inwestycje",
    body:
      "Zarobki to rejestr Twoich dochodów: etat, B2B i obciążenia, miesiąc po miesiącu. " +
      "Średnia po obciążeniach pokazuje, ile realnie zostaje — i ile z tego może pracować w portfelu.",
    placement: "bottom",
  },
];

export const FINALE_COPY = {
  eyebrow: "Połącz swoje dane",
  title: "Zobaczmy Twój portfel.",
  bodyDemo:
    "To już wszystko — wiesz, gdzie co jest. Oglądałeś dane przykładowe; teraz odblokuj synchronizację " +
    "frazą z aplikacji natywnej albo zacznij od pobrania Zecca na macOS lub iOS.",
  bodyReplay: "To już wszystko — tour zakończony. Twoje dane są zsynchronizowane.",
  ctaDemo: "Przejdź do konfiguracji synchronizacji →",
  ctaReplay: "Wróć do aplikacji →",
} as const;

export function nextPresentStep(
  steps: TourStep[],
  from: number,
  dir: 1 | -1,
  isPresent: (anchor: string) => boolean,
): number {
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    if (isPresent(steps[i].anchor)) return i;
  }
  return -1;
}
