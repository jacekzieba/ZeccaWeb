"use client";

import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import {
  clearCachedUserDataKey,
  loadCachedUserDataKey,
  saveCachedUserDataKey,
} from "@/sync/encryption/key-cache";
import { unlockUserDataKey } from "@/sync/encryption/key-backup";
import { decryptEncryptedRecords } from "@/sync/records/encrypted-records";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import {
  fetchActiveEncryptedRecords,
  fetchEncryptedKeyBackup,
  registerWebDevice,
  refreshEncryptedKeyBackup,
} from "@/sync/records/supabase-sync-store";
import { flushPendingSyncOperations } from "@/sync/records/record-writer";
import {
  summarizeDecryptedRecords,
  type SyncRecordSummary,
} from "@/sync/records/sync-summary";
import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import type { DecryptedRecord } from "@/sync/records/encrypted-records";
import { useSyncStore } from "@/sync/store/sync-store";

// ── Design tokens ────────────────────────────────────────────────
const INK = "#1C3144";
const MUTED = "rgba(28,49,68,0.58)";
const SUBTLE = "rgba(28,49,68,0.38)";
const PROFIT = "#2D9C6B";
const LOSS = "#B85042";
const AMBER = "#B87830";
const PAPER = "#FBFAF6";

type SessionStatus =
  | "checking"
  | "config-missing"
  | "unauthenticated"
  | "authenticated";

type UnlockStatus = "idle" | "unlocking" | "ready" | "error";

function getUnlockErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "OperationError") {
      return "Nie udało się odszyfrować backupu klucza. Sprawdź passphrase.";
    }

    return error.message || `Nie udało się odblokować danych (${error.name}).`;
  }

  if (error instanceof Error) {
    return error.message || "Nie udało się odblokować danych.";
  }

  return "Nie udało się odblokować danych.";
}

function getRecordDecryptErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "OperationError") {
    return "Backup klucza został odblokowany, ale rekordy w Supabase są zaszyfrowane innym kluczem. W aplikacji natywnej uruchom naprawę danych weba i spróbuj ponownie.";
  }

  return getUnlockErrorMessage(error);
}

export type SyncLoadResult = {
  records: DecryptedRecord[];
  summary: SyncRecordSummary;
  snapshot: InvestorDataSnapshot;
};

