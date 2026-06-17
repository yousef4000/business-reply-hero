
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_dna JSONB,
  ADD COLUMN IF NOT EXISTS dna_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dna_edited_at TIMESTAMPTZ;
