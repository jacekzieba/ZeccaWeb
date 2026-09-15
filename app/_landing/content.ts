// Landing page markup builder for zecca.pl.
//
// All TEXT lives in copy.ts — edit there. This file holds the structural markup,
// the inline SVG icons and the screenshot config, and assembles them with the
// copy into the final (trusted, static) HTML string that page.tsx injects.
// Styles live in landing.css.

import { GLYPHS } from "./glyphs";
import { landingCopy } from "./copy";
import { bindOrphans as b } from "./typo";

/* ── Szkielet trzech sekcji („Obraz Twojego majątku", „Funkcje",
   „Dla polskiego inwestora") ─────────────────────────────────────────────

   Wcześniej wszystkie trzy używały tego samego szablonu: nagłówek + lista
   wierszy z glifem, tą samą paletą i tym samym rytmem — trzy kopie jednego
   projektu. Klej, który ma je trzymać jako jedną stronę mimo różnych
   układów, jest dokładnie tym, co reszta landingu już ma i czego tu nie
   ruszam: --vault/--surface/--ink/--amber, Bodoni Moda + Archivo + IBM Plex
   Mono, skala odstępów 12-kolumnowej siatki (--col-gap, --gut), promień 4px
   (--r-md odpowiednik na landingu). Różnicuję układ i akcenty, nie system.

   Każda sekcja miała punktem wyjścia osobny losowy string (nigdzie w UI —
   tylko tu, jako źródło inspiracji, nie treść):
     obraz-majatku   6T4pMP7uFmKN0RPi → układ: naprzemiennie lewo/prawo;
                     forma: sekwencja numerowana; akcent: wersaliki
                     z szerokim tropieniem; kształt: zaokrąglony kwadrat;
                     jedna kropka akcentu; wejście: fade-up ze zwłoką.
     funkcje         lUr5LInmkQucCLYj → układ: siatka kart; forma: karty
                     z plakietkami; akcent: kursywa pierwszego słowa;
                     kształt: romb za glifem; włosowe obramowanie;
                     wejście: wsunięcie z boku, naprzemiennie.
     polski-inwestor b4CN5IU5ED71ab6v → układ: karuzela pozioma pod dużą
                     liczbą; forma: card-carousel; akcent: duża figura
                     otwierająca sekcję; kształt: włosowa linia w karcie;
                     zdjęcie (druk.jpg) jako jedyna sekcja z fotografią;
                     wejście: scale-in.
   Trzy różne układy, trzy różne formy prezentacji, trzy różne style
   ilustracji (podgląd aplikacji w oknie / ikona liniowa / fotografia) —
   każda para różni się więc co najmniej dwoma wymiarami.

   Figury w „Obraz Twojego majątku" to na razie placeholdery: ramka okna
   aplikacji z tym samym wykresem-śladem co wcześniej w środku, zamiast
   pustego widma. Docelowo `.steps-shot-body` przyjmie prawdziwy zrzut
   ekranu (<img>) na miejsce SVG — patrz TODO przy STEP_MARKS. */

function emFirstWord(text: string): string {
  const i = text.indexOf(" ");
  return i === -1 ? `<em>${text}</em>` : `<em>${text.slice(0, i)}</em>${text.slice(i)}`;
}

// ── Static design assets (not copy) ─────────────────────────────────────────



