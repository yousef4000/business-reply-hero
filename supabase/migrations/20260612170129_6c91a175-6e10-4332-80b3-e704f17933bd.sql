
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============== knowledge_sources ==============
CREATE TABLE public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('url','pdf','docx','txt','xlsx','manual','social')),
  title text,
  original_name text,
  source_url text,
  storage_path text,
  raw_text text,
  char_count int DEFAULT 0,
  chunk_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_sources TO authenticated;
GRANT ALL ON public.knowledge_sources TO service_role;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own knowledge sources"
  ON public.knowledge_sources FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_knowledge_sources_user ON public.knowledge_sources(user_id, created_at DESC);

CREATE TRIGGER trg_knowledge_sources_updated
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============== knowledge_chunks ==============
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_id uuid NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  content text NOT NULL,
  token_estimate int DEFAULT 0,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own knowledge chunks"
  ON public.knowledge_chunks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_knowledge_chunks_user ON public.knowledge_chunks(user_id);
CREATE INDEX idx_knowledge_chunks_source ON public.knowledge_chunks(source_id);
CREATE INDEX idx_knowledge_chunks_embedding
  ON public.knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- ============== user_consents ==============
CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL,
  accepted boolean NOT NULL DEFAULT true,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own consents"
  ON public.user_consents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_consents_user ON public.user_consents(user_id, consent_type);

-- ============== match_knowledge ==============
CREATE OR REPLACE FUNCTION public.match_knowledge(
  _user_id uuid,
  _query_embedding vector(1536),
  _match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    kc.id,
    kc.source_id,
    kc.content,
    1 - (kc.embedding <=> _query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  WHERE kc.user_id = _user_id
    AND kc.embedding IS NOT NULL
  ORDER BY kc.embedding <=> _query_embedding
  LIMIT _match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge(uuid, vector, int) TO authenticated, service_role;

-- ============== delete_user_data ==============
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.knowledge_chunks WHERE user_id = _user_id;
  DELETE FROM public.knowledge_sources WHERE user_id = _user_id;
  DELETE FROM public.business_profiles WHERE user_id = _user_id;
  DELETE FROM public.user_consents WHERE user_id = _user_id;
  DELETE FROM public.usage_counters WHERE user_id = _user_id;
  DELETE FROM public.subscriptions WHERE user_id = _user_id;
  DELETE FROM public.play_purchases WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;
