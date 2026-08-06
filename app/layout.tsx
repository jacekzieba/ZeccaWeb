import type { Metadata } from "next";
import "@/design/tokens.css";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Space_Grotesk, Newsreader, IBM_Plex_Mono } from "next/font/google";

// Grotesk niesie nagłówki i etykiety, szeryf prozę, mono każdą liczbę.
// Rozdział ról jest regułą kierunku „Próba" — patrz src/design/tokens.css.
const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700"],
  variable: "--font-display-src",
  display: "swap",
});

const text = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-text-src",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-code-src",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zecca.pl"),
  applicationName: "Zecca",
  title: "Zecca",
  description: "Śledź wszystkie inwestycje",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" data-theme="light" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      <body className="antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
