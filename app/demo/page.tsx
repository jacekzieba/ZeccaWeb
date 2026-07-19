import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PublicDemoContent } from "@/features/onboarding/public-demo-content";
import { Providers } from "@/providers/providers";

export const metadata: Metadata = {
  title: "Demo Zecca",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return (
    <Providers>
      <AppShell publicDemo>
        <PublicDemoContent />
      </AppShell>
    </Providers>
  );
}
