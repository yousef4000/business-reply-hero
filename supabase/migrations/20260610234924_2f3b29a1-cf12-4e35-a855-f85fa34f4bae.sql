
-- 1. business_profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text,
  business_type text,
  description text,
  services text,
  products text,
  pricing text,
  menu_items text,
  working_hours text,
  branches text,
  return_policy text,
  shipping_policy text,
  faqs text,
  custom_notes text,
  preferred_tone text DEFAULT 'professional',
  language text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own business profile" ON public.business_profiles;
CREATE POLICY "Users manage own business profile"
  ON public.business_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_business_profiles_updated_at ON public.business_profiles;
CREATE TRIGGER trg_business_profiles_updated_at
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Trial columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_replies_used integer NOT NULL DEFAULT 0;

UPDATE public.subscriptions
  SET trial_started_at = now(),
      trial_ends_at = now() + interval '7 days',
      trial_replies_used = 0
  WHERE plan = 'free' AND trial_started_at IS NULL;

-- 3. get_or_create_subscription
CREATE OR REPLACE FUNCTION public.get_or_create_subscription(_user_id uuid)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
  current_period DATE := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, period_start, trial_started_at, trial_ends_at)
  VALUES (_user_id, 'free', current_period, now(), now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO sub FROM public.subscriptions WHERE user_id = _user_id;
  IF sub.period_start < current_period THEN
    UPDATE public.subscriptions SET period_start = current_period
      WHERE user_id = _user_id RETURNING * INTO sub;
  END IF;
  RETURN sub;
END; $$;

-- 4. Drop old usage/credit functions (return types change)
DROP FUNCTION IF EXISTS public.my_usage_status();
DROP FUNCTION IF EXISTS public.get_usage_status(uuid);
DROP FUNCTION IF EXISTS public.consume_reply_credit(uuid);

CREATE FUNCTION public.get_usage_status(_user_id uuid)
RETURNS TABLE (
  used integer, plan_limit integer, plan plan_tier, period_start date,
  plan_state text, trial_ends_at timestamptz, trial_used integer, trial_limit integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
  lim INTEGER;
  current_used INTEGER;
  state TEXT;
  trial_lim INTEGER := 30;
  is_paid BOOLEAN;
  in_trial BOOLEAN;
BEGIN
  sub := public.get_or_create_subscription(_user_id);
  is_paid := sub.plan IN ('starter','pro','business');
  in_trial := (sub.trial_ends_at IS NOT NULL AND sub.trial_ends_at > now()) AND NOT is_paid;

  IF is_paid THEN
    state := 'paid';
    lim := public.plan_monthly_limit(sub.plan);
    SELECT replies_used INTO current_used FROM public.usage_counters
      WHERE user_id = _user_id AND period_start = sub.period_start;
    current_used := COALESCE(current_used, 0);
  ELSIF in_trial THEN
    state := 'trial';
    lim := trial_lim;
    current_used := COALESCE(sub.trial_replies_used, 0);
  ELSE
    state := 'trial_expired';
    lim := 0;
    current_used := COALESCE(sub.trial_replies_used, 0);
  END IF;

  RETURN QUERY SELECT current_used, lim, sub.plan, sub.period_start,
    state, sub.trial_ends_at, COALESCE(sub.trial_replies_used, 0), trial_lim;
END; $$;

CREATE FUNCTION public.my_usage_status()
RETURNS TABLE (
  used integer, plan_limit integer, plan plan_tier, period_start date,
  plan_state text, trial_ends_at timestamptz, trial_used integer, trial_limit integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_usage_status(auth.uid());
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_usage_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_usage_status() TO authenticated;

CREATE FUNCTION public.consume_reply_credit(_user_id uuid)
RETURNS TABLE (
  used integer, plan_limit integer, plan plan_tier, period_start date,
  plan_state text, trial_ends_at timestamptz, trial_used integer, trial_limit integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
  lim INTEGER;
  current_used INTEGER;
  is_paid BOOLEAN;
  in_trial BOOLEAN;
  trial_lim INTEGER := 30;
BEGIN
  sub := public.get_or_create_subscription(_user_id);
  is_paid := sub.plan IN ('starter','pro','business');
  in_trial := (sub.trial_ends_at IS NOT NULL AND sub.trial_ends_at > now()) AND NOT is_paid;

  IF is_paid THEN
    lim := public.plan_monthly_limit(sub.plan);
    INSERT INTO public.usage_counters (user_id, period_start, replies_used)
    VALUES (_user_id, sub.period_start, 0)
    ON CONFLICT (user_id, period_start) DO NOTHING;
    SELECT replies_used INTO current_used FROM public.usage_counters
      WHERE user_id = _user_id AND period_start = sub.period_start FOR UPDATE;
    IF current_used >= lim THEN
      RAISE EXCEPTION 'USAGE_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.usage_counters SET replies_used = replies_used + 1
      WHERE user_id = _user_id AND period_start = sub.period_start
      RETURNING replies_used INTO current_used;
  ELSIF in_trial THEN
    IF COALESCE(sub.trial_replies_used, 0) >= trial_lim THEN
      RAISE EXCEPTION 'TRIAL_LIMIT_REACHED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.subscriptions
      SET trial_replies_used = COALESCE(trial_replies_used, 0) + 1
      WHERE user_id = _user_id RETURNING trial_replies_used INTO current_used;
    lim := trial_lim;
  ELSE
    RAISE EXCEPTION 'TRIAL_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT * FROM public.get_usage_status(_user_id);
END; $$;

REVOKE EXECUTE ON FUNCTION public.consume_reply_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_reply_credit(uuid) TO service_role;

-- 5. Auto-start trial for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, period_start, trial_started_at, trial_ends_at)
  VALUES (NEW.id, 'free', date_trunc('month', now())::date, now(), now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_trial();
