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

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const settings = records?.find((record) => record.envelope.type === "settings");
    const syncedLanguage = settings?.envelope.payload as { appLanguage?: unknown } | undefined;
    if (isLanguage(syncedLanguage?.appLanguage)) {
      setAppLanguage(syncedLanguage.appLanguage);
    }
  }, [records]);

  return null;
}
