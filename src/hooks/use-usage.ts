import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const GUEST_KEY = "smartreply-guest-usage";
export const GUEST_LIMIT = 3;

export type PlanName = "free" | "starter" | "pro" | "business" | "guest";
export type PlanState = "trial" | "trial_expired" | "paid" | "guest";

export interface UsageStatus {
  used: number;
  limit: number;
  plan: PlanName;
  planState: PlanState;
  isGuest: boolean;
  loading: boolean;
  trialEndsAt: string | null;
  trialUsed: number;
  trialLimit: number;
}

export function getGuestUsage(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(GUEST_KEY) ?? 0));
  } catch {
    return 0;
  }
}

export function bumpGuestUsage(): number {
  const next = getGuestUsage() + 1;
  try { localStorage.setItem(GUEST_KEY, String(next)); } catch {}
  return next;
}

const initial: UsageStatus = {
  used: 0, limit: GUEST_LIMIT, plan: "guest", planState: "guest",
  isGuest: true, loading: true, trialEndsAt: null, trialUsed: 0, trialLimit: 30,
};

export function useUsage() {
  const [status, setStatus] = useState<UsageStatus>(initial);

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setStatus({
        ...initial,
        used: getGuestUsage(),
        loading: false,
      });
      return;
    }
    const { data, error } = await supabase.rpc("my_usage_status");
    if (error || !data) {
      setStatus((s) => ({ ...s, loading: false }));
      return;
    }
    const row: any = Array.isArray(data) ? data[0] : data;
    setStatus({
      used: row?.used ?? 0,
      limit: row?.plan_limit ?? 0,
      plan: (row?.plan ?? "free") as PlanName,
      planState: (row?.plan_state ?? "trial_expired") as PlanState,
      isGuest: false,
      loading: false,
      trialEndsAt: row?.trial_ends_at ?? null,
      trialUsed: row?.trial_used ?? 0,
      trialLimit: row?.trial_limit ?? 30,
    });
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...status, refresh };
}
