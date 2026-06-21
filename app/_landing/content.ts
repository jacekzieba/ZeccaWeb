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

// Privacy-card icons, aligned 1:1 with copy.privacy.cards.
const PRIVACY_ICONS: string[] = [
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5"/><path d="M11.5 11.5L21 21M17 17l2-2M14 14l2-2"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg>`,
];

// Investor-cell badge colours, aligned 1:1 with copy.investor.cells.
const INVESTOR_BADGE_CLASSES = ["b-br", "b-bo", "b-eq", "b-go", "b-de", "b-br"];

// Showcase screenshots, aligned 1:1 with copy.showcase. `frame` picks the mock.
const SHOWCASE_MEDIA = [
  { frame: "mac", src: "/landing/showcase-mac.webp", width: 2200, height: 1359 },
  { frame: "iphone", src: "/landing/ios.webp", width: 600, height: 1305 },
] as const;

const APPLE_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4 0 0-2.1-.8-2.1-3.2zM14.2 5.9c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z"/></svg>`;
const STAR_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.5 6.5L22 9.8l-5 4.4 1.4 6.8L12 17.7 5.6 21l1.4-6.8-5-4.4 6.5-1.3z"/></svg>`;
const DISCORD_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19.3 5.3A16 16 0 0015.4 4l-.2.4a12 12 0 014 .9 13 13 0 00-14.6 0c1.2-.5 2.6-.8 4-.9L8.6 4a16 16 0 00-3.9 1.3C2.2 9 1.5 12.6 1.8 16.2a16 16 0 004.9 2.5l.6-1c-.5-.2-1-.4-1.5-.7l.4-.3a11.5 11.5 0 009.8 0l.4.3c-.5.3-1 .5-1.5.7l.6 1a16 16 0 004.9-2.5c.4-4.2-.7-7.8-3-11zM8.9 14.3c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.8 1.9-1.7 1.9zm6.2 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.8 1.9-1.7 1.9z"/></svg>`;
const CHECK_SVG = `<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
const PLUS_SVG = `<svg class="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;

// ── Section builders ────────────────────────────────────────────────────────

const c = landingCopy;

const navHtml = `
<nav class="nav">
  <div class="nav-in">
    <a class="brand" href="#top">
      <span class="mark">Z</span>
      <span class="wordmark">Zecca</span>
      <span class="beta-pill">beta</span>
    </a>
    <div class="nav-links">
      ${c.nav.links.map((l) => `<a class="lnk" href="${l.href}">${l.label}</a>`).join("\n      ")}
      <a class="btn btn-ghost nav-login" href="${c.nav.login.href}">${c.nav.login.label}</a>
    </div>
  </div>
</nav>`;

const heroHtml = `
<header class="hero" id="top">
  <div class="wrap hero-grid">
    <span class="beta-banner">${c.hero.betaBanner}</span>
    <div class="eyebrow">${c.hero.eyebrow}</div>
    <h1>${c.hero.title}</h1>
    <p class="lede">${c.hero.lede}</p>

    <div class="cta-row">
      <a class="btn btn-brand btn-lg" href="${c.hero.ctaPrimaryHref}">
        ${STAR_SVG}
        ${c.hero.ctaPrimary}
      </a>
      <div class="store-badges">
        ${c.hero.storeBadges
          .map(
            (b) => `<span class="store-badge" title="Wkrótce">
          <span class="store-soon">${b.soon}</span>
          ${APPLE_SVG}
          <span><span class="sb-top">${b.top}</span><span class="sb-main">${b.main}</span></span>
        </span>`,
          )
          .join("\n        ")}
      </div>
    </div>
    <p class="cta-note">${c.hero.note}</p>

    <div class="macwin reveal">
      <img class="mac-shot" src="/landing/hero-mac.webp" width="2000" height="1157" fetchpriority="high" decoding="async" alt="${c.hero.imageAlt}"/>
    </div>
  </div>
</header>`;

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
          return `<div class="feat reveal">
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
<div class="showcase">
  <div class="wrap">
    ${c.showcase
      .map((row, i) => {
        const media = SHOWCASE_MEDIA[i] ?? SHOWCASE_MEDIA[0];
        const points = row.points
          .map((p) => `<div class="li">${CHECK_SVG}${p}</div>`)
          .join("\n          ");
        const art =
          media.frame === "iphone"
            ? `<div class="iphone">
          <div class="island"></div>
          <div class="screen">
            <img class="ph-shot" src="${media.src}" width="${media.width}" height="${media.height}" loading="lazy" decoding="async" alt="${row.imageAlt}"/>
          </div>
        </div>`
            : `<div class="macwin" style="margin-top:0;width:100%;">
          <img class="mac-shot" src="${media.src}" width="${media.width}" height="${media.height}" loading="lazy" decoding="async" alt="${row.imageAlt}"/>
        </div>`;
        return `<div class="show-row${i % 2 === 1 ? " flip" : ""}">
      <div class="show-copy reveal">
        <div class="kicker">${row.kicker}</div>
        <h3>${row.title}</h3>
        <p>${row.desc}</p>
        <div class="show-list">
          ${points}
        </div>
      </div>
      <div class="show-art reveal">
        ${art}
      </div>
    </div>`;
      })
      .join("\n    ")}
  </div>
</div>`;

const privacyHtml = `
<section class="block privacy" id="prywatnosc">
  <div class="wrap">
    <div class="sec-head reveal">
      <div class="sec-num">${c.privacy.eyebrow}</div>
      <h2 class="sec-title">${c.privacy.title}</h2>
      <p class="sec-desc">${c.privacy.desc}</p>
    </div>

    <div class="priv-grid">
      ${c.privacy.cards
        .map(
          (card, i) => `<div class="priv-card reveal">
        <div class="ic">${PRIVACY_ICONS[i] ?? PRIVACY_ICONS[0]}</div>
        <h3>${card.title}</h3>
        <p>${card.desc}</p>
      </div>`,
        )
        .join("\n      ")}
    </div>
    <p class="priv-foot">${c.privacy.footnote}</p>
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
          (item) =>
            `<details class="faq reveal"${"open" in item && item.open ? " open" : ""}><summary>${item.q}${PLUS_SVG}</summary><div class="ans">${item.a}</div></details>`,
        )
        .join("\n\n      ")}
    </div>
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
        <a class="brand" href="#top"><span class="mark">Z</span><span class="wordmark">Zecca</span></a>
        <p>${c.footer.tagline}</p>
      </div>
      ${c.footer.columns
        .map(
          (col) => `<div class="foot-col">
        <h5>${col.title}</h5>
        ${col.links
          .map(
            (l) =>
              `<a href="${l.href}">${l.label}${"soon" in l && l.soon ? `<span class="soon">${l.soon}</span>` : ""}</a>`,
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

export const LANDING_HTML = `
<div class="zlanding">
${navHtml}
${heroHtml}
${featuresHtml}
${showcaseHtml}
${privacyHtml}
${investorHtml}
${faqHtml}
${feedbackHtml}
${footerHtml}
</div>
`;