const SHOWCASE_MEDIA = {
  macos: {
    device: "desktop",
    shots: [
      { label: "Pulpit", src: "/landing/screenshots/macos/dashboard.webp", width: 2560, height: 1640, alt: "Pulpit natywnej aplikacji Zecca na macOS" },
      { label: "Pozycje", src: "/landing/screenshots/macos/positions.webp", width: 2560, height: 1640, alt: "Pozycje portfela w natywnej aplikacji Zecca na macOS" },
      { label: "Transakcje", src: "/landing/screenshots/macos/transactions.webp", width: 2560, height: 1640, alt: "Historia transakcji w natywnej aplikacji Zecca na macOS" },
      { label: "Raporty", src: "/landing/screenshots/macos/reports.webp", width: 2560, height: 1640, alt: "Raporty inwestycyjne w natywnej aplikacji Zecca na macOS" },
      { label: "Import", src: "/landing/screenshots/macos/import.webp", width: 2560, height: 1640, alt: "Import danych w natywnej aplikacji Zecca na macOS" },
    ],
  },
  web: {
    device: "desktop",
    shots: [
      { label: "Pulpit", src: "/landing/screenshots/web/dashboard.webp", width: 2530, height: 1424, alt: "Pulpit Zecca w przeglądarce" },
      { label: "Pozycje", src: "/landing/screenshots/web/positions.webp", width: 2530, height: 1424, alt: "Pozycje portfela Zecca w przeglądarce" },
      { label: "Transakcje", src: "/landing/screenshots/web/transactions.webp", width: 2530, height: 1424, alt: "Historia transakcji Zecca w przeglądarce" },
      { label: "Raporty", src: "/landing/screenshots/web/reports.webp", width: 2530, height: 1424, alt: "Raporty inwestycyjne Zecca w przeglądarce" },
    ],
  },
  ios: {
    device: "phone",
    shots: [
      { label: "Pulpit", src: "/landing/screenshots/ios/dashboard.webp", width: 1206, height: 2622, alt: "Pulpit aplikacji Zecca na iPhonie" },
      { label: "Pozycje", src: "/landing/screenshots/ios/positions.webp", width: 1206, height: 2622, alt: "Pozycje portfela w aplikacji Zecca na iPhonie" },
      { label: "Transakcje", src: "/landing/screenshots/ios/transactions.webp", width: 1206, height: 2622, alt: "Historia transakcji w aplikacji Zecca na iPhonie" },
      { label: "Zarobki", src: "/landing/screenshots/ios/earnings.webp", width: 1206, height: 2622, alt: "Zarobki i wyniki roczne w aplikacji Zecca na iPhonie" },
      { label: "Raporty", src: "/landing/screenshots/ios/reports.webp", width: 1206, height: 2622, alt: "Raporty inwestycyjne w aplikacji Zecca na iPhonie" },
    ],
  },
} as const;

