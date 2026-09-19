// Creates a Lemon Squeezy hosted checkout for the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  json,
  lemonFetch,
  variantIdFor,
  type PaidPlan,
} from "../_shared/lemon.ts";

const PLANS: PaidPlan[] = ["starter", "pro", "business"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "UNAUTHENTICATED" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    const email = (claims?.claims as any)?.email as string | undefined;
    if (cErr || !userId) return json({ error: "UNAUTHENTICATED" }, 401);

    const body = await req.json().catch(() => ({}));
    const plan = String(body?.plan ?? "");
    if (!PLANS.includes(plan as PaidPlan)) {
      return json({ error: "INVALID_PLAN" }, 400);
    }

    const storeId = Deno.env.get("LEMON_SQUEEZY_STORE_ID");
    const variantId = variantIdFor(plan as PaidPlan);
    if (!storeId || !variantId) {
      return json({ error: "BILLING_NOT_CONFIGURED" }, 503);
    }

    const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
    const redirectUrl = appUrl
      ? `${appUrl}/app/settings?checkout=success`
      : undefined;

    const payload = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: email ?? undefined,
            custom: { user_id: userId },
          },
          product_options: redirectUrl
            ? { redirect_url: redirectUrl, enabled_variants: [Number(variantId)] }
            : { enabled_variants: [Number(variantId)] },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    };

    const res = await lemonFetch("/checkouts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const url = res?.data?.attributes?.url;
    if (!url) return json({ error: "CHECKOUT_FAILED" }, 502);

    return json({ url });
  } catch (e) {
    console.error("create-lemon-checkout error:", e instanceof Error ? e.message : e);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
