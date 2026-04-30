import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const GUEST_KEY = "smartreply-guest-usage";
export const GUEST_LIMIT = 3;

export type PlanName = "free" | "starter" | "pro" | "business" | "guest";

export interface UsageStatus {
  used: number;
  limit: number;
  plan: PlanName;
  isGuest: boolean;
  loading: boolean;
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

export function useUsage() {
  const [status, setStatus] = useState<UsageStatus>({
    used: 0, limit: GUEST_LIMIT, plan: "guest", isGuest: true, loading: true,
  });

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user) {
      setStatus({
        used: getGuestUsage(),
        limit: GUEST_LIMIT,
        plan: "guest",
        isGuest: true,
        loading: false,
      });
      return;
    }
    const { data, error } = await supabase.rpc("my_usage_status");
    if (error || !data) {
      setStatus((s) => ({ ...s, loading: false }));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setStatus({
      used: row?.used ?? 0,
      limit: row?.plan_limit ?? 15,
      plan: (row?.plan ?? "free") as PlanName,
      isGuest: false,
      loading: false,
    });
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refresh());
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  return { ...status, refresh };
}
