import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-4o-mini";
const GUEST_LIMIT = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return json({ error: "Server not configured" }, 500);
    }

    const body = await req.json();
    const { platform, businessType, replyGoal, tone, customerMessage, language, guestUsage } = body ?? {};

    if (!customerMessage?.trim()) {
      return json({ error: "Customer message is required" }, 400);
    }

    // Identify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace("Bearer ", "").trim();
    let userId: string | null = null;
    if (accessToken && accessToken !== SUPABASE_ANON_KEY) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) userId = userData.user.id;
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Enforce limit
    let usedAfter = 0;
    let planLimit = 0;
    let planName = "guest";
    let isTrialUser = false;

    if (userId) {
      const { data, error } = await admin.rpc("consume_reply_credit", { _user_id: userId });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("TRIAL_EXPIRED")) {
          return json({ error: "TRIAL_EXPIRED", code: "TRIAL_EXPIRED" }, 403);
        }
        if (msg.includes("TRIAL_LIMIT_REACHED")) {
          return json({ error: "TRIAL_LIMIT_REACHED", code: "TRIAL_LIMIT_REACHED" }, 403);
        }
        if (msg.includes("USAGE_LIMIT_REACHED")) {
          return json({ error: "USAGE_LIMIT_REACHED", code: "USAGE_LIMIT_REACHED" }, 403);
        }
        console.error("consume_reply_credit error:", error);
        return json({ error: "Failed to verify usage" }, 500);
      }
      const row: any = Array.isArray(data) ? data[0] : data;
      usedAfter = row?.used ?? 0;
      planLimit = row?.plan_limit ?? 0;
      planName = row?.plan ?? "free";
      isTrialUser = row?.plan_state === "trial";
    } else {
      const guestUsed = Math.max(0, Number(guestUsage ?? 0));
      if (guestUsed >= GUEST_LIMIT) {
        return json({ error: "GUEST_LIMIT_REACHED", code: "GUEST_LIMIT_REACHED", used: guestUsed, limit: GUEST_LIMIT, plan: "guest" }, 403);
      }
      usedAfter = guestUsed + 1;
      planLimit = GUEST_LIMIT;
      planName = "guest";
    }

    // Fetch business profile (authoritative source from DB, ignore client-supplied)
    let bp: any = null;
    if (userId) {
      const { data } = await admin
        .from("business_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      bp = data;
    }

    const businessContext = bp
      ? `\nBUSINESS KNOWLEDGE BASE (ALWAYS PRIORITIZE THESE FACTS — never contradict them, never invent details):
- Business Name: ${bp.business_name || "—"}
- Business Type: ${bp.business_type || "—"}
- Description: ${bp.description || "—"}
- Services: ${bp.services || "—"}
- Products: ${bp.products || "—"}
- Pricing: ${bp.pricing || "—"}
- Menu Items: ${bp.menu_items || "—"}
- Working Hours: ${bp.working_hours || "—"}
- Branches / Locations: ${bp.branches || "—"}
- Return Policy: ${bp.return_policy || "—"}
- Shipping Policy: ${bp.shipping_policy || "—"}
- FAQs: ${bp.faqs || "—"}
- Notes: ${bp.custom_notes || "—"}
Use specific facts from above when relevant. If the customer asks about something not covered, ask one focused clarifying question instead of inventing details.`
      : "";

    const systemPrompt = `You are a senior Arabic-speaking sales & customer-service expert AND an AI sales coach writing replies on behalf of a small business owner. Your replies must feel HUMAN — like a real, friendly, knowledgeable shop owner texting a customer back.

LANGUAGE & TONE
- Reply ONLY in the language of the customer message. Arabic = natural Egyptian/Gulf-friendly MSA, not formal, not robotic, not translated-from-English.
- Never use empty filler ("Thank you for reaching out", "نحن نقدّر تواصلك", etc.).
- No exaggeration, no ALL-CAPS, max 1 emoji.
- Address the EXACT words/concern of the customer.

LENGTH & FORMAT
- WhatsApp / Messenger / Instagram: 2–4 short sentences. Email: up to 5 sentences. End with ONE practical next step.

OBJECTION HANDLING (objection_analysis must be returned)
Detect one of: price, trust, timing, competitor, need, budget, decision_maker, or none.
For non-"none" objections, fill objection_analysis with:
- type (one of the above)
- strategy: short label of the sales strategy used (e.g. "Value-Based Selling", "Risk Reversal", "Social Proof", "Anchoring", "Decision-Maker Bridge", "Urgency Framing")
- coaching_tip: ONE actionable sentence directed at the business owner explaining what to do next time / how to handle this objection.

REPLY STRUCTURE for objections: EMPATHY → VALUE REFRAME → REDUCE HESITATION → SOFT CTA.
COMPLAINTS: Apology/understanding → Reassurance → Concrete next action → Warm tone.
INQUIRIES/REQUESTS/GREETINGS: Answer specifically; ask ONE focused clarifying question if needed.

THE 3 REPLY STYLES (return all three, each addressing the same message but with different energy):
- soft: empathetic, low pressure.
- persuasive: value-focused, confident but not pushy.
- directClosing: warm but action-oriented, concrete next step.

FOLLOW-UP: A SHORT note for the BUSINESS OWNER (not customer-facing), specific to this conversation, one sentence in the interface language.`;

    const userPrompt = `TASK: Analyze the customer message and generate 3 reply options + objection analysis.

INPUTS:
- Platform: ${platform || "General"}
- Business Type: ${businessType || (bp?.business_type ?? "General business")}
- Reply Goal: ${replyGoal || "Help the customer"}
- Desired Tone: ${tone || bp?.preferred_tone || "Professional"}
- Interface Language: ${language || "en"}
${businessContext}

CUSTOMER MESSAGE:
"${customerMessage}"

Return a JSON object matching the schema with classification, 3 reply options, leadTemperature, followUp, and objection_analysis.`;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        classification: {
          type: "object",
          additionalProperties: false,
          properties: {
            messageType: { type: "string", enum: ["objection", "inquiry", "complaint", "followUp", "greeting", "request", "comparison", "negotiation"] },
            customerIntent: { type: "string" },
            objectionType: { type: "string", enum: ["price", "hesitation", "comparison", "discount", "trust", "timing", "none"] },
          },
          required: ["messageType", "customerIntent", "objectionType"],
        },
        replies: {
          type: "object",
          additionalProperties: false,
          properties: { soft: { type: "string" }, persuasive: { type: "string" }, directClosing: { type: "string" } },
          required: ["soft", "persuasive", "directClosing"],
        },
        leadTemperature: { type: "string", enum: ["hot", "warm", "cold"] },
        followUp: { type: "string" },
        objection_analysis: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["price", "trust", "timing", "competitor", "need", "budget", "decision_maker", "none"] },
            strategy: { type: "string" },
            coaching_tip: { type: "string" },
          },
          required: ["type", "strategy", "coaching_tip"],
        },
      },
      required: ["classification", "replies", "leadTemperature", "followUp", "objection_analysis"],
    };

    let response: Response;
    try {
      response = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          text: { format: { type: "json_schema", name: "generate_reply", strict: true, schema } },
        }),
      });
    } catch (error) {
      console.error("OpenAI Error:", error);
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again shortly." }, 429);
      if (response.status === 401) return json({ error: "Invalid OpenAI API key." }, 500);
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      return json({ error: "AI generation failed" }, 500);
    }

    const data = await response.json();
    let outputText: string | undefined = data.output_text;
    if (!outputText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item?.type === "message" && Array.isArray(item.content)) {
          for (const c of item.content) if (typeof c?.text === "string") { outputText = c.text; break; }
        }
        if (outputText) break;
      }
    }
    if (!outputText) return json({ error: "AI did not return structured output" }, 500);

    let result;
    try { result = JSON.parse(outputText); }
    catch { return json({ error: "AI returned invalid JSON" }, 500); }

    return json({
      ...result,
      usage: { used: usedAfter, limit: planLimit, plan: planName, trial: isTrialUser },
    });
  } catch (e) {
    console.error("generate-reply error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
