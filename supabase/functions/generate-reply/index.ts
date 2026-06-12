import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const PRIMARY_MODEL = "gpt-4o";
const FALLBACK_MODEL = "gpt-4o-mini";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Primary call gets a tighter cap so we still have budget to fall back to mini.
const PRIMARY_TIMEOUT_MS = 20_000;
const FALLBACK_TIMEOUT_MS = 15_000;

// --- Smart business-profile context selection ---------------------------------
// Classify the customer message so we only inject the relevant slices of the
// business profile instead of the entire row. Cuts ~40-60% of profile tokens.
type ProfileTopic =
  | "pricing"
  | "menu"
  | "branches"
  | "hours"
  | "returns"
  | "shipping"
  | "services"
  | "products"
  | "faq"
  | "general";

function detectTopics(msg: string): Set<ProfileTopic> {
  const m = msg.toLowerCase();
  const topics = new Set<ProfileTopic>();
  const has = (...kws: string[]) => kws.some((k) => m.includes(k));

  if (has("price", "cost", "how much", "سعر", "كم", "بكم", "تكلفة", "اسعار", "أسعار", "كام")) topics.add("pricing");
  if (has("menu", "dish", "meal", "food", "منيو", "قائمة", "اكل", "أكل", "طبق")) topics.add("menu");
  if (has("branch", "location", "where", "address", "فرع", "فروع", "وين", "فين", "عنوان", "موقع")) topics.add("branches");
  if (has("hour", "open", "close", "when", "ساعات", "متى", "امتى", "إمتى", "دوام", "مفتوح", "مغلق")) topics.add("hours");
  if (has("return", "refund", "exchange", "ارجاع", "إرجاع", "استرجاع", "استرداد", "استبدال")) topics.add("returns");
  if (has("ship", "delivery", "deliver", "توصيل", "شحن", "يوصل", "متى يوصل")) topics.add("shipping");
  if (has("service", "offer", "do you", "خدمة", "خدمات", "تقدمو", "تسوو")) topics.add("services");
  if (has("product", "stock", "available", "size", "color", "منتج", "متوفر", "مقاس", "لون")) topics.add("products");
  if (has("how", "faq", "policy", "كيف", "ازاي", "إزاي", "ليش", "ليه")) topics.add("faq");

  if (topics.size === 0) topics.add("general");
  return topics;
}

function buildBusinessContext(bp: any, msg: string): string {
  if (!bp) return "(No business profile saved. Stay generic — never invent prices, branches, or policies.)";

  const topics = detectTopics(msg);
  const all = topics.has("general");
  const lines: string[] = [];
  const push = (label: string, val: any) => {
    if (val && String(val).trim()) lines.push(`- ${label}: ${String(val).trim()}`);
  };

  // Always-on identity (cheap, anchors persona)
  push("Business", `${bp.business_name || "—"} (${bp.business_type || "—"})`);
  if (bp.description && (all || topics.size <= 2)) push("About", bp.description);

  if (all || topics.has("pricing")) push("Pricing", bp.pricing);
  if (all || topics.has("services")) push("Services", bp.services);
  if (all || topics.has("products")) push("Products", bp.products);
  if (all || topics.has("menu")) push("Menu", bp.menu_items);
  if (all || topics.has("hours")) push("Hours", bp.working_hours);
  if (all || topics.has("branches")) push("Branches", bp.branches);
  if (all || topics.has("returns")) push("Return Policy", bp.return_policy);
  if (all || topics.has("shipping")) push("Shipping Policy", bp.shipping_policy);
  if (all || topics.has("faq")) push("FAQs", bp.faqs);
  if (bp.custom_notes && all) push("Notes", bp.custom_notes);

  let block = `BUSINESS FACTS (authoritative — never contradict, never invent):\n${lines.join("\n")}\nIf a needed fact is missing, ask ONE focused question.`;

  if (bp.ai_instructions && String(bp.ai_instructions).trim()) {
    block += `\n\nOWNER INSTRUCTIONS (HIGHEST PRIORITY — follow exactly, override defaults if they conflict):\n${String(bp.ai_instructions).trim()}`;
  }

  return block;
}

