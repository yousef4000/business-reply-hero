// Shared Lemon Squeezy helpers. All secrets stay server-side.
export type PaidPlan = "starter" | "pro" | "business";

export const LEMON_API = "https://api.lemonsqueezy.com/v1";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function variantIdFor(plan: PaidPlan): string | null {
  const map: Record<PaidPlan, string> = {
    starter: Deno.env.get("LEMON_STARTER_VARIANT_ID") ?? "",
    pro: Deno.env.get("LEMON_PRO_VARIANT_ID") ?? "",
    business: Deno.env.get("LEMON_BUSINESS_VARIANT_ID") ?? "",
  };
  return map[plan] || null;
}

export function planForVariant(variantId: string | number | null): PaidPlan | null {
  if (variantId === null || variantId === undefined) return null;
  const v = String(variantId);
  if (v === (Deno.env.get("LEMON_STARTER_VARIANT_ID") ?? "")) return "starter";
  if (v === (Deno.env.get("LEMON_PRO_VARIANT_ID") ?? "")) return "pro";
  if (v === (Deno.env.get("LEMON_BUSINESS_VARIANT_ID") ?? "")) return "business";
  return null;
}

export async function lemonFetch(path: string, init: RequestInit = {}) {
  const key = Deno.env.get("LEMON_SQUEEZY_API_KEY");
  if (!key) throw new Error("LEMON_SQUEEZY_API_KEY not configured");
  const res = await fetch(`${LEMON_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Never log the payload/keys — only status and a short, safe message.
    throw new Error(`Lemon Squeezy API error (${res.status})`);
  }
  return await res.json();
}

/** Timing-safe HMAC-SHA256 hex signature check of the raw request body. */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = Deno.env.get("LEMON_SQUEEZY_WEBHOOK_SECRET");
  if (!secret || !signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const given = signatureHeader.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}
