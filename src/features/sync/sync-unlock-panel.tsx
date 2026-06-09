"use client";

import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClientOrNull } from "@/supabase/client";
import {
  clearCachedUserDataKey,
  loadCachedUserDataKey,
  saveCachedUserDataKey,
} from "@/sync/encryption/key-cache";
import {
  createEncryptedKeyBackup,
  generateUserDataKeyBytes,
  unlockUserDataKey,
  type EncryptedKeyBackup,
} from "@/sync/encryption/key-backup";
import { importAesGcmKey } from "@/sync/encryption/aes-gcm";
import { decryptEncryptedRecords } from "@/sync/records/encrypted-records";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import { buildParitySnapshot } from "@/sync/records/parity-snapshot";
import {
  fetchActiveEncryptedRecords,
  fetchEncryptedKeyBackup,
  registerWebDevice,
  refreshEncryptedKeyBackup,
  upsertEncryptedKeyBackup,
} from "@/sync/records/supabase-sync-store";
import { flushPendingSyncOperations } from "@/sync/records/record-writer";
import {
  summarizeDecryptedRecords,
  type SyncRecordSummary,
} from "@/sync/records/sync-summary";
import type { InvestorDataSnapshot } from "@/domain/models/investor-data";
import type {
  DecryptedRecord,
  EncryptedRecord,
} from "@/sync/records/encrypted-records";
import { useSyncStore } from "@/sync/store/sync-store";

declare global {
  interface Window {
    __investorWebParitySnapshot?: ReturnType<typeof buildParitySnapshot>;
    __investorWebExportParitySnapshot?: () => string;
  }
}

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
type TrustedKeyStatus =
  | "idle"
  | "checking"
  | "missing"
  | "available"
  | "saved"
  | "cleared"
  | "error";
type UnlockStep =
  | "key-backup"
  | "user-device"
  | "pending-sync"
  | "fetch-records"
  | "decrypt-records"
  | "build-snapshot";

const UNLOCK_STEP_LABELS: Record<UnlockStep, string> = {
  "key-backup": "Pobieram backup klucza z Supabase…",
  "user-device": "Rejestruję tę przeglądarkę jako urządzenie sync…",
  "pending-sync": "Wysyłam oczekujące zmiany sync…",
  "fetch-records": "Pobieram zaszyfrowane rekordy z Supabase…",
  "decrypt-records": "Odszyfrowuję rekordy lokalnie w przeglądarce…",
  "build-snapshot": "Buduję lokalny snapshot portfela…",
};

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 20_000) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`${label} przekroczyło limit ${timeoutMs / 1000}s.`));
      }, timeoutMs);
    }),
  ]);
}

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

function isCryptoOperationError(error: unknown) {
  return error instanceof DOMException && error.name === "OperationError";
}

type SyncBootstrapResponse = {
  keyBackup: EncryptedKeyBackup | null;
  encryptedRecords: EncryptedRecord[];
};

async function fetchSyncBootstrap(): Promise<SyncBootstrapResponse> {
  const response = await fetch("/api/sync/bootstrap", { cache: "no-store" });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body.error === "string"
        ? body.error
        : `HTTP ${response.status}`;
    throw new Error(`Nie udało się pobrać danych sync: ${message}`);
  }

  return response.json() as Promise<SyncBootstrapResponse>;
}

export type SyncLoadResult = {
  records: DecryptedRecord[];
  summary: SyncRecordSummary;
  snapshot: InvestorDataSnapshot;
};

export type InitialSyncUser = {
  id: string;
  email?: string | null;
};