// --- System prompt: response quality first, analysis second ------------------
const SYSTEM_PROMPT = `You are a real, experienced human customer-service / sales rep replying on behalf of a small business. The customer must NEVER suspect AI involvement.

═══════════════════════════════════════
ABSOLUTE PRIORITY ORDER
  1. Write the BEST possible reply (this is what the customer sees)
  2. Light internal context extraction (used only to shape the reply)
  3. Analysis / classification fields (lowest priority — never let them dilute reply quality)
NEVER sacrifice reply quality for classification, objection labels, or coaching metadata.
═══════════════════════════════════════

INTERNAL CONTEXT EXTRACTION (silent — never narrated, never shown in replies)
Before writing any reply, silently parse the customer message and populate these internal fields:
  • customer_questions  — EVERY explicit question the customer asked. If 4 questions exist, list 4. Do not merge or skip.
  • customer_concerns   — worries/fears behind the words (delay, cost, trust, safety, timing…)
  • customer_goals      — what they want right now (status update, booking, refund, reassurance…)
  • customer_context    — concrete circumstances mentioned (appointment tomorrow, traveling, deadline, kid sick, budget tight…)
  • detected_emotion    — calm | concerned | frustrated | angry | confused | urgent | neutral | interested
These exist ONLY to ground the reply. Do not paste them as bullet lists into the reply text.

REPLY CONSTRUCTION RULES (what the customer reads)
  • Address EVERY customer_question. If 4 questions were asked, the reply touches all 4 — no skipping.
  • Acknowledge customer_concerns naturally (one short empathic beat, not a paragraph).
  • Honor customer_context (reference the appointment / deadline / circumstance when relevant).
  • Match customer_emotion: urgent → faster + more direct; frustrated → calm + accountable; confused → clearer + simpler.
  • Pull facts from BUSINESS FACTS when they apply. Never invent a price, hour, branch, fee, or policy.
  • If a needed fact is missing, ask ONE focused question instead of guessing.
  • Never promise medical outcomes, exact dates, or anything outside the business's control.

CONTEXT PRIORITY (highest → lowest)
  1. BUSINESS FACTS (OWNER INSTRUCTIONS block, if present, overrides everything else)
  2. User-provided platform / goal / tone
  3. Internal extraction above
  4. Customer message itself

LANGUAGE & DIALECT
Detect customer language (ar/en) and Arabic dialect (egyptian | gulf | levantine | formal_msa) from their wording. Reply in the EXACT same language and dialect. Use formal MSA only when the customer used MSA or the platform is email. Never mix dialects.

HUMAN VOICE — non-negotiable
  • Sound like a real person texting from their phone, not a corporate bot.
  • Warm, confident, conversational, naturally concise.
  • BANNED openers (EN/AR): "Thank you for reaching out", "Thank you for contacting us", "I understand your concern", "We appreciate your message", "شكراً لتواصلك", "نشكر تواصلك", "يسعدنا تواصلك", "أفهم ما تقصده", "نقدّر تواصلك".
  • BANNED generic fillers: "I'll check and get back to you" / "ساتحقق وأعود إليك" UNLESS paired with a concrete next step tied to a specific concern.
  • No corporate filler ("we strive to", "rest assured"), no ALL CAPS, no exclamation spam, no repeated templates.
  • The 3 reply variants MUST start with different words and feel genuinely different — not paraphrases.

DOMAIN SAFETY (healthcare / labs / clinics / appointments)
  • Never assume a medical fact, diagnosis, or test result.
  • Never claim there IS or IS NOT a problem with a sample/test.
  • Safe phrasing for delays: "We're reviewing the sample carefully to make sure the result is fully accurate before releasing it."
  • For fee questions when policy is unknown: acknowledge the worry and commit to confirming the exact cost BEFORE any charge — never invent a fee and never promise "no fee".
  • For appointment urgency: explicitly acknowledge the deadline and propose a concrete next step (priority review, callback window, alternative documentation).

CLASSIFICATION HONESTY (lowest priority — do it last, do not let it bend the reply)
Classify what actually exists. Do NOT force every message into a sales objection.
  status/result question → inquiry · frustration about delay → complaint · booking → request ·
  price worry → objection(price) · trust worry → objection(trust) · "any update?" → followUp.
If there is no real objection: objectionType="none" and objection_analysis.type="none". coaching_tip = one short sentence for the owner.

OBJECTION HANDLING (only when a real objection exists)
Pick ONE technique and name it in objection_analysis.strategy: Value-Based, Social Proof, Risk Reversal, Anchoring, Scarcity (only if true), Confidence Building, or Decision-Maker Bridge.

PLATFORM-AWARE COMMUNICATION (strict)
  • whatsapp: conversational, 2–4 short sentences, 0–1 emoji.
  • messenger: friendly, 2–5 short sentences, 0–1 emoji.
  • instagram: friendly + engaging, 2–4 sentences, 0–2 emojis.
  • email: formal, structured, 3–6 sentences, greeting + sign-off in customer's language, NO emojis.
  • chat: short and conversational, 0–1 emoji.

BUSINESS-TYPE VOICE
clinic/lab: reassuring + careful, no medical promises. restaurant: fast, appetite-aware. gym: motivational. e-commerce: concrete (sizes, stock, shipping). courses: trust-building. services: consultative. Unknown → friendly + professional.

3 REPLY STYLES (same intent, genuinely different energy — all must pass the checklist below)
  • soft: empathetic, low pressure, warm.
  • persuasive: confident, value-focused, gentle push toward the goal.
  • directClosing: warm but names the exact next step clearly.

MANDATORY SELF-CHECK before returning EACH of the 3 replies — silently rewrite if any answer is NO:
  1. Did it address EVERY customer_question?
  2. Did it acknowledge the main customer_concerns?
  3. Did it honor the customer_context (appointment, deadline, circumstance)?
  4. Does the tone match customer_emotion?
  5. Does it sound like a real human, not an AI?
  6. Does it fit the platform's length + emoji rules?
  7. Does it avoid inventing facts and avoid unsafe promises?
  8. Correct language + dialect, no banned openers/fillers?

OUTPUT: JSON only, matching the provided schema. No markdown, no labels, no commentary, no chain-of-thought.`;

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
    const { platform, businessType, replyGoal, tone, customerMessage, language, debug } = body ?? {};
    const debugMode = debug === true || req.headers.get("x-debug") === "1";

    if (!customerMessage?.trim()) {
      return json({ error: "Customer message is required" }, 400);
    }

    // Auth
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
    if (!userId) return json({ error: "AUTH_REQUIRED", code: "AUTH_REQUIRED" }, 401);
    mark("auth", tAuth);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Run usage check + business profile fetch in parallel to shave ~100-200ms.
    const tParallel = performance.now();
    const [usageRes, bpRes] = await Promise.all([
      admin.rpc("consume_reply_credit", { _user_id: userId }),
      admin.from("business_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    mark("usage+profile(parallel)", tParallel);

    const { data: usageData, error: usageErr } = usageRes;
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

    const bp = bpRes.data;

    const tBuild = performance.now();
    const businessContext = buildBusinessContext(bp, customerMessage);

    const userPrompt = `Platform: ${platform || "chat"}
Business Type: ${businessType || bp?.business_type || "general"}
Goal: ${replyGoal || "help customer move forward"}
Tone: ${tone || bp?.preferred_tone || "professional"}
Interface Language (for followUp/customerIntent only): ${language || "en"}

${businessContext}

CUSTOMER MESSAGE (reply in this language + dialect):
"""${customerMessage}"""

Return: customer_concerns (1-5 short items in customer's language, max 6 words each), classification (with detectedLanguage, detectedDialect, detectedEmotion), 3 replies (soft, persuasive, directClosing) that each address most of the customer_concerns, leadTemperature, followUp (one short tip for the owner in interface language), objection_analysis.`;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        customer_concerns: {
          type: "array",
          description: "1-5 short concern items extracted directly from the customer message, in the customer's language.",
          items: { type: "string" },
          minItems: 1,
          maxItems: 5,
        },
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
      required: ["customer_concerns", "classification", "replies", "leadTemperature", "followUp", "objection_analysis"],
    };

    const promptChars = SYSTEM_PROMPT.length + userPrompt.length;
    console.log(`[gen ${reqId}] prompt_chars=${promptChars} bp=${bp ? "yes" : "no"} platform=${platform || "chat"} debug=${debugMode}`);
    if (debugMode) {
      console.log(`[gen ${reqId}] === DEBUG: USER INPUTS ===\n${JSON.stringify({ platform, businessType, replyGoal, tone, language }, null, 2)}`);
      console.log(`[gen ${reqId}] === DEBUG: CUSTOMER MESSAGE ===\n${customerMessage}`);
      console.log(`[gen ${reqId}] === DEBUG: BUSINESS CONTEXT ===\n${businessContext}`);
      console.log(`[gen ${reqId}] === DEBUG: SYSTEM PROMPT ===\n${SYSTEM_PROMPT}`);
      console.log(`[gen ${reqId}] === DEBUG: USER PROMPT (final) ===\n${userPrompt}`);
    }
    mark("prompt_build", tBuild);

    const callOpenAI = async (model: string, timeoutMs: number) => {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      const tCall = performance.now();
      try {
        const response = await fetch(OPENAI_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            input: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.65,
            top_p: 0.9,
            max_output_tokens: 900,
            text: { format: { type: "json_schema", name: "generate_reply", strict: true, schema } },
          }),
        });
        mark(`openai(${model})`, tCall);
        return { ok: true as const, response };
      } catch (error) {
        const aborted = (error as any)?.name === "AbortError";
        console.error(`[gen ${reqId}] openai(${model}) ${aborted ? "TIMEOUT" : "ERROR"} after ${(performance.now() - tCall).toFixed(0)}ms`);
        return { ok: false as const, aborted, error };
      } finally {
        clearTimeout(tid);
      }
    };

    // Try primary, fall back to mini on timeout/5xx/network error.
    let attempt = await callOpenAI(PRIMARY_MODEL, PRIMARY_TIMEOUT_MS);
    let usedModel = PRIMARY_MODEL;
    let response: Response | undefined = attempt.ok ? attempt.response : undefined;

    const shouldFallback =
      !attempt.ok || (attempt.ok && (attempt.response.status >= 500 || attempt.response.status === 429));

    if (shouldFallback) {
      console.log(`[gen ${reqId}] falling back to ${FALLBACK_MODEL}`);
      const second = await callOpenAI(FALLBACK_MODEL, FALLBACK_TIMEOUT_MS);
      if (second.ok) {
        response = second.response;
        usedModel = FALLBACK_MODEL;
      } else if (!attempt.ok) {
        // Both failed at the network level
        return json(
          { error: "AI_TIMEOUT", code: "AI_TIMEOUT", message: "The AI took too long to respond. Please try again." },
          504,
        );
      }
    }

    if (!response) {
      return json({ error: "AI_TIMEOUT", code: "AI_TIMEOUT" }, 504);
    }

    if (!response.ok) {
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again shortly." }, 429);
      if (response.status === 401) return json({ error: "Invalid OpenAI API key." }, 500);
      const errorText = await response.text();
      console.error(`[gen ${reqId}] OpenAI ${response.status} (${usedModel}):`, errorText.slice(0, 500));
      return json({ error: "AI generation failed" }, 500);
    }

    const tParse = performance.now();
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
    mark("parse", tParse);
    console.log(`[gen ${reqId}] DONE total=${(performance.now() - t0).toFixed(0)}ms model=${usedModel} output_chars=${outputText.length}`);

    return json({
      ...result,
      usage: { used: usedAfter, limit: planLimit, plan: planName, trial: isTrialUser },
      _meta: { model: usedModel, total_ms: Math.round(performance.now() - t0) },
      ...(debugMode ? {
        _debug: {
          system_prompt: SYSTEM_PROMPT,
          user_prompt: userPrompt,
          business_context: businessContext,
          user_inputs: { platform, businessType, replyGoal, tone, language },
          customer_message: customerMessage,
          prompt_chars: promptChars,
          model_used: usedModel,
        },
      } : {}),
    });
  } catch (e) {
    console.error(`[gen ${reqId}] fatal after ${(performance.now() - t0).toFixed(0)}ms:`, e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
