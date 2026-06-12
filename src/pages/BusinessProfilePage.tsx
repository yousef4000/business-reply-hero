import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Save, Loader2 } from "lucide-react";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from "@/lib/templates";

const FIELDS = [
  "business_name", "business_type", "description", "services", "products",
  "pricing", "menu_items", "working_hours", "branches",
  "return_policy", "shipping_policy", "faqs", "custom_notes", "ai_instructions",
] as const;

type FieldKey = typeof FIELDS[number];
type ProfileForm = Record<FieldKey, string> & { preferred_tone: string };

const empty: ProfileForm = {
  business_name: "", business_type: "", description: "", services: "", products: "",
  pricing: "", menu_items: "", working_hours: "", branches: "",
  return_policy: "", shipping_policy: "", faqs: "", custom_notes: "", ai_instructions: "",
  preferred_tone: "professional",
};

const schema = z.object({
  business_name: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

const TONES = ["professional", "friendly", "casual", "persuasive", "empathetic"];

export default function BusinessProfilePage() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("business_profiles")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) {
        setForm({
          ...empty,
          ...Object.fromEntries(
            Object.entries(data).filter(([k]) => k in empty).map(([k, v]) => [k, v ?? ""])
          ) as ProfileForm,
        });
      }
      setLoading(false);
    })();
  }, []);

  const completeness = (() => {
    const filled = FIELDS.filter((k) => (form[k] ?? "").toString().trim().length > 0).length;
    return Math.round((filled / FIELDS.length) * 100);
  })();

  const set = (k: keyof ProfileForm, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!userId) {
      toast({ title: isAr ? "يلزم تسجيل الدخول" : "Sign in required", variant: "destructive" });
      return;
    }
    const parsed = schema.safeParse({ business_name: form.business_name, description: form.description });
    if (!parsed.success) {
      toast({ title: isAr ? "بيانات غير صحيحة" : "Invalid data", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("business_profiles")
      .upsert({ user_id: userId, ...form }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: isAr ? "تعذر الحفظ" : "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isAr ? "تم الحفظ ✅" : "Saved ✅" });
    }
  };

  const L = isAr ? AR : EN;

  if (loading) {
    return (
      <div className="mobile-container py-10 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mobile-container space-y-5 animate-slide-up pb-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">{L.title}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{L.subtitle}</p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{L.completeness}</span>
            <span className="font-semibold tabular-nums">{completeness}%</span>
          </div>
          <Progress value={completeness} className="h-1.5" />
        </div>
      </header>

      <Section title={L.basics}>
        <Field label={L.business_name}>
          <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} maxLength={120} />
        </Field>
        <Field label={L.business_type}>
          <Select value={form.business_type} onValueChange={(v) => set("business_type", v)}>
            <SelectTrigger><SelectValue placeholder={L.choose} /></SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((b) => (
                <SelectItem key={b} value={b}>{BUSINESS_TYPE_LABELS[b][locale]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={L.description}>
          <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} className="resize-none" />
        </Field>
        <Field label={L.preferred_tone}>
          <Select value={form.preferred_tone} onValueChange={(v) => set("preferred_tone", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONES.map((tn) => (<SelectItem key={tn} value={tn}>{tn}</SelectItem>))}
            </SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title={L.offerings}>
        <Field label={L.services}><Textarea rows={3} value={form.services} onChange={(e) => set("services", e.target.value)} className="resize-none" /></Field>
        <Field label={L.products}><Textarea rows={3} value={form.products} onChange={(e) => set("products", e.target.value)} className="resize-none" /></Field>
        <Field label={L.menu_items}><Textarea rows={3} value={form.menu_items} onChange={(e) => set("menu_items", e.target.value)} className="resize-none" /></Field>
      </Section>

      <Section title={L.pricing_section}>
        <Field label={L.pricing}><Textarea rows={3} value={form.pricing} onChange={(e) => set("pricing", e.target.value)} className="resize-none" /></Field>
      </Section>

      <Section title={L.hours_locations}>
        <Field label={L.working_hours}><Input value={form.working_hours} onChange={(e) => set("working_hours", e.target.value)} /></Field>
        <Field label={L.branches}><Textarea rows={2} value={form.branches} onChange={(e) => set("branches", e.target.value)} className="resize-none" /></Field>
      </Section>

      <Section title={L.policies}>
        <Field label={L.return_policy}><Textarea rows={2} value={form.return_policy} onChange={(e) => set("return_policy", e.target.value)} className="resize-none" /></Field>
        <Field label={L.shipping_policy}><Textarea rows={2} value={form.shipping_policy} onChange={(e) => set("shipping_policy", e.target.value)} className="resize-none" /></Field>
      </Section>

      <Section title={L.faqs}>
        <Field label={L.faqs}><Textarea rows={4} value={form.faqs} onChange={(e) => set("faqs", e.target.value)} className="resize-none" /></Field>
      </Section>

      <Section title={L.notes}>
        <Field label={L.custom_notes}><Textarea rows={3} value={form.custom_notes} onChange={(e) => set("custom_notes", e.target.value)} className="resize-none" /></Field>
      </Section>

      <div className="sticky bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px)+1rem)] lg:bottom-4 z-20">
        <Button onClick={onSave} disabled={saving} className="w-full gap-2 shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {L.save}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
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

const EN = {
  title: "My Business Profile",
  subtitle: "Used by the AI to personalize every reply with your real business info.",
  completeness: "Profile completeness",
  basics: "Basics",
  offerings: "Offerings",
  pricing_section: "Pricing",
  hours_locations: "Hours & Locations",
  policies: "Policies",
  faqs: "FAQs",
  notes: "Custom Notes",
  business_name: "Business name",
  business_type: "Business type",
  description: "Business description",
  preferred_tone: "Preferred tone",
  services: "Services",
  products: "Products",
  menu_items: "Menu items",
  pricing: "Pricing info",
  working_hours: "Working hours",
  branches: "Branches / locations",
  return_policy: "Return policy",
  shipping_policy: "Shipping policy",
  custom_notes: "Anything else the AI should know",
  save: "Save business profile",
  choose: "Choose",
};

const AR: typeof EN = {
  title: "ملف عملي",
  subtitle: "يستخدمها الذكاء الاصطناعي لتخصيص الردود ببيانات عملك الحقيقية.",
  completeness: "اكتمال الملف",
  basics: "الأساسيات",
  offerings: "ما تقدمه",
  pricing_section: "الأسعار",
  hours_locations: "المواعيد والفروع",
  policies: "السياسات",
  faqs: "الأسئلة الشائعة",
  notes: "ملاحظات إضافية",
  business_name: "اسم العمل",
  business_type: "نوع العمل",
  description: "وصف العمل",
  preferred_tone: "النبرة المفضلة",
  services: "الخدمات",
  products: "المنتجات",
  menu_items: "بنود المنيو",
  pricing: "معلومات الأسعار",
  working_hours: "ساعات العمل",
  branches: "الفروع والمواقع",
  return_policy: "سياسة الاسترجاع",
  shipping_policy: "سياسة الشحن",
  custom_notes: "أي معلومات إضافية للذكاء الاصطناعي",
  save: "حفظ ملف العمل",
  choose: "اختر",
};
