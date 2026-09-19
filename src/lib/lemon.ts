// Lemon Squeezy billing client. All API keys/variant IDs live server-side
// in the edge functions — nothing sensitive is referenced here.
import { supabase } from "@/integrations/supabase/client";

export type PaidPlan = "starter" | "pro" | "business";

export const PLAN_REPLY_LIMITS: Record<PaidPlan, number> = {
  starter: 150,
  pro: 500,
  business: 2000,
};

export const PLAN_PRICES: Record<PaidPlan, string> = {
  starter: "$5",
  pro: "$12",
  business: "$25",
};

export type CheckoutResult =
  | { status: "redirecting" }
  | { status: "unauthenticated" }
  | { status: "not_configured" }
  | { status: "error"; message: string };

async function invoke<T>(fn: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    // Surface the function's own error code when present.
    const ctx: any = (error as any).context;
    let code = error.message;
    try {
      const parsed = await ctx?.json?.();
      if (parsed?.error) code = parsed.error;
    } catch { /* ignore */ }
    throw new Error(code);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

/** Opens the Lemon Squeezy hosted checkout for a paid plan. */
export async function startCheckout(plan: PaidPlan): Promise<CheckoutResult> {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { status: "unauthenticated" };
  try {
    const { url } = await invoke<{ url: string }>("create-lemon-checkout", { plan });
    if (!url) return { status: "error", message: "CHECKOUT_FAILED" };
    window.location.href = url;
    return { status: "redirecting" };
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (/BILLING_NOT_CONFIGURED/.test(msg)) return { status: "not_configured" };
    if (/UNAUTHENTICATED/.test(msg)) return { status: "unauthenticated" };
    return { status: "error", message: msg };
  }
}

/** Opens the Lemon Squeezy customer portal (manage/cancel subscription). */
export async function openBillingPortal(): Promise<
  { status: "opened" } | { status: "none" } | { status: "error"; message: string }
> {
  try {
    const { url } = await invoke<{ url: string }>("get-lemon-portal");
    if (!url) return { status: "error", message: "PORTAL_UNAVAILABLE" };
    window.open(url, "_blank", "noopener,noreferrer");
    return { status: "opened" };
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (/NO_SUBSCRIPTION/.test(msg)) return { status: "none" };
    return { status: "error", message: msg };
  }
}

export interface PlanInfo {
  plan: string;
  monthlyLimit: number;
  usedThisMonth: number;
  remaining: number;
  renewsAt: string | null;
  periodStart: string | null;
}

/** Fetches authoritative plan info (including renewal date) from the backend. */
export async function fetchPlanInfo(): Promise<PlanInfo | null> {
  try {
    const data = await invoke<{
      plan: string;
      monthlyLimit: number;
      usedThisMonth: number;
      remaining: number;
      renewsAt: string | null;
      periodStart: string | null;
    }>("me-plan");
    return {
      plan: data.plan,
      monthlyLimit: data.monthlyLimit,
      usedThisMonth: data.usedThisMonth,
      remaining: data.remaining,
      renewsAt: data.renewsAt,
      periodStart: data.periodStart,
    };
  } catch {
    return null;
  }
}
