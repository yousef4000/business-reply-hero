// Single LLM pass over a user's imported knowledge to auto-fill the business_profiles row.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const accessToken = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!accessToken || accessToken === ANON_KEY) return json({ error: "AUTH_REQUIRED" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "AUTH_REQUIRED" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: sources } = await admin
      .from("knowledge_sources")
      .select("title,source_type,raw_text")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!sources || !sources.length) return json({ error: "No knowledge sources to analyze" }, 400);

    // Build aggregated text (cap at 30k chars)
    let combined = "";
    for (const s of sources) {
      const chunk = `\n\n=== ${s.title || s.source_type} ===\n${s.raw_text || ""}`;
      if (combined.length + chunk.length > 30_000) break;
      combined += chunk;
    }

    const sys = `You analyze imported business documents and produce a clean structured business profile. Return ONLY valid JSON matching the schema. Use the SAME language as the source text. If a field is not in the documents, return empty string — never invent.`;

    const user = `Extract a structured business profile from the following imported documents. Return JSON with these string fields: business_name, business_type, description, services, products, pricing, menu_items, working_hours, branches, return_policy, shipping_policy, faqs, verified_facts, frequent_questions, common_scenarios.

DOCUMENTS:
${combined}`;

    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return json({ error: "AI analysis failed", details: t.slice(0, 300) }, 500);
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return json({ error: "No AI output" }, 500);
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { return json({ error: "AI returned invalid JSON" }, 500); }

    // Upsert into business_profiles (only non-empty fields)
    const allowed = ["business_name","business_type","description","services","products","pricing","menu_items","working_hours","branches","return_policy","shipping_policy","faqs","verified_facts","frequent_questions","common_scenarios"];
    const row: any = { user_id: userId };
    for (const k of allowed) if (parsed[k] && String(parsed[k]).trim()) row[k] = String(parsed[k]).trim();

    const { error: upErr } = await admin.from("business_profiles").upsert(row, { onConflict: "user_id" });
    if (upErr) return json({ error: "Failed to save profile", details: upErr.message }, 500);

    return json({ success: true, fields: Object.keys(row).filter((k) => k !== "user_id"), profile: row });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
