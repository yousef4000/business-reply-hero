
-- ============================================================
-- 1. successful_replies — feedback-learning examples
-- ============================================================
CREATE TABLE public.successful_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_message TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  business_type TEXT,
  intent_tag TEXT,
  action TEXT NOT NULL CHECK (action IN ('copied', 'favorited', 'edited_and_used')),
  usage_count INTEGER NOT NULL DEFAULT 1,
  embedding vector(1536),
  message_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX successful_replies_user_hash_idx
  ON public.successful_replies (user_id, message_hash);

CREATE INDEX successful_replies_embedding_idx
  ON public.successful_replies USING hnsw (embedding vector_cosine_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.successful_replies TO authenticated;
GRANT ALL ON public.successful_replies TO service_role;

ALTER TABLE public.successful_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage successful_replies"
  ON public.successful_replies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER successful_replies_set_updated_at
  BEFORE UPDATE ON public.successful_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 2. user_style_signals — lightweight memory (one row per user)
-- ============================================================
CREATE TABLE public.user_style_signals (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  avoided_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  avg_reply_length INTEGER,
  tone_hint TEXT,
  sample_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_style_signals TO authenticated;
GRANT ALL ON public.user_style_signals TO service_role;

ALTER TABLE public.user_style_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage user_style_signals"
  ON public.user_style_signals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_style_signals_set_updated_at
  BEFORE UPDATE ON public.user_style_signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 3. match_successful_replies — top-K similar past replies
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_successful_replies(
  _user_id UUID,
  _query_embedding vector,
  _match_count INTEGER DEFAULT 2
)
RETURNS TABLE (
  id UUID,
  customer_message TEXT,
  reply_text TEXT,
  similarity DOUBLE PRECISION,
  usage_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.customer_message,
    sr.reply_text,
    1 - (sr.embedding <=> _query_embedding) AS similarity,
    sr.usage_count
  FROM public.successful_replies sr
  WHERE sr.user_id = _user_id
    AND sr.embedding IS NOT NULL
  ORDER BY sr.embedding <=> _query_embedding
  LIMIT _match_count;
$$;


-- ============================================================
-- 4. record_reply_feedback — single-call upsert + style update
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_reply_feedback(
  _user_id UUID,
  _customer_message TEXT,
  _reply_text TEXT,
  _action TEXT,
  _business_type TEXT DEFAULT NULL,
  _intent_tag TEXT DEFAULT NULL,
  _embedding vector DEFAULT NULL,
  _removed_phrases TEXT[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _hash TEXT;
  _len INTEGER;
  _current_avg INTEGER;
  _current_count INTEGER;
  _preferred JSONB;
  _avoided JSONB;
  phrase TEXT;
BEGIN
  IF _user_id IS NULL OR _customer_message IS NULL OR _reply_text IS NULL THEN
    RETURN;
  END IF;
  IF _action NOT IN ('copied', 'favorited', 'edited_and_used') THEN
    RETURN;
  END IF;

  _hash := md5(lower(trim(_customer_message)) || '|' || lower(trim(_reply_text)));
  _len := length(_reply_text);

  -- Upsert successful_replies (increment usage_count on dup)
  INSERT INTO public.successful_replies (
    user_id, customer_message, reply_text, business_type, intent_tag,
    action, embedding, message_hash, usage_count
  ) VALUES (
    _user_id, _customer_message, _reply_text, _business_type, _intent_tag,
    _action, _embedding, _hash, 1
  )
  ON CONFLICT (user_id, message_hash) DO UPDATE
    SET usage_count = public.successful_replies.usage_count + 1,
        action = EXCLUDED.action,
        embedding = COALESCE(EXCLUDED.embedding, public.successful_replies.embedding),
        updated_at = now();

  -- Ensure style row
  INSERT INTO public.user_style_signals (user_id) VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT avg_reply_length, sample_count, preferred_phrases, avoided_phrases
    INTO _current_avg, _current_count, _preferred, _avoided
    FROM public.user_style_signals WHERE user_id = _user_id;

  -- Rolling average length (cap at 50 samples for stability)
  _current_count := LEAST(COALESCE(_current_count, 0), 50);
  _current_avg := COALESCE(_current_avg, _len);
  _current_avg := ((_current_avg * _current_count) + _len) / (_current_count + 1);

  -- Add removed phrases (from user edits) to avoided list, dedup, cap 20
  IF _removed_phrases IS NOT NULL AND array_length(_removed_phrases, 1) > 0 THEN
    FOREACH phrase IN ARRAY _removed_phrases LOOP
      IF length(trim(phrase)) >= 6 AND length(trim(phrase)) <= 80 THEN
        IF NOT (_avoided @> to_jsonb(trim(phrase))) THEN
          _avoided := _avoided || to_jsonb(trim(phrase));
        END IF;
      END IF;
    END LOOP;
    -- Cap at 20 (keep most recent)
    IF jsonb_array_length(_avoided) > 20 THEN
      _avoided := (SELECT jsonb_agg(v) FROM (
        SELECT v FROM jsonb_array_elements(_avoided) v
        OFFSET GREATEST(0, jsonb_array_length(_avoided) - 20)
      ) s);
    END IF;
  END IF;

  -- For 'favorited' or 'edited_and_used', add the full reply (first 120 chars) as preferred
  IF _action IN ('favorited', 'edited_and_used') AND length(_reply_text) >= 20 THEN
    DECLARE
      snippet TEXT := substring(_reply_text from 1 for 120);
    BEGIN
      IF NOT (_preferred @> to_jsonb(snippet)) THEN
        _preferred := _preferred || to_jsonb(snippet);
      END IF;
      IF jsonb_array_length(_preferred) > 20 THEN
        _preferred := (SELECT jsonb_agg(v) FROM (
          SELECT v FROM jsonb_array_elements(_preferred) v
          OFFSET GREATEST(0, jsonb_array_length(_preferred) - 20)
        ) s);
      END IF;
    END;
  END IF;

  UPDATE public.user_style_signals
    SET preferred_phrases = _preferred,
        avoided_phrases = _avoided,
        avg_reply_length = _current_avg,
        sample_count = COALESCE(sample_count, 0) + 1,
        updated_at = now()
    WHERE user_id = _user_id;
END;
$$;


-- ============================================================
-- 5. Update delete_user_data to wipe the new tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
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
