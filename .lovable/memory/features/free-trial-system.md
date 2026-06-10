---
name: Free Trial System
description: 7-day / 30-reply trial with full premium features; replaces the old Free plan
type: feature
---
- Trial fields live on `public.subscriptions`: trial_started_at, trial_ends_at, trial_replies_used.
- New signups get a 7-day trial via `on_auth_user_created_trial` trigger (handle_new_user_trial).
- Existing free users were backfilled to a fresh trial on 2026-06-10.
- Plan states from `my_usage_status` rpc: `trial` (limit=30, counts trial_replies_used), `trial_expired` (lim=0, blocks generation), `paid` (uses normal monthly plan limit on usage_counters).
- `consume_reply_credit` raises `TRIAL_EXPIRED`, `TRIAL_LIMIT_REACHED`, or `USAGE_LIMIT_REACHED` — generate-reply translates these into 403 with matching `code`.
- UI: `TrialBanner` component shown on Generate/Settings pages; `UpgradeModal` is opened on expiry.
