CREATE TABLE IF NOT EXISTS public.winning_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT,
  customer_message TEXT,
  reply_text TEXT NOT NULL,
  objection_type TEXT,
  customer_intent TEXT,
  industry TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  embedding vector(1536),
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.winning_replies TO authenticated;
GRANT ALL ON public.winning_replies TO service_role;

ALTER TABLE public.winning_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own winning replies"
  ON public.winning_replies FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS winning_replies_user_created_idx
  ON public.winning_replies (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS winning_replies_user_objection_idx
  ON public.winning_replies (user_id, objection_type);

CREATE INDEX IF NOT EXISTS winning_replies_embedding_idx
  ON public.winning_replies USING hnsw (embedding vector_cosine_ops);

-- updated_at trigger
DROP TRIGGER IF EXISTS winning_replies_set_updated_at ON public.winning_replies;
CREATE TRIGGER winning_replies_set_updated_at
  BEFORE UPDATE ON public.winning_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Wipe on account deletion
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.winning_replies WHERE user_id = _user_id;
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

-- Top-K cosine match for winning replies (auth-scoped via _user_id)
CREATE OR REPLACE FUNCTION public.match_winning_replies(
  _user_id uuid,
  _query_embedding vector,
  _match_count integer DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  title text,
  customer_message text,
  reply_text text,
  objection_type text,
  customer_intent text,
  industry text,
  similarity double precision,
  usage_count integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT wr.id, wr.title, wr.customer_message, wr.reply_text,
         wr.objection_type, wr.customer_intent, wr.industry,
         1 - (wr.embedding <=> _query_embedding) AS similarity,
         wr.usage_count
  FROM public.winning_replies wr
  WHERE wr.user_id = _user_id AND wr.embedding IS NOT NULL
  ORDER BY wr.embedding <=> _query_embedding
  LIMIT _match_count;
$$;

-- Increment usage counter (called from generate-reply or library UI)
CREATE OR REPLACE FUNCTION public.bump_winning_reply_usage(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.winning_replies SET usage_count = usage_count + 1 WHERE id = _id;
$$;