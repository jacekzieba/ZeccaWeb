import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/supabase/server";
import { LANDING_BODY_HTML, LANDING_NAV_HTML } from "./_landing/content";
import { LandingHero } from "./_landing/landing-hero";
import { LandingInteractions } from "./_landing/landing-interactions";
import "./_landing/landing.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zecca · spokojny przegląd Twoich inwestycji",
  description:
    "Zecca prowadzi Twoje portfele — IKE, IKZE, akcje, ETF-y, obligacje skarbowe i lokaty — lokalnie i prywatnie. Kursy z NBP, inflacja z GUS, pełna historia od pierwszej transakcji.",
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
      <div className="zlanding">
        <div dangerouslySetInnerHTML={{ __html: LANDING_NAV_HTML }} />
        <LandingHero />
        <div dangerouslySetInnerHTML={{ __html: LANDING_BODY_HTML }} />
      </div>
      <LandingInteractions />
    </>
  );
}
