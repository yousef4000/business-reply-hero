
# Smart Reply Hub — Major Update Plan

Scope confirmed: full plan, all existing users auto-granted 7-day trial, you'll rebuild the APK after native changes, payments stay placeholder.

---

## Phase 1 — Database & Backend

### 1.1 New table: `business_profiles` (one row per user)
Fields: business_name, business_type, description, services, products, pricing, menu_items, working_hours, branches, return_policy, shipping_policy, faqs, custom_notes, preferred_tone, language.
- RLS: owner-only select/insert/update/delete (`auth.uid() = user_id`).
- GRANTs to `authenticated` + `service_role`. Updated-at trigger.

### 1.2 Trial system on `subscriptions`
Add columns: `trial_started_at timestamptz`, `trial_ends_at timestamptz`, `trial_replies_used int default 0`, `trial_replies_limit int default 30`, `is_trial_active bool generated`.
- Backfill: every existing user where `plan='free'` → set `trial_started_at = now()`, `trial_ends_at = now() + 7 days`. (Auto-grant to existing users.)
- New signups: `handle_new_user` trigger starts trial on first subscription row.
- Update `plan_monthly_limit` / `get_usage_status` / `consume_reply_credit` to respect trial window: while trial active, limit = 30 and tracked in `trial_replies_used`; after expiry and no paid plan → block with `TRIAL_EXPIRED`.
- Return trial info from `my_usage_status` (days_left, trial_used, trial_limit, plan_state: `trial|trial_expired|free|paid`).

### 1.3 Edge function `generate-reply`
- Fetch caller's `business_profiles` row and inject as a **System Context** block at the top of the prompt — instruct model to prioritize these facts.
- Extend response JSON with `objection_analysis: { type, strategy, coaching_tip }` when the incoming customer message contains an objection. Types: price, trust, timing, competitor, need, budget, decision_maker, none.
- Enforce trial/limit via `consume_reply_credit` (already does usage; extend to raise `TRIAL_EXPIRED`).

---

## Phase 2 — Frontend Features

### 2.1 Business Profile (Feature 1)
- New page `/app/business` + Settings entry "My Business Profile".
- Sectioned form (collapsible): Basics, Offerings, Pricing/Menu, Hours & Locations, Policies, FAQs, Notes.
- Load/save via Supabase. Optimistic save, toast feedback. Bilingual labels.
- Show "Profile completeness" bar to encourage completion.

### 2.2 Smart Templates (Feature 2)
- New file `src/lib/templates.ts` mapping `business_type → goal chips[]` (clinic, restaurant, ecommerce, gym, courses, salon, real_estate, services, other).
- On Generate page: after user picks business type, render chips above the goal textarea. Click = fills goal field. Custom goal input remains.
- Localize chip labels EN/AR.

### 2.3 Objection Handler (Feature 3)
- In Generate page result panel, when `objection_analysis.type !== 'none'`, render a card:
  - Badge: Objection Type
  - Row: Sales Strategy
  - Row: Coaching Tip (highlighted)
- Bilingual strings.

### 2.4 Share-to-Smart-Reply (Feature 4 — Android native)
- `AndroidManifest.xml`: add `<intent-filter>` with `android.intent.action.SEND` + `text/plain` on MainActivity.
- Custom `MainActivity.java`: capture `Intent.EXTRA_TEXT` on create/new-intent, push to JS via `window.location` deep route `/app/generate?shared=<encoded>`.
- Generate page reads `?shared=` param → prefills customer message and auto-runs generation.
- Web/PWA fallback: Web Share Target in `manifest.json` pointing to same route.

### 2.5 Trial UI (Feature 5)
- Replace "X of 15 used" everywhere with trial state from `my_usage_status`:
  - Active trial: badge "Trial • Nd left • X/30 replies"
  - Expired: banner + lock generation, route to Upgrade.
- UpgradeModal: show trial-expired copy when triggered after expiry.

### 2.6 Homepage Redesign (Feature 6)
- Rewrite `LandingPage.tsx`: hero with one-line value prop, then 5 feature sections (Business KB, Smart Templates, Objection Coach, Share-to-Reply, 7-Day Trial) — each with `lucide` icon, title, 1-line description, mobile stacked.
- Pricing strip + "Start 7-day free trial" CTA.
- Keep SEO (single H1, meta description, OG tags).

### 2.7 Subscription Restructure (Feature 7)
- `src/lib/billing.ts`: redefine plans:
  - Trial: 30 replies / 7 days, all features
  - Pro: 500 replies/mo
  - Business: 2000 replies/mo
  - (Drop Starter to simplify, or keep — propose dropping for clarity.)
- UpgradeModal: cleaner 2-column compare, highlight Pro, list premium features bullets.

---

## Phase 3 — QA & Polish (Feature 8)

Audit-driven fixes I'll make in this pass:
- **Footer/safe-area** already partially fixed — verify on `/app/*` too.
- **SettingsPage** "Sign Out" button has no handler — wire to `supabase.auth.signOut()`.
- **Billing card** in Settings shows hardcoded "12 of 25" — replace with live usage.
- **Loading/empty states** for new pages (skeletons via existing `LoadingStates`).
- **Form validation** with `zod` on Business Profile.
- **Dark mode**: token-only colors, audit new cards.
- **A11y**: labels on all inputs, focus rings, aria on chips.
- **Mobile**: chips wrap, profile form scroll, trial banner doesn't overlap bottom nav.

---

## Technical Notes

### New files
- `supabase/migrations/<ts>_business_profile_and_trial.sql`
- `src/pages/BusinessProfilePage.tsx`
- `src/lib/templates.ts`
- `src/lib/trial.ts` (helpers)
- `src/components/ObjectionCard.tsx`
- `src/components/TrialBanner.tsx`

### Modified files (expected)
`generate-reply/index.ts`, `LandingPage.tsx`, `GeneratePage.tsx`, `SettingsPage.tsx`, `UpgradeModal.tsx`, `App.tsx` (route), `BottomNav.tsx` (new entry), `i18n/translations.ts`, `billing.ts`, `use-usage.ts`, `AndroidManifest.xml`, `MainActivity.java`, `public/manifest.json`.

### Migrations required
One migration: `business_profiles` table + trial columns on `subscriptions` + updated functions + backfill.

### Env vars
None new. Uses existing `LOVABLE_API_KEY`.

### Android-specific
- Manifest SEND intent-filter
- MainActivity intent capture → JS bridge
- After my changes: `git pull` → `npx cap sync android` → rebuild APK in Android Studio.

### Future recommendations
- Real Stripe checkout (currently placeholder).
- Server-side rate limits per IP on generate endpoint.
- Analytics events for trial conversion funnel.
- Background sync for offline queueing of customer messages.

---

## Execution order
1. Migration (await your approval — required before code uses new columns).
2. Edge function update.
3. Frontend: trial hook → business profile page → generate page integration → objection card → landing redesign → upgrade modal.
4. Android native files.
5. QA sweep + bug fixes from audit list.

Approve this and I'll start with the migration.
