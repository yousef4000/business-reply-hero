// Generate a structured Business DNA profile from name/description/website/socials.
// Output is saved to business_profiles.business_dna (jsonb) for reuse by generate-reply.
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

async function fetchWebsiteSnippet(url: string): Promise<string> {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(u, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 SmartReplyDNA" } });
    clearTimeout(tid);
    if (!r.ok) return "";
    const html = await r.text();
    // crude HTML strip
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 8000);
  } catch {
    return "";
  }
}

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

    const body = await req.json().catch(() => ({} as any));
    const {
      business_name,
      description,
      website_url,
      social_links,
    }: {
      business_name?: string;
      description?: string;
      website_url?: string;
      social_links?: Record<string, string>;
    } = body || {};

    if (!business_name?.trim() && !description?.trim() && !website_url?.trim()) {
      return json({ error: "Provide at least business name, description, or website." }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Persist inputs first so they're saved even if AI fails
    await admin
      .from("business_profiles")
      .upsert(
        {
          user_id: userId,
          business_name: business_name ?? undefined,
          description: description ?? undefined,
          website_url: website_url ?? null,
          social_links: social_links ?? {},
        },
        { onConflict: "user_id" },
      );

    const siteSnippet = website_url?.trim() ? await fetchWebsiteSnippet(website_url.trim()) : "";

    const socials = social_links && typeof social_links === "object"
      ? Object.entries(social_links).filter(([, v]) => v && String(v).trim()).map(([k, v]) => `- ${k}: ${v}`).join("\n")
      : "";

    const sys = `You are a senior brand strategist. Analyze the business inputs and produce a structured "Business DNA" profile. Reply ONLY with valid JSON matching the schema. Use the same primary language as the inputs (Arabic if inputs are Arabic, else English). Never invent specific facts (prices, names, addresses); infer general positioning only.`;

    const user = `BUSINESS NAME:
${business_name || "(none)"}

DESCRIPTION:
${description || "(none)"}

WEBSITE URL: ${website_url || "(none)"}
WEBSITE CONTENT SNIPPET:
${siteSnippet || "(unavailable)"}

SOCIAL LINKS:
${socials || "(none)"}

TASK: Produce a "Business DNA" with these fields (each concise, useful for guiding a customer-service AI):
- industry: 2-5 words
- main_services: 3-6 bullet items
- target_audience: 1-2 sentences describing primary customers
- communication_style: 1-2 sentences (formal/casual, warm/direct, emoji-friendly?, dialect hints)
- sales_style: 1-2 sentences (consultative, transactional, persuasive, low-pressure...)
- trust_signals: 3-6 short bullets (credentials, guarantees, social proof angles, certifications hinted by content)
- typical_questions: 5-8 short questions customers commonly ask this business
- common_objections: 4-6 short objections customers commonly raise
- preferred_reply_length: one of "short", "medium", "long"

Output strict JSON only.`;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        industry: { type: "string" },
        main_services: { type: "array", items: { type: "string" } },
        target_audience: { type: "string" },
        communication_style: { type: "string" },
        sales_style: { type: "string" },
        trust_signals: { type: "array", items: { type: "string" } },
        typical_questions: { type: "array", items: { type: "string" } },
        common_objections: { type: "array", items: { type: "string" } },
        preferred_reply_length: { type: "string", enum: ["short", "medium", "long"] },
      },
      required: [
        "industry", "main_services", "target_audience", "communication_style",
        "sales_style", "trust_signals", "typical_questions", "common_objections",
        "preferred_reply_length",
      ],
    };

    const r = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name: "business_dna", strict: true, schema } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("dna ai err", r.status, t.slice(0, 300));
      return json({ error: "AI generation failed", details: t.slice(0, 200) }, 500);
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return json({ error: "No AI output" }, 500);
    let dna: any;
    try { dna = JSON.parse(content); } catch { return json({ error: "AI returned invalid JSON" }, 500); }

    const now = new Date().toISOString();
    const { error: upErr } = await admin
      .from("business_profiles")
      .upsert(
        { user_id: userId, business_dna: dna, dna_generated_at: now, dna_edited_at: null },
        { onConflict: "user_id" },
      );
    if (upErr) return json({ error: "Failed to save DNA", details: upErr.message }, 500);

    return json({ success: true, dna, dna_generated_at: now });
  } catch (e) {
    console.error("dna fatal", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
