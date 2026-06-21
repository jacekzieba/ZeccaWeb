"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useMemo, type CSSProperties } from "react";
import type { Route } from "next";
import {
  ArrowDownUp,
  ArrowLeftRight,
  Banknote,
  BriefcaseBusiness,
  ChartNoAxesColumn,
  FileText,
  FolderOpen,
  Landmark,
  LayoutDashboard,
  ListCollapse,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { buildParitySnapshot } from "@/sync/records/parity-snapshot";
import { useSyncStore } from "@/sync/store/sync-store";
import { useDisplaySnapshot } from "@/features/sync/use-display-snapshot";
import { AddTransactionModal } from "@/features/transactions/add-transaction-modal";
import { TelemetryConsentBanner } from "@/features/telemetry/telemetry-consent-banner";
import { CommandPalette } from "@/features/search/command-palette";
import { PendingSyncStatus } from "@/features/sync/pending-sync-status";
import {
  SyncUnlockPanel,
  type InitialSyncUser,
  type SyncLoadResult,
} from "@/features/sync/sync-unlock-panel";
import { COLORS, SHADOWS, SURFACES, TYPOGRAPHY } from "@/lib/design-tokens";
import { V2, v2Glass, v2Mix } from "@/lib/v2-design";
import { clearCachedUserDataKey } from "@/sync/encryption/key-cache";
import { initials, useProfile } from "@/features/profile/profile-store";
import { AppLock } from "@/features/auth/app-lock";

declare global {
  interface Window {
    __investorWebParitySnapshot?: ReturnType<typeof buildParitySnapshot>;
    __investorWebExportParitySnapshot?: () => string;
  }
}

const glassSurface: CSSProperties = {
  ...SURFACES.glassPanel,
  ...v2Glass,
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

// Hide the floating topbar when scrolling down, reveal it when scrolling up
// (or near the top of the page).
function useHideOnScroll(threshold = 80) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < threshold) {
          setHidden(false);
        } else if (delta > 6) {
          setHidden(true);
        } else if (delta < -6) {
          setHidden(false);
        }
        lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return hidden;
}

// ── Nav structure ────────────────────────────────────────────────
type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: Route;
  color?: string;
  value?: number;
  exact?: boolean;
};
type NavGroup = {
  sec: string | null;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    sec: null,
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
  {
    sec: "Portfele",
    items: [
      {
        id: "portfolios",
        label: "Wszystkie portfele",
        icon: BriefcaseBusiness,
        href: "/portfolios",
        exact: true,
      },
    ],
  },
  {
    sec: "Analiza",
    items: [
      { id: "positions", label: "Pozycje", icon: ListCollapse, href: "/positions" },
      { id: "transactions", label: "Transakcje", icon: ArrowLeftRight, href: "/transactions" },
      { id: "instruments", label: "Instrumenty", icon: Landmark, href: "/instruments" },
      { id: "earnings", label: "Zarobki", icon: Banknote, href: "/earnings" },
      { id: "benchmark", label: "Porównanie", icon: ChartNoAxesColumn, href: "/benchmark" },
      { id: "reports", label: "Raporty", icon: FileText, href: "/reports" },
    ],
  },
  {
    sec: "System",
    items: [
      { id: "import", label: "Import / Eksport", icon: ArrowDownUp, href: "/import" },
      { id: "settings", label: "Ustawienia", icon: Settings, href: "/settings" },
    ],
  },
];

async function handleLogout() {
  const supabase = createBrowserSupabaseClientOrNull();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) {
        await clearCachedUserDataKey(data.user.id);
      }
    } catch {
      // Sign out even if the local trusted-device cache is unavailable.
    }

    await supabase.auth.signOut();
  }
  window.location.assign("/login");
}

function fmtNavNumber(value: number, digits = 0) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Compact value shown next to each portfolio in the sidebar (matches the
// design's `wFmtK`: e.g. "1,23 mln", "31,2 tys.", "950").
function fmtNavCompact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2).replace(".", ",")} mln`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1).replace(".", ",")} tys.`;
  return fmtNavNumber(value);
}

