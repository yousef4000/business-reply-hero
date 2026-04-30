// Returns the current user's plan, monthly limit, used count, remaining, and renewal date.
// Backend is the source of truth — never trust client state for paid access.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authoritative usage status from the DB
    const { data: status, error: sErr } = await supabase.rpc("my_usage_status");
    if (sErr) throw sErr;

    const row = Array.isArray(status) ? status[0] : status;
    const used: number = row?.used ?? 0;
    const limit: number = row?.plan_limit ?? 0;
    const plan: string = row?.plan ?? "free";
    const periodStart: string = row?.period_start ?? new Date().toISOString();

    // Period rolls monthly — compute renewal as start of next month
    const start = new Date(periodStart);
    const renewsAt = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    ).toISOString();

    return new Response(
      JSON.stringify({
        plan,
        monthlyLimit: limit,
        usedThisMonth: used,
        remaining: Math.max(0, limit - used),
        renewsAt,
        periodStart,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("me-plan error", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "INTERNAL_ERROR" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
