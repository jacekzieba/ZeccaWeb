"use client";

import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import { useOnboardingStore } from "@/features/onboarding/onboarding-state";
import {
  PRIVACY_POLICY_CHANGES,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_EFFECTIVE_DATE_LABEL,
} from "@/lib/privacy-policy";

// Polityka obiecuje informację w aplikacji o istotnych zmianach. Raz na
// przeglądarkę i wersję polityki: data w kluczu, więc nowa wersja = nowe
// powiadomienie. Gdy localStorage rzuca (tryb prywatny, zablokowane dane
// witryny), „Rozumiem” obowiązuje do zamknięcia karty — jak zgoda na statystyki.
const KEY = `zecca-web-policy-notice-${PRIVACY_POLICY_EFFECTIVE_DATE}`;

const listeners = new Set<() => void>();
let dismissedInTab = false;

function isDismissed() {
  try {
    return window.localStorage.getItem(KEY) !== null || dismissedInTab;
  } catch {
    return dismissedInTab;
  }
}

function dismiss() {
  dismissedInTab = true;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Zostaje `dismissedInTab`.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // „Rozumiem” w innej karcie chowa powiadomienie także tutaj.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Rejestracja: nowe konto właśnie zaakceptowało tę wersję polityki. */
export function markPolicyNoticeSeen() {
  dismiss();
}

/**
 * Pasek nad treścią aplikacji, nie kolejny element przyklejony do dołu (tam
 * jest pytanie o zgodę na statystyki). Serwer nie zna localStorage, więc przy
 * renderze serwerowym i hydratacji nic nie pokazuje — bez błędu #418.
 * Nie kradnie fokusu; po „Rozumiem” fokus idzie na <main>, zamiast przepaść
 * razem z przyciskiem.
 */
export function PolicyUpdateNotice() {
  const ref = useRef<HTMLElement>(null);
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  // W trakcie wprowadzenia nie dokładamy drugiego komunikatu nad demo.
  const onboarding = useOnboardingStore((state) => state.phase !== "idle");
  if (dismissed || onboarding) return null;

  function onDismiss() {
    const main = ref.current?.closest("main");
    dismiss();
    main?.focus();
  }

  return (
    <section ref={ref} className="policy-notice" aria-label="Zmiany w polityce prywatności">
      <p className="policy-notice__body">
        Zaktualizowaliśmy politykę prywatności ({PRIVACY_POLICY_EFFECTIVE_DATE_LABEL}):{" "}
        {PRIVACY_POLICY_CHANGES}.
      </p>
      <div className="policy-notice__actions">
        <Link href="/privacy-policy">Przeczytaj zmiany</Link>
        <button type="button" onClick={onDismiss}>
          Rozumiem
        </button>
      </div>
    </section>
  );
}
