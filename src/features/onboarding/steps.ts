// Całe copy onboardingu mieszka tutaj — do podmiany przez właściciela produktu.

export type IntroCard = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: "portfolio" | "privacy";
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
    title: "Monitoruj swoje inwestycje",
    body:
      "Zecca to miejsce do sprawdzania Twoich wyników inwestycyjnych. Aplikacja wspiera akcje, ETF-y, obligacje skarbowe, " +
      "lokaty, kryptowaluty i inne instrumenty. Odwzorowuje historię Twoich inwestycji oraz przedstawia metryki i wykresy, " +
      "aby pomóc Ci podejmować jak najlepsze decyzje i budować swój majątek.",
    visual: "portfolio",
  },
  {
    id: "intro-privacy",
    eyebrow: "Twoje dane, Twój klucz",
    title: "Dostęp do Twojego portfela masz tylko Ty",
    body:
      "Zecca jest obecnie dostępna przez przeglądarkę internetową oraz aplikację na iPhone'a, iPada i Maca. Możesz wybrać " +
      "synchronizację przez iCloud (wspiera tylko urządzenia Apple), przez nasze serwery lub trzymać swoje dane wyłącznie " +
      "lokalnie. Twoja prywatność jest dla nas szczególnie ważna, dlatego wszystkie dane szyfrujemy end-to-end.",
    visual: "privacy",
  },
];

export const TOUR_STEPS: TourStep[] = [
  {
    id: "tour-kpi",
    route: "/dashboard",
    anchor: "dashboard-hero",
    title: "Wartość Twojego portfela w czasie",
    body:
      "Sprawdź, jak zmieniała się wartość Twoich inwestycji oraz poznaj najważniejsze metryki. " +
      "Zobaczysz tutaj wpływ inflacji, realną stopę zwrotu oraz wyniki z ostatnich tygodni.",
    placement: "bottom",
  },
  {
    id: "tour-instruments",
    route: "/dashboard",
    anchor: "dashboard-instruments",
    title: "Instrumenty w Twoim portfelu",
    body:
      "Każdy instrument z Twojego portfela jest widoczny z liczbą jednostek, kursem zakupu i bieżącą wartością. " +
      "Klikając na jego nazwę, zobaczysz dodatkowe szczegóły.",
    placement: "bottom",
  },
  {
    id: "tour-portfolios",
    route: "/dashboard",
    anchor: "sidebar-portfolios",
    title: "Każdy portfel pod ręką",
    body: "Boczne menu gwarantuje Ci szybki dostęp do wszystkich Twoich portfeli.",
    placement: "right",
  },
  {
    id: "tour-positions",
    route: "/positions",
    anchor: "positions-table",
    title: "Każda złotówka ma swoją historię",
    body:
      "Pozycje pokazują pełny skład portfela z zyskiem/stratą liczonym od realnych transakcji zakupu. " +
      "Obok, w zakładce Transakcje, znajduje się cała historia: zakupy, sprzedaże, dywidendy i odsetki.",
    placement: "bottom",
  },
  {
    id: "tour-earnings",
    route: "/earnings",
    anchor: "earnings-summary",
    title: "Monitoruj także zarobki",
    body:
      "Nie ma inwestycji bez środków do zainwestowania. W tym menu znajdziesz rejestr swoich dochodów oraz " +
      "obciążenia związane z pracą (jeśli masz działalność gospodarczą).",
    placement: "bottom",
  },
];

export const FINALE_COPY = {
  eyebrow: "Połącz swoje dane",
  title: "Zobaczmy Twój portfel.",
  bodyDemo:
    "To już wszystko — wiesz, gdzie co jest. Oglądałeś dane przykładowe; teraz odblokuj synchronizację " +
    "frazą z aplikacji natywnej albo zacznij od pobrania Zecca na macOS lub iOS.",
  bodyReplay:
    "To już wszystko. Możesz rozpocząć korzystanie z aplikacji. W razie pytań, kontakt do nas jest możliwy przez maila lub Discord.",
  bodyPublic:
    "To już wszystko. Możesz teraz swobodnie zwiedzać całą aplikację na danych przykładowych — " +
    "dodawanie transakcji i import są w demo wyłączone, a dane nie zostaną nigdzie zapisane. " +
    "Załóż konto lub zaloguj się, aby pracować na własnym portfelu.",
  ctaDemo: "Przejdź do konfiguracji synchronizacji →",
  ctaReplay: "Wróć do aplikacji →",
  ctaPublicLogin: "Zaloguj się",
  ctaPublicRegister: "Załóż konto",
  ctaPublicExplore: "Zwiedzaj aplikację →",
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
