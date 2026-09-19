// Returns the Lemon Squeezy customer portal URL for the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json, lemonFetch } from "../_shared/lemon.ts";

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
    if (cErr || !userId) return json({ error: "UNAUTHENTICATED" }, 401);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("provider_subscription_id, customer_portal_url, update_payment_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub?.provider_subscription_id && !sub?.customer_portal_url) {
      return json({ error: "NO_SUBSCRIPTION" }, 404);
    }

    // Portal links are signed and short-lived — always refresh when we can.
    if (sub?.provider_subscription_id) {
      try {
        const res = await lemonFetch(
          `/subscriptions/${sub.provider_subscription_id}`,
        );
        const urls = res?.data?.attributes?.urls ?? {};
        const fresh = urls.customer_portal ?? sub.customer_portal_url;
        if (fresh) return json({ url: fresh });
      } catch (e) {
        console.error("portal refresh failed:", e instanceof Error ? e.message : e);
      }
    }

    if (sub?.customer_portal_url) return json({ url: sub.customer_portal_url });
    return json({ error: "PORTAL_UNAVAILABLE" }, 502);
  } catch (e) {
    console.error("get-lemon-portal error:", e instanceof Error ? e.message : e);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
