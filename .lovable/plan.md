# Smart Reply Hub — RAG Knowledge Base + Compliance Upgrade

This is a large, multi-part change. Below is the proposed plan. I'll wait for your approval before implementing.

---

## Part 1 — Smart Business Knowledge Base (RAG)

### Database changes (new migration)
- `knowledge_sources` — one row per import (type: `url | pdf | docx | txt | xlsx | manual | social`, original filename, status, raw_text, created_at, user_id).
- `knowledge_chunks` — chunked text + `embedding vector(1536)` (pgvector). Columns: id, source_id, user_id, content, token_count, embedding, metadata jsonb.
- `match_knowledge(user_id, query_embedding, match_count)` SQL function — cosine similarity, returns top-K chunks **scoped to the calling user**.
- `user_consents` — records consent acceptance (consent_type, accepted_at, ip).
- HNSW index on `embedding`, RLS owner-only, GRANTs to authenticated + service_role.
- Enable `pgvector` extension.

### Storage
- New private Storage bucket `business-docs` (user-scoped path `{user_id}/...`). RLS: owner-only read/write. Files encrypted at rest by default in Cloud Storage.

### Edge functions (new)
1. `ingest-knowledge` — accepts URL or uploaded file path, extracts text (URL via Firecrawl scrape if connected, otherwise simple fetch; PDF via `pdf-parse` ESM; DOCX via `mammoth`; XLSX via `xlsx`; TXT direct), chunks to ~800 chars w/ 100 overlap, embeds via Lovable AI Gateway (`google/gemini-embedding-001`, 1536 dims), inserts into `knowledge_chunks`.
2. `analyze-business` — single GPT-4o-mini pass over aggregated extracted text → fills `business_profiles` fields (name, services, pricing, hours, policies, FAQs…).
3. `export-business-data` — returns JSON or PDF of profile + sources + chunks.
4. `delete-account` — deletes user data (profile, sources, chunks, files, subscription rows) then calls `auth.admin.deleteUser`.

### `generate-reply` retrieval flow (modified, still 1 OpenAI call)
1. Auth + usage check (unchanged).
2. **Embed the incoming customer message** via Lovable AI embeddings (~80–150ms).
3. `match_knowledge` → top 5 chunks (~50ms).
4. Build prompt with: (a) compact business profile core fields, (b) retrieved chunks only, (c) customer service rules, (d) customer message.
5. One GPT-4o call → reply.
- Net added latency: ~150–250ms. Token usage drops because we no longer dump the full profile.

---

## Part 2 — Response Quality (inside the same single call)
- System prompt's internal silent analysis already extracts questions/concerns/intent — extend to explicitly tag emotion + a `known_vs_unknown` map.
- Hard rule: if a fact isn't in retrieved chunks or profile, say "this needs to be checked" + a concrete next step. Never invent.

## Part 3 — Customer Service Rules
- Fields already exist (`verified_facts`, `never_assume`, `preferred_phrases`, `forbidden_phrases`, `escalation_rules`, `sensitive_cases`). Surface them as a dedicated section in BusinessProfilePage and always inject them (small, ~hundreds of tokens) in every prompt.

---

## Part 4 — Google Play Compliance

### New public pages
- `/privacy` — Privacy Policy (data collected, purpose, retention, rights, "never sold / never shared").
- `/terms` — short Terms of Service.
- `/data-deletion` — public URL Google Play requires; explains how to delete account + data, links to in-app flow, and an email contact for users who can't sign in.

### In-app pages (under `/app/settings`)
- **Delete Account** — confirmation dialog → calls `delete-account` edge function → signs out.
- **Delete Business Data** — wipes sources/chunks/files but keeps account.
- **Export Data** — downloads JSON or PDF.

### Consent
- Consent modal before first knowledge import; checkbox + stored in `user_consents`.

### Links
- Add Privacy/Terms links in SignIn page, Settings page, and landing footer.

---

## Part 5 — Performance & cost summary
- Single OpenAI generation call preserved.
- One extra embedding call per reply (~100ms, ~$0.00002).
- Prompt size drops from ~13k chars to ~3–5k → faster GPT-4o, lower cost.
- Target: 2–8s end-to-end (currently ~6–7s).

---

## Technical notes
- pgvector dim = 1536 to match `google/gemini-embedding-001` with `dimensions: 1536` request param (smaller index, faster search vs 3072).
- File parsing in edge functions uses `npm:` ESM imports (pdf-parse, mammoth, xlsx) — no native deps.
- URL ingestion: if Firecrawl connector linked use it; otherwise fall back to plain `fetch` + simple HTML→text.
- All chunk searches RLS-scoped via `auth.uid()` in the SQL function.
- Storage bucket is private; signed URLs only when needed for export.

---

## Open questions before I build

1. **URL ingestion** — should I require/connect Firecrawl for clean web scraping, or is a basic `fetch` + strip-HTML fallback enough for v1?
2. **Account deletion grace period** — hard delete immediately, or 30-day soft delete (recoverable)?
3. **Privacy Policy contact email** — what email should I list as the data-controller contact (required by Google Play)?
4. **Scope** — this is ~3–4 hours of changes. Want me to ship it all in one pass, or split into phases (RAG first → compliance second)?
