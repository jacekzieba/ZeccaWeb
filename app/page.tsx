import type { Metadata } from "next";
import { LANDING_BODY_HTML, LANDING_NAV_HTML } from "./_landing/content";
import { landingCopy } from "./_landing/copy";
import { LandingHero } from "./_landing/landing-hero";
import { LandingInteractions } from "./_landing/landing-interactions";
import "./_landing/landing.css";

const SITE_URL = "https://zecca.pl";
const LANDING_DESCRIPTION =
  "Zecca to prywatna aplikacja do śledzenia inwestycji: IKE, IKZE, akcje, ETF-y, obligacje skarbowe i lokaty — na macOS, iOS oraz w przeglądarce.";
const LANDING_TITLE = "Zecca - śledź wszystkie inwestycje";

export const metadata: Metadata = {
  title: LANDING_TITLE,
  description: LANDING_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: SITE_URL,
    siteName: "Zecca",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: [
      {
        url: "/landing/showcase-mac.webp",
        width: 2200,
        height: 1359,
        alt: "Zecca na macOS — dashboard i raporty portfela",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    images: ["/landing/showcase-mac.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

function stripLandingHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const landingJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "Zecca",
      url: SITE_URL,
      description: LANDING_DESCRIPTION,
      inLanguage: "pl-PL",
      applicationCategory: "FinanceApplication",
      operatingSystem: ["macOS", "iOS", "Web"],
      image: `${SITE_URL}/landing/showcase-mac.webp`,
      screenshot: [
        `${SITE_URL}/landing/showcase-mac.webp`,
        `${SITE_URL}/landing/ios.webp`,
      ],
      featureList: landingCopy.features.items.map((item) => stripLandingHtml(item.title)),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "PLN",
        availability: "https://schema.org/InStock",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: landingCopy.faq.items.map((item) => ({
        "@type": "Question",
        name: stripLandingHtml(item.q),
        acceptedAnswer: {
          "@type": "Answer",
          text: stripLandingHtml(item.a),
        },
      })),
    },
  ],
};

// Static marketing page. Logged-in visitors are redirected to /dashboard in
// middleware, so `/` needs no per-request auth call and can be prerendered.
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main className="zlanding">
        <div dangerouslySetInnerHTML={{ __html: LANDING_NAV_HTML }} />
        <LandingHero />
        <div dangerouslySetInnerHTML={{ __html: LANDING_BODY_HTML }} />
      </main>
      <LandingInteractions />
    </>
  );
}
