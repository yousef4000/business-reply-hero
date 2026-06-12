import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sparkles, MessageSquare, Globe, Zap, Star, Store, Dumbbell, Stethoscope, GraduationCap, Building2, Briefcase, Quote, BookOpen, Layers, Brain, Share2, Gift, Check } from "lucide-react";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";

export default function LandingPage() {
  const { t, locale, setLocale } = useLanguage();
  const [upgradePlan, setUpgradePlan] = useState<PlanKey | null>(null);
  const isAr = locale === "ar";

  const audiences = [
    { icon: Store, label: isAr ? "المتاجر" : "Stores" },
    { icon: Dumbbell, label: isAr ? "الجيمات والمدربين" : "Gyms & Trainers" },
    { icon: Stethoscope, label: isAr ? "العيادات" : "Clinics" },
    { icon: GraduationCap, label: isAr ? "الكورسات" : "Courses" },
    { icon: Building2, label: isAr ? "العقارات" : "Real Estate" },
    { icon: Briefcase, label: isAr ? "الخدمات" : "Services" },
  ];

  const featureSections = [
    {
      icon: BookOpen,
      title: isAr ? "قاعدة معرفة عملك" : "Business Knowledge Base",
      desc: isAr
        ? "احفظ خدماتك، أسعارك، ساعات العمل والسياسات مرة واحدة — وكل رد يخرج مخصصًا لعملك."
        : "Save your services, prices, hours, and policies once — every reply is personalized to your business.",
    },
    {
      icon: Layers,
      title: isAr ? "قوالب ذكية" : "Smart Templates",
      desc: isAr
        ? "اختر نوع نشاطك واحصل على أهداف ردود جاهزة: حجز، استفسار سعر، متابعة طلب والمزيد."
        : "Pick your business type and get ready-made goals: booking, pricing inquiry, order follow-up, and more.",
    },
    {
      icon: Brain,
      title: isAr ? "مدرّب اعتراضات بالذكاء الاصطناعي" : "AI Objection Coach",
      desc: isAr
        ? "يكتشف اعتراضات السعر والثقة والمنافسين ويعطيك استراتيجية المبيعات + نصيحة المدرّب لكل رد."
        : "Detects price, trust, and competitor objections and shows you the sales strategy + a coaching tip for every reply.",
    },
    {
      icon: Share2,
      title: isAr ? "شارك إلى Smart Reply" : "Share to Smart Reply",
      desc: isAr
        ? "من واتساب أو إنستغرام، شارك رسالة العميل مباشرة إلى التطبيق ويتم إنشاء الرد فورًا."
        : "From WhatsApp or Instagram, share a customer message straight into the app and a reply is generated instantly.",
    },
    {
      icon: Gift,
      title: isAr ? "تجربة مجانية 7 أيام" : "7-Day Free Trial",
      desc: isAr
        ? "30 ردًا مع كل الميزات المتقدمة مفعّلة. بدون بطاقة ائتمان."
        : "30 replies with every premium feature unlocked. No credit card required.",
    },
  ];

  const heroTitle = isAr
    ? "حوّل رسائل العملاء إلى ردود تقفل البيع"
    : "Turn customer messages into replies that close the sale";
  const heroSub = isAr
    ? "مساعد ذكي يكتب لك ردودًا احترافية على واتساب وإنستغرام والبريد، ويدرّبك على معالجة اعتراضات العملاء — مصمم للعيادات والمطاعم والجيمات والمتاجر والكورسات."
    : "An AI assistant that writes professional replies for WhatsApp, Instagram and email — and coaches you through every objection. Built for clinics, restaurants, gyms, stores, and course providers.";
  const ctaPrimary = isAr ? "ابدأ تجربتك المجانية 7 أيام" : "Start your 7-day free trial";

  const exampleCustomer = isAr ? "السعر غالي" : "The price is too expensive";
  const exampleReply = isAr
    ? "فاهمك جدًا، لكن الفكرة إنك مش بتدفع مقابل الخدمة فقط، أنت بتدفع مقابل نتيجة ومتابعة توفر عليك وقت. تحب أشرح لك أنسب باقة حسب احتياجك؟"
    : "I totally understand — but you're not paying for the service alone, you're paying for results and follow-up that save you time. Want me to suggest the best package for you?";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm safe-top">
        <div className="mobile-container flex items-center justify-between h-14">
          <span className="text-base font-bold text-primary">{t.app.name}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocale(isAr ? "en" : "ar")}>
              {isAr ? "EN" : "عربي"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/signin">{t.landing.signIn}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mobile-container py-14 lg:py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          {isAr ? "مدرّب مبيعات بالذكاء الاصطناعي" : "Your AI sales coach"}
        </div>
        <h1 className="text-3xl lg:text-5xl font-bold text-foreground leading-tight max-w-2xl mx-auto">
          {heroTitle}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm lg:text-base leading-relaxed">
          {heroSub}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Button size="lg" asChild className="text-base">
            <Link to="/app/generate">{ctaPrimary}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-base">
            <a href="#example">{isAr ? "شاهد مثالًا" : "See an example"}</a>
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          {isAr ? "30 رد مجانًا · بدون بطاقة ائتمان" : "30 free replies · no credit card"}
        </p>
      </section>

      {/* Example */}
      <section id="example" className="mobile-container pb-16">
        <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-5 lg:p-7 shadow-sm">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wide mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            {isAr ? "مثال حقيقي" : "Real example"}
          </div>
          <div className="flex flex-col items-start mb-3">
            <span className="text-[11px] text-muted-foreground mb-1">{isAr ? "رسالة العميل" : "Customer message"}</span>
            <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-muted px-4 py-2.5 text-sm" dir="auto">{exampleCustomer}</div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-muted-foreground mb-1">{isAr ? "الرد الذكي" : "AI reply"}</span>
            <div className="max-w-[90%] rounded-2xl rounded-se-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed" dir="auto">
              <Quote className="h-3.5 w-3.5 opacity-70 mb-1" />
              {exampleReply}
            </div>
          </div>
          <div className="mt-6 text-center">
            <Button asChild><Link to="/app/generate">{ctaPrimary}</Link></Button>
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="mobile-container pb-16">
        <h2 className="text-xl lg:text-2xl font-bold text-center mb-2">
          {isAr ? "مصمم لكل نشاط تجاري" : "Built for every business"}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-8">
          {isAr ? "تجربة مخصّصة لمجالك" : "Tailored to your industry"}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-3xl mx-auto">
          {audiences.map((a, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <a.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-xs font-medium text-center">{a.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* New core features */}
      <section className="mobile-container py-16">
        <h2 className="text-2xl lg:text-3xl font-bold text-center mb-3">
          {isAr ? "كل ما تحتاجه للرد على عملائك" : "Everything you need to reply better"}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-10 max-w-xl mx-auto">
          {isAr ? "ميزات متكاملة تتعلم نشاطك وتدرّبك على البيع" : "Integrated features that learn your business and coach your sales"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {featureSections.map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mobile-container py-16">
        <h2 className="text-2xl font-bold text-center mb-2">{t.landing.pricing}</h2>
        <p className="text-sm text-muted-foreground text-center mb-10">
          {isAr ? "ابدأ بتجربة مجانية. ارتقِ متى احتجت." : "Start free. Upgrade when you need more."}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {[
            {
              key: "trial",
              name: isAr ? "تجربة مجانية" : "Free Trial",
              price: isAr ? "مجانًا" : "Free",
              tag: (t.plans as any).trialTag ?? (isAr ? "7 أيام مجانية + 30 رسالة" : "7 days free + 30 replies"),
              cta: isAr ? "ابدأ التجربة" : "Start trial",
              link: "/app/generate",
              features: t.plans.features.free as unknown as string[],
              highlight: false,
            },
            {
              key: "starter",
              name: t.plans.starter,
              price: t.plans.price.starter,
              tag: `150 ${isAr ? "رد شهريًا" : "replies/mo"}`,
              cta: t.plans.cta.starter,
              features: t.plans.features.starter as unknown as string[],
              highlight: false,
            },
            {
              key: "pro",
              name: t.plans.pro,
              price: t.plans.price.pro,
              tag: `500 ${isAr ? "رد شهريًا" : "replies/mo"}`,
              cta: t.plans.cta.pro,
              features: t.plans.features.pro as unknown as string[],
              highlight: true,
            },
            {
              key: "business",
              name: t.plans.business,
              price: t.plans.price.business,
              tag: `2000 ${isAr ? "رد شهريًا" : "replies/mo"}`,
              cta: t.plans.cta.business,
              features: t.plans.features.business as unknown as string[],
              highlight: false,
            },
          ].map((p) => (
            <div
              key={p.key}
              className={`relative rounded-2xl border p-5 flex flex-col ${
                p.highlight ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-lg sm:scale-[1.02]" : "border-border bg-card"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                  {t.plans.recommended}
                </span>
              )}
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{p.tag}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{p.price}</span>
                {p.key !== "trial" && <span className="text-sm font-normal text-muted-foreground">/{isAr ? "شهر" : "mo"}</span>}
              </div>
              <ul className="mt-4 space-y-2 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {p.link ? (
                <Button className="mt-5 w-full" variant={p.highlight ? "default" : "outline"} asChild>
                  <Link to={p.link}>{p.cta}</Link>
                </Button>
              ) : (
                <Button
                  className="mt-5 w-full"
                  variant={p.highlight ? "default" : "outline"}
                  onClick={() => setUpgradePlan(p.key as PlanKey)}
                >
                  {p.cta}
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <div className="mobile-container text-center text-sm text-muted-foreground leading-relaxed break-words space-y-3" dir="auto">
          <div className="flex flex-wrap justify-center gap-4 text-xs">
            <a href="/privacy" className="hover:text-primary">{isAr ? "الخصوصية" : "Privacy"}</a>
            <a href="/terms" className="hover:text-primary">{isAr ? "الشروط" : "Terms"}</a>
            <a href="/data-deletion" className="hover:text-primary">{isAr ? "حذف البيانات" : "Data Deletion"}</a>
          </div>
          <div>© 2026 {t.app.name}. {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}</div>
        </div>
      </footer>

      <UpgradeModal open={!!upgradePlan} onOpenChange={(o) => !o && setUpgradePlan(null)} plan={upgradePlan} />
    </div>
  );
}