export function SyncUnlockPanel({
  initialUser = null,
  onSyncLoaded,
}: {
  initialUser?: InitialSyncUser | null;
  onSyncLoaded(result: SyncLoadResult | null): void;
}) {
  const supabase = useMemo(() => createBrowserSupabaseClientOrNull(), []);
  const setCredentials = useSyncStore((s) => s.setCredentials);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(
    initialUser ? "authenticated" : "checking",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [createPassphrase, setCreatePassphrase] = useState("");
  const [createConfirm, setCreateConfirm] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "creating" | "error">("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [unlockStatus, setUnlockStatus] = useState<UnlockStatus>("idle");
  const [unlockStep, setUnlockStep] = useState<UnlockStep | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [trustedKeyStatus, setTrustedKeyStatus] =
    useState<TrustedKeyStatus>("idle");
  const [trustedKeyMessage, setTrustedKeyMessage] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<SyncRecordSummary | null>(null);
  const onSyncLoadedRef = useRef(onSyncLoaded);
  const unlockStatusRef = useRef(unlockStatus);
  const attemptedTrustedKeyUserRef = useRef<string | null>(null);

  useEffect(() => {
    onSyncLoadedRef.current = onSyncLoaded;
  }, [onSyncLoaded]);

  useEffect(() => {
    unlockStatusRef.current = unlockStatus;
  }, [unlockStatus]);

  useEffect(() => {
    if (!supabase) {
      setSessionStatus("config-missing");
      return;
    }

    if (initialUser) {
      setSessionStatus("authenticated");
      return;
    }

    let mounted = true;
    let sessionCheckSettled = false;

    const finishSessionCheck = (
      nextSession: Session | null,
      nextError?: string | null,
    ) => {
      if (!mounted) return;
      sessionCheckSettled = true;
      window.clearTimeout(sessionCheckTimeout);
      setSession(nextSession);
      setSessionStatus(nextSession ? "authenticated" : "unauthenticated");
      setSessionError(nextError ?? null);
    };

    const sessionCheckTimeout = window.setTimeout(() => {
      if (sessionCheckSettled) return;
      finishSessionCheck(
        null,
        "Sprawdzanie sesji Supabase przekroczyło limit 8s. Odśwież sesję albo zaloguj się ponownie.",
      );
    }, 8_000);

    setSessionError(null);
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          finishSessionCheck(null, error.message);
          return;
        }
        finishSessionCheck(data.session, null);
      })
      .catch((error) => {
        finishSessionCheck(null, getUnlockErrorMessage(error));
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        finishSessionCheck(nextSession, null);
        setLastSummary(null);
        setTrustedKeyStatus("idle");
        setTrustedKeyMessage(null);
        attemptedTrustedKeyUserRef.current = null;
        onSyncLoadedRef.current(null);
      }
    );

    return () => {
      mounted = false;
      window.clearTimeout(sessionCheckTimeout);
      authListener.subscription.unsubscribe();
    };
  }, [initialUser, supabase]);

  const userId = session?.user.id ?? initialUser?.id ?? null;
  const userLabel = session?.user.email ?? initialUser?.email ?? userId;

  useEffect(() => {
    attemptedTrustedKeyUserRef.current = null;
    setTrustedKeyStatus("idle");
    setTrustedKeyMessage(null);
  }, [userId]);

  const keyBackupQuery = useQuery({
    queryKey: ["encrypted-key-backup", userId],
    enabled: Boolean(supabase && userId && sessionStatus === "authenticated"),
    queryFn: async (): Promise<SyncBootstrapResponse> => {
      if (!supabase) throw new Error("Supabase client is not configured.");
      if (initialUser) {
        return withTimeout(
          fetchSyncBootstrap(),
          "Pobieranie danych sync z serwera",
        );
      }
      return {
        keyBackup: await withTimeout(
          fetchEncryptedKeyBackup(supabase),
          "Pobieranie backupu klucza",
        ),
        encryptedRecords: [],
      };
    },
  });

  const loadSyncWithKey = useCallback(async (
    userDataKey: CryptoKey,
    bootstrapEncryptedRecords: EncryptedRecord[] | null,
    options: { rememberTrustedKey?: boolean } = {},
  ) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    let encryptedRecords = bootstrapEncryptedRecords;

    if (!encryptedRecords) {
      if (userId) {
        setUnlockStep("user-device");
        await withTimeout(
          registerWebDevice(supabase, userId),
          "Rejestracja urządzenia sync",
        );
      }

      setUnlockStep("pending-sync");
      await withTimeout(
        flushPendingSyncOperations(supabase),
        "Wysyłanie oczekujących zmian sync",
      );

      setUnlockStep("fetch-records");
      encryptedRecords = await withTimeout(
        fetchActiveEncryptedRecords(supabase),
        "Pobieranie rekordów sync",
      );
    }

    setUnlockStep("decrypt-records");
    const decryptedRecords = await decryptEncryptedRecords(userDataKey, encryptedRecords);

    setUnlockStep("build-snapshot");
    const summary = summarizeDecryptedRecords(decryptedRecords);
    const snapshot = buildInvestorDataSnapshot(decryptedRecords, {
      asOf: new Date(),
      historyGranularity: "daily",
      useLatestTransactionFxRate: true,
      useMarketQuotes: true,
    });
    const paritySnapshot = buildParitySnapshot(decryptedRecords, {
      asOf: new Date(),
      historyGranularity: "daily",
      useLatestTransactionFxRate: true,
      useMarketQuotes: true,
    });

    window.__investorWebParitySnapshot = paritySnapshot;
    window.__investorWebExportParitySnapshot = () =>
      JSON.stringify(window.__investorWebParitySnapshot, null, 2);

    if (options.rememberTrustedKey && userId) {
      try {
        await saveCachedUserDataKey(userId, userDataKey);
        setTrustedKeyStatus("saved");
        setTrustedKeyMessage(
          "Klucz zapisany lokalnie dla tej przeglądarki. Wylogowanie usunie go z urządzenia.",
        );
      } catch (error) {
        setTrustedKeyStatus("error");
        setTrustedKeyMessage(
          `Nie udało się zapisać klucza lokalnie: ${getUnlockErrorMessage(error)}`,
        );
      }
    }

    setCredentials(userDataKey, supabase);
    setLastSummary(summary);
    onSyncLoaded({ records: decryptedRecords, summary, snapshot });
    setUnlockStep(null);
    setUnlockStatus("ready");
  }, [onSyncLoaded, setCredentials, supabase, userId]);

  useEffect(() => {
    if (
      !supabase ||
      !userId ||
      sessionStatus !== "authenticated" ||
      unlockStatusRef.current !== "idle" ||
      keyBackupQuery.isLoading ||
      keyBackupQuery.isError ||
      !keyBackupQuery.data?.keyBackup ||
      attemptedTrustedKeyUserRef.current === userId
    ) {
      return;
    }

    let cancelled = false;
    const trustedUserId = userId;
    attemptedTrustedKeyUserRef.current = trustedUserId;

    async function unlockWithTrustedBrowserKey() {
      setTrustedKeyStatus("checking");
      setTrustedKeyMessage("Sprawdzam zapamiętany klucz tej przeglądarki…");

      let cachedKey: CryptoKey | null = null;
      try {
        cachedKey = await loadCachedUserDataKey(trustedUserId);
      } catch (error) {
        if (cancelled) return;
        setTrustedKeyStatus("error");
        setTrustedKeyMessage(
          `Nie udało się odczytać lokalnego klucza: ${getUnlockErrorMessage(error)}`,
        );
        return;
      }

      if (cancelled) return;

      if (!cachedKey) {
        setTrustedKeyStatus("missing");
        setTrustedKeyMessage(null);
        return;
      }

      setUnlockStatus("unlocking");
      setUnlockStep("decrypt-records");
      setUnlockError(null);

      try {
        await loadSyncWithKey(
          cachedKey,
          initialUser ? keyBackupQuery.data?.encryptedRecords ?? null : null,
        );
        if (cancelled) return;
        setTrustedKeyStatus("available");
        setTrustedKeyMessage("Dane odblokowane lokalnym kluczem tej przeglądarki.");
      } catch (error) {
        if (cancelled) return;
        setUnlockStatus("error");
        setUnlockStep(null);

        if (isCryptoOperationError(error)) {
          await clearCachedUserDataKey(trustedUserId).catch(() => undefined);
          setTrustedKeyStatus("cleared");
          setTrustedKeyMessage(
            "Zapamiętany klucz nie pasował do danych i został usunięty z tej przeglądarki.",
          );
          setUnlockError(
            "Wpisz passphrase, żeby odświeżyć zaufane urządzenie.",
          );
          return;
        }

        setTrustedKeyStatus("error");
        setTrustedKeyMessage("Nie udało się użyć zapamiętanego klucza.");
        setUnlockError(getRecordDecryptErrorMessage(error));
      }
    }

    void unlockWithTrustedBrowserKey();

    return () => {
      cancelled = true;
    };
  }, [
    initialUser,
    keyBackupQuery.data,
    keyBackupQuery.isError,
    keyBackupQuery.isLoading,
    loadSyncWithKey,
    sessionStatus,
    supabase,
    userId,
  ]);

  async function unlockSync() {
    if (unlockStatus === "unlocking" || passphrase.length === 0) {
      return;
    }

    if (!supabase) {
      setUnlockStatus("error");
      setUnlockStep(null);
      setUnlockError("Supabase client is not configured.");
      return;
    }

    setUnlockStatus("unlocking");
    setUnlockStep("key-backup");
    setUnlockError(null);

    let keyBackup = keyBackupQuery.data?.keyBackup ?? null;
    try {
      if (!initialUser) {
        keyBackup = await withTimeout(
          refreshEncryptedKeyBackup(supabase),
          "Pobieranie backupu klucza",
        );
      }
    } catch (error) {
      setUnlockStatus("error");
      setUnlockStep(null);
      setUnlockError(getUnlockErrorMessage(error));
      return;
    }

    if (!keyBackup) {
      setUnlockStatus("error");
      setUnlockStep(null);
      setUnlockError("Nie znaleziono backupu klucza dla tego konta.");
      return;
    }

    let userDataKey: CryptoKey;
    try {
      userDataKey = await unlockUserDataKey(keyBackup, passphrase);
    } catch (error) {
      setUnlockStatus("error");
      setUnlockStep(null);
      setUnlockError(getUnlockErrorMessage(error));
      return;
    }

    try {
      await loadSyncWithKey(
        userDataKey,
        initialUser ? keyBackupQuery.data?.encryptedRecords ?? null : null,
        { rememberTrustedKey: true },
      );
      setPassphrase("");
    } catch (error) {
      setUnlockStatus("error");
      setUnlockStep(null);
      setUnlockError(getRecordDecryptErrorMessage(error));
    }
  }

  async function createBackupAndUnlock() {
    if (createStatus === "creating") return;

    if (!supabase || !userId) {
      setCreateStatus("error");
      setCreateError("Brak sesji użytkownika.");
      return;
    }
    if (createPassphrase.length < 8) {
      setCreateStatus("error");
      setCreateError("Passphrase musi mieć co najmniej 8 znaków.");
      return;
    }
    if (createPassphrase !== createConfirm) {
      setCreateStatus("error");
      setCreateError("Passphrase i potwierdzenie różnią się.");
      return;
    }

    setCreateStatus("creating");
    setCreateError(null);

    // Bootstrap a web-only account: generate a fresh user data key, wrap it under
    // the passphrase (PBKDF2-SHA256/600k) and upload — so a new device can later
    // restore sync from this account. Parity with native KeyBackupService.makeBackup.
    const rawUserDataKey = generateUserDataKeyBytes();
    try {
      const backup = await withTimeout(
        createEncryptedKeyBackup({ rawUserDataKey, passphrase: createPassphrase }),
        "Tworzenie backupu klucza",
      );
      await withTimeout(
        upsertEncryptedKeyBackup(supabase, userId, backup),
        "Zapis backupu klucza w Supabase",
      );

      const userDataKey = await importAesGcmKey(rawUserDataKey);
      await loadSyncWithKey(userDataKey, null, { rememberTrustedKey: true });
      await keyBackupQuery.refetch();

      setCreatePassphrase("");
      setCreateConfirm("");
      setCreateStatus("idle");
    } catch (error) {
      setCreateStatus("error");
      setCreateError(getUnlockErrorMessage(error));
    }
  }

  function handleCreateBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void createBackupAndUnlock();
  }

  function handleUnlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void unlockSync();
  }

  async function handleSignOut() {
    if (!supabase) return;
    if (userId) {
      await clearCachedUserDataKey(userId);
      setTrustedKeyStatus("cleared");
      setTrustedKeyMessage("Lokalny klucz tej przeglądarki został usunięty.");
    }
    await supabase.auth.signOut();
    window.location.assign("/login");
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
            {sessionError ??
              "Po zalogowaniu web odszyfruje rekordy lokalnie w przeglądarce."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sessionError && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 9,
                border: "0.5px solid rgba(28,49,68,0.14)",
                background: PAPER,
                color: INK,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Odśwież sesję
            </button>
          )}
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
      </div>
    );
  }

  // ── State: authenticated ──────────────────────────────────────
  const hasBackup = Boolean(keyBackupQuery.data?.keyBackup);
  const isBusy = unlockStatus === "unlocking";
  const isPreparingTrustedKey =
    hasBackup &&
    unlockStatus === "idle" &&
    trustedKeyStatus === "idle" &&
    attemptedTrustedKeyUserRef.current !== userId;
  const showPassphraseForm =
    hasBackup &&
    unlockStatus !== "ready" &&
    !keyBackupQuery.isLoading &&
    trustedKeyStatus !== "checking" &&
    !isPreparingTrustedKey;

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
                {userLabel}
              </span>
            ) : (
              userLabel
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
              Po pierwszym odblokowaniu klucz zostanie zapisany lokalnie dla tej przeglądarki.
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

      {trustedKeyStatus === "checking" && (
        <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 8 }}>
          <SpinnerDot />
          {trustedKeyMessage}
        </div>
      )}

      {isPreparingTrustedKey && (
        <div style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 8 }}>
          <SpinnerDot />
          Sprawdzam lokalny klucz tej przeglądarki…
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

      {!keyBackupQuery.isLoading && !hasBackup && unlockStatus !== "ready" && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, color: AMBER, marginBottom: 10 }}>
            Konto nie ma jeszcze backupu klucza w <code>encrypted_key_backups</code>.
            Utwórz go passphrase&apos;ą, żeby uruchomić sync na tym i kolejnych urządzeniach.
          </div>
          <form onSubmit={handleCreateBackup} style={{ display: "grid", gap: 8 }}>
            <input
              type="password"
              value={createPassphrase}
              onChange={(e) => setCreatePassphrase(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Nowa passphrase (min. 8 znaków)…"
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
            <input
              type="password"
              value={createConfirm}
              onChange={(e) => setCreateConfirm(e.target.value)}
              autoComplete="new-password"
              required
              placeholder="Powtórz passphrase…"
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
            <button
              type="submit"
              disabled={createStatus === "creating"}
              style={{
                justifySelf: "start",
                padding: "9px 16px",
                borderRadius: 9,
                border: "none",
                background: createStatus === "creating" ? "rgba(28,49,68,0.12)" : INK,
                color: createStatus === "creating" ? SUBTLE : "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: createStatus === "creating" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {createStatus === "creating" ? <SpinnerDot /> : "🔐"}
              {createStatus === "creating" ? "Tworzę backup…" : "Utwórz backup klucza"}
            </button>
          </form>
          {createStatus === "error" && createError && (
            <div style={{ fontSize: 12, color: LOSS, marginTop: 8 }}>{createError}</div>
          )}
        </div>
      )}

      {trustedKeyMessage && trustedKeyStatus !== "checking" && (
        <div
          style={{
            fontSize: 12,
            color:
              trustedKeyStatus === "error" || trustedKeyStatus === "cleared"
                ? AMBER
                : PROFIT,
            marginTop: 4,
          }}
        >
          {trustedKeyMessage}
        </div>
      )}

      {/* Passphrase form */}
      {showPassphraseForm && (
        <form
          onSubmit={handleUnlock}
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
            type="submit"
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

      {unlockStatus === "unlocking" && unlockStep && (
        <div style={{ fontSize: 12, color: MUTED, marginTop: 10 }}>
          {UNLOCK_STEP_LABELS[unlockStep]}
        </div>
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
