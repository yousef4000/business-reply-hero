-- Smart Memory: track success/failure outcomes per generated reply
CREATE TABLE IF NOT EXISTS public.reply_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  customer_message TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  reply_style TEXT,            -- soft | persuasive | directClosing
  tone TEXT,                   -- professional | friendly | casual | persuasive | empathetic
  platform TEXT,
  business_type TEXT,
  message_type TEXT,           -- inquiry | objection | complaint | ...
  objection_type TEXT,         -- price | trust | timing | none ...
  buying_stage TEXT,
  purchase_probability INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure')),
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reply_outcomes TO authenticated;
GRANT ALL ON public.reply_outcomes TO service_role;

ALTER TABLE public.reply_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own outcomes"
  ON public.reply_outcomes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reply_outcomes_user_created_idx
  ON public.reply_outcomes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reply_outcomes_embedding_idx
  ON public.reply_outcomes USING hnsw (embedding vector_cosine_ops);

-- Wipe outcomes on account deletion
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.reply_outcomes WHERE user_id = _user_id;
  DELETE FROM public.successful_replies WHERE user_id = _user_id;
  DELETE FROM public.user_style_signals WHERE user_id = _user_id;
  DELETE FROM public.knowledge_chunks WHERE user_id = _user_id;
  DELETE FROM public.knowledge_sources WHERE user_id = _user_id;
  DELETE FROM public.business_profiles WHERE user_id = _user_id;
  DELETE FROM public.user_consents WHERE user_id = _user_id;
  DELETE FROM public.usage_counters WHERE user_id = _user_id;
  DELETE FROM public.subscriptions WHERE user_id = _user_id;
  DELETE FROM public.play_purchases WHERE user_id = _user_id;
END;
$$;

-- Aggregated analytics for the dashboard
CREATE OR REPLACE FUNCTION public.get_reply_analytics(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total INTEGER;
  succ INTEGER;
  fail INTEGER;
  best_tone JSONB;
  best_style JSONB;
  top_obj JSONB;
  top_close JSONB;
  recent JSONB;
BEGIN
  SELECT COUNT(*) FILTER (WHERE outcome IN ('success','failure')),
         COUNT(*) FILTER (WHERE outcome = 'success'),
         COUNT(*) FILTER (WHERE outcome = 'failure')
    INTO total, succ, fail
    FROM public.reply_outcomes WHERE user_id = _user_id;

  -- Best performing tone (min 2 samples)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO best_tone FROM (
    SELECT tone AS name,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE outcome='success') AS success,
           ROUND(100.0 * COUNT(*) FILTER (WHERE outcome='success') / NULLIF(COUNT(*),0))::int AS success_rate
    FROM public.reply_outcomes
    WHERE user_id = _user_id AND tone IS NOT NULL
    GROUP BY tone
    HAVING COUNT(*) >= 2
    ORDER BY success_rate DESC NULLS LAST, total DESC
    LIMIT 5
  ) t;

  -- Best reply style (soft / persuasive / directClosing)
  SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) INTO best_style FROM (
    SELECT reply_style AS name,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE outcome='success') AS success,
           ROUND(100.0 * COUNT(*) FILTER (WHERE outcome='success') / NULLIF(COUNT(*),0))::int AS success_rate
    FROM public.reply_outcomes
    WHERE user_id = _user_id AND reply_style IS NOT NULL
    GROUP BY reply_style
    ORDER BY success_rate DESC NULLS LAST, total DESC
  ) s;

  -- Most common objections
  SELECT COALESCE(jsonb_agg(o), '[]'::jsonb) INTO top_obj FROM (
    SELECT objection_type AS name,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE outcome='success') AS success
    FROM public.reply_outcomes
    WHERE user_id = _user_id AND objection_type IS NOT NULL AND objection_type <> 'none'
    GROUP BY objection_type
    ORDER BY total DESC
    LIMIT 5
  ) o;

  -- Top closing strategies = directClosing replies that succeeded, grouped by objection_type
  SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) INTO top_close FROM (
    SELECT COALESCE(NULLIF(objection_type,''), 'general') AS context,
           COUNT(*) AS wins,
           (ARRAY_AGG(reply_text ORDER BY created_at DESC))[1] AS sample
    FROM public.reply_outcomes
    WHERE user_id = _user_id
      AND outcome = 'success'
      AND reply_style = 'directClosing'
    GROUP BY 1
    ORDER BY wins DESC
    LIMIT 5
  ) c;

  -- Last 20 outcomes for trend
  SELECT COALESCE(jsonb_agg(r ORDER BY r->>'created_at' DESC), '[]'::jsonb) INTO recent FROM (
    SELECT jsonb_build_object(
      'outcome', outcome,
      'tone', tone,
      'reply_style', reply_style,
      'objection_type', objection_type,
      'created_at', created_at
    ) AS r
    FROM public.reply_outcomes
    WHERE user_id = _user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) x;

  RETURN jsonb_build_object(
    'total', COALESCE(total, 0),
    'success', COALESCE(succ, 0),
    'failure', COALESCE(fail, 0),
    'success_rate', CASE WHEN COALESCE(total,0) = 0 THEN NULL ELSE ROUND(100.0 * succ / total)::int END,
    'best_tone', best_tone,
    'best_style', best_style,
    'top_objections', top_obj,
    'top_closing', top_close,
    'recent', recent
  );
END;
$$;

-- Match similar past outcomes (used by generate-reply to learn what worked / failed for similar messages)
CREATE OR REPLACE FUNCTION public.match_reply_outcomes(_user_id uuid, _query_embedding vector, _match_count integer DEFAULT 4)
RETURNS TABLE(id uuid, customer_message text, reply_text text, outcome text, reply_style text, tone text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ro.id, ro.customer_message, ro.reply_text, ro.outcome, ro.reply_style, ro.tone,
         1 - (ro.embedding <=> _query_embedding) AS similarity
  FROM public.reply_outcomes ro
  WHERE ro.user_id = _user_id AND ro.embedding IS NOT NULL
  ORDER BY ro.embedding <=> _query_embedding
  LIMIT _match_count;
$$;