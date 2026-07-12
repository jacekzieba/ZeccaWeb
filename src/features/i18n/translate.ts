"use client";

import { useAppLanguage } from "./language-store";

const english: Record<string, string> = {
  "Portfele": "Portfolios",
  "Wszystkie portfele": "All portfolios",
  "Analiza": "Analysis",
  "Pozycje": "Positions",
  "Transakcje": "Transactions",
  "Instrumenty": "Instruments",
  "Zarobki": "Earnings",
  "Porównanie": "Comparison",
  "Raporty": "Reports",
  "System": "System",
  "Import / Eksport": "Import / Export",
  "Ustawienia": "Settings",
  "Łączna wartość": "Total value",
  "Ładowanie danych": "Loading data",
  "vs 30 dni temu": "vs 30 days ago",
  "Język interfejsu": "Interface language",
  "Zmiana jest stosowana od razu i synchronizowana z aplikacjami Zecca.": "The change is applied immediately and synced with Zecca apps.",
};

export function translate(language: "pl" | "en", text: string) {
  return language === "en" ? (english[text] ?? text) : text;
}

export function useTranslation() {
  const language = useAppLanguage();
  return { language, t: (text: string) => translate(language, text) };
}
