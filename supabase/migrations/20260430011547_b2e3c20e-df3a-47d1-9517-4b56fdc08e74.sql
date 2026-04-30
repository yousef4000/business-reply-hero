-- Plan enum
CREATE TYPE public.plan_tier AS ENUM ('free', 'starter', 'pro', 'business');

-- Subscriptions: one row per user
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan plan_tier NOT NULL DEFAULT 'free',
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for clients; managed server-side only

-- Usage counters: one row per user per monthly period
CREATE TABLE public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  replies_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage"
  ON public.usage_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Updated-at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Plan -> monthly limit mapping helper
CREATE OR REPLACE FUNCTION public.plan_monthly_limit(_plan plan_tier)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _plan
    WHEN 'free' THEN 15
    WHEN 'starter' THEN 150
    WHEN 'pro' THEN 500
    WHEN 'business' THEN 2000
  END;
$$;

-- Ensure subscription exists, rolling period if month changed
CREATE OR REPLACE FUNCTION public.get_or_create_subscription(_user_id UUID)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
  current_period DATE := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, period_start)
  VALUES (_user_id, 'free', current_period)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO sub FROM public.subscriptions WHERE user_id = _user_id;

  -- Roll over period if a new month started
  IF sub.period_start < current_period THEN
    UPDATE public.subscriptions
      SET period_start = current_period
      WHERE user_id = _user_id
      RETURNING * INTO sub;
  END IF;

  RETURN sub;
END;
$$;

-- Atomically consume one reply credit; raises if over limit
CREATE OR REPLACE FUNCTION public.consume_reply_credit(_user_id UUID)
RETURNS TABLE (used INTEGER, plan_limit INTEGER, plan plan_tier, period_start DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
  lim INTEGER;
  current_used INTEGER;
BEGIN
  sub := public.get_or_create_subscription(_user_id);
  lim := public.plan_monthly_limit(sub.plan);

  INSERT INTO public.usage_counters (user_id, period_start, replies_used)
  VALUES (_user_id, sub.period_start, 0)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Lock the row to prevent race conditions
  SELECT replies_used INTO current_used
    FROM public.usage_counters
    WHERE user_id = _user_id AND period_start = sub.period_start
    FOR UPDATE;

  IF current_used >= lim THEN
    RAISE EXCEPTION 'USAGE_LIMIT_REACHED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.usage_counters
    SET replies_used = replies_used + 1
    WHERE user_id = _user_id AND period_start = sub.period_start
    RETURNING replies_used INTO current_used;

  RETURN QUERY SELECT current_used, lim, sub.plan, sub.period_start;
END;
$$;

-- Read-only usage status for the dashboard
CREATE OR REPLACE FUNCTION public.get_usage_status(_user_id UUID)
RETURNS TABLE (used INTEGER, plan_limit INTEGER, plan plan_tier, period_start DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
  lim INTEGER;
  current_used INTEGER;
BEGIN
  sub := public.get_or_create_subscription(_user_id);
  lim := public.plan_monthly_limit(sub.plan);

  SELECT replies_used INTO current_used
    FROM public.usage_counters
    WHERE user_id = _user_id AND period_start = sub.period_start;

  RETURN QUERY SELECT COALESCE(current_used, 0), lim, sub.plan, sub.period_start;
END;
$$;