// Google Play Billing wrapper — runs only on Android (Capacitor native).
// On web/PWA `isBillingAvailable()` returns false and the UI shows a
// "coming soon via Google Play" placeholder instead.
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type PaidPlan = "starter" | "pro" | "business";
export type BillingPeriod = "monthly" | "yearly";

// Centralized Product ID map. Edit here when Play Console SKUs change.
// Format: PLAY_PRODUCTS[plan][period] = "<sku>"
export const PLAY_PRODUCTS: Record<PaidPlan, Record<BillingPeriod, string>> = {
  starter: { monthly: "starter_monthly", yearly: "starter_yearly" },
  pro:     { monthly: "pro_monthly",     yearly: "pro_yearly" },
  business:{ monthly: "business_monthly",yearly: "business_yearly" },
};

export const productIdFor = (plan: PaidPlan, period: BillingPeriod = "monthly") =>
  PLAY_PRODUCTS[plan][period];

export const PLAN_REPLY_LIMITS: Record<PaidPlan, number> = {
  starter: 150,
  pro: 500,
  business: 2000,
};

export type PurchaseResult =
  | { status: "success"; plan: PaidPlan; productId: string }
  | { status: "pending"; productId: string }
  | { status: "cancelled" }
  | { status: "failed"; message: string }
  | { status: "unsupported" };

export const isBillingAvailable = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

async function loadPlugin(): Promise<any | null> {
  if (!isBillingAvailable()) return null;
  try {
    // Lazy import so web builds don't pull native code.
    // Variable + @vite-ignore prevents Rollup from statically resolving
    // this optional native-only plugin (which may not be installed and is
    // not compatible with our Capacitor 8 web build).
    const pkg = "@capgo/capacitor-purchases";
    const mod: any = await import(/* @vite-ignore */ pkg).catch(() => null);
    if (!mod) return null;
    return mod.CapacitorPurchases ?? mod.default ?? mod;
  } catch (e) {
    console.warn("[billing] plugin not available", e);
    return null;
  }
}

export async function getProducts(): Promise<
  Array<{ productId: string; price?: string; title?: string }>
> {
  const plugin = await loadPlugin();
  if (!plugin) return [];
  try {
    const ids = Object.values(PLAY_PRODUCTS).flatMap((p) => Object.values(p));
    const res = await plugin.getProducts?.({ productIdentifiers: ids });
    return res?.products ?? [];
  } catch (e) {
    console.warn("[billing] getProducts failed", e);
    return [];
  }
}

async function verifyOnBackend(
  productId: string,
  purchaseToken: string,
  orderId?: string,
  purchaseTime?: number,
) {
  const { data, error } = await supabase.functions.invoke(
    "verify-play-purchase",
    { body: { productId, purchaseToken, orderId, purchaseTime } },
  );
  if (error) throw error;
  return data as { ok: boolean; status: string; plan?: PaidPlan };
}

export async function purchasePlan(
  plan: PaidPlan,
  period: BillingPeriod = "monthly",
): Promise<PurchaseResult> {
  const plugin = await loadPlugin();
  if (!plugin) return { status: "unsupported" };

  const productId = productIdFor(plan, period);
  try {
    const res = await plugin.purchaseProduct?.({ productIdentifier: productId });
    // Plugin shapes vary — try common fields
    const tx = res?.transaction ?? res?.purchase ?? res ?? {};
    const purchaseToken: string | undefined =
      tx.purchaseToken ?? tx.transactionReceipt ?? tx.receipt;
    const orderId: string | undefined = tx.orderId ?? tx.transactionId;
    const purchaseTime: number | undefined =
      tx.purchaseTime ?? tx.transactionDate;

    if (!purchaseToken) {
      return { status: "failed", message: "Missing purchase token" };
    }

    const verify = await verifyOnBackend(
      productId,
      purchaseToken,
      orderId,
      purchaseTime,
    );

    if (verify.ok && verify.plan) {
      return { status: "success", plan: verify.plan, productId };
    }
    return { status: "pending", productId };
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    if (/cancel/i.test(msg) || /USER_CANCELED/i.test(msg)) {
      return { status: "cancelled" };
    }
    console.error("[billing] purchase failed", e);
    return { status: "failed", message: msg };
  }
}

export async function restorePurchases(): Promise<{
  restored: number;
  results: PurchaseResult[];
}> {
  const plugin = await loadPlugin();
  if (!plugin) return { restored: 0, results: [{ status: "unsupported" }] };

  try {
    const res = await plugin.restorePurchases?.();
    const txs: any[] = res?.purchases ?? res?.transactions ?? [];
    const results: PurchaseResult[] = [];
    let restored = 0;

    for (const tx of txs) {
      const productId: string =
        tx.productIdentifier ?? tx.productId ?? "";
      const token: string | undefined =
        tx.purchaseToken ?? tx.transactionReceipt;
      if (!productId || !token) continue;
      const verify = await verifyOnBackend(
        productId,
        token,
        tx.orderId,
        tx.purchaseTime,
      );
      if (verify.ok) {
        restored++;
        results.push({
          status: "success",
          plan: verify.plan!,
          productId,
        });
      } else {
        results.push({ status: "pending", productId });
      }
    }
    return { restored, results };
  } catch (e: any) {
    console.error("[billing] restore failed", e);
    return {
      restored: 0,
      results: [{ status: "failed", message: e?.message || "restore failed" }],
    };
  }
}
