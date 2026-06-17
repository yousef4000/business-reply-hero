// Save a generated reply into the user's Winning Replies Library.
// Embeds the customer message (or reply text) so similarity search can surface
// it for future generations. Auth-required, RLS-scoped.
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
      title,
      customer_message,
      reply_text,
      objection_type,
      customer_intent,
      industry,
      tags,
    } = body ?? {};

    if (!reply_text || typeof reply_text !== "string" || reply_text.trim().length < 5) {
      return json({ error: "reply_text required" }, 400);
    }

    // Embed the customer message (fallback to reply text) for retrieval.
    const embedInput = String(customer_message || reply_text).slice(0, 2000);
    let embedding: number[] | null = null;
    if (LOVABLE_API_KEY) {
      try {
        const r = await fetch(EMBED_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-embedding-001",
            input: embedInput,
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
    const { data, error } = await admin
      .from("winning_replies")
      .insert({
        user_id: userId,
        title: title ? String(title).slice(0, 120) : null,
        customer_message: customer_message ? String(customer_message).slice(0, 4000) : null,
        reply_text: String(reply_text).slice(0, 4000),
        objection_type: objection_type || null,
        customer_intent: customer_intent ? String(customer_intent).slice(0, 200) : null,
        industry: industry ? String(industry).slice(0, 120) : null,
        tags: Array.isArray(tags) ? tags.slice(0, 10).map((t: any) => String(t).slice(0, 40)) : [],
        embedding,
      })
      .select("id")
      .single();
    if (error) {
      console.error("save-winning-reply:", error);
      return json({ error: error.message }, 500);
    }
    return json({ success: true, id: data?.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
