import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/providers/providers";

export const dynamic = "force-dynamic";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fakeSyncEnabled =
    process.env.NEXT_PUBLIC_FAKE_SYNC === "1" &&
    process.env.NODE_ENV !== "production";

  if (fakeSyncEnabled) {
    return (
      <Providers>
        <AppShell>{children}</AppShell>
      </Providers>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as { onboarding_completed_at: string | null } | null;

  // A profile read failure must not trap a returning user in onboarding.
  const onboardingCompleted = profileError
    ? true
    : Boolean(profile?.onboarding_completed_at);

  return (
    <Providers>
      <AppShell
        initialUser={{ id: user.id, email: user.email, onboardingCompleted }}
      >
        {children}
      </AppShell>
    </Providers>
  );
}
