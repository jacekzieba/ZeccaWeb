import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/supabase/server";
import { LANDING_BODY_HTML, LANDING_NAV_HTML } from "./_landing/content";
import { landingCopy } from "./_landing/copy";
import { LandingHero } from "./_landing/landing-hero";
import { LandingInteractions } from "./_landing/landing-interactions";
import "./_landing/landing.css";

export const dynamic = "force-dynamic";

const SITE_URL = "https://zecca.pl";
const LANDING_DESCRIPTION =
  "Zecca prowadzi Twoje portfele — IKE, IKZE, akcje, ETF-y, obligacje skarbowe i lokaty — lokalnie i prywatnie. Kursy z NBP, inflacja z GUS, pełna historia od pierwszej transakcji.";

export const metadata: Metadata = {
  title: "Zecca · spokojny przegląd Twoich inwestycji",
  description: LANDING_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: SITE_URL,
    siteName: "Zecca",
    title: "Zecca · spokojny przegląd Twoich inwestycji",
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
    title: "Zecca · spokojny przegląd Twoich inwestycji",
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
        availability: "https://schema.org/PreOrder",
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

export default async function LandingPage() {
  const fakeSyncEnabled =
    process.env.NEXT_PUBLIC_FAKE_SYNC === "1" &&
    process.env.NODE_ENV !== "production";

  // Logged-in users go straight to their app; visitors see the marketing landing.
  if (!fakeSyncEnabled) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  }

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
