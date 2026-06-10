---
name: Business Knowledge Base
description: Per-user business_profiles table is the authoritative source for personalization; edge function fetches it server-side and injects into every prompt
type: feature
---
- Table `public.business_profiles` (one row per user, RLS owner-only).
- Fields: business_name, business_type, description, services, products, pricing, menu_items, working_hours, branches, return_policy, shipping_policy, faqs, custom_notes, preferred_tone, language.
- Edge function `generate-reply` ALWAYS loads the row server-side via service role and injects it as a "BUSINESS KNOWLEDGE BASE — ALWAYS PRIORITIZE" block in the system context. Do NOT trust client-supplied business profile data.
- UI: `/app/business` page (BusinessProfilePage) for editing. Settings page links to it.
