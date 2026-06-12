// Exports user's business data (profile + sources + chunks summary) as JSON.
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

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const [profile, sources, consents] = await Promise.all([
      admin.from("business_profiles").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("knowledge_sources").select("id,source_type,title,original_name,source_url,char_count,chunk_count,status,created_at,raw_text").eq("user_id", userId),
      admin.from("user_consents").select("*").eq("user_id", userId),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      email: userData?.user?.email,
      business_profile: profile.data || null,
      knowledge_sources: sources.data || [],
      consents: consents.data || [],
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="smart-reply-hub-export-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
