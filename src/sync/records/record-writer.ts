import { encryptJsonPayload } from "@/sync/encryption/aes-gcm";
import { decryptEncryptedRecords } from "@/sync/records/encrypted-records";
import { buildInvestorDataSnapshot } from "@/sync/records/investor-snapshot";
import {
  fetchActiveEncryptedRecords,
  fetchEncryptedRecordMetadata,
  softDeleteEncryptedRecord,
  upsertEncryptedRecord,
  type UpsertPayload,
} from "@/sync/records/supabase-sync-store";
import { summarizeDecryptedRecords } from "@/sync/records/sync-summary";
import { getWebDeviceId } from "@/sync/records/web-device";
import type { BrowserSupabaseClient } from "@/supabase/client";

const PENDING_SYNC_KEY = "investor-web-pending-sync-v1";
export const PENDING_SYNC_CHANGED_EVENT = "investor-web-pending-sync-changed";

export type WriteRecordPayload = {
  id: string;
  recordType: string;
  [key: string]: unknown;
};

export class SyncConflictError extends Error {
  constructor(
    message: string,
    readonly recordType: string,
    readonly id: string,
  ) {
    super(message);
    this.name = "SyncConflictError";
  }
}

type PendingUpsertOperation = {
  operationId: string;
  operation: "upsert";
  recordType: string;
  id: string;
  baseUpdatedAt: string | null;
  createdAt: string;
  encryptedRecord: UpsertPayload;
  error: string | null;
};

type PendingDeleteOperation = {
  operationId: string;
  operation: "delete";
  recordType: string;
  id: string;
  userId: string;
  baseUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
};

export type PendingSyncOperation =
  | PendingUpsertOperation
  | PendingDeleteOperation;

type SaveRecordOptions = {
  baseUpdatedAt?: string | null;
  enqueueOnFailure?: boolean;
};

export type WriteRecordResult = {
  queued: boolean;
};

function getPendingQueue(): PendingSyncOperation[] {
  if (typeof localStorage === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(PENDING_SYNC_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingSyncOperation[]) : [];
  } catch {
    return [];
  }
}

function setPendingQueue(queue: PendingSyncOperation[]) {
  if (typeof localStorage === "undefined") {
    return;
  }

  if (queue.length === 0) {
    localStorage.removeItem(PENDING_SYNC_KEY);
  } else {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  }

  window.dispatchEvent(new CustomEvent(PENDING_SYNC_CHANGED_EVENT));
}

function enqueuePendingOperation(operation: PendingSyncOperation) {
  const queue = getPendingQueue().filter(
    (pending) =>
      !(
        pending.recordType === operation.recordType &&
        pending.id === operation.id
      ),
  );
  queue.push(operation);
  setPendingQueue(queue);
}

export function getPendingSyncOperations() {
  return getPendingQueue();
}

export function clearPendingSyncOperations() {
  setPendingQueue([]);
}

export function removePendingSyncOperation(operationId: string) {
  setPendingQueue(
    getPendingQueue().filter((operation) => operation.operationId !== operationId),
  );
}

async function getCurrentUserId(supabase: BrowserSupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Sesja użytkownika wygasła.");
  }

  return user.id;
}

async function assertNoConflict(
  supabase: BrowserSupabaseClient,
  recordType: string,
  id: string,
  baseUpdatedAt: string | null | undefined,
) {
  const remote = await fetchEncryptedRecordMetadata(supabase, recordType, id);

  if (!remote) {
    if (baseUpdatedAt) {
      throw new SyncConflictError(
        "Rekord został usunięty na innym urządzeniu. Odśwież dane przed zapisem.",
        recordType,
        id,
      );
    }
    return;
  }

  if (!baseUpdatedAt) {
    throw new SyncConflictError(
      "Rekord został już utworzony na innym urządzeniu. Odśwież dane przed zapisem.",
      recordType,
      id,
    );
  }

  if (remote.updated_at !== baseUpdatedAt || remote.deleted_at) {
    throw new SyncConflictError(
      "Rekord zmienił się na innym urządzeniu. Odśwież dane i ponów zmianę.",
      recordType,
      id,
    );
  }
}

async function uploadEncryptedRecord(
  supabase: BrowserSupabaseClient,
  encryptedRecord: UpsertPayload,
  baseUpdatedAt: string | null | undefined,
) {
  await assertNoConflict(
    supabase,
    encryptedRecord.record_type,
    encryptedRecord.id,
    baseUpdatedAt,
  );
  await upsertEncryptedRecord(supabase, encryptedRecord);
}

