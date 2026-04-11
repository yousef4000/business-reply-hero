import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { platform, businessType, replyGoal, tone, customerMessage, language, businessProfile } = await req.json();

    if (!customerMessage?.trim()) {
      return new Response(JSON.stringify({ error: "Customer message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
                      messageType: {
                        type: "string",
                        enum: ["objection", "inquiry", "complaint", "followUp", "greeting", "request", "comparison", "negotiation"],
                        description: "Type of customer message",
                      },
                      customerIntent: {
                        type: "string",
                        description: "What the customer actually wants (1 sentence)",
                      },
                      objectionType: {
                        type: "string",
                        enum: ["price", "hesitation", "comparison", "discount", "trust", "timing", "none"],
                        description: "Type of objection if present",
                      },
                    },
                    required: ["messageType", "customerIntent", "objectionType"],
                  },
                  replies: {
                    type: "object",
                    properties: {
                      soft: {
                        type: "string",
                        description: "Empathetic, understanding approach. Acknowledges concern gently, builds rapport.",
                      },
                      persuasive: {
                        type: "string",
                        description: "Value-focused, reframes the objection, uses social proof or urgency.",
                      },
                      directClosing: {
                        type: "string",
                        description: "Confident, action-oriented. Pushes toward a decision with a clear CTA.",
                      },
                    },
                    required: ["soft", "persuasive", "directClosing"],
                  },
                  leadTemperature: {
                    type: "string",
                    enum: ["hot", "warm", "cold"],
                    description: "How likely this lead is to convert based on the message",
                  },
                  followUp: {
                    type: "string",
                    description: "Suggested follow-up action for the business owner (1 sentence, in the interface language)",
                  },
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
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI did not return structured output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-reply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
