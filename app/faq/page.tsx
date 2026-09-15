import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { DEMO_SESSION_COOKIE } from "@/features/onboarding/demo-session";
import { Providers } from "@/providers/providers";
import { Footer } from "@/components/layout/footer";
import { FaqContent } from "@/features/faq/faq-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "FAQ i metryki - Zecca",
  description: "Najczęstsze pytania dotyczące Zecca oraz wyjaśnienia metryk inwestycyjnych.",
  alternates: {
    canonical: "/faq",
  },
};

/** FAQ ma dwóch odbiorców pod tym samym adresem: anonimowego gościa z landingu
 * (link w stopce) i użytkownika aplikacji (link w menu bocznym / palecie
 * poleceń). Wcześniej strona była zawsze samodzielna — kliknięcie „FAQ"
 * z wnętrza aplikacji gubiło całe menu AppShell. Logika sesji lustrzana
 * względem app/(app)/layout.tsx: zalogowany i tryb demo dostają FAQ wewnątrz
 * AppShell, gość bez sesji — samodzielną stronę jak dotychczas. */
export default async function FAQPage() {
  const fakeSyncEnabled =
    process.env.NEXT_PUBLIC_FAKE_SYNC === "1" &&
    process.env.NODE_ENV !== "production";

  if (fakeSyncEnabled) {
    return (
      <Providers>
        <AppShell>
          <FaqAppWrapper />
        </AppShell>
      </Providers>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <Providers>
        <AppShell initialUser={{ id: user.id, email: user.email }}>
          <FaqAppWrapper />
        </AppShell>
      </Providers>
    );
  }

  const demoSession = (await cookies()).get(DEMO_SESSION_COOKIE)?.value === "1";
  if (demoSession) {
    return (
      <Providers>
        <AppShell publicDemo>
          <FaqAppWrapper />
        </AppShell>
      </Providers>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, maxWidth: "900px", marginInline: "auto", width: "100%", padding: "40px 24px" }}>
        <FaqContent />
      </main>
      <Footer />
    </div>
  );
}

function FaqAppWrapper() {
  return (
    <div style={{ maxWidth: 900, marginInline: "auto" }}>
      <FaqContent />
    </div>
  );
}
