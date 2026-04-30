-- Map Google Play product IDs to plan tiers
CREATE TABLE IF NOT EXISTS public.play_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan public.plan_tier NOT NULL,
  product_id TEXT NOT NULL,
  purchase_token TEXT NOT NULL UNIQUE,
  order_id TEXT,
  purchase_time TIMESTAMPTZ,
  expiry_time TIMESTAMPTZ,
  auto_renewing BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | cancelled | expired | failed
  platform TEXT NOT NULL DEFAULT 'android',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.play_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own purchases"
  ON public.play_purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_play_purchases_user ON public.play_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_play_purchases_status ON public.play_purchases(status);

CREATE TRIGGER set_play_purchases_updated_at
  BEFORE UPDATE ON public.play_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: apply a verified purchase to the user's subscription
CREATE OR REPLACE FUNCTION public.apply_verified_purchase(
  _user_id UUID,
  _plan public.plan_tier,
  _product_id TEXT,
  _purchase_token TEXT,
  _order_id TEXT,
  _purchase_time TIMESTAMPTZ,
  _expiry_time TIMESTAMPTZ,
  _auto_renewing BOOLEAN,
  _raw JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.play_purchases (
    user_id, plan, product_id, purchase_token, order_id,
    purchase_time, expiry_time, auto_renewing, status, raw
  ) VALUES (
    _user_id, _plan, _product_id, _purchase_token, _order_id,
    _purchase_time, _expiry_time, _auto_renewing, 'active', _raw
  )
  ON CONFLICT (purchase_token) DO UPDATE SET
    plan = EXCLUDED.plan,
    expiry_time = EXCLUDED.expiry_time,
    auto_renewing = EXCLUDED.auto_renewing,
    status = 'active',
    raw = EXCLUDED.raw,
    updated_at = now();

  -- Upgrade subscription
  INSERT INTO public.subscriptions (user_id, plan, period_start)
  VALUES (_user_id, _plan, date_trunc('month', now())::date)
  ON CONFLICT (user_id) DO UPDATE SET plan = EXCLUDED.plan, updated_at = now();
END;
$$;