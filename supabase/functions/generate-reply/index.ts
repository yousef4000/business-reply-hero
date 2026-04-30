import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GUEST_LIMIT = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return json({ error: "Server not configured" }, 500);
    }

    const body = await req.json();
    const {
      platform,
      businessType,
      replyGoal,
      tone,
      customerMessage,
      language,
      businessProfile,
      guestUsage,
    } = body ?? {};

    if (!customerMessage?.trim()) {
      return json({ error: "Customer message is required" }, 400);
    }

    // ----- Identify caller (authenticated user vs guest) -----
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

    // ----- Enforce limit -----
    let usedAfter: number;
    let planLimit: number;
    let planName: string;

    if (userId) {
      const { data, error } = await admin.rpc("consume_reply_credit", { _user_id: userId });
      if (error) {
        if ((error.message || "").includes("USAGE_LIMIT_REACHED")) {
          // Fetch status for context
          const { data: status } = await admin.rpc("get_usage_status", { _user_id: userId });
          const s = Array.isArray(status) ? status[0] : status;
          return json(
            {
              error: "USAGE_LIMIT_REACHED",
              code: "USAGE_LIMIT_REACHED",
              used: s?.used ?? null,
              limit: s?.plan_limit ?? null,
              plan: s?.plan ?? null,
            },
            403
          );
        }
        console.error("consume_reply_credit error:", error);
        return json({ error: "Failed to verify usage" }, 500);
      }
      const row = Array.isArray(data) ? data[0] : data;
      usedAfter = row?.used ?? 0;
      planLimit = row?.plan_limit ?? 15;
      planName = row?.plan ?? "free";
    } else {
      // Guest: client-attested counter (best-effort; hard cap on server)
      const guestUsed = Math.max(0, Number(guestUsage ?? 0));
      if (guestUsed >= GUEST_LIMIT) {
        return json(
          {
            error: "USAGE_LIMIT_REACHED",
            code: "GUEST_LIMIT_REACHED",
            used: guestUsed,
            limit: GUEST_LIMIT,
            plan: "guest",
          },
          403
        );
      }
      usedAfter = guestUsed + 1;
      planLimit = GUEST_LIMIT;
      planName = "guest";
    }

    // ----- Build prompt and call AI -----
    const systemPrompt = `You are an expert customer communication AI for small businesses. You specialize in writing high-converting, natural customer replies.

RULES:
- Reply ONLY in the language of the customer message. If the customer wrote in Arabic, reply in Arabic. If in English, reply in English.
- Keep replies SHORT (2-4 sentences max), natural, and conversational — like a real person texting.
- NEVER use generic filler like "Thank you for reaching out" or "We appreciate your interest."
- Address the customer's EXACT concern, objection, or question directly.
- Match the platform style: WhatsApp/Messenger = casual texting style with emojis. Email = slightly more structured. Instagram = brief and engaging.
- When handling objections (price, hesitation, comparison), use proven sales psychology: reframe value, create urgency, offer social proof, or suggest alternatives.
- The reply must serve the stated reply goal.`;

    const businessContext = businessProfile
      ? `\nBUSINESS CONTEXT:
- Business Name: ${businessProfile.businessName || "Not specified"}
- Services: ${businessProfile.services || "Not specified"}
- Pricing: ${businessProfile.pricing || "Not specified"}
- FAQs: ${businessProfile.faqs || "Not specified"}
- Working Hours: ${businessProfile.hours || "Not specified"}
- Policies: ${businessProfile.policies || "Not specified"}`
      : "";

    const userPrompt = `TASK: Analyze the customer message and generate 3 reply options.

INPUTS:
- Platform: ${platform || "General"}
- Business Type: ${businessType || "General business"}
- Reply Goal: ${replyGoal || "Help the customer"}
- Desired Tone: ${tone || "Professional"}
- Interface Language: ${language || "en"}
${businessContext}

CUSTOMER MESSAGE:
"${customerMessage}"

You must call the generate_reply function with your analysis and 3 reply options.`;

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_reply",
              description: "Generate classified customer reply options",
              parameters: {
                type: "object",
                properties: {
                  classification: {
                    type: "object",
                    properties: {
                      messageType: { type: "string", enum: ["objection", "inquiry", "complaint", "followUp", "greeting", "request", "comparison", "negotiation"] },
                      customerIntent: { type: "string" },
                      objectionType: { type: "string", enum: ["price", "hesitation", "comparison", "discount", "trust", "timing", "none"] },
                    },
                    required: ["messageType", "customerIntent", "objectionType"],
                  },
                  replies: {
                    type: "object",
                    properties: {
                      soft: { type: "string" },
                      persuasive: { type: "string" },
                      directClosing: { type: "string" },
                    },
                    required: ["soft", "persuasive", "directClosing"],
                  },
                  leadTemperature: { type: "string", enum: ["hot", "warm", "cold"] },
                  followUp: { type: "string" },
                },
                required: ["classification", "replies", "leadTemperature", "followUp"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_reply" } },
      }),
    });

    if (!response.ok) {
      // Refund the credit since AI call failed (only for logged-in users)
      if (userId) {
        await admin
          .from("usage_counters")
          .update({ replies_used: Math.max(0, usedAfter - 1) })
          .eq("user_id", userId);
      }
      if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again shortly." }, 429);
      if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return json({ error: "AI generation failed" }, 500);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return json({ error: "AI did not return structured output" }, 500);
    }

    const result = JSON.parse(toolCall.function.arguments);

    return json({
      ...result,
      usage: { used: usedAfter, limit: planLimit, plan: planName },
    });
  } catch (e) {
    console.error("generate-reply error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
