"use client";

import { useSyncExternalStore } from "react";

export type AppLanguage = "pl" | "en";

const STORAGE_KEY = "zecca-web-language";
const DEFAULT_LANGUAGE: AppLanguage = "pl";

let currentLanguage: AppLanguage = DEFAULT_LANGUAGE;
let loaded = false;
const listeners = new Set<() => void>();

function isLanguage(value: unknown): value is AppLanguage {
  return value === "pl" || value === "en";
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLanguage(stored)) currentLanguage = stored;
}

function emit() {
  for (const listener of listeners) listener();
}

export function setAppLanguage(language: AppLanguage) {
  ensureLoaded();
  if (language === currentLanguage) return;
  currentLanguage = language;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, language);
  }
  emit();
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureLoaded();
  return currentLanguage;
}

export function useAppLanguage() {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_LANGUAGE);
}

export function languageName(language: AppLanguage) {
  return language === "pl" ? "Polski" : "English";
}
