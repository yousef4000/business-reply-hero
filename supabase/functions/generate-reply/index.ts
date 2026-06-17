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

  // Customer Service Rules — ALWAYS injected when present (safety-critical, no topic gating).
  const csrLines: string[] = [];
  const pushCsr = (label: string, val: any) => {
    if (val && String(val).trim()) csrLines.push(`▸ ${label}:\n${String(val).trim()}`);
  };
  pushCsr("VERIFIED FACTS (safe to state confidently)", bp.verified_facts);
  pushCsr("NEVER ASSUME (forbidden assumptions — do NOT state these unless explicitly given above)", bp.never_assume);
  pushCsr("PREFERRED PHRASES (favor these wordings)", bp.preferred_phrases);
  pushCsr("FORBIDDEN PHRASES (never use these wordings)", bp.forbidden_phrases);
  pushCsr("SENSITIVE CASES (handle with extra care)", bp.sensitive_cases);
  pushCsr("COMMON SCENARIOS (recognize and respond accordingly)", bp.common_scenarios);
  pushCsr("FREQUENT QUESTIONS (typical customer asks)", bp.frequent_questions);
  pushCsr("ESCALATION RULES (when to escalate to a human/manager)", bp.escalation_rules);
  pushCsr("COMPLAINT RULES (how to handle complaints)", bp.complaint_rules);
  if (csrLines.length) {
    block += `\n\nCUSTOMER SERVICE RULES (authoritative — apply in EVERY reply):\n${csrLines.join("\n\n")}`;
  }

  if (bp.ai_instructions && String(bp.ai_instructions).trim()) {
    block += `\n\nOWNER INSTRUCTIONS (HIGHEST PRIORITY — follow exactly, override defaults if they conflict):\n${String(bp.ai_instructions).trim()}`;
  }

  // BUSINESS DNA — structured profile generated from name/description/website/socials.
  // Always injected when present; it sets identity, audience, voice, sales style, and reply length.
  const dna = bp.business_dna && typeof bp.business_dna === "object" ? bp.business_dna as any : null;
  if (dna) {
    const arr = (v: any): string => Array.isArray(v) ? v.filter(Boolean).map((s) => `  • ${String(s).trim()}`).join("\n") : "";
    const dnaLines: string[] = [];
    if (dna.industry) dnaLines.push(`▸ Industry: ${dna.industry}`);
    if (dna.target_audience) dnaLines.push(`▸ Target audience: ${dna.target_audience}`);
    if (dna.communication_style) dnaLines.push(`▸ Communication style (MATCH this voice): ${dna.communication_style}`);
    if (dna.sales_style) dnaLines.push(`▸ Sales style: ${dna.sales_style}`);
    if (dna.preferred_reply_length) dnaLines.push(`▸ Preferred reply length: ${dna.preferred_reply_length}`);
    if (Array.isArray(dna.main_services) && dna.main_services.length) dnaLines.push(`▸ Main services:\n${arr(dna.main_services)}`);
    if (Array.isArray(dna.trust_signals) && dna.trust_signals.length) dnaLines.push(`▸ Trust signals (use to reassure when relevant):\n${arr(dna.trust_signals)}`);
    if (Array.isArray(dna.typical_questions) && dna.typical_questions.length) dnaLines.push(`▸ Typical customer questions (anticipate):\n${arr(dna.typical_questions)}`);
    if (Array.isArray(dna.common_objections) && dna.common_objections.length) dnaLines.push(`▸ Common objections (be ready to address):\n${arr(dna.common_objections)}`);
    if (dnaLines.length) {
      block += `\n\nBUSINESS DNA (deep brand profile — apply implicitly to voice, framing, and assumptions; never quote verbatim):\n${dnaLines.join("\n")}`;
    }
  }

  return block;
}

