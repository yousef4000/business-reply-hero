// Verifies a Google Play purchase token and activates the user's plan.
// TODO: Wire to Google Play Developer API for real server-side verification
// using a service account JSON stored as GOOGLE_PLAY_SERVICE_ACCOUNT secret.
// Until then, this endpoint records the purchase as PENDING-VERIFICATION
// and DOES NOT auto-activate paid plans.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PRODUCT_TO_PLAN: Record<string, "starter" | "pro" | "business"> = {
  starter_monthly: "starter",
  pro_monthly: "pro",
  business_monthly: "business",
};

interface VerifyBody {
  productId: string;
  purchaseToken: string;
  orderId?: string;
  purchaseTime?: number; // ms since epoch
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as VerifyBody;
    if (!body?.productId || !body?.purchaseToken) {
      return new Response(JSON.stringify({ error: "INVALID_BODY" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = PRODUCT_TO_PLAN[body.productId];
    if (!plan) {
      return new Response(JSON.stringify({ error: "UNKNOWN_PRODUCT" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ─────────────────────────────────────────────────────────────
    // TODO(real verification): Call Google Play Developer API
    //   GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/purchases/subscriptions/{subscriptionId}/tokens/{token}
    // using a service-account JWT. Validate paymentState === 1 (received)
    // and expiryTimeMillis is in the future before activating.
    //
    // For now we only RECORD the purchase as 'pending' so an admin or a
    // future verification job can activate it. We DO NOT upgrade the plan.
    // ─────────────────────────────────────────────────────────────
    const SERVICE_ACCOUNT = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT");
    const verified = false; // flip to true once real verification lands

    const purchaseTime = body.purchaseTime
      ? new Date(body.purchaseTime).toISOString()
      : new Date().toISOString();

    if (!verified) {
      // Just log it for traceability
      await admin.from("play_purchases").upsert(
        {
          user_id: user.id,
          plan,
          product_id: body.productId,
          purchase_token: body.purchaseToken,
          order_id: body.orderId ?? null,
          purchase_time: purchaseTime,
          status: "pending",
          raw: { note: "awaiting server-side verification" } as any,
        },
        { onConflict: "purchase_token" },
      );

      return new Response(
        JSON.stringify({
          ok: false,
          status: "pending",
          message:
            "Purchase recorded. Server-side verification is not yet configured.",
        }),
        {
          status: 202,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // When real verification is enabled, call the helper:
    const expiry = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
    const { error: rpcErr } = await admin.rpc("apply_verified_purchase", {
      _user_id: user.id,
      _plan: plan,
      _product_id: body.productId,
      _purchase_token: body.purchaseToken,
      _order_id: body.orderId ?? null,
      _purchase_time: purchaseTime,
      _expiry_time: expiry,
      _auto_renewing: true,
      _raw: { verifiedBy: "google-play-api" } as any,
    });
    if (rpcErr) throw rpcErr;

    return new Response(JSON.stringify({ ok: true, status: "active", plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-play-purchase error", e);
    return new Response(
      JSON.stringify({ error: e?.message || "INTERNAL_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
