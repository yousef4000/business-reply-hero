
# خطة: Memory Layer + Feedback Learning (مع الحفاظ على السرعة)

## ما هو موجود فعلاً (لا داعي لإعادة بنائه)
- ✅ **RAG / Knowledge Base** — جدول `knowledge_sources` + `knowledge_chunks` + pgvector + دالة `match_knowledge` + Edge Function `ingest-knowledge` (PDF/DOCX/XLSX/TXT/URL) + صفحة `/app/knowledge`.
- ✅ **Smart Business Profile** + رفع الملفات إلى bucket `business-docs`.
- ✅ **Google Play Compliance** — صفحات `/privacy`, `/terms`, `/data-deletion`، حذف الحساب الكامل، تصدير البيانات، Consent.
- ✅ في `generate-reply`: استخراج النية + جلب أفضل 5 نتائج RAG بالتوازي مع جلب الـ profile والـ usage.

**الجديد المطلوب بناؤه:** فقط النقطتان 2 و 3 (Memory Layer + Feedback Learning) + ربطهما بـ `generate-reply` دون كسر ميزانية السرعة.

---

## 1. تغييرات قاعدة البيانات (migration واحدة)

### جدول `successful_replies` (Feedback Learning)
حقول رئيسية: `customer_message`, `reply_text`, `business_type`, `intent_tag` (نص قصير مثل "appointment", "pricing"…), `score` (1-5)، `usage_count`، `embedding vector(1536)` لرسالة العميل، `created_at`.
- يُملأ تلقائياً عند: نسخ الرد، إضافته للمفضلة، أو تعديله ثم استخدامه.
- HNSW index على `embedding`.
- دالة `match_successful_replies(_user_id, _embedding, _business_type, _k)` ترجع أفضل 2 (cosine).

### جدول `user_style_signals` (Memory Layer — خفيف جداً)
صف واحد لكل مستخدم. حقول:
- `preferred_phrases jsonb` — مصفوفة عبارات يحبها (مأخوذة من ردود نسخها/عدّلها) مع عدّاد تكرار.
- `avoided_phrases jsonb` — عبارات حذفها المستخدم أثناء التعديل.
- `avg_reply_length int`, `tone_hint text` (warm/formal/concise — مستنتج).
- `last_updated`.

**لماذا صف واحد؟** لتجنب أي scan عند البناء — قراءة O(1) وحقن مباشر في البرومبت (~200-400 حرف فقط).

### دالة `record_reply_feedback(_user_id, _customer_message, _reply, _action)`
- `_action` ∈ ('copied', 'favorited', 'edited_and_used').
- تُدخل/تُحدّث صف في `successful_replies` (مع زيادة `usage_count` إن وُجد رد متطابق).
- تستخرج العبارات الجديدة من الرد وتُدمجها في `user_style_signals.preferred_phrases` (تحديث جزئي، حد أقصى 20 عبارة).
- استخراج العبارات يتم بـ regex بسيط server-side (لا AI call) — يأخذ أكثر 3-grams تكراراً.

GRANTs كاملة + RLS owner-only.

---

## 2. تغييرات `generate-reply` (دون استدعاءات AI إضافية)

التدفق الحالي:
```
embed(message) ─┐
                ├─→ AI call → reply
match_knowledge ┘
+ profile
```

التدفق الجديد (نفس عدد استدعاءات AI — `embed` واحد + `chat` واحد):
```
embed(message) ──┬─→ match_knowledge      (top 5 chunks)
                 ├─→ match_successful_replies (top 2 examples)  ← جديد، يستخدم نفس الـ embedding
                 ├─→ user_style_signals    (صف واحد)            ← جديد
                 └─→ profile + usage
                          ↓
                    AI call → reply
```

كل الاستعلامات الجديدة تعمل **بالتوازي** في نفس `Promise.all` الموجود. الكلفة المضافة: ~30-50ms (استعلامات Postgres محلية).

### في البرومبت، نُضيف قسمين قصيرين:
- **STYLE MEMORY** (~200 حرف): "العبارات المفضلة عند المستخدم: …، تجنب: …، الطول المعتاد: X".
- **SIMILAR PAST REPLIES** (~400 حرف): أفضل مثال أو مثالين مع رسالة العميل الأصلية والرد المعتمد.

الإجمالي المضاف للبرومبت: < 700 حرف.

---

## 3. تغييرات الواجهة الأمامية

### `GeneratePage.tsx`
- زر **نسخ** → بعد النسخ: `supabase.functions.invoke('record-feedback', { action: 'copied', message, reply })` (fire-and-forget).
- زر **مفضلة** → نفس الشيء بـ `action: 'favorited'`.
- إذا عدّل المستخدم الرد في textarea ثم ضغط نسخ/مشاركة → `action: 'edited_and_used'` مع `original_reply` و `final_reply` (لاستخراج ما حذفه).

### Edge Function جديدة `record-feedback`
- خفيفة جداً (لا AI). تستدعي `record_reply_feedback` SQL function.
- تعمل في الخلفية، لا تؤثر على UX.

### `KnowledgeBasePage` و `SettingsPage`
- إضافة قسم "أسلوبي المتعلَّم" يعرض `preferred_phrases` و `avoided_phrases` مع زر **مسح الذاكرة**.

---

## 4. السرعة والامتثال

### ميزانية الزمن (الهدف 3-8 ث):
- `embed` (موجود): ~150ms
- 4 استعلامات Postgres بالتوازي: ~80ms (max)
- GPT call: 2-5 ث
- **الإجمالي: 3-6 ث** — لا تغيير ملموس عن الحالي.

### Google Play
- إضافة الذاكرة والـ feedback إلى:
  - تصدير البيانات (`export-business-data` يشمل الجدولين الجديدين).
  - حذف الحساب (`delete_user_data` يشمل الجدولين).
  - نص سياسة الخصوصية يذكر "نتعلم من ردودك المعتمدة لتحسين الأسلوب فقط، ولا نشاركها مع أي طرف ثالث ولا نستخدمها لتدريب نماذج عامة".

---

## 5. الملفات المتأثرة

**جديدة:**
- `supabase/migrations/<ts>_memory_and_feedback.sql`
- `supabase/functions/record-feedback/index.ts`

**معدّلة:**
- `supabase/functions/generate-reply/index.ts` — إضافة استعلامين متوازيين + قسمين في البرومبت.
- `supabase/functions/export-business-data/index.ts` — إضافة الجدولين.
- `supabase/functions/delete-account/index.ts` — الـ RPC `delete_user_data` يُحدّث تلقائياً.
- `src/pages/GeneratePage.tsx` — fire-and-forget feedback عند نسخ/مفضلة/تعديل.
- `src/pages/SettingsPage.tsx` — قسم "أسلوبي المتعلَّم" + مسح الذاكرة.
- `src/pages/PrivacyPage.tsx` — جملة عن الذاكرة.

---

## أسئلة قبل البدء

1. **حد العبارات المحفوظة** — 20 عبارة preferred + 20 avoided لكل مستخدم كافٍ، أم تريد أكثر؟
2. **التعلم من التعديل** — هل أعتبر أي تعديل ≥ 10 أحرف "إشارة أسلوب" أم أطلب من المستخدم تأكيداً صريحاً؟
3. **مشاركة الأمثلة بين المستخدمين** — حالياً كل مستخدم يتعلم من ردوده فقط (خاص وآمن). هل تريد أن تتعلم أنشطة من نفس النوع (مثلاً كل العيادات) من بعضها بشكل مجهول الهوية، أم نبقي كل شيء معزولاً؟ (الخيار المعزول أأمن وأبسط من ناحية الخصوصية).