export async function saveRecord(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
  recordType: string,
  payload: WriteRecordPayload,
  options: SaveRecordOptions = {},
): Promise<WriteRecordResult> {
  const userId = await getCurrentUserId(supabase);
  const { encryptedPayload, nonce } = await encryptJsonPayload(userDataKey, payload);
  const updatedAt = new Date().toISOString();
  const encryptedRecord: UpsertPayload = {
    id: payload.id,
    user_id: userId,
    record_type: recordType,
    encrypted_payload: encryptedPayload,
    nonce,
    payload_version: 1,
    schema_version: 1,
    device_id: getWebDeviceId(),
    updated_at: updatedAt,
    deleted_at: null,
  };

  try {
    await uploadEncryptedRecord(supabase, encryptedRecord, options.baseUpdatedAt);
  } catch (error) {
    if (error instanceof SyncConflictError || options.enqueueOnFailure === false) {
      throw error;
    }

    enqueuePendingOperation({
      operationId: crypto.randomUUID(),
      operation: "upsert",
      recordType,
      id: payload.id,
      baseUpdatedAt: options.baseUpdatedAt ?? null,
      createdAt: new Date().toISOString(),
      encryptedRecord,
      error: error instanceof Error ? error.message : "Nie udało się wysłać zmiany.",
    });
    return { queued: true };
  }

  return { queued: false };
}

export async function encryptAndUpload(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
  recordType: string,
  payload: WriteRecordPayload,
): Promise<void> {
  await saveRecord(supabase, userDataKey, recordType, payload, {
    enqueueOnFailure: false,
  });
}

export async function deleteRecord(
  supabase: BrowserSupabaseClient,
  recordType: string,
  id: string,
  options: SaveRecordOptions = {},
): Promise<WriteRecordResult> {
  const userId = await getCurrentUserId(supabase);
  const updatedAt = new Date().toISOString();

  try {
    await assertNoConflict(supabase, recordType, id, options.baseUpdatedAt);
    await softDeleteEncryptedRecord(supabase, {
      id,
      user_id: userId,
      record_type: recordType,
      updated_at: updatedAt,
    });
  } catch (error) {
    if (error instanceof SyncConflictError || options.enqueueOnFailure === false) {
      throw error;
    }

    enqueuePendingOperation({
      operationId: crypto.randomUUID(),
      operation: "delete",
      recordType,
      id,
      userId,
      baseUpdatedAt: options.baseUpdatedAt ?? null,
      createdAt: new Date().toISOString(),
      updatedAt,
      error: error instanceof Error ? error.message : "Nie udało się wysłać usunięcia.",
    });
    return { queued: true };
  }

  return { queued: false };
}

export async function flushPendingSyncOperations(
  supabase: BrowserSupabaseClient,
) {
  const queue = getPendingQueue();
  const remaining: PendingSyncOperation[] = [];

  for (const operation of queue) {
    try {
      if (operation.operation === "upsert") {
        await uploadEncryptedRecord(
          supabase,
          operation.encryptedRecord,
          operation.baseUpdatedAt,
        );
      } else {
        await assertNoConflict(
          supabase,
          operation.recordType,
          operation.id,
          operation.baseUpdatedAt,
        );
        await softDeleteEncryptedRecord(supabase, {
          id: operation.id,
          user_id: operation.userId,
          record_type: operation.recordType,
          updated_at: operation.updatedAt,
        });
      }
    } catch (error) {
      remaining.push({
        ...operation,
        error:
          error instanceof Error
            ? error.message
            : "Nie udało się wysłać oczekującej zmiany.",
      });
    }
  }

  setPendingQueue(remaining);

  return {
    attempted: queue.length,
    sent: queue.length - remaining.length,
    remaining,
  };
}

export async function forcePendingSyncOperation(
  supabase: BrowserSupabaseClient,
  operationId: string,
) {
  const queue = getPendingQueue();
  const operation = queue.find((pending) => pending.operationId === operationId);

  if (!operation) {
    return { forced: false };
  }

  if (operation.operation === "upsert") {
    await upsertEncryptedRecord(supabase, operation.encryptedRecord);
  } else {
    await softDeleteEncryptedRecord(supabase, {
      id: operation.id,
      user_id: operation.userId,
      record_type: operation.recordType,
      updated_at: new Date().toISOString(),
    });
  }

  removePendingSyncOperation(operationId);
  return { forced: true };
}

export async function refreshSyncStore(
  supabase: BrowserSupabaseClient,
  userDataKey: CryptoKey,
) {
  const encryptedRecords = await fetchActiveEncryptedRecords(supabase);
  const decryptedRecords = await decryptEncryptedRecords(userDataKey, encryptedRecords);
  const summary = summarizeDecryptedRecords(decryptedRecords);
  const snapshot = buildInvestorDataSnapshot(decryptedRecords);
  return { records: decryptedRecords, summary, snapshot };
}
