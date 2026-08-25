// Landing page markup builder for zecca.pl.
//
// All TEXT lives in copy.ts — edit there. This file holds the structural markup,
// the inline SVG icons and the screenshot config, and assembles them with the
// copy into the final (trusted, static) HTML string that page.tsx injects.
// Styles live in landing.css.

import { landingCopy } from "./copy";

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
<section class="block steps" id="jak-dziala">
  <div class="wrap">
    <div class="rail-row sec-head reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <div>
        <div class="sec-kicker">${how.eyebrow}</div>
        <h2 class="sec-title">${how.title}</h2>
        <p class="sec-desc">${how.desc}</p>
      </div>
    </div>

    ${how.steps
      .map(
        (step) => `<article class="rail-row step reveal">
      <span class="rail-mark">${step.label}<em>${step.meta}</em></span>
      <div>
        <h3>${step.title}</h3>
        <p>${step.desc}</p>
      </div>
    </article>`,
      )
      .join("\n    ")}
  </div>
</section>`;

const featuresHtml = `
<section class="block scope" id="funkcje">
  <div class="wrap">
    <div class="rail-row sec-head reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <div>
        <h2 class="sec-title">${c.features.title}</h2>
        <p class="sec-desc">${c.features.desc}</p>
      </div>
    </div>

    ${c.features.items
      .map(
        (item) => `<article class="rail-row scope-item reveal">
      <span class="rail-mark">${item.tags.map((t) => `<em>${t}</em>`).join("")}</span>
      <div>
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
      </div>
    </article>`,
      )
      .join("\n    ")}
  </div>
</section>`;

const showcaseHtml = `
<section class="block platform-showcase" id="aplikacje">
  <div class="wrap">
    <div class="rail-row sec-head reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <div>
        <div class="sec-kicker">${c.showcase.eyebrow}</div>
        <h2 class="sec-title">${c.showcase.title}</h2>
        <p class="sec-desc">${c.showcase.desc}</p>
      </div>
    </div>

    <article class="rail-row platform-stage reveal" data-platform-gallery>
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
            const shotNavigation =
              media.shots.length > 1
                ? `<div class="platform-shot-nav" role="group" aria-label="Widoki ${screen.tab}">${media.shots
                    .map(
                      (shot, shotIndex) => `<button type="button" aria-pressed="${shotIndex === 0 ? "true" : "false"}" data-platform-shot-target data-src="${shot.src}" data-width="${shot.width}" data-height="${shot.height}" data-alt="${shot.alt}">${shot.label}</button>`,
                    )
                    .join("")}</div>`
                : "";
            return `<figure id="platform-panel-${screen.id}" role="tabpanel" aria-labelledby="platform-tab-${screen.id}" data-platform-panel="${screen.id}" data-device="${media.device}"${index === 0 ? "" : " hidden"}><img data-platform-shot src="${firstShot.src}" width="${firstShot.width}" height="${firstShot.height}" loading="lazy" decoding="async" alt="${firstShot.alt}" />${shotNavigation}</figure>`;
          })
          .join("\n        ")}

        ${showcasePlatforms
          .map(
            (screen, index) => `<div class="platform-story" data-platform-copy="${screen.id}"${index === 0 ? "" : " hidden"}>
          <h3>${screen.title}</h3>
          <p>${screen.desc}</p>
          <ul class="show-list">
            ${screen.points.map((point) => `<li>${point}</li>`).join("\n            ")}
          </ul>
        </div>`,
          )
          .join("\n        ")}
      </div>
    </article>

    <div class="rail-row store-row reveal">
      <span class="rail-mark">Aplikacje<em>wkrótce</em></span>
      <div class="store-badges">
        ${c.hero.storeBadges
          .map(
            (badge) => `<span class="store-badge" aria-disabled="true">${APPLE_SVG}<span><small>${badge.top}</small><strong>${badge.main}</strong></span><em>${badge.soon}</em></span>`,
          )
          .join("")}
      </div>
    </div>
  </div>
</section>`;

const investorHtml = `
<section class="block band-dark" id="inwestor">
  <div class="wrap">
    <div class="rail-row sec-head reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <div>
        <h2 class="sec-title">${c.investor.title}</h2>
        <p class="sec-desc">${c.investor.desc}</p>
      </div>
    </div>

    ${c.investor.cells
      .map(
        (cell) => `<article class="rail-row pl-row reveal">
      <span class="rail-mark">${cell.badge}</span>
      <div>
        <h3>${cell.title}</h3>
        <p>${cell.desc}</p>
      </div>
    </article>`,
      )
      .join("\n    ")}
  </div>
</section>`;


const faqHtml = `
<section class="block faq-block" id="faq">
  <div class="wrap">
    <div class="rail-row sec-head reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <h2 class="sec-title">${c.faq.title}</h2>
    </div>
    ${c.faq.items
      .map(
        (item, index) =>
          `<div class="rail-row faq-row reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <details class="faq"${"open" in item && item.open ? " open" : ""}>
        <summary><span data-landing-edit-id="faq.items.${index}.question">${item.q}</span>${PLUS_SVG}</summary>
        <div class="ans" data-landing-edit-id="faq.items.${index}.answer">${item.a}</div>
      </details>
    </div>`,
      )
      .join("\n    ")}
  </div>
</section>`;

const beta = c.betaList;
const betaListHtml = `
<section class="block beta-list-section" id="lista-beta">
  <div class="wrap">
    <div class="rail-row sec-head reveal">
      <span class="rail-mark" aria-hidden="true"></span>
      <div>
        <h2 class="sec-title">${beta.title}</h2>
        <p class="sec-desc">${beta.desc}</p>
      </div>
    </div>
    <div class="rail-row reveal">
      <span class="rail-mark">Zapisy<em>${waitlistEnabled ? "otwarte" : "wkrótce"}</em></span>
      <form class="beta-waitlist-form" id="betaWaitlistForm" data-provider="airtable" data-enabled="${waitlistEnabled ? "true" : "false"}" data-status="${waitlistEnabled ? "ready" : "planned"}" aria-describedby="beta-waitlist-status" novalidate>
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
  </div>
</section>`;

const fb = c.feedback;

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
    <div class="rail-row foot-contact" id="kontakt">
      <span class="rail-mark">Kontakt<em>${fb.email}</em></span>
      <div>
        <p>${fb.desc}</p>
        <a class="btn btn-ink" href="${fb.discordHref}" target="_blank" rel="noopener">${DISCORD_SVG}${fb.discordButton}</a>
        <a class="foot-mail" href="mailto:${fb.email}?subject=${encodeURIComponent(fb.emailSubject)}">${fb.email}</a>
      </div>
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
${faqHtml}
${betaListHtml}
${footerHtml}
`;