// --- System prompt: deep context understanding + human-like answers ---------
const SYSTEM_PROMPT = `You are a HIGHLY EXPERIENCED human customer-service representative replying on behalf of a small business (often a medical lab, clinic, home-visit service, or similar). The customer must NEVER suspect AI involvement. Your job is NOT to paraphrase the customer — it is to UNDERSTAND their real situation and ANSWER their real questions like a senior agent would.

═══════════════════════════════════════
ABSOLUTE PRIORITY ORDER
  1. Deep understanding of the customer's real situation (silent analysis)
  2. A human-sounding reply that ANSWERS the actual questions and addresses the real worry
  3. Operational facts (use what is given; never invent what isn't)
  4. Classification / analysis fields (lowest priority — must never bend the reply)
═══════════════════════════════════════

STEP 1 — SILENT DEEP ANALYSIS (never shown verbatim in the reply)
Before writing anything, silently extract:
  • customer_intent        — one short phrase ("اطمئنان على نتيجة + استفسار عن رسوم").
  • messageType            — inquiry | complaint | followUp | request | objection | greeting | comparison | negotiation.
  • customer_questions     — EVERY EXPLICIT question literally in the message. If 4 question marks → 4 entries. Never merge.
  • implicit_questions     — questions the customer DIDN'T ask out loud but clearly needs answered ("متى أعرف؟", "هل سأدفع تاني؟", "هل في مشكلة؟").
  • customer_concerns      — underlying worries (delay, cost, sample problem, safety, missing appointment, trust…).
  • customer_context       — concrete circumstances (appointment tomorrow, traveling, deadline, has kids waiting…).
  • known_facts            — facts you can CONFIRM right now because they appear in BUSINESS FACTS / VERIFIED FACTS / OPERATIONAL CONTEXT.
  • unknown_facts          — things the customer asked about that are NOT in any provided context. These must be acknowledged honestly, not invented and not silently skipped.
  • detected_emotion       — concerned | frustrated | angry | confused | urgent | curious | calm | neutral | interested.
  • detected_dialect       — egyptian | gulf | levantine | formal_msa | english | other.
  • buying_stage           — awareness | consideration | comparison | intent | decision | post_purchase | support. Pick the stage that matches the message RIGHT NOW (e.g. "كم السعر؟" + ready language = intent/decision; "إيه الفرق بينكم وبين X" = comparison; "متى تنزل نتيجتي" = post_purchase/support).
  • purchase_probability   — integer 0-100. Calibrate honestly from signals: urgency, explicit buying language, objections being resolved, follow-up readiness, payment/booking questions. A pure complaint or vague inquiry is usually <30. A clear "أبغى أحجز الآن / how do I pay" is 80+.

STRATEGIC USE OF STAGE + PROBABILITY (must shape the reply, never mentioned to the customer):
  • awareness/consideration → educate + build trust, no closing pressure.
  • comparison → name your differentiators concretely, address the alternative implicitly.
  • intent → remove the last friction, offer a clear path to act.
  • decision → close warmly with the exact next step (booking / payment / scheduling).
  • post_purchase/support → reassure, give concrete status framing, set expectation for resolution.
  • purchase_probability ≥ 70 → directClosing reply should explicitly invite the next concrete action.
  • purchase_probability ≤ 30 → soft reply leads; avoid any pressure language.

STEP 2 — WRITE THE REPLY (the only thing the customer will read)
HARD RULES (violation = failure):
  A. DO NOT paraphrase or repeat the customer's message back to them. Skip restating what they already know.
  B. ANSWER every customer_question AND every implicit_question — ONE-BY-ONE, EXPLICITLY. Skipping any = failure. Merging 4 questions into one vague sentence = failure.
  C. Start by addressing the BIGGEST worry first.
  D. For each known_fact → state it confidently and concretely.
  E. SUBSTANCE-FIRST RULE (critical — fixes the #1 failure mode): For EVERY question, give a real, useful, substantive answer using your professional domain knowledge as a senior agent in this business type — EVEN IF exact case data is missing. ONLY THEN ask for the specific missing piece needed to finalize.
     • FORBIDDEN: deferring a whole question with "هنتأكد ونرجعلك" / "we'll check and get back" without any real content. This is the #1 thing that makes you sound like a scared bot.
     • REQUIRED PATTERN per question: [general expert answer of how it normally works] + [the one specific thing we still need from the customer OR will confirm].
     • Example — "هل لازم صيام لكل التحاليل؟":
       BAD ❌: "هنتأكد من التحاليل المطلوبة ونرجعلك"
       GOOD ✅: "الصيام مش مطلوب لكل التحاليل — في تحاليل بتحتاج صيام 8–12 ساعة (زي السكر الصايم والدهون) وفي تحاليل ملهاش علاقة بالأكل. ابعتيلنا أسماء التحاليل وهنأكدلك أي واحدة محتاجة صيام."
     • Example — "هل النتائج تنزل كلها مع بعض؟":
       BAD ❌: "هنبلغك بمواعيد النتائج"
       GOOD ✅: "النتائج عادةً مبتنزلش في نفس اللحظة — كل تحليل ليه مدة معالجة مختلفة، البسيط بيظهر أسرع والمتخصص بياخد وقت أطول، وكل نتيجة بتتحدّث أول ما تخلص."
  F. End with ONE clear concrete next step. No vague "we'll get back to you" without a hook.
  G. Acknowledge the detected_emotion in ONE short natural beat — never a paragraph, never corporate.
  H. NEVER assume any item listed under NEVER ASSUME. NEVER use any item under FORBIDDEN PHRASES.
  I. NO-FEAR RULE: Act like a confident senior agent, NOT a nervous lawyer. Generic professional knowledge about how things normally work in this field is ALLOWED and EXPECTED — that is NOT "inventing". What IS forbidden is fabricating SPECIFIC case data (this customer's fee, this customer's exact result, this customer's sample status). Know the difference.
  J. EXPERT KNOWLEDGE RULE — the explicit line you must never cross:
     ✅ ALLOWED — general domain knowledge about how the FIELD works (procedures, policies, concepts):
        • "الصيام لبعض التحاليل يعتمد على نوع الفحص."
        • "بعض النتائج قد تستغرق وقتاً أطول من غيرها حسب نوع التحليل."
        • "تعليمات التحضير بتختلف حسب نوع التحليل."
        • "بشكل عام، الزيارات المنزلية بيتم تأكيدها قبل الوصول."
     ❌ FORBIDDEN — applying general knowledge to THIS customer's specific case, sample, result, order, or appointment unless the fact appears in OPERATIONAL CONTEXT / VERIFIED FACTS / BUSINESS FACTS:
        • ❌ "تحاليل والدتك تحتاج صيام" (لا تعرف أي تحاليل)
        • ❌ "نتيجتك هتنزل خلال ساعتين" (لا تعرف الحالة)
        • ❌ "المندوب بتاعك هيتصل الساعة 7" (لا تعرف جدوله)
        • ❌ "موعدك يقدر يتعدل لـ 10 صباحاً" (لا تعرف التوفر)
     RULE OF THUMB: Every sentence must be classifiable as either (general field knowledge) OR (verified case fact from provided context). If it's neither, do NOT say it — instead, give the general-knowledge framing and ask for the missing case-specific detail.



LANGUAGE & DIALECT MATCHING (critical)
Mirror the customer EXACTLY:
  • Egyptian markers (ازاي، إزاي، عايز، عاوز، بكام، فين، إمتى، دلوقتي، حضرتك، لسه، بس) → reply in natural Egyptian Arabic. Use "هنتابع، هنراجع، هنرجع لحضرتك، هنأكد، تمام، ماشي، طب".
  • Gulf markers (وش، كيف، متى، الحين، أبغى، أبي، تكفى) → natural Gulf Arabic.
  • Levantine markers (شو، كيف، هلق، بدي، عم) → natural Levantine.
  • Formal/MSA wording → professional formal Arabic.
  • English → English (match casual vs formal register).
NEVER auto-default to MSA when the customer wrote in a dialect.
On NON-EMAIL platforms (especially WhatsApp), these are BANNED in any dialect reply: "نفيدكم، نحيطكم علماً، سيتم إفادتكم، نشكر تواصلكم، يرجى العلم، تفضلوا بقبول فائق الاحترام". Replace with: "هنتابع، هنراجع، هنرجع لحضرتك، هنتأكد، تمام يا فندم". English bans: "Thank you for reaching out", "I understand your concern", "Rest assured", "We strive to".

OPERATIONAL CONTEXT (when provided)
A block titled "OPERATIONAL CONTEXT (live case data)" may appear. Treat each line as ground truth for THIS specific case (order status, delay reason, sample status, redraw needed?, fees, expected update time, lab notes). USE these facts directly and concretely. If a field is absent it is UNKNOWN — never guess, never imply a problem, never promise a fee or timeline.

CONTEXT PRIORITY (highest → lowest)
  1. OWNER INSTRUCTIONS
  2. CUSTOMER SERVICE RULES (VERIFIED FACTS, NEVER ASSUME, FORBIDDEN PHRASES — hard constraints)
  3. OPERATIONAL CONTEXT (live case data)
  4. BUSINESS FACTS
  5. User-provided platform / goal / tone
  6. The customer message itself
  7. Internal extraction

PLATFORM RULES
  • whatsapp: conversational, like an employee texting from their phone. 2–4 short sentences, 0–1 emoji, NO corporate phrases.
  • messenger: friendly, 2–5 short sentences, 0–1 emoji.
  • instagram: friendly + engaging, 2–4 sentences, 0–2 emojis.
  • email: formal, 3–6 sentences, greeting + sign-off, NO emojis. Email is the ONLY place where "نشكركم على تواصلكم" / "يرجى العلم" are acceptable.
  • chat: short and conversational, 0–1 emoji.

MEDICAL / LAB / HEALTHCARE SAFETY (mandatory when relevant)
  • Never invent: results, sample issues, causes of delay, fees, redraw needs, exact timing.
  • Safe wording for delays: "النتيجة لسه تحت المراجعة للتأكد من دقتها قبل اعتمادها"؛ "We're carefully reviewing the result before releasing it".
  • FORBIDDEN: "في مشكلة في العينة"، "there's an issue with your sample" — never assert.
  • Fee questions when policy unknown: acknowledge worry + commit to confirming the EXACT cost BEFORE any charge; never invent and never promise "free".
  • Appointment urgency: explicitly acknowledge the deadline + propose a concrete next step.

3 REPLY STYLES — same intent, GENUINELY different energy. Each must start with different words and pass the self-check.
  • soft: empathetic, low pressure, warm.
  • persuasive: confident, value-focused, gentle push toward the goal.
  • directClosing: warm but names the exact next step clearly.

MANDATORY SELF-CHECK before returning EACH of the 3 replies — silently rewrite ONCE if any answer is NO:
  1. Did I avoid paraphrasing or repeating the customer's message?
  2. Did I answer EVERY customer_question + implicit_question with SUBSTANCE (not a deferral)? Count: if customer asked N questions, reply must contain N distinct substantive answers.
  3. For each question, did I give the "how it normally works" expert answer BEFORE asking for missing info?
  4. Did I address the biggest worry FIRST?
  5. Did I state known_facts confidently? Did I avoid fabricating SPECIFIC case data?
  6. Did I avoid every NEVER-ASSUME and every FORBIDDEN PHRASE?
  7. Does it sound like a real human in the customer's exact dialect?
  8. Did I include ONE concrete next step?
  9. Does it fit the platform's length + emoji rules?

OUTPUT: JSON only, matching the provided schema. No markdown, no labels, no chain-of-thought.`;




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
    const { platform, businessType, replyGoal, tone, customerMessage, language, debug, operationalContext } = body ?? {};
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Run usage check + business profile + RAG + memory layer in parallel.
    // Single embedding call is shared between RAG (knowledge) and similar past
    // replies (feedback learning) — no extra AI calls.
    const tParallel = performance.now();

    const tEmbed = performance.now();
    const embedPromise: Promise<number[] | null> = (async () => {
      if (!LOVABLE_API_KEY) return null;
      try {
        const er = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-embedding-001",
            input: customerMessage.slice(0, 2000),
            dimensions: 1536,
          }),
        });
        if (!er.ok) {
          console.log(`[gen ${reqId}] embed_skip status=${er.status}`);
          return null;
        }
        const ed = await er.json();
        console.log(`[gen ${reqId}] embed: ${(performance.now() - tEmbed).toFixed(0)}ms`);
        return ed?.data?.[0]?.embedding ?? null;
      } catch (e) {
        console.log(`[gen ${reqId}] embed_error: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    })();

    // RAG knowledge chunks (top 5 above 0.35 similarity)
    const ragPromise = (async (): Promise<string> => {
      const vec = await embedPromise;
      if (!vec) return "";
      try {
        const { data: matches, error } = await admin.rpc("match_knowledge", {
          _user_id: userId,
          _query_embedding: vec,
          _match_count: 5,
        });
        if (error || !matches?.length) return "";
        const good = (matches as any[]).filter((m) => (m.similarity ?? 0) > 0.35);
        if (!good.length) return "";
        const lines = good.slice(0, 5).map((m, i) => `[${i + 1}] ${String(m.content).slice(0, 600)}`);
        return `\n\nRETRIEVED KNOWLEDGE (top matches from this business's uploaded docs — authoritative, never contradict, never invent beyond these):\n${lines.join("\n")}`;
      } catch (e) {
        console.log(`[gen ${reqId}] rag_error: ${e instanceof Error ? e.message : e}`);
        return "";
      }
    })();

    // Top-2 similar past replies that THIS user actually adopted (style ref)
    const similarPromise = (async (): Promise<string> => {
      const vec = await embedPromise;
      if (!vec) return "";
      try {
        const { data: matches, error } = await admin.rpc("match_successful_replies", {
          _user_id: userId,
          _query_embedding: vec,
          _match_count: 2,
        });
        if (error || !matches?.length) return "";
        const good = (matches as any[]).filter((m) => (m.similarity ?? 0) > 0.55);
        if (!good.length) return "";
        const lines = good.map((m: any, i: number) =>
          `[Example ${i + 1}]\nCustomer wrote: ${String(m.customer_message).slice(0, 280)}\nApproved reply: ${String(m.reply_text).slice(0, 400)}`,
        );
        return `\n\nSIMILAR PAST REPLIES THIS USER ALREADY ADOPTED (style + structure reference — DO NOT copy verbatim, MATCH the voice):\n${lines.join("\n\n")}`;
      } catch (e) {
        console.log(`[gen ${reqId}] similar_error: ${e instanceof Error ? e.message : e}`);
        return "";
      }
    })();

    // Lightweight style memory (one row per user, O(1))
    const stylePromise = (async (): Promise<string> => {
      try {
        const { data } = await admin
          .from("user_style_signals")
          .select("preferred_phrases,avoided_phrases,avg_reply_length,sample_count")
          .eq("user_id", userId)
          .maybeSingle();
        if (!data || (data.sample_count ?? 0) < 3) return "";
        const pref = Array.isArray(data.preferred_phrases) ? (data.preferred_phrases as string[]).slice(-6) : [];
        const avoid = Array.isArray(data.avoided_phrases) ? (data.avoided_phrases as string[]).slice(-6) : [];
        const parts: string[] = [];
        if (pref.length) parts.push(`Preferred wordings (favor this voice):\n${pref.map((p) => `• "${p}"`).join("\n")}`);
        if (avoid.length) parts.push(`Avoided wordings (this user removed these — DO NOT use):\n${avoid.map((p) => `• "${p}"`).join("\n")}`);
        if (data.avg_reply_length) parts.push(`Typical reply length: ~${data.avg_reply_length} chars.`);
        if (!parts.length) return "";
        return `\n\nUSER STYLE MEMORY (learned from this user's adopted replies — apply naturally, never mention):\n${parts.join("\n\n")}`;
      } catch (e) {
        console.log(`[gen ${reqId}] style_error: ${e instanceof Error ? e.message : e}`);
        return "";
      }
    })();

    const [usageRes, bpRes, ragBlock, similarBlock, styleBlock] = await Promise.all([
      admin.rpc("consume_reply_credit", { _user_id: userId }),
      admin.from("business_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ragPromise,
      similarPromise,
      stylePromise,
    ]);
    mark("usage+profile+rag+memory(parallel)", tParallel);

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
    const businessContext = buildBusinessContext(bp, customerMessage) + (ragBlock || "") + (similarBlock || "") + (styleBlock || "");

    // OPERATIONAL CONTEXT — optional live case data passed by the client.
    // Accept either a string or an object of key/value pairs.
    let operationalBlock = "";
    if (operationalContext) {
      if (typeof operationalContext === "string" && operationalContext.trim()) {
        operationalBlock = `\n\nOPERATIONAL CONTEXT (live case data — authoritative for THIS case, never invent missing fields):\n${operationalContext.trim()}`;
      } else if (typeof operationalContext === "object") {
        const ocLines = Object.entries(operationalContext)
          .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
          .map(([k, v]) => `- ${k}: ${String(v).trim()}`);
        if (ocLines.length) {
          operationalBlock = `\n\nOPERATIONAL CONTEXT (live case data — authoritative for THIS case, never invent missing fields):\n${ocLines.join("\n")}`;
        }
      }
    }

    const userPrompt = `Platform: ${platform || "chat"}
Business Type: ${businessType || bp?.business_type || "general"}
Goal: ${replyGoal || "help customer move forward"}
Tone: ${tone || bp?.preferred_tone || "professional"}
Interface Language (for followUp/customerIntent only): ${language || "en"}

${businessContext}${operationalBlock}

CUSTOMER MESSAGE (reply in this language + dialect — do NOT paraphrase it back):
"""${customerMessage}"""

TASK:
1. Silently run STEP 1 (deep analysis) — fill customer_questions, implicit_questions, customer_concerns, customer_context, known_facts, unknown_facts.
2. Write 3 replies that ANSWER every explicit + implicit question, address the biggest worry first, state known_facts confidently, acknowledge unknown_facts honestly (never invent fees/timelines/causes/sample issues), and end with ONE concrete next step.
3. Run the self-check; silently rewrite once if any item fails.
4. Return JSON matching the schema. No paraphrasing, no chain-of-thought, no markdown.`;

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        customer_questions: {
          type: "array",
          description: "EVERY explicit question literally in the message, in the customer's language. One entry per question mark. Empty array if none.",
          items: { type: "string" },
          maxItems: 8,
        },
        implicit_questions: {
          type: "array",
          description: "Questions the customer did NOT ask aloud but clearly needs answered. 0-5 items, in their language.",
          items: { type: "string" },
          maxItems: 5,
        },
        customer_concerns: {
          type: "array",
          description: "1-5 short underlying worries in the customer's language, max 6 words each.",
          items: { type: "string" },
          minItems: 1,
          maxItems: 5,
        },
        customer_context: {
          type: "array",
          description: "Concrete circumstances mentioned (appointment tomorrow, deadline, traveling…). Empty if none.",
          items: { type: "string" },
          maxItems: 5,
        },
        known_facts: {
          type: "array",
          description: "Facts you can confirm now because they appear in BUSINESS FACTS / VERIFIED FACTS / OPERATIONAL CONTEXT. Each short, in the customer's language. Empty if none.",
          items: { type: "string" },
          maxItems: 6,
        },
        unknown_facts: {
          type: "array",
          description: "Things the customer asked about that are NOT in any provided context (must be acknowledged honestly, never invented). Empty if everything is known.",
          items: { type: "string" },
          maxItems: 6,
        },
        classification: {
          type: "object",
          additionalProperties: false,
          properties: {
            messageType: { type: "string", enum: ["objection", "inquiry", "complaint", "followUp", "greeting", "request", "comparison", "negotiation"] },
            customerIntent: { type: "string" },
            objectionType: { type: "string", enum: ["price", "hesitation", "comparison", "discount", "trust", "timing", "none"] },
            buyingStage: { type: "string", enum: ["awareness", "consideration", "comparison", "intent", "decision", "post_purchase", "support"], description: "Where the customer sits in the buying journey RIGHT NOW based on their message." },
            purchaseProbability: { type: "integer", minimum: 0, maximum: 100, description: "Estimated probability (0-100) this customer will purchase / convert soon, based on intent, urgency, objections, and stage signals." },
            detectedLanguage: { type: "string", enum: ["ar", "en"] },
            detectedDialect: { type: "string", enum: ["egyptian", "gulf", "levantine", "formal_msa", "english", "other"] },
            detectedEmotion: { type: "string", enum: ["angry", "confused", "interested", "curious", "excited", "disappointed", "skeptical", "neutral", "concerned", "frustrated", "urgent", "calm"] },
          },
          required: ["messageType", "customerIntent", "objectionType", "buyingStage", "purchaseProbability", "detectedLanguage", "detectedDialect", "detectedEmotion"],
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
      required: ["customer_questions", "implicit_questions", "customer_concerns", "customer_context", "known_facts", "unknown_facts", "classification", "replies", "leadTemperature", "followUp", "objection_analysis"],
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

    const buildBody = (model: string) => JSON.stringify({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.65,
      top_p: 0.9,
      max_output_tokens: 1100,
      text: { format: { type: "json_schema", name: "generate_reply", strict: true, schema } },
    });

    const callOpenAI = async (model: string, timeoutMs: number) => {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      const tCall = performance.now();
      const reqBody = buildBody(model);
      console.log(`[gen ${reqId}] openai(${model}) START body_bytes=${reqBody.length} timeout=${timeoutMs}ms`);
      try {
        const response = await fetch(OPENAI_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: reqBody,
        });
        const dur = performance.now() - tCall;
        console.log(`[gen ${reqId}] openai(${model}) RESPONSE status=${response.status} duration=${dur.toFixed(0)}ms`);
        return { ok: true as const, response, duration: dur };
      } catch (error) {
        const dur = performance.now() - tCall;
        const aborted = (error as any)?.name === "AbortError";
        console.error(`[gen ${reqId}] openai(${model}) ${aborted ? "TIMEOUT" : "NETWORK_ERROR"} after ${dur.toFixed(0)}ms err=${(error as any)?.message || error}`);
        return { ok: false as const, aborted, error, duration: dur };
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
    const usageInfo = data?.usage ?? {};
    console.log(`[gen ${reqId}] openai_usage input_tokens=${usageInfo.input_tokens ?? "?"} output_tokens=${usageInfo.output_tokens ?? "?"} total_tokens=${usageInfo.total_tokens ?? "?"}`);
    let outputText: string | undefined = data.output_text;
    if (!outputText && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item?.type === "message" && Array.isArray(item.content)) {
          for (const c of item.content) if (typeof c?.text === "string") { outputText = c.text; break; }
        }
        if (outputText) break;
      }
    }
    if (!outputText) {
      console.error(`[gen ${reqId}] no_output_text data_keys=${Object.keys(data).join(",")}`);
      return json({ error: "AI did not return structured output" }, 500);
    }

    let result;
    try { result = JSON.parse(outputText); }
    catch { return json({ error: "AI returned invalid JSON" }, 500); }
    mark("parse", tParse);
    const totalMs = performance.now() - t0;
    console.log(`[gen ${reqId}] DONE total=${totalMs.toFixed(0)}ms model=${usedModel} output_chars=${outputText.length} input_tokens=${usageInfo.input_tokens ?? "?"} output_tokens=${usageInfo.output_tokens ?? "?"}`);

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
