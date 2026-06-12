"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { V2, V2_TYPE, v2Mix } from "@/lib/v2-design";

const SESSION_KEY = "investor-app-lock-pin";
const VERIFIED_KEY = "investor-app-lock-verified";
const SETUP_KEY = "investor-app-lock-setup";
const IDLE_MINUTES_KEY = "investor-app-lock-idle-minutes";
const DEFAULT_IDLE_MINUTES = 5;

const UI = V2_TYPE.ui;
const SERIF = V2_TYPE.serif;
const MONO = V2_TYPE.mono;

function hashPin(pin: string): string {
  // Simple deterministic hash for sessionStorage (not a security boundary,
  // just obscures the PIN from casual glancing at DevTools storage).
  let h = 0;
  for (let i = 0; i < pin.length; i++) {
    h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function getPinHash(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}

function setPinHash(pin: string) {
  try { sessionStorage.setItem(SESSION_KEY, hashPin(pin)); } catch { /* */ }
}

function removePinHash() {
  try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(VERIFIED_KEY); } catch { /* */ }
}

function isVerified(): boolean {
  try { return sessionStorage.getItem(VERIFIED_KEY) === "1"; } catch { return false; }
}

function markVerified() {
  try { sessionStorage.setItem(VERIFIED_KEY, "1"); } catch { /* */ }
}

function isSetupEnabled(): boolean {
  try { return localStorage.getItem(SETUP_KEY) === "1"; } catch { return false; }
}

function getIdleMinutes(): number {
  try { return parseInt(localStorage.getItem(IDLE_MINUTES_KEY) ?? "", 10) || DEFAULT_IDLE_MINUTES; } catch { return DEFAULT_IDLE_MINUTES; }
}

type Mode = "locked" | "setup" | "unlocked";

function PinDots({ filled }: { filled: number }) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "18px 0 8px" }}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            width: 14, height: 14, borderRadius: "50%",
            background: i < filled ? V2.brand : v2Mix(V2.ink, 0.12),
            transition: "background .12s",
          }}
        />
      ))}
    </div>
  );
}

function PinPad({ onPin, label, error }: { onPin: (pin: string) => void; label: string; error?: string | null }) {
  const [input, setInput] = useState("");
  const maxLen = 6;

  function press(digit: string) {
    if (input.length >= maxLen) return;
    const next = input + digit;
    setInput(next);
    if (next.length >= 4) {
      // Submit when 4–6 digits entered (auto on 6, manual submit on 4–5)
      if (next.length === maxLen) {
        onPin(next);
        setInput("");
      }
    }
  }

  function submit() {
    if (input.length >= 4) { onPin(input); setInput(""); }
  }

  function del() {
    setInput((s) => s.slice(0, -1));
  }

  const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, color: V2.muted, marginBottom: 4 }}>{label}</div>
      <PinDots filled={input.length} />
      {error && <div style={{ fontFamily: UI, fontSize: 12.5, color: V2.loss, marginBottom: 8, minHeight: 20 }}>{error}</div>}
      {!error && <div style={{ minHeight: 28 }} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 240, margin: "0 auto" }}>
        {DIGITS.map((d, i) => (
          d === "" ? <div key={i} /> :
          d === "⌫" ? (
            <button key={i} onClick={del} style={btnStyle(V2.card)}>
              {d}
            </button>
          ) : (
            <button key={i} onClick={() => press(d)} style={btnStyle(V2.card)}>
              {d}
            </button>
          )
        ))}
      </div>
      {input.length >= 4 && input.length < maxLen && (
        <button
          onClick={submit}
          style={{ marginTop: 14, padding: "10px 28px", borderRadius: 10, border: "none", background: V2.brand, color: V2.card, fontFamily: UI, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Odblokuj
        </button>
      )}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    height: 56, borderRadius: 12, border: `0.5px solid ${V2.line}`,
    background: bg, color: V2.ink,
    fontFamily: MONO, fontSize: 20, fontWeight: 500, cursor: "pointer",
    boxShadow: `0 1px 3px ${v2Mix(V2.ink, 0.08)}`,
    transition: "background .1s",
  };
}