function isNavItemActive(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// ── Sidebar content ──────────────────────────────────────────────
function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const snapshot = useDisplaySnapshot();
  const { displayCurrency } = useProfile();
  const totalValue = snapshot?.totalValue ?? null;
  const changePct = snapshot?.monthlyChange ?? null;
  const changePLN =
    totalValue != null && changePct != null
      ? Math.round((totalValue * changePct) / 100)
      : null;
  const changeSign = changePLN != null && changePLN >= 0 ? "+" : "";

  // Design + native iOS/macOS list each portfolio directly under "Portfele".
  // Build those entries dynamically from the synced snapshot.
  const portfolioItems: NavItem[] = (snapshot?.portfolios ?? []).map((portfolio) => ({
    id: `pf-${portfolio.id}`,
    label: portfolio.name,
    icon: FolderOpen,
    href: `/portfolios/${portfolio.id}` as Route,
    value: portfolio.value,
  }));

  const navGroups: NavGroup[] = NAV_GROUPS.map((group) =>
    group.sec === "Portfele"
      ? { ...group, items: [...group.items, ...portfolioItems] }
      : group,
  );

  return (
    <>
      {/* Brand */}
      <div style={{ padding: "18px 16px 10px", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 8,
            background: COLORS.text, color: COLORS.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: TYPOGRAPHY.serif,
            fontSize: 18, fontWeight: 600,
            boxShadow: SHADOWS.button,
          }}
        >
          Z
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, letterSpacing: ".01em" }}>Zecca</div>
          <div style={{ fontFamily: TYPOGRAPHY.mono, fontSize: 9.5, color: COLORS.subtle, letterSpacing: ".10em", textTransform: "uppercase", marginTop: 1 }}>
            Web · v2
          </div>
        </div>
      </div>

      {/* Only navigation scrolls. The summary card below stays visible. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <nav style={{ padding: "6px 10px 4px" }}>
        {navGroups.map((group, gi) => (
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
              const active = isNavItemActive(item, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNav}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "8px 11px", borderRadius: 9,
                    background: active ? COLORS.green : "transparent",
                    color: active ? COLORS.white : COLORS.text,
                    textDecoration: "none", marginBottom: 1,
                    boxShadow: active
                      ? `0 2px 8px rgba(33,74,53,0.35), inset 0 0.5px 0 rgba(255,255,255,0.22)`
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
                      width: 20,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      color: active ? COLORS.white : (item.color || COLORS.textMuted),
                      opacity: active ? 1 : 0.8,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15.5} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, fontFamily: TYPOGRAPHY.system, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.label}
                  </span>
                  {item.value != null && (
                    <span
                      style={{
                        fontFamily: TYPOGRAPHY.mono,
                        fontSize: 10.5,
                        color: active ? "rgba(255,255,255,0.8)" : COLORS.subtle,
                        flexShrink: 0,
                      }}
                    >
                      {fmtNavCompact(item.value)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      </div>

      {/* Total-value card — fixed below the scrollable menu */}
      <div style={{ padding: "4px 10px 12px" }}>
        <div
          style={{
            padding: "14px", borderRadius: 12,
            background: COLORS.text, color: COLORS.white,
            border: `0.5px solid ${COLORS.border}`,
            boxShadow: "0 10px 26px rgba(22,29,24,0.24)",
            position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(244,242,230,0.62)", textTransform: "uppercase", letterSpacing: ".13em", position: "relative" }}>
            Łączna wartość
          </div>
          <div style={{ fontFamily: TYPOGRAPHY.serif, fontSize: 27, fontWeight: 500, marginTop: 5, position: "relative", fontVariantNumeric: "tabular-nums", letterSpacing: "-.01em" }}>
            {totalValue == null ? "—" : fmtNavNumber(totalValue)}
            <span style={{ fontSize: 13, fontStyle: "italic", opacity: 0.6, marginLeft: 5 }}>{displayCurrency}</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#7FD9A8", fontWeight: 600, marginTop: 4, fontVariantNumeric: "tabular-nums", position: "relative" }}>
            {changePLN == null || changePct == null
              ? "Ładowanie danych"
              : `${changeSign}${fmtNavNumber(changePLN)} ${displayCurrency} (${changePct >= 0 ? "+" : ""}${fmtNavNumber(changePct, 2)}%)`}
          </div>
          <div style={{ fontSize: 10.5, color: "rgba(244,242,230,0.50)", marginTop: 1, position: "relative" }}>vs 30 dni temu</div>
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
          <LogOut size={14} strokeWidth={1.8} aria-hidden="true" />
          Wyloguj się
        </button>
      </div>
    </>
  );
}

