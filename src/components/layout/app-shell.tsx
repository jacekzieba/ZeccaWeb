"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, useEffect, type CSSProperties } from "react";
import type { Route } from "next";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { useSyncStore } from "@/sync/store/sync-store";
import { AddTransactionModal } from "@/features/transactions/add-transaction-modal";
import { PendingSyncStatus } from "@/features/sync/pending-sync-status";
import { SyncUnlockPanel, type SyncLoadResult } from "@/features/sync/sync-unlock-panel";
import { COLORS, SHADOWS, SURFACES, TYPOGRAPHY } from "@/lib/design-tokens";

const glassSurface: CSSProperties = {
  ...SURFACES.glassPanel,
};

// ── useMedia hook (SSR-safe, defaults to desktop to avoid shift) ──
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

// ── Nav structure ────────────────────────────────────────────────
type NavItem = {
  id: string;
  label: string;
  icon: string;
  href: Route;
  color?: string;
};
type NavGroup = {
  sec: string | null;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    sec: null,
    items: [{ id: "dashboard", label: "Dashboard", icon: "⬡", href: "/dashboard" }],
  },
  {
    sec: "Portfele",
    items: [
      { id: "portfolios", label: "Wszystkie portfele", icon: "◎", href: "/portfolios" },
    ],
  },
  {
    sec: "Analiza",
    items: [
      { id: "transactions", label: "Transakcje", icon: "↕", href: "/transactions" },
      { id: "instruments", label: "Instrumenty", icon: "◈", href: "/instruments" },
      { id: "reports", label: "Raporty", icon: "≋", href: "/reports" },
    ],
  },
  {
    sec: "System",
    items: [
      { id: "import", label: "Import / Export", icon: "⇅", href: "/import" },
      { id: "settings", label: "Ustawienia", icon: "⚙", href: "/dashboard" },
    ],
  },
];

async function handleLogout() {
  const supabase = createBrowserSupabaseClientOrNull();
  if (supabase) await supabase.auth.signOut();
  window.location.assign("/login");
}

// ── Sidebar content ──────────────────────────────────────────────
function SidebarContent({ activeId, onNav }: { activeId: string; onNav?: () => void }) {
  return (
    <>
      {/* Brand */}
      <div style={{ padding: "18px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: COLORS.text, color: COLORS.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800,
            boxShadow: SHADOWS.button,
          }}
        >
          I
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, letterSpacing: ".02em" }}>Investor</div>
          <div style={{ fontSize: 10, color: COLORS.subtle, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Web · v0.1
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 10px 12px" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 8 }}>
            {group.sec && (
              <div
                style={{
                  fontSize: 10, fontWeight: 700,
                  color: COLORS.subtle,
                  letterSpacing: ".10em", textTransform: "uppercase",
                  padding: "12px 12px 6px",
                }}
              >
                {group.sec}
              </div>
            )}
            {group.items.map((item) => {
              const active = activeId === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNav}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "8px 11px", borderRadius: 9,
                    background: active ? COLORS.surfaceAlt : "transparent",
                    color: active ? COLORS.text : COLORS.text,
                    textDecoration: "none", marginBottom: 1,
                    boxShadow: active
                      ? `inset 0 0 0 1px ${COLORS.border}, ${SHADOWS.card}`
                      : "none",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = COLORS.textSoft;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 20, height: 20, borderRadius: 6,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: active ? COLORS.surface : COLORS.textSoft,
                      color: active ? COLORS.accent : (item.color || COLORS.textMuted),
                      fontSize: 11, flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, fontFamily: TYPOGRAPHY.system }}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom card */}
      <div style={{ padding: "0 10px 12px" }}>
        <div
          style={{
            padding: "14px", borderRadius: 12,
            background: COLORS.surfaceAlt, color: COLORS.text,
            border: `0.5px solid ${COLORS.border}`,
            boxShadow: SHADOWS.card,
            position: "relative", overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute", right: -22, top: -22,
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(44,76,107,0.14)", filter: "blur(20px)",
            }}
          />
          <div style={{ fontSize: 9.5, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: ".12em" }}>
            Tryb
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, position: "relative" }}>MVP</div>
          <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 1 }}>Dane odszyfrowywane lokalnie</div>
        </div>
      </div>

      {/* Logout */}
      <div style={{ padding: "0 10px 14px" }}>
        <button
          onClick={handleLogout}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8,
            padding: "8px 11px", borderRadius: 9,
            border: "none", background: "transparent",
            color: COLORS.textMuted, fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
            transition: "background .15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = COLORS.textSoft; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ fontSize: 14 }}>↩</span>
          Wyloguj się
        </button>
      </div>
    </>
  );
}

