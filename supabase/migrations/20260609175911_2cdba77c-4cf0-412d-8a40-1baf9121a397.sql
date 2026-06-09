
-- Lock down SECURITY DEFINER functions so signed-in users can't call them directly.
-- These are meant to be called only by edge functions using the service role.
REVOKE EXECUTE ON FUNCTION public.get_or_create_subscription(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_usage_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_reply_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_verified_purchase(uuid, plan_tier, text, text, text, timestamptz, timestamptz, boolean, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_or_create_subscription(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reply_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_verified_purchase(uuid, plan_tier, text, text, text, timestamptz, timestamptz, boolean, jsonb) TO service_role;

-- my_usage_status is the safe wrapper that uses auth.uid(); signed-in users may call it.
REVOKE EXECUTE ON FUNCTION public.my_usage_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_usage_status() TO authenticated, service_role;