const DISCORD_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.3 5.3A16 16 0 0015.4 4l-.2.4a12 12 0 014 .9 13 13 0 00-14.6 0c1.2-.5 2.6-.8 4-.9L8.6 4a16 16 0 00-3.9 1.3C2.2 9 1.5 12.6 1.8 16.2a16 16 0 004.9 2.5l.6-1c-.5-.2-1-.4-1.5-.7l.4-.3a11.5 11.5 0 009.8 0l.4.3c-.5.3-1 .5-1.5.7l.6 1a16 16 0 004.9-2.5c.4-4.2-.7-7.8-3-11zM8.9 14.3c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.8 1.9-1.7 1.9zm6.2 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.8 1.9-1.7 1.9z"/></svg>`;
const APPLE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="20" height="20"><path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"/></svg>`;
const PLUS_SVG = `<svg class="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;

// ── Section builders ────────────────────────────────────────────────────────

import { buildLandingDemoSnapshot } from "./landing-demo-data";
import { formatPercent } from "@/lib/money";

const c = landingCopy;
const demo = buildLandingDemoSnapshot();

// Kotwica pod opisem karty: jedna konkretna wartość zamiast samej obietnicy.
// Puste tam, gdzie nie ma liczby, której nie trzeba by zmyślić.
// Znak przy wierszu — w kolejności copy.ts.
// Zawartość okna-placeholdera: trzy różne TYPY wykresu, nie trzy warianty tej
// samej kreski — rozrzucone punkty (wprowadzasz dane pojedynczo), słupki
// (Zecca liczy), jedna gładka linia (wszystko złożone w jedno). Rysowane w
// viewBox 300×140 — wysokość ciała okna po odjęciu paska tytułowego.
// TODO(zrzuty ekranu): zamienić `.steps-figure-spark` na <img> z prawdziwym
// zrzutem produktu, gdy powstaną — patrz notatka na górze pliku.
const STEP_MARKS = [
  '<g class="steps-figure-mark steps-figure-dots">' +
    [40, 95, 150, 205, 260].map((x, i) => `<circle cx="${x}" cy="${((58 - i * 9 - (i % 2) * 6) * 1.75).toFixed(1)}" r="6" />`).join("") +
    "</g>",
  '<g class="steps-figure-mark steps-figure-bars">' +
    [
      [30, 22], [78, 34], [126, 18], [174, 44], [222, 30], [270, 52],
    ].map(([x, h]) => `<rect x="${x}" y="${(140 - h * 1.75).toFixed(1)}" width="20" height="${(h * 1.75).toFixed(1)}" rx="1.5" />`).join("") +
    "</g>",
  '<polyline class="steps-figure-mark steps-figure-line" points="0,73.5 60,70 120,64.8 180,59.5 240,35 300,14" />',
];
const FEATURE_GLYPHS = [GLYPHS.portfele, GLYPHS.statystyki, GLYPHS.inflacja, GLYPHS.historia,
  GLYPHS.zarobki, GLYPHS.import, GLYPHS.eksport, GLYPHS.sync];
// Karty karuzeli nie mają już ikon linowych — ten język znaków należy teraz
// wyłącznie do Funkcji. Dla polskiego inwestora różni się anatomią karty, nie
// tylko układem, więc GLYPHS.emerytalne/obligacje/nbp/gus/lokaty/waluty
// zostają w bibliotece nieużywane, na wypadek gdyby wróciły gdzie indziej.

const FEATURE_ANCHORS: readonly string[] = [
  "IKE + IKZE",
  demo.metrics.xirrPct === null ? "" : `XIRR ${formatPercent(demo.metrics.xirrPct)}`,
  formatPercent(demo.metrics.realReturnPct),
  "8 lat wstecz",
  "UoP + B2B",
  "XTB · PKO",
  "CSV + JSON",
  "AES-GCM",
];

// Kotwice tej sekcji to nazwy i stawki — rzeczy stałe, nie odczyty z portfela.
// Wcześniej czwarta brała wynik realny z danych demo, przez co ta sama liczba
// („8,8%") stała raz jako mono w rejestrze, raz jako Didone tutaj: jedna wartość
// w dwóch krojach. Reguła: mono to zmierzona wielkość z Twoich danych, Didone to
// figura retoryczna. Wynik realny należy do rejestru i tam zostaje.
const INVESTOR_ANCHORS: readonly string[] = [
  "IKE + IKZE",
  "6 serii",
  "tabela A",
  "wskaźnik CPI",
  "19% podatku",
  "PLN / EUR / USD",
];
const waitlistEnabled = process.env.NEXT_PUBLIC_BETA_WAITLIST_ENABLED === "1";
const showcasePlatforms = [...c.showcase.desktop, c.showcase.ios];

const navHtml = `
<nav class="nav">
  <div class="nav-in">
    <a class="brand" href="#top">
      <span class="mark"><img src="/zecca-mark-96.png" width="96" height="96" alt="" /></span>
      <span class="wordmark">Zecca</span>
      <span class="beta-pill">beta</span>
    </a>
    <button class="nav-burger" type="button" id="navBurger" aria-label="Otwórz menu" aria-expanded="false" aria-controls="navLinks">
      <span class="nav-burger-lines" aria-hidden="true"></span>
    </button>
    <div class="nav-links" id="navLinks">
      ${c.nav.links.map((l) => `<a class="lnk" href="${l.href}">${l.label}</a>`).join("\n      ")}
    </div>
  </div>
  <span class="nav-progress" aria-hidden="true"></span>
</nav>`;

const how = c.howItWorks;
const howItWorksHtml = `
<section class="block steps" id="jak-dziala">
  <div class="wrap">
    <div class="steps-head">
      <span class="sec-kicker">${how.eyebrow}</span>
      <h2 class="sec-title">${b(how.title)}</h2>
      <p class="sec-desc">${b(how.desc)}</p>
    </div>
    <ol class="steps-seq">
      ${how.steps
        .map(
          (step, index) => `<li class="steps-row reveal reveal-fade-up" style="--i:${index}">
        <div class="steps-row-copy">
          <span class="steps-label">Krok ${String(index + 1).padStart(2, "0")}</span>
          <h3>${b(step.title)}</h3>
          <p>${b(step.desc)}</p>
          <span class="src src-quiet">${step.meta}</span>
        </div>
        <div class="steps-row-figure" aria-hidden="true">
          <div class="steps-shot">
            <div class="steps-shot-bar"><span></span><span></span><span></span></div>
            <div class="steps-shot-body">
              <svg class="steps-figure-spark" viewBox="0 0 300 140" preserveAspectRatio="none">${STEP_MARKS[index] ?? STEP_MARKS[0]}</svg>
            </div>
          </div>
        </div>
      </li>`,
        )
        .join("\n      ")}
    </ol>
  </div>
