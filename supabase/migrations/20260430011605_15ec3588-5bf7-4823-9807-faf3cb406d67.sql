-- Fix search_path on the timestamp helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Lock down EXECUTE on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.get_or_create_subscription(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_reply_credit(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_usage_status(UUID) FROM PUBLIC, anon, authenticated;

-- Service role keeps full access by default; ensure it explicitly
GRANT EXECUTE ON FUNCTION public.get_or_create_subscription(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reply_credit(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_status(UUID) TO service_role;

-- Wrap get_usage_status so signed-in users can read THEIR OWN status only
CREATE OR REPLACE FUNCTION public.my_usage_status()
RETURNS TABLE (used INTEGER, plan_limit INTEGER, plan plan_tier, period_start DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_usage_status(auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_usage_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_usage_status() TO authenticated;