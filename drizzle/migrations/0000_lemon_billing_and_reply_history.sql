-- 1. Billing columns on subscriptions (provider-agnostic, Lemon Squeezy first)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_product_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_status TEXT,
  ADD COLUMN IF NOT EXISTS renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS update_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS customer_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_id_idx
  ON public.subscriptions (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

GRANT ALL ON public.subscriptions TO service_role;

-- 2. Webhook idempotency log (service role only)
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_name TEXT,
  user_id UUID,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_webhook_events_provider_event_key UNIQUE (provider, event_key)
);

GRANT ALL ON public.billing_webhook_events TO service_role;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- 3. Reply history + favorites (real user data, replaces localStorage demo data)
CREATE TABLE IF NOT EXISTS public.reply_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT,
  business_type TEXT,
  goal TEXT,
  tone TEXT,
  objection_type TEXT,
  customer_message TEXT,
  reply_text TEXT NOT NULL,
  category TEXT,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reply_history_user_created_idx
  ON public.reply_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reply_history_user_fav_idx
  ON public.reply_history (user_id, is_favorite);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_history TO authenticated;
GRANT ALL ON public.reply_history TO service_role;

ALTER TABLE public.reply_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reply history"
  ON public.reply_history FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_reply_history_updated_at
  BEFORE UPDATE ON public.reply_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();