</section>`;

const featuresHtml = `
<section class="block scope" id="funkcje">
  <div class="wrap">
    <div class="sec-split">
      <div class="sec-head">
        <span class="sec-kicker">${c.features.eyebrow}</span>
        <h2 class="sec-title">${b(c.features.title)}</h2>
      </div>
      <p class="sec-desc sec-aside">${b(c.features.desc)}</p>
    </div>
    <div class="feature-grid">
      ${c.features.items
        .map((item, index) => {
          const slideX = index % 2 === 0 ? "-16px" : "16px";
          return `<article class="feature-card reveal reveal-slide" style="--i:${index};--slide-x:${slideX}">
        <div class="feature-card-head">
          <span class="glyph-slot feature-card-glyph">${FEATURE_GLYPHS[index] ?? ""}</span>
          ${FEATURE_ANCHORS[index] ? `<span class="feature-card-anchor">${FEATURE_ANCHORS[index]}</span>` : ""}
        </div>
        <h3 class="feature-card-title">${b(emFirstWord(item.title))}</h3>
        <p>${b(item.desc)}</p>
        <ul class="feature-tags">${item.tags.map((tag) => `<li>${tag}</li>`).join("")}</ul>
      </article>`;
        })
        .join("\n      ")}
    </div>
  </div>
</section>`;

const investorHtml = `
<section class="block investor-block" id="inwestor">
  <img class="sec-bg" src="/landing/depozyt/druk.jpg" alt="" aria-hidden="true" loading="lazy" decoding="async" />
  <span class="sec-scrim" style="background:linear-gradient(100deg,var(--vault) 0%,rgba(2,10,11,.88) 40%,rgba(2,10,11,.6) 70%,rgba(2,10,11,.88) 100%)"></span>
  <span class="sec-scrim" style="background:linear-gradient(180deg,var(--vault) 0%,transparent 22%,transparent 80%,var(--vault) 100%)"></span>
  <div class="wrap">
    <div class="investor-lead">
      <span class="sec-kicker">${c.investor.eyebrow}</span>
      <!-- Jedna wypowiedź, nie etykieta+nagłówek+akapit — Funkcje mają dokładnie
           ten trzypoziomowy szablon, więc tytuł i opis tutaj płyną jednym,
           serifowym ciągiem zamiast rozjeżdżać się na nagłówek + szary akapit
           groteskiem. Liczba obszarów wchodzi w zdanie, nie stoi obok niego. -->
      <p class="investor-statement">
        <strong>${b(c.investor.title)}</strong>
        ${b(c.investor.desc)}
        <span class="investor-statement-count">${c.investor.cells.length} obszarów niżej.</span>
      </p>
    </div>
    <div class="investor-carousel-wrap">
      <span class="investor-scroll-hint">przewiń <span aria-hidden="true">→</span></span>
      <ul class="investor-carousel">
        ${c.investor.cells
          .map(
            (cell, index) => `<li class="investor-card reveal reveal-scale" style="--i:${index}">
          <span class="investor-card-badge">${cell.badge}</span>
          <h3>${b(cell.title)}</h3>
          <p>${b(cell.desc)}</p>
          ${INVESTOR_ANCHORS[index] ? `<span class="investor-card-spec">${INVESTOR_ANCHORS[index]}</span>` : ""}
        </li>`,
          )
          .join("\n        ")}
      </ul>
    </div>
  </div>
</section>`;

const showcaseHtml = `
<section class="block platform-showcase" id="aplikacje">
  <div class="wrap">
    <div class="steps-head">
      <span class="sec-kicker">${c.showcase.eyebrow}</span>
      <h2 class="sec-title">${b(c.showcase.title)}</h2>
      <p class="sec-desc">${b(c.showcase.desc)}</p>
    </div>

    <article class="platform-stage reveal" data-platform-gallery>
      <div class="platform-tabs" role="tablist" aria-label="Wybierz platformę Zecca">
        ${showcasePlatforms
          .map(
            (screen, index) => `<button type="button" role="tab" id="platform-tab-${screen.id}" aria-controls="platform-panel-${screen.id}" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}" data-platform-target="${screen.id}">${screen.tab}</button>`,
          )
          .join("")}
      </div>

      <div class="platform-stage-main">
        ${showcasePlatforms
          .map((screen, index) => {
            const media = SHOWCASE_MEDIA[screen.id];
            const firstShot = media.shots[0];
            const shotNavigation = "";
            return `<figure id="platform-panel-${screen.id}" role="tabpanel" aria-labelledby="platform-tab-${screen.id}" data-platform-panel="${screen.id}" data-device="${media.device}"${index === 0 ? "" : " hidden"}><img data-platform-shot src="${firstShot.src}" width="${firstShot.width}" height="${firstShot.height}" loading="lazy" decoding="async" alt="${firstShot.alt}" />${shotNavigation}</figure>`;
          })
          .join("\n        ")}

        ${showcasePlatforms
          .map(
            (screen, index) => `<div class="platform-story" data-platform-copy="${screen.id}"${index === 0 ? "" : " hidden"}>
          <h3>${b(screen.title)}</h3>
          <p>${b(screen.desc)}</p>
          <ul class="show-list">
            ${screen.points.map((point) => `<li>${b(point)}</li>`).join("\n            ")}
          </ul>
        </div>`,
          )
          .join("\n        ")}
      </div>
    </article>

    <p class="store-note reveal">Aplikacje natywne na macOS i iOS — wkrótce w App Store. Wersja webowa działa już teraz.</p>
  </div>
