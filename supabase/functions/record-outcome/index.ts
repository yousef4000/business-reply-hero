// Smart Memory — outcome recorder. Stores Success / Failure for a generated reply
// so we can compute the analytics dashboard and bias future generations toward
// what actually works for this user. Fire-and-forget from the client.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const accessToken = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!accessToken || accessToken === ANON_KEY) return json({ error: "AUTH_REQUIRED" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      customer_message,
      reply_text,
      outcome,
      reply_style,
      tone,
      platform,
      business_type,
      message_type,
      objection_type,
      buying_stage,
      purchase_probability,
    } = body ?? {};

    if (!customer_message || !reply_text || !outcome) {
      return json({ error: "Missing fields" }, 400);
    }
    if (!["success", "failure"].includes(outcome)) {
      return json({ error: "Invalid outcome" }, 400);
    }

    // Best-effort embedding (~150ms). Skip silently on failure.
    let embedding: number[] | null = null;
    if (LOVABLE_API_KEY) {
      try {
        const r = await fetch(EMBED_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-embedding-001",
            input: String(customer_message).slice(0, 2000),
            dimensions: 1536,
          }),
        });
        if (r.ok) {
          const d = await r.json();
          embedding = d?.data?.[0]?.embedding ?? null;
        }
      } catch { /* ignore */ }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin.from("reply_outcomes").insert({
      user_id: userId,
      customer_message: String(customer_message).slice(0, 4000),
      reply_text: String(reply_text).slice(0, 4000),
      outcome,
      reply_style: reply_style ?? null,
      tone: tone ?? null,
      platform: platform ?? null,
      business_type: business_type ?? null,
      message_type: message_type ?? null,
      objection_type: objection_type ?? null,
      buying_stage: buying_stage ?? null,
      purchase_probability: typeof purchase_probability === "number" ? purchase_probability : null,
      embedding,
    });
    if (error) {
      console.error("record-outcome insert:", error);
      return json({ error: error.message }, 500);
    }
    return json({ success: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