// ── Main AppShell ────────────────────────────────────────────────
export function AppShell({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: InitialSyncUser | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const topbarHidden = useHideOnScroll();
  const profile = useProfile();
  const openAddTransaction = useSyncStore((s) => s.openAddTransaction);
  const records = useSyncStore((s) => s.records);
  const setSync = useSyncStore((s) => s.setSync);
  const clearSync = useSyncStore((s) => s.clearSync);
  const paritySnapshot = useMemo(
    () =>
      records
        ? buildParitySnapshot(records, {
            asOf: new Date(),
            historyGranularity: "daily",
            useLatestTransactionFxRate: true,
            useMarketQuotes: true,
          })
        : null,
    [records],
  );

  useEffect(() => {
    if (!paritySnapshot) {
      delete window.__investorWebParitySnapshot;
      delete window.__investorWebExportParitySnapshot;
      return;
    }

    window.__investorWebParitySnapshot = paritySnapshot;
    window.__investorWebExportParitySnapshot = () =>
      JSON.stringify(window.__investorWebParitySnapshot, null, 2);
  }, [paritySnapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSyncLoaded = useCallback((result: SyncLoadResult | null) => {
    if (result) {
      setSync(result.records, result.snapshot);
      return;
    }

    clearSync();
  }, [clearSync, setSync]);

  const PAD = 12;

  // Until the user data key is unlocked there is nothing meaningful to show —
  // the dashboard would render demo/empty data. Mirror the native iOS/macOS
  // flow: present a full-screen passphrase gate right after login/registration
  // (the trusted-browser auto-unlock and "create backup" flows live inside
  // SyncUnlockPanel, so a returning user on a trusted device passes through
  // with just a brief spinner).
  if (!records) {
    return (
      <AppLock>
        <SyncUnlockGate initialUser={initialUser} onSyncLoaded={handleSyncLoaded} />
      </AppLock>
    );
  }

  return (
    <AppLock>
    <div style={{ minHeight: "100vh", background: V2.page, padding: `${PAD}px ${PAD}px ${PAD + 8}px`, overflowX: "hidden" }}>

      {/* ── FLOATING TOPBAR ──────────────────────────────────── */}
      <header
        style={{
          position: "sticky", top: PAD, zIndex: 50,
          ...glassSurface,
          borderRadius: 14,
          marginBottom: PAD * 2,
          transform: topbarHidden ? `translateY(-${PAD * 2 + 56}px)` : "translateY(0)",
          opacity: topbarHidden ? 0 : 1,
          pointerEvents: topbarHidden ? "none" : "auto",
          transition: "transform .28s ease, opacity .28s ease",
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
                background: v2Mix(V2.card, 0.5),
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
              Zecca
            </span>
          )}

          {/* Desktop: brand */}
          {isDesktop && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, letterSpacing: ".02em" }}>Zecca</span>
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

          {/* Desktop: search trigger */}
          {isDesktop && (
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px 6px 10px", borderRadius: 10,
                background: V2.card,
                border: `1px solid ${v2Mix(V2.ink, 0.28)}`,
                boxShadow: `inset 0 1px 0 ${V2.spec}, 0 2px 8px ${v2Mix(V2.ink, 0.06)}`,
                minWidth: 300, cursor: "text",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 13, color: COLORS.muted }}>⌕</span>
              <span style={{ fontSize: 12, color: COLORS.muted }}>Szukaj instrumentu, transakcji…</span>
              <span
                style={{
                  marginLeft: "auto", fontSize: 10, color: COLORS.muted,
                  padding: "2px 6px", borderRadius: 4,
                  background: v2Mix(V2.ink, 0.07),
                  fontFamily: TYPOGRAPHY.mono,
                }}
              >
                ⌘K
              </span>
            </button>
          )}

          {/* Mobile: search icon */}
          {!isDesktop && (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Szukaj"
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                border: `0.5px solid ${COLORS.border}`,
                background: v2Mix(V2.card, 0.5),
                cursor: "pointer", color: COLORS.text, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ⌕
            </button>
          )}

          <PendingSyncStatus />

          {/* Add transaction */}
          <button
            onClick={openAddTransaction}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 9,
              border: "none", background: V2.ink, color: V2.card,
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
          <Link
            href={"/settings" as Route}
            aria-label="Profil"
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              background: V2.brand, color: V2.onBrand,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700,
              boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.3)",
              cursor: "pointer", textDecoration: "none",
            }}
          >
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              initials(profile.name)
            )}
          </Link>
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
            <SidebarContent />
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
                background: v2Mix(V2.card, 0.94),
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
              <SidebarContent onNav={() => setDrawerOpen(false)} />
            </aside>
          </>
        )}

        {/* Main content — capped on very wide screens (topbar + sidebar stay full-bleed) */}
        <main style={{ flex: 1, minWidth: 0, maxWidth: 1240, marginInline: "auto", width: "100%", paddingBottom: 4 }}>
          {children}
        </main>
      </div>

      {/* Global modal */}
      <AddTransactionModal />
      <TelemetryConsentBanner />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      {paritySnapshot && (
        <script
          id="investor-web-parity-snapshot"
          type="application/json"
          suppressHydrationWarning
        >
          {JSON.stringify(paritySnapshot)}
        </script>
      )}
    </div>
    </AppLock>
  );
}

