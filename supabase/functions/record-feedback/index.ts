// Lightweight feedback recorder — no AI call. Stores the user's adopted reply
// (copied/favorited/edited) so the AI can learn their style over time.
// Designed for fire-and-forget invocation from the client.
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

/** Extract phrases present in `original` but missing in `edited` — a hint
 *  about wording the user dislikes. Simple, no AI call. */
function diffRemovedPhrases(original: string, edited: string): string[] {
  if (!original || !edited) return [];
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const o = norm(original);
  const e = norm(edited);
  if (o === e) return [];
  // Split original into sentence-ish chunks, keep those absent from edited.
  const chunks = o.split(/(?<=[.!?؟])\s+|،\s+|\n+/).map((c) => c.trim()).filter((c) => c.length >= 8);
  const eLower = e.toLowerCase();
  const removed: string[] = [];
  for (const c of chunks) {
    if (!eLower.includes(c.toLowerCase()) && c.length <= 80) removed.push(c);
    if (removed.length >= 5) break;
  }
  return removed;
}

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
      original_reply,
      action,
      business_type,
      intent_tag,
    } = body ?? {};

    if (!customer_message || !reply_text || !action) {
      return json({ error: "Missing fields" }, 400);
    }
    if (!["copied", "favorited", "edited_and_used"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    // Compute removed-phrase hints when the user edited the reply
    let removed: string[] | null = null;
    if (action === "edited_and_used" && original_reply) {
      removed = diffRemovedPhrases(String(original_reply), String(reply_text));
    }

    // Embed the customer message (best-effort, ~150ms). Skip if no key.
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
      } catch (_) {
        // ignore — embedding is optional
      }
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await admin.rpc("record_reply_feedback", {
      _user_id: userId,
      _customer_message: String(customer_message),
      _reply_text: String(reply_text),
      _action: action,
      _business_type: business_type || null,
      _intent_tag: intent_tag || null,
      _embedding: embedding,
      _removed_phrases: removed,
    });
    if (error) {
      console.error("record_reply_feedback:", error);
      return json({ error: error.message }, 500);
    }

    return json({ success: true, learned_removed: removed?.length ?? 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
