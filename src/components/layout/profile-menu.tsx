"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { LogOut, Settings } from "lucide-react";
import { token } from "@/design/tokens";

// Menu pod awatarem w górnym pasku: przejście do ustawień i wylogowanie.
// Zamyka się po wyborze, klawiszem Escape i kliknięciem obok (jak Select).
export function ProfileMenu({
  children,
  size,
  logoutLabel,
  onLogout,
  triggerStyle,
}: {
  children: ReactNode;
  size: number;
  logoutLabel: string;
  onLogout(): void;
  triggerStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const item: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 12px",
    borderRadius: "var(--r-md)",
    border: "none",
    background: "transparent",
    color: token("ink"),
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "inherit",
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
  };

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Profil"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        style={{ ...triggerStyle, width: size, height: size, padding: 0, fontFamily: "inherit" }}
      >
        {children}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Profil"
          onKeyDown={onMenuKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 200,
            minWidth: 190,
            padding: 4,
            borderRadius: "var(--r-lg)",
            border: `0.5px solid ${token("line")}`,
            background: token("surface"),
          }}
        >
          <Link
            ref={firstItemRef}
            href={"/settings" as Route}
            role="menuitem"
            onClick={() => setOpen(false)}
            style={item}
          >
            <Settings size={15} aria-hidden />
            Ustawienia
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            style={item}
          >
            <LogOut size={15} aria-hidden />
            {logoutLabel}
          </button>
        </div>
      )}
    </div>
  );
}
