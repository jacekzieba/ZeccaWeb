"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  V2,
  V2Badge,
  V2Card,
  V2ScreenHead,
  V2_TYPE,
  v2Mix,
} from "@/lib/v2-design";
import { useSyncStore } from "@/sync/store/sync-store";
import {
  initials,
  updateProfile,
  useProfile,
  type NotificationPrefs,
  type Profile,
} from "@/features/profile/profile-store";
import { AppLockSettingsRow } from "@/features/auth/app-lock";
import { useTelemetryConsent } from "@/features/telemetry/use-telemetry-consent";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import { clearCachedUserDataKey } from "@/sync/encryption/key-cache";
import { clearPendingSyncOperations } from "@/sync/records/record-writer";

function Switch({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-label={label}
      style={{
        width: 42,
        height: 25,
        borderRadius: 13,
        border: "none",
        padding: 0,
        cursor: "pointer",
        position: "relative",
        background: on ? V2.brand : v2Mix(V2.ink, 0.16),
        transition: "background .18s",
      }}
      aria-pressed={on}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 20 : 3,
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: `0 1px 3px ${v2Mix(V2.ink, 0.3)}`,
          transition: "left .18s",
        }}
      />
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ display: "inline-flex", background: v2Mix(V2.ink, 0.06), borderRadius: 9, padding: 3 }}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          style={{
            padding: "6px 12px",
            borderRadius: 7,
            border: "none",
            cursor: "pointer",
            fontFamily: V2_TYPE.ui,
            fontSize: 12,
            fontWeight: value === option.value ? 700 : 500,
            background: value === option.value ? V2.card : "transparent",
            color: value === option.value ? V2.ink : V2.muted,
            boxShadow: value === option.value ? `0 1px 4px ${v2Mix(V2.ink, 0.1)}` : "none",
            whiteSpace: "nowrap",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <V2Card pad={0}>
      <div style={{ padding: "17px 24px 13px", borderBottom: `0.5px solid ${V2.line}` }}>
        <div style={{ fontFamily: V2_TYPE.ui, fontSize: 10.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: V2.subtle }}>
          {eyebrow}
        </div>
        <div style={{ fontFamily: V2_TYPE.serif, fontSize: 19, fontWeight: 500, color: V2.ink, marginTop: 2 }}>{title}</div>
      </div>
      {children}
    </V2Card>
  );
}

