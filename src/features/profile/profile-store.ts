"use client";

import { useSyncExternalStore } from "react";

// The display profile (name, avatar), target asset-class allocation and
// notification preferences are personal presentation settings that never need
// to leave the browser, so they live in localStorage rather than the encrypted
// sync. This keeps them aligned with the app's "decrypted data stays local"
// principle while still being editable.

export type AssetClassTarget = {
  /** Asset-class key, matching the labels produced by the snapshot allocation. */
  label: string;
  /** Target share of the portfolio, percent. */
  percent: number;
};

export type NotificationPrefs = {
  price: boolean;
  income: boolean;
  weekly: boolean;
  pit: boolean;
};

/** Currency the UI presents all amounts in. Data is stored natively in PLN and
 * converted for display using NBP rates. */
export type DisplayCurrency = "PLN" | "EUR" | "USD";

export type Profile = {
  name: string;
  avatar: string | null;
  targetAllocation: AssetClassTarget[];
  notifications: NotificationPrefs;
  displayCurrency: DisplayCurrency;
  /** Polish tax residency (Belka tax preference). Stored as a presentation
   * preference; detailed tax computation is not yet wired. */
  taxResidencePL: boolean;
  autoTax: boolean;
};

const STORAGE_KEY = "investor-web-profile";

const DEFAULT_PROFILE: Profile = {
  name: "Inwestor",
  avatar: null,
  targetAllocation: [
    { label: "Akcje / ETF", percent: 60 },
    { label: "Obligacje", percent: 30 },
    { label: "Lokaty", percent: 5 },
    { label: "Gotówka", percent: 5 },
  ],
  notifications: { price: true, income: true, weekly: false, pit: false },
  displayCurrency: "PLN",
  taxResidencePL: true,
  autoTax: true,
};

let current: Profile = DEFAULT_PROFILE;
let loaded = false;
const listeners = new Set<() => void>();

function load(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      notifications: { ...DEFAULT_PROFILE.notifications, ...parsed.notifications },
      targetAllocation: parsed.targetAllocation?.length
        ? parsed.targetAllocation
        : DEFAULT_PROFILE.targetAllocation,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    current = load();
    loaded = true;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function updateProfile(patch: Partial<Profile>) {
  ensureLoaded();
  current = { ...current, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Ignore quota / serialization errors — settings just won't persist.
    }
  }
  emit();
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Profile {
  ensureLoaded();
  return current;
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PROFILE);
}

/** First-name-only greeting helper. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Initials for the avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
