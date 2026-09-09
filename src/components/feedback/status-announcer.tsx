"use client";

import { useEffect, useState } from "react";
import { token } from "@/design/tokens";
import { TYPOGRAPHY } from "@/lib/design-tokens";

/** Potwierdzenia zapisu — widoczne i ogłaszane.
 *
 * Produkt ogłaszał błędy (`role="alert"` w oknie transakcji, przy synchronizacji,
 * w postępie importu), ale sukcesu nie ogłaszał nigdzie. Po przełączeniu opcji
 * w ustawieniach nie dało się odróżnić „zapisano" od „kliknięcie nie doszło".
 *
 * Kanał jest celowo prosty: zdarzenie na `window`, jeden nasłuch w powłoce,
 * jeden żywy region. Bez magazynu stanu i bez kolejki — komunikat wypiera
 * poprzedni, bo potwierdzenie jest ulotne z natury.
 */
const ZDARZENIE = "zecca:status";

type Status = { message: string; action?: { label: string; run: () => void } };

/** Komunikat może nieść jedną akcję — dziś wyłącznie cofnięcie usunięcia.
 *  Z akcją komunikat czeka dłużej, bo trzeba zdążyć w niego trafić. */
export function announce(message: string, action?: { label: string; run: () => void }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Status>(ZDARZENIE, { detail: { message, action } }));
}

export function StatusAnnouncer() {
  const [status, setStatus] = useState<Status>({ message: "" });
  const message = status.message;

  useEffect(() => {
    function onStatus(event: Event) {
      const detail = (event as CustomEvent<Status>).detail;
      if (!detail || typeof detail.message !== "string" || !detail.message) return;
      setStatus(detail);
    }
    window.addEventListener(ZDARZENIE, onStatus);
    return () => window.removeEventListener(ZDARZENIE, onStatus);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setStatus({ message: "" }), status.action ? 9000 : 4000);
    return () => window.clearTimeout(timer);
  }, [message, status.action]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: message ? 24 : 8,
        transform: "translateX(-50%)",
        zIndex: 300,
        // Bez akcji pasek nie łapie kliknięć; z akcją musi.
        pointerEvents: status.action ? "auto" : "none",
        display: "flex",
        alignItems: "center",
        gap: 14,
        opacity: message ? 1 : 0,
        transition: "opacity .18s ease, bottom .18s ease",
        padding: message ? "10px 18px" : 0,
        borderRadius: "var(--r-pill)",
        background: token("surface2"),
        border: message ? `1px solid ${token("rail")}` : "none",
        color: token("ink"),
        fontFamily: TYPOGRAPHY.system,
        fontSize: 13,
        fontWeight: 500,
        maxWidth: "min(92vw, 520px)",
        textAlign: "center",
      }}
    >
      <span>{message}</span>
      {status.action && (
        <button
          type="button"
          onClick={() => {
            const run = status.action?.run;
            setStatus({ message: "" });
            run?.();
          }}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            color: token("accent"),
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            whiteSpace: "nowrap",
          }}
        >
          {status.action.label}
        </button>
      )}
    </div>
  );
}