// ── Main AppShell ────────────────────────────────────────────────
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const openAddTransaction = useSyncStore((s) => s.openAddTransaction);
  const records = useSyncStore((s) => s.records);
  const setSync = useSyncStore((s) => s.setSync);
  const clearSync = useSyncStore((s) => s.clearSync);

  const handleSyncLoaded = useCallback((result: SyncLoadResult | null) => {
    if (result) {
      setSync(result.records, result.snapshot);
      return;
    }

    clearSync();
  }, [clearSync, setSync]);

  const activeId = pathname === "/dashboard"
    ? "dashboard"
    : pathname.startsWith("/portfolios")
    ? "portfolios"
    : pathname.startsWith("/transactions")
    ? "transactions"
    : pathname.startsWith("/instruments")
    ? "instruments"
    : pathname.startsWith("/reports")
    ? "reports"
    : pathname.replace("/", "");
  const PAD = 12;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, padding: `${PAD}px ${PAD}px ${PAD + 8}px` }}>

      {/* ── FLOATING TOPBAR ──────────────────────────────────── */}
      <header
        style={{
          position: "sticky", top: PAD, zIndex: 50,
          ...glassSurface,
          borderRadius: 14,
          marginBottom: PAD,
        }}
      >
        <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 12 }}>

          {/* Mobile: hamburger */}
          {!isDesktop && (
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                border: `0.5px solid ${COLORS.border}`,
                background: COLORS.surface,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 3,
              }}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ width: 14, height: 1.5, background: COLORS.text, borderRadius: 1, display: "block" }} />
              ))}
            </button>
          )}

          {/* Mobile: brand text */}
          {!isDesktop && (
            <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, letterSpacing: ".01em" }}>
              Investor
            </span>
          )}

          {/* Desktop: brand */}
          {isDesktop && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, letterSpacing: ".02em" }}>Investor</span>
              <span
                style={{
                  fontSize: 10, color: COLORS.subtle,
                  padding: "2px 6px", borderRadius: 4,
                  background: COLORS.surfaceAlt,
                  textTransform: "uppercase", letterSpacing: ".08em",
                }}
              >
                Web
              </span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Desktop: search */}
          {isDesktop && (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px 6px 10px", borderRadius: 10,
                background: COLORS.surface,
                border: `0.5px solid ${COLORS.border}`,
                minWidth: 260, cursor: "text",
              }}
            >
              <span style={{ fontSize: 13, color: COLORS.subtle }}>⌕</span>
              <span style={{ fontSize: 12, color: COLORS.subtle }}>Szukaj instrumentu, transakcji…</span>
              <span
                style={{
                  marginLeft: "auto", fontSize: 10, color: COLORS.subtle,
                  padding: "2px 6px", borderRadius: 4,
                  background: COLORS.surfaceAlt,
                  fontFamily: TYPOGRAPHY.mono,
                }}
              >
                ⌘K
              </span>
            </div>
          )}

          <PendingSyncStatus />

          {/* Add transaction */}
          <button
            onClick={openAddTransaction}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 9,
              border: "none", background: COLORS.text, color: COLORS.white,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: SHADOWS.button,
              fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            {isDesktop && "Dodaj transakcję"}
          </button>

          {/* Avatar */}
          <div
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: COLORS.gold, color: COLORS.white,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
              boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.3)",
              cursor: "pointer",
            }}
          >
            P
          </div>
        </div>
      </header>

      {/* ── LAYOUT ───────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: PAD, alignItems: "flex-start" }}>

        {/* Desktop floating sidebar */}
        {isDesktop && (
          <aside
            style={{
              width: 240, flexShrink: 0,
              position: "sticky",
              top: PAD + 56 + PAD,
              alignSelf: "flex-start",
              maxHeight: `calc(100vh - ${PAD * 3 + 56}px)`,
              display: "flex", flexDirection: "column",
              ...glassSurface,
              borderRadius: 14, overflow: "hidden",
            }}
          >
            <SidebarContent activeId={activeId} />
          </aside>
        )}

        {/* Mobile drawer overlay */}
        {!isDesktop && drawerOpen && (
          <>
            <div
              onClick={() => setDrawerOpen(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 80,
                background: COLORS.overlay,
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
              }}
            />
            <aside
              style={{
                position: "fixed", left: 10, top: 10, bottom: 10,
                width: 268, zIndex: 90,
                ...glassSurface,
                background: "rgba(255,255,255,0.98)",
                borderRadius: 14,
                display: "flex", flexDirection: "column",
                boxShadow: SHADOWS.cardStrong,
                overflow: "hidden",
              }}
              className="animate-slide-in-left"
            >
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  position: "absolute", top: 14, right: 12,
                  width: 26, height: 26, borderRadius: "50%",
                  border: "none", background: COLORS.surfaceAlt,
                  color: COLORS.text, fontSize: 15, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
              <SidebarContent activeId={activeId} onNav={() => setDrawerOpen(false)} />
            </aside>
          </>
        )}

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
          {!records && (
            <GlobalSyncPanel onSyncLoaded={handleSyncLoaded} />
          )}
          {children}
        </main>
      </div>

      {/* Global modal */}
      <AddTransactionModal />
    </div>
  );
}

function GlobalSyncPanel({
  onSyncLoaded,
}: {
  onSyncLoaded(result: SyncLoadResult | null): void;
}) {
  return (
    <section
      style={{
        ...glassSurface,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          padding: "14px 22px",
          borderBottom: `0.5px solid ${COLORS.lineSoft}`,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: COLORS.subtle,
            textTransform: "uppercase",
            letterSpacing: ".10em",
          }}
        >
          Synchronizacja danych
        </div>
      </div>
      <SyncUnlockPanel onSyncLoaded={onSyncLoaded} />
    </section>
  );
}
