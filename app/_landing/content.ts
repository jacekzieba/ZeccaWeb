// Landing page markup builder for zecca.pl.
//
// All TEXT lives in copy.ts — edit there. This file holds the structural markup,
// the inline SVG icons and the screenshot config, and assembles them with the
// copy into the final (trusted, static) HTML string that page.tsx injects.
// Styles live in landing.css.

import { landingCopy } from "./copy";

// ── Static design assets (not copy) ─────────────────────────────────────────

// Feature-card icons + tile colours, aligned 1:1 with copy.features.items.
const FEATURE_ICONS: { bg: string; svg: string }[] = [
  {
    bg: "background:var(--brand-tint);color:var(--brand)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="11" rx="1.5"/><rect x="3" y="14" width="8" height="6" rx="1.5"/></svg>`,
  },
  {
    bg: "background:color-mix(in srgb,var(--equity) 12%,transparent);color:var(--equity)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 5-7 4 5"/><path d="M3 21h18"/></svg>`,
  },
  {
    bg: "background:var(--gold-tint);color:var(--gold)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  },
  {
    bg: "background:color-mix(in srgb,var(--profit) 12%,transparent);color:var(--profit)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
  },
  {
    bg: "background:color-mix(in srgb,var(--deposit) 14%,transparent);color:var(--deposit)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>`,
  },
  {
    bg: "background:var(--gold-tint);color:var(--gold)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="14.5" r="1.4"/></svg>`,
  },
  {
    bg: "background:color-mix(in srgb,var(--bonds) 13%,transparent);color:var(--bonds)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>`,
  },
  {
    bg: "background:color-mix(in srgb,var(--deposit) 14%,transparent);color:var(--deposit)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L8 8m4-4l4 4"/><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>`,
  },
  {
    bg: "background:var(--brand-tint);color:var(--brand)",
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8a5 5 0 00-9.6-1.5A4 4 0 006 14h11a3.5 3.5 0 000-7z"/><path d="M9 18l1.5 1.5L13 17"/></svg>`,
  },
];

