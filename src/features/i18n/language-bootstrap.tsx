"use client";

import { useEffect } from "react";
import { useSyncStore } from "@/sync/store/sync-store";
import { setAppLanguage, useAppLanguage, type AppLanguage } from "./language-store";

function isLanguage(value: unknown): value is AppLanguage {
  return value === "pl" || value === "en";
}

/** Keeps the browser language aligned with the shared native settings record. */
export function LanguageBootstrap() {
  const language = useAppLanguage();
  const records = useSyncStore((state) => state.records);

  // `lang` opisuje język TREŚCI, nie preferencję w ustawieniach. Słownik tłumaczy
  // dziś osiemnaście napisów — menu boczne i własną etykietę przełącznika — więc
  // dokument pozostaje polski. Ustawianie tu `en` powodowało, że czytnik ekranu
  // czytał polski tekst angielską fonetyką: przełącznik pogarszał dostępność,
  // zamiast cokolwiek przetłumaczyć. Wróci tu, gdy wróci tłumaczenie.
  void language;

  useEffect(() => {
    const settings = records?.find((record) => record.envelope.type === "settings");
    const syncedLanguage = settings?.envelope.payload as { appLanguage?: unknown } | undefined;
    if (isLanguage(syncedLanguage?.appLanguage)) {
      setAppLanguage(syncedLanguage.appLanguage);
    }
  }, [records]);

  return null;
}
