
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS verified_facts text,
  ADD COLUMN IF NOT EXISTS never_assume text,
  ADD COLUMN IF NOT EXISTS preferred_phrases text,
  ADD COLUMN IF NOT EXISTS forbidden_phrases text,
  ADD COLUMN IF NOT EXISTS sensitive_cases text,
  ADD COLUMN IF NOT EXISTS common_scenarios text,
  ADD COLUMN IF NOT EXISTS escalation_rules text,
  ADD COLUMN IF NOT EXISTS complaint_rules text,
  ADD COLUMN IF NOT EXISTS frequent_questions text;