// Compare-table row icons, aligned 1:1 with copy.comparison.rows.
const COMPARE_ROW_ICONS: string[] = [
  // Cena
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9.3c0-1.1 1.2-1.9 2.8-1.9s2.8.8 2.8 1.9c0 1.6-5.6 1.4-5.6 4 0 1.1 1.2 1.9 2.8 1.9s2.8-.8 2.8-1.9M12 6v1.3M12 16.7V18"/></svg>`,
  // Import transakcji od brokera
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10m0 0l-3.5-3.5M12 13l3.5-3.5"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>`,
  // IKE i IKZE jako osobne portfele
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg>`,
  // Obligacje detaliczne
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  // Kursy walut z NBP
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h11m0 0l-3.5-3.5M18 7l-3.5 3.5"/><path d="M17 17H6m0 0l3.5-3.5M6 17l3.5 3.5"/></svg>`,
  // Inflacja CPI z GUS
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 5-7 4 5"/><path d="M3 21h18"/></svg>`,
  // XIRR / TWR / CAGR
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`,
  // Szyfrowanie end-to-end
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>`,
  // Aplikacja natywna macOS / iOS
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M1 16.5h16"/><rect x="18.5" y="5" width="4" height="14" rx="1"/><path d="M20.2 16.3h.1"/></svg>`,
  // Pełna personalizacja
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h8M16 6h4M4 12h4M10 12h10M4 18h11M19 18h1"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  // Ryzyko błędu przy utrzymaniu
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5H2.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/></svg>`,
];

// Investor-cell badge colours, aligned 1:1 with copy.investor.cells.
const INVESTOR_BADGE_CLASSES = ["b-br", "b-bo", "b-eq", "b-go", "b-de", "b-br"];
const FEATURE_LAYOUT_CLASSES = [
  "feat-portfolios",
  "feat-assets",
  "feat-metrics",
  "feat-real-return",
  "feat-history",
  "feat-income",
  "feat-import",
  "feat-backup",
  "feat-sync",
];

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
const CHECK_SVG = `<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
const PLUS_SVG = `<svg class="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;

// ── Section builders ────────────────────────────────────────────────────────

const c = landingCopy;
const waitlistEnabled = process.env.NEXT_PUBLIC_BETA_WAITLIST_ENABLED === "1";
const showcasePlatforms = [...c.showcase.desktop, c.showcase.ios];

const navHtml = `
<nav class="nav">
  <div class="nav-in">
    <a class="brand" href="#top">
      <span class="mark"><img src="/zecca-logo-96.png" width="96" height="96" alt="" /></span>
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
<section class="block how-work" id="jak-dziala">
  <div class="wrap">
    <div class="process-shell reveal">
      <div class="process-copy">
        <div class="sec-num">${how.eyebrow}</div>
        <h2 class="sec-title">${how.title}</h2>
        <p class="sec-desc">${how.desc}</p>
      </div>
      <div class="process-steps">
        ${how.steps
          .map(
            (step) => `<article class="process-step">
          <div class="step-index">${step.label}</div>
          <div>
            <h3>${step.title}</h3>
            <p>${step.desc}</p>
            <span>${step.meta}</span>
          </div>
        </article>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </div>
</section>`;

const featuresHtml = `
<section class="block" id="funkcje">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="sec-num">${c.features.eyebrow}</div>
      <h2 class="sec-title">${c.features.title}</h2>
      <p class="sec-desc">${c.features.desc}</p>
    </div>

    <div class="feat-grid">
      ${c.features.items
        .map((item, i) => {
          const icon = FEATURE_ICONS[i] ?? FEATURE_ICONS[0];
          const tags = item.tags.map((t) => `<span class="tag">${t}</span>`).join("");
          return `<div class="feat ${FEATURE_LAYOUT_CLASSES[i] ?? ""} reveal" style="--feature-order:${i}">
        <div class="ic" style="${icon.bg}">${icon.svg}</div>
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
        <div class="meta">${tags}</div>
      </div>`;
        })
        .join("\n      ")}
    </div>
  </div>
</section>`;

const showcaseHtml = `
<section class="platform-showcase" id="aplikacje">
  <div class="wrap">
    <header class="platform-showcase-head reveal">
      <div>
        <div class="kicker">${c.showcase.eyebrow}</div>
        <h2>${c.showcase.title}</h2>
      </div>
      <div>
        <p>${c.showcase.desc}</p>
      </div>
    </header>

    <article class="platform-stage reveal" data-platform-gallery>
      <div class="platform-stage-bar">
        <div class="platform-stage-brand"><span class="platform-stage-mark">Z</span><span>Zecca</span><small>jeden portfel</small></div>
        <div class="platform-tabs" role="tablist" aria-label="Wybierz platformę Zecca" style="--platform-index:0">
          ${showcasePlatforms
            .map(
              (screen, index) => `<button type="button" role="tab" id="platform-tab-${screen.id}" aria-controls="platform-panel-${screen.id}" aria-selected="${index === 0 ? "true" : "false"}" tabindex="${index === 0 ? "0" : "-1"}" data-platform-target="${screen.id}"><span>${String(index + 1).padStart(2, "0")}</span>${screen.tab}</button>`,
            )
            .join("")}
        </div>
      </div>

      <div class="platform-stage-main">
        <div class="platform-visual">
          <div class="platform-orbit" aria-hidden="true"></div>
          <div class="platform-visual-label"><span>Podgląd produktu</span><strong>Web · macOS · iOS</strong></div>
          ${showcasePlatforms
            .map((screen, index) => {
              const media = SHOWCASE_MEDIA[screen.id];
              const firstShot = media.shots[0];
              const shotNavigation =
                media.shots.length > 1
                  ? `<div class="platform-shot-nav" role="group" aria-label="Widoki ${screen.tab}">${media.shots
                      .map(
                        (shot, shotIndex) => `<button type="button" aria-pressed="${shotIndex === 0 ? "true" : "false"}" data-platform-shot-target data-src="${shot.src}" data-width="${shot.width}" data-height="${shot.height}" data-alt="${shot.alt}">${shot.label}</button>`,
                      )
                      .join("")}</div>`
                  : "";
              const preview =
                media.device === "phone"
                  ? `<div class="phone-preview"><img class="ios-shot" data-platform-shot src="${firstShot.src}" width="${firstShot.width}" height="${firstShot.height}" loading="lazy" decoding="async" alt="${firstShot.alt}" /><span class="phone-preview-note">Najważniejsze dane<br />zawsze pod ręką</span></div>`
                  : `<div class="desktop-preview"><div class="desktop-preview-chrome"><span></span><span></span><span></span><small>${screen.id === "web" ? "app.zecca.pl" : "Zecca dla macOS"}</small></div><img data-platform-shot src="${firstShot.src}" width="${firstShot.width}" height="${firstShot.height}" loading="lazy" decoding="async" alt="${firstShot.alt}" /></div>`;
              return `<figure id="platform-panel-${screen.id}" role="tabpanel" aria-labelledby="platform-tab-${screen.id}" data-platform-panel="${screen.id}" data-device="${media.device}"${index === 0 ? "" : " hidden"}>${preview}${shotNavigation}</figure>`;
            })
            .join("\n          ")}
          <div class="platform-data-chip"><span>${CHECK_SVG}</span><div><strong>Ten sam portfel</strong><small>Spójne dane i historia</small></div></div>
        </div>

        <div class="platform-stories">
          ${showcasePlatforms
            .map(
              (screen, index) => `<div class="platform-story" data-platform-copy="${screen.id}"${index === 0 ? "" : " hidden"}>
            <div class="platform-story-index">${String(index + 1).padStart(2, "0")} <span>/ 03</span></div>
            <div class="kicker">${screen.kicker}</div>
            <h3>${screen.title}</h3>
            <p>${screen.desc}</p>
            <div class="show-list">
              ${screen.points.map((point) => `<div class="li">${CHECK_SVG}${point}</div>`).join("\n              ")}
            </div>
          </div>`,
            )
            .join("\n          ")}
        </div>
      </div>

      <div class="platform-stage-foot" aria-label="Wspólne cechy platform">
        <span><strong>01</strong> Jedna historia transakcji</span>
        <span><strong>02</strong> Te same metryki i wyniki</span>
        <span><strong>03</strong> Widok dopasowany do urządzenia</span>
      </div>
    </article>
  </div>
</section>`;

const investorHtml = `
<section class="block" id="inwestor">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="sec-num">${c.investor.eyebrow}</div>
      <h2 class="sec-title">${c.investor.title}</h2>
      <p class="sec-desc">${c.investor.desc}</p>
    </div>

    <div class="pl-grid">
      ${c.investor.cells
        .map(
          (cell, i) => `<div class="pl-cell reveal">
        <div class="h"><span class="badge ${INVESTOR_BADGE_CLASSES[i] ?? "b-br"}">${cell.badge}</span></div>
        <h3>${cell.title}</h3>
        <p>${cell.desc}</p>
      </div>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;

const cmp = c.comparison;
const comparisonHtml = `
<section class="block compare-section" id="porownanie">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="sec-num">${cmp.eyebrow}</div>
      <h2 class="sec-title">${cmp.title}</h2>
      <p class="sec-desc">${cmp.desc}</p>
    </div>

    <div class="compare-scroll reveal">
      <table class="compare-table">
        <colgroup>
          <col class="compare-col-label" />
          ${cmp.columns.map((_, i) => `<col class="${i === 0 ? "compare-us" : ""}" />`).join("\n          ")}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" class="compare-col-label"><span class="sr-only">Kryterium</span></th>
            ${cmp.columns
              .map(
                (col, i) =>
                  `<th scope="col" class="${i === 0 ? "compare-us" : ""}">${i === 0 ? '<span class="compare-tag" data-landing-edit-id="comparison.recommended">Polecane</span>' : ""}<span data-landing-edit-id="comparison.columns.${i}">${col}</span></th>`,
              )
              .join("\n            ")}
          </tr>
        </thead>
        <tbody>
          ${cmp.rows
            .map(
              (row, r) => `<tr>
            <th scope="row" class="compare-col-label">
              <span class="compare-row-label">
                <span class="compare-row-ic">${COMPARE_ROW_ICONS[r] ?? ""}</span>
                <span data-landing-edit-id="comparison.rows.${r}.label">${row.label}</span>
              </span>
            </th>
            ${row.values.map((value, i) => `<td class="${i === 0 ? "compare-us" : ""}" data-label="${cmp.columns[i]}"><span data-landing-edit-id="comparison.rows.${r}.values.${i}">${value}</span></td>`).join("\n            ")}
          </tr>`,
            )
            .join("\n          ")}
        </tbody>
      </table>
    </div>
    <p class="compare-foot">${cmp.footnote}</p>
  </div>
</section>`;

const faqHtml = `
<section class="block" id="faq" style="background:var(--page);border-top:.5px solid var(--line);">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="sec-num">${c.faq.eyebrow}</div>
      <h2 class="sec-title">${c.faq.title}</h2>
    </div>
    <div class="faq-wrap">
      ${c.faq.items
        .map(
          (item, index) =>
            `<details class="faq reveal"${"open" in item && item.open ? " open" : ""}><summary><span data-landing-edit-id="faq.items.${index}.question">${item.q}</span>${PLUS_SVG}</summary><div class="ans" data-landing-edit-id="faq.items.${index}.answer">${item.a}</div></details>`,
        )
        .join("\n\n      ")}
    </div>
  </div>
</section>`;

const beta = c.betaList;
const betaListHtml = `
<section class="block beta-list-section" id="lista-beta">
  <div class="wrap beta-list-grid">
    <div class="beta-list-copy reveal">
      <div class="sec-num">${beta.eyebrow}</div>
      <h2 class="sec-title">${beta.title}</h2>
      <p class="sec-desc">${beta.desc}</p>
    </div>
    <form class="beta-waitlist-form reveal" id="betaWaitlistForm" data-provider="airtable" data-enabled="${waitlistEnabled ? "true" : "false"}" data-status="${waitlistEnabled ? "ready" : "planned"}" aria-describedby="beta-waitlist-status" novalidate>
      <div class="field">
        <label for="beta-email">${beta.form.emailLabel}</label>
        <input id="beta-email" name="email" type="email" placeholder="${beta.form.emailPlaceholder}" autocomplete="email"${waitlistEnabled ? "" : " disabled"} />
      </div>
      <div class="field hp-field" aria-hidden="true">
        <label for="beta-company">Firma</label>
        <input id="beta-company" name="company" type="text" tabindex="-1" autocomplete="off" />
      </div>
      <label class="beta-consent" for="beta-consent">
        <input id="beta-consent" name="consent" type="checkbox"${waitlistEnabled ? "" : " disabled"} />
        <span>${beta.form.consentLabel}</span>
      </label>
      <button type="submit" class="btn btn-brand btn-lg"${waitlistEnabled ? "" : " disabled"}>${waitlistEnabled ? beta.form.submit : beta.form.disabledSubmit}</button>
      <p class="beta-waitlist-status" id="beta-waitlist-status" role="status" aria-live="polite"
        data-success="${beta.form.success}"
        data-error="${beta.form.error}"
        data-invalid-email="${beta.form.invalidEmail}"
        data-missing-consent="${beta.form.missingConsent}"></p>
    </form>
  </div>
</section>`;

const fb = c.feedback;
const feedbackHtml = `
<section class="block feedback" id="kontakt">
  <div class="wrap fb-grid">
    <div class="fb-copy reveal">
      <div class="sec-num">${fb.eyebrow}</div>
      <h2 style="margin-top:14px;">${fb.title}</h2>
      <p>${fb.desc}</p>
      <div class="fb-discord">
        <a class="btn btn-ink btn-lg" href="${fb.discordHref}" target="_blank" rel="noopener">
          ${DISCORD_SVG}
          ${fb.discordButton}
        </a>
        <span class="note">${fb.discordNote}</span>
      </div>
    </div>

    <form class="fb-form reveal" id="fbForm" data-email="${fb.email}" data-subject="${fb.emailSubject}">
      <div class="field">
        <label for="fb-name">${fb.form.nameLabel} <span style="text-transform:none;font-weight:400;color:var(--subtle)">${fb.form.nameHint}</span></label>
        <input id="fb-name" name="name" type="text" placeholder="${fb.form.namePlaceholder}"/>
      </div>
      <div class="field">
        <label for="fb-email">${fb.form.emailLabel} <span style="text-transform:none;font-weight:400;color:var(--subtle)">${fb.form.emailHint}</span></label>
        <input id="fb-email" name="email" type="email" placeholder="${fb.form.emailPlaceholder}"/>
      </div>
      <div class="field">
        <label for="fb-msg">${fb.form.messageLabel}</label>
        <textarea id="fb-msg" name="message" required placeholder="${fb.form.messagePlaceholder}"></textarea>
      </div>
      <div class="submit-row">
        <button type="submit" class="btn btn-brand btn-lg">${fb.form.submit}</button>
        <span class="fb-ok" id="fbOk">${fb.form.sending}</span>
      </div>
    </form>
  </div>
</section>`;

const footerHtml = `
<footer>
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        <a class="brand" href="#top"><span class="mark"><img src="/zecca-logo-96.png" width="96" height="96" alt="" /></span><span class="wordmark">Zecca</span></a>
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
${showcaseHtml}
${investorHtml}
${comparisonHtml}
${faqHtml}
${betaListHtml}
${feedbackHtml}
${footerHtml}
`;
