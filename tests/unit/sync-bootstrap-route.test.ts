import { describe, expect, it, vi } from "vitest";

// Trasa serwerowa ma własne zapytanie o rekordy. Bez `logical_id` wiersze
// tenant-scoped (id będące hashem) dostają zły AAD i nie dają się odszyfrować.
const selects: string[] = [];

vi.mock("@/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = (columns: string) => {
        if (table === "encrypted_records") selects.push(columns);
        return chain;
      };
      chain.is = () => chain;
      chain.order = () => chain;
      chain.maybeSingle = async () => ({ data: null, error: null });
      chain.range = async () => ({ data: [], error: null });
      return chain;
    },
  }),
}));

describe("GET /api/sync/bootstrap", () => {
  it("pobiera logical_id razem z rekordami", async () => {
    const { GET } = await import("../../app/api/sync/bootstrap/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(selects.length).toBeGreaterThan(0);
    for (const columns of selects) {
      expect(columns.split(",").map((column) => column.trim())).toContain("logical_id");
    }
  });
});
