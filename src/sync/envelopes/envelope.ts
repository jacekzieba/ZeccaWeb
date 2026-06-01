import { z } from "zod";
import type { RecordType } from "@/domain/models/investor-data";

export const recordTypeSchema = z.enum([
  "account",
  "asset",
  "transaction",
  "manualValuation",
  "income",
  "settings",
  "marketQuote",
]);

const timestampSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Invalid timestamp",
);

export const encryptedRecordSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  record_type: recordTypeSchema,
  encrypted_payload: z.string().min(1),
  nonce: z.string().min(1),
  payload_version: z.number().int().positive(),
  schema_version: z.number().int().positive(),
  device_id: z.string().min(1).nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  deleted_at: timestampSchema.nullable(),
});

export const wrappedPayloadEnvelopeSchema = z.object({
  type: recordTypeSchema,
  payloadVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  payload: z.unknown(),
});

export const swiftPayloadEnvelopeSchema = z
  .object({
    recordType: recordTypeSchema,
  })
  .passthrough();

export type PayloadEnvelope<TPayload = unknown> = {
  type: RecordType;
  payloadVersion: number;
  schemaVersion: number;
  payload: TPayload;
};

export function parsePayloadEnvelope(
  payload: unknown,
  versions?: {
    payloadVersion: number;
    schemaVersion: number;
  },
) {
  const wrapped = wrappedPayloadEnvelopeSchema.safeParse(payload);

  if (wrapped.success) {
    if (!Object.hasOwn(wrapped.data, "payload")) {
      throw new Error("Payload envelope is missing payload.");
    }

    return wrapped.data as PayloadEnvelope;
  }

  const swiftPayload = swiftPayloadEnvelopeSchema.parse(payload);

  if (!versions) {
    throw new Error("Swift payload envelope requires metadata versions.");
  }

  return {
    type: swiftPayload.recordType,
    payloadVersion: versions.payloadVersion,
    schemaVersion: versions.schemaVersion,
    payload: swiftPayload,
  } satisfies PayloadEnvelope;
}