// ── Setup screen (for settings panel) ────────────────────────────
export function AppLockSetup({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFirst(pin: string) {
    if (pin.length < 4) { setError("Minimalnie 4 cyfry."); return; }
    setFirst(pin);
    setStep("confirm");
    setError(null);
  }

  function handleConfirm(pin: string) {
    if (pin !== first) {
      setError("PINy się różnią. Zacznij od nowa.");
      setStep("enter");
      setFirst("");
      return;
    }
    setPinHash(pin);
    markVerified();
    localStorage.setItem(SETUP_KEY, "1");
    onDone?.();
  }

  return (
    <div>
      {step === "enter" ? (
        <PinPad label="Ustaw PIN (4–6 cyfr)" onPin={handleFirst} error={error} />
      ) : (
        <PinPad label="Potwierdź PIN" onPin={handleConfirm} error={error} />
      )}
    </div>
  );
}

export function AppLockRemove({ onDone }: { onDone?: () => void }) {
  const [error, setError] = useState<string | null>(null);

  function verify(pin: string) {
    const stored = getPinHash();
    if (!stored || hashPin(pin) !== stored) {
      setError("Nieprawidłowy PIN.");
      return;
    }
    removePinHash();
    localStorage.removeItem(SETUP_KEY);
    onDone?.();
  }

  return <PinPad label="Podaj aktualny PIN, aby usunąć blokadę" onPin={verify} error={error} />;
}

// ── Main lock overlay ─────────────────────────────────────────────
export function AppLock({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    if (!isSetupEnabled()) return "unlocked";
    if (!getPinHash()) return "unlocked";
    if (isVerified()) return "unlocked";
    return "locked";
  });
  const [error, setError] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    if (isSetupEnabled() && getPinHash()) {
      try { sessionStorage.removeItem(VERIFIED_KEY); } catch { /* */ }
      setMode("locked");
      setError(null);
    }
  }, []);

  // Page Visibility API: lock after idle
  useEffect(() => {
    if (!isSetupEnabled() || !getPinHash()) return;

    const idleMs = getIdleMinutes() * 60 * 1000;

    function onVisibilityChange() {
      if (document.hidden) {
        idleTimer.current = setTimeout(lock, idleMs);
      } else {
        if (idleTimer.current) clearTimeout(idleTimer.current);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [lock]);

  function verify(pin: string) {
    const stored = getPinHash();
    if (!stored || hashPin(pin) !== stored) {
      setError("Nieprawidłowy PIN.");
      return;
    }
    markVerified();
    setMode("unlocked");
    setError(null);
  }

  if (mode === "locked") {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: V2.page,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 6,
        }}
      >
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 500, color: V2.ink, marginBottom: 8 }}>Zecca</div>
        <PinPad label="Podaj PIN, aby odblokować" onPin={verify} error={error} />
      </div>
    );
  }

  return <>{children}</>;
}

// ── Settings row for toggling lock in settings page ──────────────
export function AppLockSettingsRow() {
  const [enabled, setEnabled] = useState(isSetupEnabled);
  const [view, setView] = useState<"idle" | "setup" | "remove">("idle");

  if (view === "setup") return <AppLockSetup onDone={() => { setEnabled(true); setView("idle"); }} />;
  if (view === "remove") return <AppLockRemove onDone={() => { setEnabled(false); setView("idle"); }} />;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: UI, fontSize: 13.5, fontWeight: 600, color: V2.ink }}>Blokada PIN</div>
        <div style={{ fontFamily: UI, fontSize: 12, color: V2.muted, marginTop: 2 }}>
          {enabled ? `Aplikacja blokuje się po ${getIdleMinutes()} min. nieaktywności` : "Aplikacja nie jest chroniona PINem"}
        </div>
      </div>
      <button
        onClick={() => setView(enabled ? "remove" : "setup")}
        style={{
          padding: "8px 14px", borderRadius: 10, border: `0.5px solid ${V2.line}`,
          background: V2.card, color: enabled ? V2.loss : V2.ink,
          fontFamily: UI, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}
      >
        {enabled ? "Usuń PIN" : "Ustaw PIN"}
      </button>
    </div>
  );
}