function Row({
  label,
  desc,
  control,
  last = false,
}: {
  label: string;
  desc?: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, padding: "15px 24px", borderTop: last ? "none" : `0.5px solid ${V2.line2}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: V2_TYPE.ui, fontSize: 13.5, fontWeight: 600, color: V2.ink }}>{label}</div>
        {desc && <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12, color: V2.muted, marginTop: 2, maxWidth: 440 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

export function SettingsPage() {
  const profile = useProfile();
  const snapshot = useSyncStore((s) => s.snapshot);

  const accounts = snapshot?.portfolios ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: V2_TYPE.ui, color: V2.ink }}>
      <V2ScreenHead eyebrow="System" title="Ustawienia" sub="Profil, podatki, alokacja, źródła danych i powiadomienia" />

      <ProfileCard profile={profile} accountCount={accounts.length} />

      <AllocationSection profile={profile} />

      <Section eyebrow="Regionalne" title="Waluta i format">
        <Row label="Waluta bazowa" desc="Przeliczenia portfela i raportów wg kursów NBP z danego dnia" control={<Segmented options={[{ value: "PLN", label: "PLN" }, { value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }]} value={profile.displayCurrency} onChange={(v) => updateProfile({ displayCurrency: v as Profile["displayCurrency"] })} />} />
        <Row label="Język interfejsu" desc="Pełne tłumaczenie EN jest w przygotowaniu" control={<Segmented options={[{ value: "pl", label: "Polski" }, { value: "en", label: "English (wkrótce)" }]} value="pl" onChange={() => {}} />} last />
      </Section>

      <Section eyebrow="Podatki" title="Rozliczenia podatkowe">
        <Row label="Rezydencja podatkowa · Polska" desc="Podatek Belki 19% od zysków kapitałowych" control={<Switch on={profile.taxResidencePL} onChange={(v) => updateProfile({ taxResidencePL: v })} label="Rezydencja podatkowa Polska" />} />
        <Row label="Automatyczne naliczanie podatku" desc="Szacuj należny podatek przy każdej sprzedaży" control={<Switch on={profile.autoTax} onChange={(v) => updateProfile({ autoTax: v })} label="Automatyczne naliczanie podatku" />} />
        <Row label="Limit wpłat IKE 2026" desc="Wykorzystano 6 500 zł z 26 019 zł" control={(
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 120, height: 7, borderRadius: 4, background: v2Mix(V2.ink, 0.08), overflow: "hidden" }}>
              <div style={{ width: "25%", height: "100%", background: V2.brand, borderRadius: 4 }} />
            </div>
            <span style={{ fontFamily: V2_TYPE.mono, fontSize: 12, color: V2.ink }}>25%</span>
          </div>
        )} last />
      </Section>

      <Section eyebrow="Dane" title="Konta i źródła">
        {accounts.length === 0 ? (
          <Row label="Brak zsynchronizowanych kont" desc="Odblokuj dane w panelu synchronizacji, aby zobaczyć swoje konta." control={<span />} last />
        ) : (
          accounts.map((account, index) => (
            <Row
              key={account.id}
              label={account.name}
              desc={`${account.positions} ${account.positions === 1 ? "pozycja" : "pozycji"} · ${account.baseCurrency}`}
              last={index === accounts.length - 1}
              control={(
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontFamily: V2_TYPE.mono, fontSize: 12, color: V2.ink }}>
                    {account.value.toLocaleString("pl-PL", { maximumFractionDigits: 0 })} {account.baseCurrency}
                  </span>
                  <V2Badge label="Sync" color={V2.profit} />
                </div>
              )}
            />
          ))
        )}
      </Section>

      <NotificationSection prefs={profile.notifications} />

      <MarketDataSection />
      <DisplaySection />
      <PrivacySection />

      <DangerZone />
    </div>
  );
}

// ── Market data settings ─────────────────────────────────────────
function MarketDataSection() {
  const [autoRefresh, setAutoRefresh] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("investor-auto-refresh") !== "false";
  });

  function toggleRefresh(v: boolean) {
    setAutoRefresh(v);
    localStorage.setItem("investor-auto-refresh", String(v));
  }

  return (
    <Section eyebrow="Dane rynkowe" title="Kursy i automatyczne odświeżanie">
      <Row
        label="Automatyczne odświeżanie kursów"
        desc="Pobierz ceny FX i notowania przy każdym otwarciu aplikacji"
        last
        control={<Switch on={autoRefresh} onChange={toggleRefresh} label="Automatyczne odświeżanie kursów" />}
      />
    </Section>
  );
}

// ── Display settings ──────────────────────────────────────────────
function DisplaySection() {
  const [showRealReturn, setShowRealReturn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("investor-show-real-return") === "true";
  });

  function toggle(v: boolean) {
    setShowRealReturn(v);
    localStorage.setItem("investor-show-real-return", String(v));
  }

  return (
    <Section eyebrow="Wyświetlanie" title="Prezentacja wyników">
      <Row
        label="Wynik realny po inflacji"
        desc="KPI i wykresy pokazują wynik nominalny pomniejszony o roczną inflację YOY (CPI). Wyłącz, aby widzieć wynik nominalny."
        last
        control={<Switch on={showRealReturn} onChange={toggle} label="Wynik realny po inflacji" />}
      />
    </Section>
  );
}

// ── Privacy / diagnostics ─────────────────────────────────────────
function PrivacySection() {
  const { enabled, acknowledged, canWrite, saving, error, setConsent } =
    useTelemetryConsent();

  const desc = !canWrite
    ? "Odblokuj synchronizację, aby zmienić to ustawienie."
    : !acknowledged
      ? "Pomóż ulepszyć aplikację — wysyłaj anonimowe zdarzenia o korzystaniu z aplikacji. Żadne dane finansowe nie są przesyłane."
      : "Anonimowe zdarzenia o korzystaniu z aplikacji. Żadne kwoty, instrumenty ani dane portfela nie są przesyłane. Wybór synchronizuje się na wszystkich urządzeniach.";

  return (
    <Section eyebrow="Prywatność" title="Bezpieczeństwo i diagnostyka">
      <div style={{ padding: "14px 24px", borderBottom: `0.5px solid ${V2.line2}` }}>
        <AppLockSettingsRow />
      </div>
      <Row
        label="Anonimowa telemetria"
        desc={error ?? desc}
        control={
          <Switch
            on={canWrite && acknowledged && enabled}
            label="Anonimowa telemetria"
            onChange={(v) => {
              if (!canWrite || saving) return;
              void setConsent(v);
            }}
          />
        }
      />
      <Row
        label="Pliki cookie"
        desc="Aplikacja używa wyłącznie niezbędnych cookies sesji Supabase, które utrzymują zalogowanie. Nie używamy cookies reklamowych ani śledzących, więc nie wymagają one zgody."
        control={<span />}
      />
      <Row
        label="Dane w tej przeglądarce"
        desc="W localStorage trzymamy ustawienia interfejsu, profil i kolejkę synchronizacji (wyłącznie zaszyfrowane rekordy), a w IndexedDB — opcjonalnie zapamiętany klucz odszyfrowywania, usuwany przy wylogowaniu. Odszyfrowane dane portfela istnieją tylko w pamięci karty."
        last
        control={<span />}
      />
    </Section>
  );
}

// ── Danger zone: account deletion ─────────────────────────────────
function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setError(null);

    const supabase = createBrowserSupabaseClientOrNull();
    if (!supabase) {
      setError("Brak konfiguracji Supabase w .env.local.");
      setDeleting(false);
      return;
    }

    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        setError("Brak zalogowanego użytkownika.");
        setDeleting(false);
        return;
      }

      const { error: fnError } = await supabase.functions.invoke("delete-account");
      if (fnError) throw fnError;

      clearPendingSyncOperations();
      await clearCachedUserDataKey(userId).catch(() => {});
      // The remote user no longer exists, so server-side sign-out may fail.
      await supabase.auth.signOut().catch(() => {});
      window.location.assign("/login");
    } catch {
      setError("Nie udało się usunąć konta. Spróbuj ponownie.");
      setDeleting(false);
    }
  }

  const buttonBase: React.CSSProperties = {
    padding: "9px 15px",
    borderRadius: 10,
    fontFamily: V2_TYPE.ui,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: deleting ? "not-allowed" : "pointer",
  };

  return (
    <V2Card style={{ borderColor: v2Mix(V2.loss, 0.3) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, maxWidth: 520 }}>
          <div style={{ fontFamily: V2_TYPE.ui, fontSize: 13.5, fontWeight: 600, color: V2.ink }}>Eksport i usunięcie danych</div>
          <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12, color: V2.muted, marginTop: 2 }}>
            {confirming
              ? "Konto oraz wszystkie zaszyfrowane dane w chmurze zostaną trwale usunięte. Dane zapisane lokalnie w aplikacjach na innych urządzeniach pozostaną. Tej operacji nie można cofnąć."
              : "Pobierz pełną kopię danych albo trwale usuń konto wraz z danymi w chmurze."}
          </div>
          {error && (
            <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12, color: V2.loss, marginTop: 4 }}>{error}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {confirming ? (
            <>
              <button
                onClick={() => { setConfirming(false); setError(null); }}
                disabled={deleting}
                style={{ ...buttonBase, border: `0.5px solid ${V2.line}`, background: V2.card, color: V2.ink }}
              >
                Anuluj
              </button>
              <button
                onClick={() => void deleteAccount()}
                disabled={deleting}
                style={{ ...buttonBase, border: "none", background: V2.loss, color: "#fff", opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? "Usuwanie…" : "Usuń trwale"}
              </button>
            </>
          ) : (
            <>
              <Link href="/import" style={{ ...buttonBase, border: `0.5px solid ${V2.line}`, background: V2.card, color: V2.ink, textDecoration: "none" }}>
                Eksportuj wszystko
              </Link>
              <button
                onClick={() => setConfirming(true)}
                style={{ ...buttonBase, border: `0.5px solid ${v2Mix(V2.loss, 0.4)}`, background: v2Mix(V2.loss, 0.08), color: V2.loss }}
              >
                Usuń konto
              </button>
            </>
          )}
        </div>
      </div>
    </V2Card>
  );
}

// ── Editable profile (name + avatar) ─────────────────────────────
function ProfileCard({
  profile,
  accountCount,
}: {
  profile: ReturnType<typeof useProfile>;
  accountCount: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(profile.name);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setName(profile.name);
  }, [profile.name]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      window.alert("Zdjęcie jest za duże (maks. 2 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") updateProfile({ avatar: reader.result });
    };
    reader.readAsDataURL(file);
  }

  function commitName() {
    const trimmed = name.trim();
    updateProfile({ name: trimmed.length ? trimmed : "Inwestor" });
    setEditing(false);
  }

  return (
    <V2Card>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <button
          onClick={() => fileRef.current?.click()}
          title="Zmień zdjęcie"
          style={{
            width: 64, height: 64, borderRadius: "50%", border: "none", cursor: "pointer",
            padding: 0, position: "relative", flexShrink: 0, overflow: "hidden",
            background: profile.avatar ? "transparent" : `linear-gradient(135deg, ${V2.brand}, ${V2.brandDeep})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: V2_TYPE.serif, fontSize: 26, fontWeight: 500, color: V2.onBrand,
          }}
        >
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            initials(profile.name)
          )}
          <span
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              fontFamily: V2_TYPE.ui, fontSize: 8.5, fontWeight: 700, letterSpacing: ".04em",
              color: "#fff", background: v2Mix(V2.ink, 0.55), padding: "2px 0",
              textTransform: "uppercase",
            }}
          >
            Zmień
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div style={{ flex: 1, minWidth: 180 }}>
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") { setName(profile.name); setEditing(false); }
              }}
              style={{
                fontFamily: V2_TYPE.serif, fontSize: 23, fontWeight: 500, color: V2.ink,
                border: "none", borderBottom: `1px solid ${V2.line}`, outline: "none",
                background: "transparent", padding: "0 0 2px", width: "100%", maxWidth: 280,
              }}
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}
            >
              <span style={{ fontFamily: V2_TYPE.serif, fontSize: 23, fontWeight: 500, color: V2.ink }}>{profile.name}</span>
              <span style={{ fontSize: 13, color: V2.subtle }}>✎</span>
            </button>
          )}
          <div style={{ fontFamily: V2_TYPE.ui, fontSize: 13, color: V2.muted, marginTop: 1 }}>Zecca Web · dane odszyfrowywane lokalnie</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <V2Badge label={`${accountCount} ${accountCount === 1 ? "konto" : "konta/kont"}`} color={V2.equity} />
          </div>
        </div>
        <Link href="/import" style={{ padding: "9px 16px", borderRadius: 10, border: `0.5px solid ${V2.line}`, background: V2.card, color: V2.ink, fontFamily: V2_TYPE.ui, fontSize: 12.5, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>Import / Eksport</Link>
      </div>
    </V2Card>
  );
}