export function SyncUnlockPanel({
  onSyncLoaded,
}: {
  onSyncLoaded(result: SyncLoadResult | null): void;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClientOrNull(), []);
  const setCredentials = useSyncStore((s) => s.setCredentials);
  const records = useSyncStore((s) => s.records);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [unlockStatus, setUnlockStatus] = useState<UnlockStatus>("idle");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncRecordSummary | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSessionStatus("config-missing");
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setSession(null);
        setSessionStatus("unauthenticated");
        return;
      }
      setSession(data.session);
      setSessionStatus(data.session ? "authenticated" : "unauthenticated");
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setSessionStatus(nextSession ? "authenticated" : "unauthenticated");
        setLastSummary(null);
        onSyncLoaded(null);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [onSyncLoaded, supabase]);

  const keyBackupQuery = useQuery({
    queryKey: ["encrypted-key-backup", session?.user.id],
    enabled: Boolean(supabase && session),
    queryFn: () => {
      if (!supabase) throw new Error("Supabase client is not configured.");
      return fetchEncryptedKeyBackup(supabase);
    },
  });

  const loadSyncWithKey = useCallback(async (userDataKey: CryptoKey, cacheUserId?: string) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    if (session?.user.id) {
      await registerWebDevice(supabase, session.user.id);
    }
    await flushPendingSyncOperations(supabase);
    const encryptedRecords = await fetchActiveEncryptedRecords(supabase);
    const decryptedRecords = await decryptEncryptedRecords(userDataKey, encryptedRecords);
    const summary = summarizeDecryptedRecords(decryptedRecords);
    const snapshot = buildInvestorDataSnapshot(decryptedRecords);

    setCredentials(userDataKey, supabase);
    setLastSummary(summary);
    onSyncLoaded({ records: decryptedRecords, summary, snapshot });
    if (cacheUserId) {
      await saveCachedUserDataKey(cacheUserId, userDataKey);
    }
    setUnlockStatus("ready");
  }, [onSyncLoaded, session?.user.id, setCredentials, supabase]);

  useEffect(() => {
    if (!supabase || !session || records || unlockStatus !== "idle") {
      return;
    }

    const userId = session.user.id;
    let cancelled = false;

    async function loadCachedSync() {
      setUnlockStatus("unlocking");
      setUnlockError(null);

      try {
        const cachedKey = await loadCachedUserDataKey(userId);
        if (!cachedKey || cancelled) {
          if (!cancelled) setUnlockStatus("idle");
          return;
        }

        await loadSyncWithKey(cachedKey);
      } catch (error) {
        await clearCachedUserDataKey(userId);
        if (!cancelled) {
          setUnlockStatus("idle");
          setUnlockError(getRecordDecryptErrorMessage(error));
        }
      }
    }

    void loadCachedSync();

    return () => {
      cancelled = true;
    };
  }, [loadSyncWithKey, records, session, supabase, unlockStatus]);

  async function unlockSync() {
    if (unlockStatus === "unlocking" || passphrase.length === 0) {
      return;
    }

    if (!supabase) {
      setUnlockStatus("error");
      setUnlockError("Supabase client is not configured.");
      return;
    }

    const keyBackup = await refreshEncryptedKeyBackup(supabase);

    if (!keyBackup) {
      setUnlockStatus("error");
      setUnlockError("Nie znaleziono backupu klucza dla tego konta.");
      return;
    }

    setUnlockStatus("unlocking");
    setUnlockError(null);

    let userDataKey: CryptoKey;
    try {
      userDataKey = await unlockUserDataKey(keyBackup, passphrase);
    } catch (error) {
      setUnlockStatus("error");
      setUnlockError(getUnlockErrorMessage(error));
      return;
    }

    try {
      await loadSyncWithKey(userDataKey, session?.user.id);
      setPassphrase("");
    } catch (error) {
      setUnlockStatus("error");
      setUnlockError(getRecordDecryptErrorMessage(error));
    }
  }

  function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void unlockSync();
  }

  function handleUnlockPointer(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    void unlockSync();
  }

  async function handleSignOut() {
    if (!supabase) return;
    if (session) {
      await clearCachedUserDataKey(session.user.id);
    }
    await supabase.auth.signOut();
  }

  // ── State: config missing ─────────────────────────────────────
  if (sessionStatus === "config-missing") {
    return (
      <StatusRow
        dot={AMBER}
        title="Sync nie jest skonfigurowany"
        detail="Ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY, żeby włączyć logowanie."
      />
    );
  }

  // ── State: checking ───────────────────────────────────────────
  if (sessionStatus === "checking") {
    return (
      <StatusRow
        dot={SUBTLE}
        title="Sprawdzanie sesji…"
        detail="Weryfikuję lokalną sesję Supabase."
        loading
      />
    );
  }

  // ── State: unauthenticated ────────────────────────────────────
  if (sessionStatus === "unauthenticated") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 22px",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
            Zaloguj się, żeby pobrać sync
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
            Po zalogowaniu web odszyfruje rekordy lokalnie w przeglądarce.
          </div>
        </div>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 9,
            background: INK,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 3px 10px rgba(28,49,68,0.22), inset 0 0.5px 0 rgba(255,255,255,0.18)",
            whiteSpace: "nowrap",
          }}
        >
          Zaloguj się →
        </Link>
      </div>
    );
  }

  // ── State: authenticated ──────────────────────────────────────
  const hasBackup = Boolean(keyBackupQuery.data);
  const isBusy = unlockStatus === "unlocking";

  return (
    <div style={{ padding: "20px 22px" }}>
      {/* User row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>
            {lastSummary ? (
              <span>
                <span style={{ color: PROFIT }}>✓</span>{" "}
                {session?.user.email ?? session?.user.id}
              </span>
            ) : (
              session?.user.email ?? session?.user.id
            )}
          </div>
          {lastSummary ? (
            <div style={{ fontSize: 12, color: PROFIT, marginTop: 3 }}>
              {lastSummary.totalRecords} rekordów odszyfrowanych. Ostatnia zmiana:{" "}
              {lastSummary.latestUpdatedAt
                ? new Date(lastSummary.latestUpdatedAt).toLocaleString("pl-PL")
                : "brak"}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
              Klucz danych pozostaje tylko w pamięci tej karty.
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: "0.5px solid rgba(28,49,68,0.12)",
            background: "rgba(28,49,68,0.04)",
            color: MUTED,
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Wyloguj
        </button>
      </div>

      {/* Key backup loading */}
      {keyBackupQuery.isLoading && (
        <div style={{ fontSize: 12, color: SUBTLE, display: "flex", alignItems: "center", gap: 8 }}>
          <SpinnerDot />
          Pobieranie backupu klucza…
        </div>
      )}

      {keyBackupQuery.isError && (
        <div style={{ fontSize: 12, color: LOSS, marginTop: 4 }}>
          Nie udało się pobrać backupu klucza:{" "}
          {keyBackupQuery.error instanceof Error
            ? keyBackupQuery.error.message
            : "nieznany błąd"}
        </div>
      )}

      {!keyBackupQuery.isLoading && !hasBackup && (
        <div style={{ fontSize: 12, color: AMBER, marginTop: 4 }}>
          Konto nie ma jeszcze backupu klucza w <code>encrypted_key_backups</code>.
        </div>
      )}

      {/* Passphrase form */}
      {hasBackup && unlockStatus !== "ready" && (
        <form
          onSubmit={handleUnlock}
          onSubmitCapture={handleUnlock}
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "minmax(0,1fr) auto",
            alignItems: "end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: SUBTLE,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 6,
              }}
            >
              Passphrase backupu klucza
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Wprowadź passphrase…"
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 9,
                border: "0.5px solid rgba(28,49,68,0.15)",
                background: PAPER,
                fontSize: 13,
                color: INK,
                outline: "none",
                boxShadow: "inset 0 1px 3px rgba(28,49,68,0.06)",
              }}
            />
          </div>
          <button
            type="button"
            onMouseDown={handleUnlockPointer}
            onClick={() => void unlockSync()}
            disabled={isBusy || passphrase.length === 0}
            style={{
              padding: "9px 16px",
              borderRadius: 9,
              border: "none",
              background: isBusy || passphrase.length === 0 ? "rgba(28,49,68,0.12)" : INK,
              color: isBusy || passphrase.length === 0 ? SUBTLE : "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: isBusy || passphrase.length === 0 ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow:
                isBusy || passphrase.length === 0
                  ? "none"
                  : "0 3px 10px rgba(28,49,68,0.18), inset 0 0.5px 0 rgba(255,255,255,0.18)",
              transition: "background .15s",
            }}
          >
            {isBusy ? <SpinnerDot /> : "🔑"}
            {isBusy ? "Odszyfrowuję…" : "Odblokuj"}
          </button>
        </form>
      )}

      {unlockStatus === "error" && (
        <div style={{ fontSize: 12, color: LOSS, marginTop: 10 }}>
          {unlockError ?? "Nie udało się odblokować danych."}
        </div>
      )}
    </div>
  );
}

// ── Helper components ────────────────────────────────────────────
function StatusRow({
  dot,
  title,
  detail,
  loading,
}: {
  dot: string;
  title: string;
  detail: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 22px",
      }}
    >
      {loading ? (
        <SpinnerDot size={8} color={dot} />
      ) : (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dot,
            flexShrink: 0,
          }}
        />
      )}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  );
}

function SpinnerDot({ size = 10, color = "#1C3144" }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1.5px solid ${color}`,
        borderTopColor: "transparent",
        animation: "spin .7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
