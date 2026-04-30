CREATE OR REPLACE FUNCTION public.plan_monthly_limit(_plan plan_tier)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 15
    WHEN 'starter' THEN 150
    WHEN 'pro' THEN 500
    WHEN 'business' THEN 2000
  END;
$$;