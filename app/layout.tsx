import type { Metadata } from "next";
import "@/design/tokens.css";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Bodoni_Moda, Archivo, IBM_Plex_Mono } from "next/font/google";

// Didone niesie nagłówki (rodowód grawerowanego banknotu), grotesk prozę
// i etykiety, mono każdą liczbę. Rozdział ról — patrz src/design/tokens.css.
// Te same kroje co landing: produkt i strona mają jedną typografię.
const display = Bodoni_Moda({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display-src",
  display: "swap",
});

// Archivo idzie w pięciu wagach, bo w tylu jest rysowany. Wcześniej krój wczytywał
// się w 300/400/500, a kod prosił 264 razy o 600/700/800 — przeglądarka robiła
// wtedy pogrubienie sztuczne, czyli rozlewała laski i zalewała światła wewnętrzne.
const text = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
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
