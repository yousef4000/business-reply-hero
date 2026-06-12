// Hard-deletes ALL user data (profile, knowledge, files, subscription) and the auth user.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const accessToken = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!accessToken || accessToken === ANON_KEY) return json({ error: "AUTH_REQUIRED" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);

    const body = await req.json().catch(() => ({}));
    const { confirm, mode } = body ?? {};
    if (confirm !== "DELETE") return json({ error: "Confirmation required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Delete storage files
    const { data: files } = await admin.storage.from("business-docs").list(userId, { limit: 1000 });
    if (files && files.length) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      await admin.storage.from("business-docs").remove(paths);
    }

    if (mode === "data_only") {
      // Wipe business data but keep account
      await admin.from("knowledge_chunks").delete().eq("user_id", userId);
      await admin.from("knowledge_sources").delete().eq("user_id", userId);
      await admin.from("business_profiles").delete().eq("user_id", userId);
      return json({ success: true, mode: "data_only" });
    }

    // 2. Wipe all DB rows
    const { error: delErr } = await admin.rpc("delete_user_data", { _user_id: userId });
    if (delErr) console.error("delete_user_data:", delErr);

    // 3. Delete auth user (hard)
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("auth.deleteUser:", authErr);
      return json({ error: "Failed to delete account", details: authErr.message }, 500);
    }

    return json({ success: true, mode: "full" });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
