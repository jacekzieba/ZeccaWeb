import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fakeSyncEnabled =
    process.env.NEXT_PUBLIC_FAKE_SYNC === "1" &&
    process.env.NODE_ENV !== "production";

  if (fakeSyncEnabled) {
    return <AppShell>{children}</AppShell>;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell initialUser={{ id: user.id, email: user.email }}>
      {children}
    </AppShell>
  );
}
