import type { RecordType } from "@/domain/models/investor-data";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          onboarding_completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          onboarding_completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          onboarding_completed_at?: string | null;
          updated_at?: string;
        };
      };
      user_devices: {
        Row: {
          user_id: string;
          device_id: string;
          device_name: string;
          platform: string;
          last_seen_at: string;
        };
        Insert: {
          user_id: string;
          device_id: string;
          device_name: string;
          platform: string;
          last_seen_at?: string;
        };
        Update: {
          device_name?: string;
          platform?: string;
          last_seen_at?: string;
        };
      };
      encrypted_records: {
        Row: {
          id: string;
          user_id: string;
          record_type: RecordType;
          encrypted_payload: string;
          nonce: string;
          payload_version: number;
          schema_version: number;
          device_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          user_id: string;
          record_type: RecordType;
          encrypted_payload: string;
          nonce: string;
          payload_version: number;
          schema_version: number;
          device_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          encrypted_payload?: string;
          nonce?: string;
          payload_version?: number;
          schema_version?: number;
          device_id?: string | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      encrypted_key_backups: {
        Row: {
          user_id: string;
          encrypted_user_data_key: string;
          nonce: string;
          salt: string;
          kdf: string;
          kdf_iterations: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          encrypted_user_data_key: string;
          nonce: string;
          salt: string;
          kdf: string;
          kdf_iterations: number;
          updated_at?: string;
        };
        Update: {
          encrypted_user_data_key?: string;
          nonce?: string;
          salt?: string;
          kdf?: string;
          kdf_iterations?: number;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
