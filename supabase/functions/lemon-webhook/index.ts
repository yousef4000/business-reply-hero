// Lemon Squeezy webhook — verifies X-Signature, is idempotent, and syncs
// subscription state into public.subscriptions. Never logs secrets/payloads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, json, planForVariant } from "../_shared/lemon.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Reuse the shared verifier but keep raw body handling local.
import { verifySignature } from "../_shared/lemon.ts";

const PAID_STATUSES = ["on_trial", "active", "past_due", "cancelled"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const raw = await req.text();
  const signature = req.headers.get("X-Signature");

  if (!(await verifySignature(raw, signature))) {
    console.warn("lemon-webhook: invalid signature");
    return json({ error: "INVALID_SIGNATURE" }, 401);
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const eventName: string =
    body?.meta?.event_name ?? req.headers.get("X-Event-Name") ?? "unknown";
  // Signature is a deterministic hash of this exact payload → perfect event key.
  const eventKey = `${eventName}:${signature}`;

  // Idempotency: the unique (provider, event_key) constraint rejects replays.
  const { error: dupErr } = await admin
    .from("billing_webhook_events")
    .insert({ provider: "lemonsqueezy", event_key: eventKey, event_name: eventName });
  if (dupErr) {
    if (dupErr.code === "23505" || /duplicate key/i.test(dupErr.message)) {
      console.log(`lemon-webhook: duplicate event ignored (${eventName})`);
      return json({ ok: true, duplicate: true });
    }
    console.error("lemon-webhook: event log failed", dupErr.code ?? "");
    return json({ error: "LOG_FAILED" }, 500);
  }

  try {
    const attrs = body?.data?.attributes ?? {};
    const custom = body?.meta?.custom_data ?? {};
    let userId: string | null = custom?.user_id ?? null;

    const subscriptionId =
      body?.data?.type === "subscriptions" ? String(body?.data?.id ?? "") : null;
    const customerId = attrs?.customer_id ? String(attrs.customer_id) : null;

    // Fall back to an existing mapping when custom_data is missing.
    if (!userId && (subscriptionId || customerId)) {
      const q = admin.from("subscriptions").select("user_id").limit(1);
      const { data } = subscriptionId
        ? await q.eq("provider_subscription_id", subscriptionId)
        : await q.eq("provider_customer_id", customerId!);
      userId = data?.[0]?.user_id ?? null;
    }

    if (!userId) {
      console.warn(`lemon-webhook: no user match for ${eventName}`);
      return json({ ok: true, unmatched: true });
    }

    const variantPlan = planForVariant(attrs?.variant_id ?? null);
    const status: string = attrs?.status ?? "";
    const nowIso = new Date().toISOString();

    const base: Record<string, unknown> = {
      user_id: userId,
      provider: "lemonsqueezy",
      last_event_at: nowIso,
    };

    if (eventName === "order_created") {
      base.provider_order_id = String(body?.data?.id ?? "");
      if (customerId) base.provider_customer_id = customerId;
      if (attrs?.first_order_item?.product_id) {
        base.provider_product_id = String(attrs.first_order_item.product_id);
      }
    } else if (eventName.startsWith("subscription")) {
      if (subscriptionId) base.provider_subscription_id = subscriptionId;
      if (customerId) base.provider_customer_id = customerId;
      if (attrs?.product_id) base.provider_product_id = String(attrs.product_id);
      if (attrs?.variant_id) base.provider_variant_id = String(attrs.variant_id);
      base.provider_status = status || eventName;
      base.renews_at = attrs?.renews_at ?? null;
      base.ends_at = attrs?.ends_at ?? null;
      base.cancelled_at = attrs?.cancelled ? nowIso : null;
      base.update_payment_url = attrs?.urls?.update_payment_method ?? null;
      base.customer_portal_url = attrs?.urls?.customer_portal ?? null;

      const active = PAID_STATUSES.includes(status) &&
        !(status === "cancelled" && attrs?.ends_at &&
          new Date(attrs.ends_at).getTime() < Date.now());

      if (eventName === "subscription_expired" || status === "expired" || status === "unpaid") {
        // Access ends — drop back to no paid plan (trial state is evaluated by the DB).
        base.plan = "free";
      } else if (active && variantPlan) {
        base.plan = variantPlan;
        base.period_start = new Date(
          Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
        ).toISOString().slice(0, 10);
      }
    } else if (eventName === "subscription_payment_failed") {
      base.provider_status = "payment_failed";
    }

    const { error: upErr } = await admin
      .from("subscriptions")
      .upsert(base, { onConflict: "user_id" });
    if (upErr) {
      console.error("lemon-webhook: sync failed", upErr.code ?? upErr.message);
      return json({ error: "SYNC_FAILED" }, 500);
    }

    await admin
      .from("billing_webhook_events")
      .update({ user_id: userId })
      .eq("provider", "lemonsqueezy")
      .eq("event_key", eventKey);

    console.log(`lemon-webhook: processed ${eventName}`);
    return json({ ok: true });
  } catch (e) {
    console.error("lemon-webhook error:", e instanceof Error ? e.message : "unknown");
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