</section>`;

const faqHtml = `
<section class="block faq-block" id="faq">
  <div class="wrap faq-inner">
    <div class="sec-head">
      <h2 class="sec-title">${b(c.faq.title)}</h2>
    </div>
    <div class="faq-list">
      ${c.faq.items
        .map(
          (item, index) => `<details class="faq">
        <summary><span data-landing-edit-id="faq.items.${index}.question">${b(item.q)}</span>${PLUS_SVG}</summary>
        <div class="ans" data-landing-edit-id="faq.items.${index}.answer">${b(item.a)}</div>
      </details>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;

// ── Domknięcie: prywatność + zaproszenie ─────────────────────────────────
const closingHtml = `
<section class="block closing" id="prywatnosc">
  <img class="sec-bg" src="/landing/depozyt/pieczec.jpg" alt="" aria-hidden="true" loading="lazy" decoding="async" />
  <span class="sec-scrim" style="background:linear-gradient(90deg,rgba(2,10,11,.94) 0%,rgba(2,10,11,.86) 34%,rgba(2,10,11,.35) 62%,transparent 84%)"></span>
  <span class="sec-scrim" style="background:linear-gradient(180deg,var(--vault) 0%,transparent 20%,transparent 76%,var(--vault) 100%)"></span>
  <div class="wrap">
    <div class="sec-head closing-head">
      <span class="sec-kicker">${c.privacy.eyebrow}</span>
      <h2 class="sec-title">${b(c.privacy.title)}</h2>
      <p class="sec-desc">${b(c.privacy.desc)}</p>
      <ul class="privacy-marks">
        ${c.privacy.marks.map((m, i) => `<li class="src">${m}</li>`).join("\n        ")}
      </ul>
      <div class="closing-actions">
        <a class="btn btn-accent" href="${c.closing.ctaPrimaryHref}">${c.closing.ctaPrimary}</a>
        <a class="btn btn-quiet" href="${c.closing.ctaSecondaryHref}">${c.closing.ctaSecondary}</a>
      </div>
      <p class="micro closing-note">${b(c.closing.note)}</p>
    </div>
  </div>
</section>`;

const fb = c.feedback;

const footerHtml = `
<footer>
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a class="brand" href="#top"><span class="mark"><img src="/zecca-mark-96.png" width="96" height="96" alt="" /></span><span class="wordmark">Zecca</span></a>
        <p>${c.footer.tagline}</p>
      </div>
      ${c.footer.columns
        .map(
          (col) => `<div class="foot-col">
        <div class="foot-title">${col.title}</div>
        ${col.links
          .map(
            (l) => {
              const label = `${l.label}${"soon" in l && l.soon ? `<span class="soon">${l.soon}</span>` : ""}`;
              if ("unavailable" in l && l.unavailable) {
                return `<span class="foot-link-unavailable" aria-disabled="true">${label}</span>`;
              }
              return "href" in l ? `<a href="${l.href}">${label}</a>` : "";
            },
          )
          .join("\n        ")}
      </div>`,
        )
        .join("\n      ")}
    </div>
    <div class="foot-bot">
      <span>${c.footer.copyright}</span>
      <span>${c.footer.betaNote}</span>
    </div>
  </div>
</footer>`;

export const LANDING_NAV_HTML = navHtml;

export const LANDING_BODY_HTML = `
${howItWorksHtml}
${featuresHtml}
${investorHtml}
${showcaseHtml}
${faqHtml}
${closingHtml}
${footerHtml}
`;
