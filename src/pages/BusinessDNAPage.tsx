import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Dna, Loader2, Save, Sparkles, Wand2, RotateCcw } from "lucide-react";

type DNA = {
  industry: string;
  main_services: string[];
  target_audience: string;
  communication_style: string;
  sales_style: string;
  trust_signals: string[];
  typical_questions: string[];
  common_objections: string[];
  preferred_reply_length: "short" | "medium" | "long";
};

const SOCIAL_KEYS = ["facebook", "instagram", "twitter", "linkedin", "tiktok", "youtube"] as const;

const emptyDNA: DNA = {
  industry: "",
  main_services: [],
  target_audience: "",
  communication_style: "",
  sales_style: "",
  trust_signals: [],
  typical_questions: [],
  common_objections: [],
  preferred_reply_length: "medium",
};

export default function BusinessDNAPage() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const L = isAr ? AR : EN;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [social, setSocial] = useState<Record<string, string>>({});

  const [dna, setDna] = useState<DNA | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [editedAt, setEditedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("business_profiles")
        .select("business_name,description,website_url,social_links,business_dna,dna_generated_at,dna_edited_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) {
        setBusinessName(data.business_name ?? "");
        setDescription(data.description ?? "");
        setWebsiteUrl(data.website_url ?? "");
        setSocial((data.social_links as Record<string, string>) ?? {});
        setDna((data.business_dna as DNA) ?? null);
        setGeneratedAt(data.dna_generated_at ?? null);
        setEditedAt(data.dna_edited_at ?? null);
      }
      setLoading(false);
    })();
  }, []);

  const canGenerate = useMemo(
    () => Boolean(businessName.trim() || description.trim() || websiteUrl.trim()),
    [businessName, description, websiteUrl],
  );

  const handleGenerate = async () => {
    if (!userId) { toast({ title: L.signInRequired, variant: "destructive" }); return; }
    if (!canGenerate) { toast({ title: L.fillSomething, variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-business-dna", {
        body: {
          business_name: businessName.trim(),
          description: description.trim(),
          website_url: websiteUrl.trim(),
          social_links: Object.fromEntries(
            Object.entries(social).filter(([, v]) => v && v.trim()),
          ),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setDna((data as any).dna);
      setGeneratedAt((data as any).dna_generated_at);
      setEditedAt(null);
      toast({ title: L.generated });
    } catch (e: any) {
      toast({ title: L.generateFailed, description: e?.message ?? "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !dna) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("business_profiles")
      .upsert(
        {
          user_id: userId,
          business_name: businessName,
          description,
          website_url: websiteUrl || null,
          social_links: social,
          business_dna: dna,
          dna_edited_at: now,
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      toast({ title: L.saveFailed, description: error.message, variant: "destructive" });
    } else {
      setEditedAt(now);
      toast({ title: L.saved });
    }
  };

  if (loading) {
    return (
      <div className="mobile-container py-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mobile-container space-y-5 animate-slide-up pb-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Dna className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{L.title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{L.subtitle}</p>
      </header>

      {/* Inputs */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">{L.inputs}</h2>
        <div className="space-y-1.5">
          <Label className="text-xs">{L.businessName}</Label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L.description}</Label>
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="resize-none" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{L.website}</Label>
          <Input type="url" placeholder="https://..." value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} maxLength={300} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">{L.socials}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SOCIAL_KEYS.map((k) => (
              <Input
                key={k}
                placeholder={k}
                value={social[k] ?? ""}
                onChange={(e) => setSocial((s) => ({ ...s, [k]: e.target.value }))}
                maxLength={300}
              />
            ))}
          </div>
        </div>
        <Button onClick={handleGenerate} disabled={generating || !canGenerate} className="w-full gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {dna ? L.regenerate : L.generate}
        </Button>
      </section>

      {/* DNA dashboard */}
      {dna ? (
        <section className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> {L.dnaTitle}
            </h2>
            <div className="text-[10px] text-muted-foreground text-end">
              {generatedAt && <div>{L.generatedAt}: {new Date(generatedAt).toLocaleString()}</div>}
              {editedAt && <div>{L.editedAt}: {new Date(editedAt).toLocaleString()}</div>}
            </div>
          </div>

          <Field label={L.industry}>
            <Input value={dna.industry} onChange={(e) => setDna({ ...dna, industry: e.target.value })} />
          </Field>

          <ListField
            label={L.mainServices}
            items={dna.main_services}
            onChange={(arr) => setDna({ ...dna, main_services: arr })}
          />

          <Field label={L.targetAudience}>
            <Textarea rows={2} value={dna.target_audience} onChange={(e) => setDna({ ...dna, target_audience: e.target.value })} className="resize-none" />
          </Field>

          <Field label={L.commStyle}>
            <Textarea rows={2} value={dna.communication_style} onChange={(e) => setDna({ ...dna, communication_style: e.target.value })} className="resize-none" />
          </Field>

          <Field label={L.salesStyle}>
            <Textarea rows={2} value={dna.sales_style} onChange={(e) => setDna({ ...dna, sales_style: e.target.value })} className="resize-none" />
          </Field>

          <ListField label={L.trustSignals} items={dna.trust_signals} onChange={(arr) => setDna({ ...dna, trust_signals: arr })} />
          <ListField label={L.typicalQuestions} items={dna.typical_questions} onChange={(arr) => setDna({ ...dna, typical_questions: arr })} />
          <ListField label={L.commonObjections} items={dna.common_objections} onChange={(arr) => setDna({ ...dna, common_objections: arr })} />

          <Field label={L.replyLength}>
            <Select
              value={dna.preferred_reply_length}
              onValueChange={(v) => setDna({ ...dna, preferred_reply_length: v as DNA["preferred_reply_length"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">{L.short}</SelectItem>
                <SelectItem value="medium">{L.medium}</SelectItem>
                <SelectItem value="long">{L.long}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {L.save}
            </Button>
            <Button variant="outline" onClick={handleGenerate} disabled={generating} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {L.regenerate}
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {L.emptyHint}
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ListField({
  label, items, onChange,
}: { label: string; items: string[]; onChange: (arr: string[]) => void }) {
  const text = (items ?? []).join("\n");
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea
        rows={Math.min(8, Math.max(3, (items?.length ?? 0) + 1))}
        value={text}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        className="resize-none font-mono text-xs"
        placeholder="One item per line"
      />
    </div>
  );
}

const EN = {
  title: "Business DNA",
  subtitle: "Smart Reply Hub uses this profile as deep context for every AI reply. Fill the inputs and let AI build your DNA — then refine any field.",
  inputs: "Business inputs",
  businessName: "Business name",
  description: "Business description",
  website: "Website URL",
  socials: "Social links",
  generate: "Generate Business DNA",
  regenerate: "Regenerate",
  dnaTitle: "Generated DNA",
  industry: "Industry",
  mainServices: "Main services",
  targetAudience: "Target audience",
  commStyle: "Communication style",
  salesStyle: "Sales style",
  trustSignals: "Trust signals",
  typicalQuestions: "Typical customer questions",
  commonObjections: "Common customer objections",
  replyLength: "Preferred reply length",
  short: "Short",
  medium: "Medium",
  long: "Long",
  save: "Save DNA",
  saved: "DNA saved ✓",
  saveFailed: "Save failed",
  generated: "DNA generated ✓",
  generateFailed: "Generation failed",
  fillSomething: "Add a business name, description, or website first.",
  signInRequired: "Sign in required",
  generatedAt: "Generated",
  editedAt: "Last edited",
  emptyHint: "No DNA yet — fill the inputs above and tap Generate.",
};

const AR: typeof EN = {
  title: "هوية النشاط (Business DNA)",
  subtitle: "يستخدم Smart Reply Hub هذه الهوية كسياق عميق لكل رد. املأ المدخلات ودع الذكاء يبني الهوية — ثم عدّل أي حقل.",
  inputs: "مدخلات النشاط",
  businessName: "اسم النشاط",
  description: "وصف النشاط",
  website: "رابط الموقع",
  socials: "روابط السوشيال",
  generate: "توليد هوية النشاط",
  regenerate: "إعادة التوليد",
  dnaTitle: "الهوية المُولَّدة",
  industry: "المجال",
  mainServices: "الخدمات الرئيسية",
  targetAudience: "الجمهور المستهدف",
  commStyle: "أسلوب التواصل",
  salesStyle: "أسلوب البيع",
  trustSignals: "إشارات الثقة",
  typicalQuestions: "أسئلة العملاء الشائعة",
  commonObjections: "اعتراضات العملاء الشائعة",
  replyLength: "طول الرد المفضل",
  short: "قصير",
  medium: "متوسط",
  long: "طويل",
  save: "حفظ الهوية",
  saved: "تم حفظ الهوية ✓",
  saveFailed: "تعذر الحفظ",
  generated: "تم توليد الهوية ✓",
  generateFailed: "فشل التوليد",
  fillSomething: "أدخل اسم النشاط أو الوصف أو الموقع أولاً.",
  signInRequired: "يلزم تسجيل الدخول",
  generatedAt: "تم التوليد",
  editedAt: "آخر تعديل",
  emptyHint: "لا توجد هوية بعد — املأ المدخلات بالأعلى ثم اضغط توليد.",
};