// Full-screen passphrase gate shown after login/registration until the user
// data key is unlocked (parity with native iOS/macOS). Centered card on the
// app background, matching the login screen aesthetic.
function SyncUnlockGate({
  initialUser,
  onSyncLoaded,
}: {
  initialUser?: InitialSyncUser | null;
  onSyncLoaded(result: SyncLoadResult | null): void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: V2.page,
        display: "grid",
        placeItems: "center",
        padding: "24px 16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 460,
          ...glassSurface,
          borderRadius: 18,
          boxShadow: SHADOWS.cardStrong,
          overflow: "hidden",
        }}
      >
        {/* Brand + heading */}
        <div style={{ padding: "28px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: COLORS.text,
                color: COLORS.white,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: TYPOGRAPHY.serif,
                fontSize: 17,
                fontWeight: 600,
                boxShadow: SHADOWS.button,
              }}
            >
              Z
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Zecca</div>
              <div
                style={{
                  fontFamily: TYPOGRAPHY.mono,
                  fontSize: 9.5,
                  color: COLORS.subtle,
                  textTransform: "uppercase",
                  letterSpacing: ".10em",
                  marginTop: 1,
                }}
              >
                Web · v2
              </div>
            </div>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.01em" }}>
            Odblokuj swoje dane
          </h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.5 }}>
            Wprowadź passphrase, aby odszyfrować portfel lokalnie w przeglądarce.
          </p>
        </div>

        <SyncUnlockPanel initialUser={initialUser} onSyncLoaded={onSyncLoaded} />
      </section>
    </div>
  );
}