// ── Default target asset-class allocation ────────────────────────
function AllocationSection({ profile }: { profile: ReturnType<typeof useProfile> }) {
  const targets = profile.targetAllocation;
  const total = useMemo(() => targets.reduce((sum, t) => sum + (t.percent || 0), 0), [targets]);

  function setPercent(index: number, value: number) {
    const next = targets.map((t, i) => (i === index ? { ...t, percent: value } : t));
    updateProfile({ targetAllocation: next });
  }

  const COLORS = [V2.equity, V2.bonds, V2.deposit, V2.cash, V2.gold, V2.brand];

  return (
    <Section eyebrow="Strategia" title="Domyślna alokacja portfela">
      <div style={{ padding: "14px 24px 4px" }}>
        <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12, color: V2.muted, marginBottom: 12 }}>
          Docelowy udział każdej klasy aktywów. Suma powinna wynosić 100%.
        </div>
        <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 7, overflow: "hidden", gap: 2, marginBottom: 16 }}>
          {targets.map((t, i) => (
            <div key={t.label} title={`${t.label}: ${t.percent}%`} style={{ flex: Math.max(t.percent, 0.001), background: COLORS[i % COLORS.length], transition: "flex .2s" }} />
          ))}
        </div>
      </div>
      {targets.map((target, index) => (
        <Row
          key={target.label}
          label={target.label}
          last={index === targets.length - 1}
          control={(
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={target.percent}
                onChange={(e) => setPercent(index, Number(e.target.value))}
                style={{ width: 140, accentColor: V2.brand }}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={target.percent}
                onChange={(e) => setPercent(index, Math.max(0, Math.min(100, Number(e.target.value))))}
                style={{
                  width: 56, padding: "6px 8px", borderRadius: 8, border: `0.5px solid ${V2.line}`,
                  background: V2.card, color: V2.ink, fontFamily: V2_TYPE.mono, fontSize: 12.5, textAlign: "right", outline: "none",
                }}
              />
              <span style={{ fontFamily: V2_TYPE.mono, fontSize: 12, color: V2.subtle }}>%</span>
            </div>
          )}
        />
      ))}
      <div style={{ padding: "13px 24px", borderTop: `0.5px solid ${V2.line2}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: V2_TYPE.ui, fontSize: 12.5, fontWeight: 600, color: V2.ink }}>Suma</span>
        <span style={{ fontFamily: V2_TYPE.mono, fontSize: 13, fontWeight: 700, color: Math.round(total) === 100 ? V2.profit : V2.loss }}>
          {total.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}%{Math.round(total) === 100 ? "" : " — powinno być 100%"}
        </span>
      </div>
    </Section>
  );
}

// ── Notifications (honest about how they actually work) ──────────
function NotificationSection({ prefs }: { prefs: NotificationPrefs }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  function setPref(key: keyof NotificationPrefs, value: boolean) {
    updateProfile({ notifications: { ...prefs, [key]: value } });
  }

  async function requestPermission() {
    if (permission === "unsupported") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      new Notification("Zecca", { body: "Powiadomienia w przeglądarce są włączone." });
    }
  }

  const statusLabel =
    permission === "granted" ? "Włączone" :
    permission === "denied" ? "Zablokowane w przeglądarce" :
    permission === "unsupported" ? "Niedostępne w tej przeglądarce" : "Nieaktywne";
  const statusColor = permission === "granted" ? V2.profit : permission === "denied" ? V2.loss : V2.subtle;

  return (
    <Section eyebrow="Powiadomienia" title="Alerty i podsumowania">
      <div style={{ padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", background: v2Mix(V2.gold, 0.06) }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: V2_TYPE.ui, fontSize: 12.5, color: V2.ink }}>
            Alerty są dostarczane jako powiadomienia przeglądarki, gdy aplikacja jest otwarta.
            Podsumowania e-mail i push wymagają backendu i nie są jeszcze aktywne.
          </div>
          <div style={{ fontFamily: V2_TYPE.mono, fontSize: 11, color: statusColor, marginTop: 4 }}>
            Status przeglądarki: {statusLabel}
          </div>
        </div>
        <button
          onClick={requestPermission}
          disabled={permission === "granted" || permission === "unsupported"}
          style={{
            padding: "9px 15px", borderRadius: 10, border: "none", whiteSpace: "nowrap",
            background: permission === "granted" || permission === "unsupported" ? v2Mix(V2.ink, 0.1) : V2.ink,
            color: permission === "granted" || permission === "unsupported" ? V2.subtle : V2.card,
            fontFamily: V2_TYPE.ui, fontSize: 12.5, fontWeight: 600,
            cursor: permission === "granted" || permission === "unsupported" ? "default" : "pointer",
          }}
        >
          {permission === "granted" ? "Włączone" : "Włącz powiadomienia"}
        </button>
      </div>
      <Row label="Alerty cenowe" desc="Powiadom o zmianie kursu instrumentu > 5%" control={<Switch on={prefs.price} onChange={(v) => setPref("price", v)} label="Alerty cenowe" />} />
      <Row label="Dywidendy i odsetki" desc="Informuj o naliczeniu dochodu pasywnego" control={<Switch on={prefs.income} onChange={(v) => setPref("income", v)} label="Dywidendy i odsetki" />} />
      <Row label="Cotygodniowe podsumowanie" desc="Wynik portfela w poniedziałki (wymaga backendu)" control={<Switch on={prefs.weekly} onChange={(v) => setPref("weekly", v)} label="Cotygodniowe podsumowanie" />} />
      <Row label="Przypomnienie o raporcie PIT" desc="Alert przed terminem rozliczenia rocznego" control={<Switch on={prefs.pit} onChange={(v) => setPref("pit", v)} label="Przypomnienie o raporcie PIT" />} last />
    </Section>
  );
}
