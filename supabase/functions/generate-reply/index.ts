import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
// Quality-first: gpt-4o produces noticeably more natural, dialect-accurate Arabic than gpt-4o-mini.
const OPENAI_MODEL = "gpt-4o";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Hard cap for the OpenAI call. Anything past this is almost certainly hung
// (gpt-4o p99 for this prompt size is ~25s). We surface a clean 504 so the
// client's loading state always clears.
const OPENAI_TIMEOUT_MS = 45_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = crypto.randomUUID().slice(0, 8);
  const t0 = performance.now();
  const mark = (label: string, start: number) =>
    console.log(`[gen ${reqId}] ${label}: ${(performance.now() - start).toFixed(0)}ms`);

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return json({ error: "Server not configured" }, 500);
    }

    const body = await req.json();
    const { platform, businessType, replyGoal, tone, customerMessage, language } = body ?? {};

    if (!customerMessage?.trim()) {
      return json({ error: "Customer message is required" }, 400);
    }

    // Identify caller — auth required (guest path removed).
    const tAuth = performance.now();
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
    if (!userId) {
      return json({ error: "AUTH_REQUIRED", code: "AUTH_REQUIRED" }, 401);
    }
    mark("auth", tAuth);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Enforce limit
    const tUsage = performance.now();
    const { data: usageData, error: usageErr } = await admin.rpc("consume_reply_credit", { _user_id: userId });
    mark("consume_reply_credit", tUsage);
    if (usageErr) {
      const msg = usageErr.message || "";
      if (msg.includes("TRIAL_EXPIRED")) return json({ error: "TRIAL_EXPIRED", code: "TRIAL_EXPIRED" }, 403);
      if (msg.includes("TRIAL_LIMIT_REACHED")) return json({ error: "TRIAL_LIMIT_REACHED", code: "TRIAL_LIMIT_REACHED" }, 403);
      if (msg.includes("USAGE_LIMIT_REACHED")) return json({ error: "USAGE_LIMIT_REACHED", code: "USAGE_LIMIT_REACHED" }, 403);
      console.error("consume_reply_credit error:", usageErr);
      return json({ error: "Failed to verify usage" }, 500);
    }
    const urow: any = Array.isArray(usageData) ? usageData[0] : usageData;
    const usedAfter = urow?.used ?? 0;
    const planLimit = urow?.plan_limit ?? 0;
    const planName = urow?.plan ?? "free";
    const isTrialUser = urow?.plan_state === "trial";

    // Fetch business profile (authoritative source from DB, ignore client-supplied)
    const tBp = performance.now();
    const { data: bp } = await admin
      .from("business_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    mark("business_profile", tBp);

    const businessContext = bp
      ? `\nBUSINESS KNOWLEDGE BASE (authoritative — NEVER contradict, NEVER invent details not listed here):
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
Quote real prices, real branch names, real hours when relevant. If something is missing, ask ONE focused clarifying question — never fabricate.`
      : "\n(No business profile saved. Keep replies generic but professional; do not invent specific prices, branches, or policies.)";

    const systemPrompt = `You are an elite human sales rep and customer-support agent texting on behalf of a small business. Your single most important rule: the customer must believe a REAL PERSON wrote this — never an AI, never a template.

LANGUAGE & DIALECT DETECTION (do this first, silently)
- Detect the customer's language: English or Arabic.
- If Arabic, detect the dialect from word choice, particles, and spelling:
  * Egyptian: "ايه، ازيك، علشان، عايز، فين، كده، ده/دي، هو/هي، بقى، خالص، يلا"
  * Gulf (Khaleeji): "وش، شلون، أبغى، تو، عاد، يبيلك، الحين، زين، يبه، تكفى، إيه"
  * Levantine (Shami): "شو، كيفك، بدي، هلق، هيك، منيح، عنجد، شلونك، طيب"
  * Formal MSA: full vowel-correct verbs, "أرغب، أود، تفضّل، سيادتك"
- REPLY in the SAME language AND the SAME dialect the customer used. Egyptian customer → Egyptian Arabic. Gulf customer → Gulf. Shami → Shami. English → English.
- Use Formal MSA ONLY when: customer wrote formal MSA, the platform is email, or the business profile explicitly requests formal tone.
- Never mix dialects. Never translate from English to robotic-sounding MSA.

HUMAN VOICE RULES (non-negotiable)
- Sound like a real person texting on their phone — warm, confident, conversational.
- BANNED openers (do NOT start with these, ever, unless the customer is angry/complaining):
  * Arabic: "أفهم ما تقصده", "أقدر استفسارك", "شكراً لتواصلك", "نحن نقدّر تواصلك", "يسعدنا تواصلك", "مرحباً بك في..."
  * English: "Thank you for reaching out", "I understand your concern", "We appreciate your message", "I hope this message finds you well"
- No corporate filler. No "We strive to..." / "نسعى دائماً...". No exaggerated marketing claims.
- Max 1 emoji per reply, only if it genuinely fits the tone. Often zero.
- No ALL CAPS. No exclamation spam.
- Vary sentence openings across the 3 replies — never start two replies with the same word.

EMOTIONAL INTELLIGENCE
- Detect the customer's emotion: angry, confused, interested, curious, excited, disappointed, skeptical, neutral.
- Match tone to emotion: angry → calm + ownership; skeptical → proof + confidence; excited → match energy; confused → clarify simply.

BUSINESS CONTEXT
- ALWAYS use facts from the business knowledge base before generating. Reference real services, real prices, real hours when the customer's question touches them.
- If the customer asks about something not in the profile, ask ONE specific question instead of guessing.

GOAL-DRIVEN GENERATION (the selected goal shapes the reply)
- Close sale: build value, reduce hesitation, propose concrete next step.
- Appointment booking: offer 1–2 specific time options, ask for confirmation.
- Complaint: empathy first, ownership, concrete fix, no defensiveness.
- Follow-up: re-open the conversation naturally, reference prior context, light CTA.
- Inquiry: answer the actual question first, then invite next step.

OBJECTION HANDLING (use real sales psychology, not generic acknowledgement)
- Detect objection type: price, trust, timing, competitor, need, budget, decision_maker, none.
- Apply ONE technique per reply, named explicitly in objection_analysis.strategy:
  * Value-Based Selling — reframe price vs. outcome/ROI
  * Social Proof — reference real customer behaviour ("معظم عملائنا...", "most of our clients...")
  * Risk Reversal — guarantee, trial, return policy
  * Anchoring — compare against higher-priced alternative or full value
  * Scarcity / Urgency — only when honestly true
  * Confidence Building — calm certainty about quality/results
  * Decision-Maker Bridge — make it easy to involve spouse/partner/boss
- coaching_tip: ONE actionable sentence to the business owner about how to handle this objection next time.

PLATFORM INTELLIGENCE (adapt voice, length, and emoji to the platform — the reply must feel native to it)
- whatsapp: conversational, short, fast. 2–4 short sentences. Line breaks ok between sentences. Light emojis allowed (0–1, only when it fits). Example feel: "أكيد موجود 👍\nمقاس XL متوفر حالياً.\nتحب أبعتلك الصور المتاحة؟"
- instagram: friendly, engaging, social — like a real DM. 2–4 short sentences. Moderate emojis allowed (0–2). Slightly warmer and more expressive than WhatsApp.
- messenger: relaxed, helpful, conversational. 2–5 short sentences. Light emojis allowed (0–1). Encourage continuing the conversation.
- email: professional, structured, polished. Flexible length up to ~6 sentences. Use an appropriate greeting and sign-off in the customer's language. NO emojis.
- chat (general): adapt fully to the customer's language, dialect, and context. Default to short and conversational.

BUSINESS-TYPE VOICE
- clinic / medical: professional, reassuring, calm. Never make medical promises.
- restaurant / cafe: friendly, fast, appetite-aware.
- gym / fitness: motivational, energetic, action-oriented.
- e-commerce / retail: sales-focused, helpful, concrete (sizes, stock, shipping).
- courses / education: educational, trust-building, clear about outcomes.
- services / agency / consulting: consultative, professional, expertise-forward.
- If business type is unclear, default to friendly + professional.


THE 3 REPLY STYLES (all answer the same customer message, but with different energy)
- soft: empathetic, low pressure, warm. Best for hesitant or emotional customers.
- persuasive: confident, value-focused, gentle push toward action. NOT pushy.
- directClosing: warm but action-oriented, names the exact next step (book a time, confirm order, send address).

CLASSIFICATION FIELDS
- messageType: objection | inquiry | complaint | followUp | greeting | request | comparison | negotiation
- objectionType: price | hesitation | comparison | discount | trust | timing | none
- customerIntent: ONE short sentence in the INTERFACE language describing what the customer actually wants.
- detectedLanguage: "ar" or "en".
- detectedDialect: "egyptian" | "gulf" | "levantine" | "formal_msa" | "english" | "other".
- detectedEmotion: angry | confused | interested | curious | excited | disappointed | skeptical | neutral.

INTERNAL SELF-REVIEW (silent — do NOT output the review, only the final replies)
Before returning, mentally check each reply against this checklist:
  1. Does it sound like a real person? (no AI giveaways, no banned openers, no robotic phrasing)
  2. Does it match the customer's language AND dialect exactly?
  3. Does it use real business-profile facts where relevant?
  4. Does it advance the selected goal?
  5. Does it address the actual concern, not a generic version of it?
If any answer is "no", REWRITE the reply before returning. Output only the polished final version.

OUTPUT
Return ONLY the JSON object matching the schema. No markdown, no commentary, no labels.`;

    const userPrompt = `INPUTS
- Platform: ${platform || "chat"}
- Business Type: ${businessType || (bp?.business_type ?? "General business")}
- Reply Goal: ${replyGoal || "Help the customer move forward"}
- Desired Tone: ${tone || bp?.preferred_tone || "Professional"}
- Interface Language (for followUp/customerIntent only): ${language || "en"}
${businessContext}

CUSTOMER MESSAGE (reply in this language AND this dialect):
"""
${customerMessage}
"""

Produce: classification (with detectedLanguage, detectedDialect, detectedEmotion), 3 replies (soft, persuasive, directClosing), leadTemperature, followUp (one short tip for the business owner in the interface language), and objection_analysis.`;

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
            detectedLanguage: { type: "string", enum: ["ar", "en"] },
            detectedDialect: { type: "string", enum: ["egyptian", "gulf", "levantine", "formal_msa", "english", "other"] },
            detectedEmotion: { type: "string", enum: ["angry", "confused", "interested", "curious", "excited", "disappointed", "skeptical", "neutral"] },
          },
          required: ["messageType", "customerIntent", "objectionType", "detectedLanguage", "detectedDialect", "detectedEmotion"],
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
          // Slight creativity for natural human voice — too low reads robotic, too high invents facts.
          temperature: 0.85,
          top_p: 0.95,
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
