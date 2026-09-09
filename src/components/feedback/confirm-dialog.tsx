"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { token } from "@/design/tokens";
import { COLORS, TYPOGRAPHY } from "@/lib/design-tokens";

/** Potwierdzenie działania nieodwracalnego.
 *
 * Zastępuje `window.confirm`, który: nie mówił, CO usuwa („Usunąć transakcję?"),
 * wyglądał jak okno systemu operacyjnego, nie dawał się ostylować i blokował
 * wątek. Tutaj nazwa usuwanej rzeczy jest w treści, akcja niszcząca ma własny
 * kolor, Escape anuluje, a ognisko startuje na „Anuluj" — nie na „Usuń".
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Usuń",
  cancelLabel = "Anuluj",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      // Dwa przyciski, ale Tab i tak nie ma prawa wyjść poza warstwę modalną.
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const przycisk = {
    height: 38,
    padding: "0 18px",
    borderRadius: "var(--r-pill)",
    fontFamily: TYPOGRAPHY.system,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  } as const;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={onCancel}
        style={{
          position: "absolute",
          inset: 0,
          background: COLORS.overlay,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          padding: "24px 26px 20px",
          background: token("surface"),
          border: `1px solid ${token("line")}`,
          borderRadius: "var(--r-md)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ fontFamily: TYPOGRAPHY.serif, fontSize: 18, fontWeight: 500, color: token("ink") }}>
          {title}
        </div>
        {body && (
          <div style={{ fontFamily: TYPOGRAPHY.system, fontSize: 13, color: token("inkMuted"), marginTop: 8, lineHeight: 1.5 }}>
            {body}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{ ...przycisk, border: `1px solid ${token("rail")}`, background: "transparent", color: token("ink") }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ ...przycisk, border: "none", background: token("down"), color: token("ground") }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
