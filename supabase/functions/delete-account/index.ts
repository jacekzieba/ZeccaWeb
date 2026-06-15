// Deletes the calling user's account (App Store rule 5.1.1(v)).
// Auth: the function verifies the caller's JWT itself (admin.auth.getUser), so
// it must be deployed with verify_jwt = false. The platform's verify_jwt gate
// would otherwise reject the unauthenticated CORS preflight (OPTIONS) before it
// reaches this handler, breaking browser-initiated deletion.
// Row cleanup (profiles, user_devices, encrypted_records, encrypted_key_backups)
// happens via ON DELETE CASCADE from auth.users — see 0001_initial_sync.sql.
import { createClient } from "npm:@supabase/supabase-js@2";

// Browser callers (supabase-js functions.invoke) send a CORS preflight because
// the request carries Authorization/apikey headers. Without these headers the
// preflight fails and the delete never runs.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: "Delete failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: jsonHeaders,
  });
});
