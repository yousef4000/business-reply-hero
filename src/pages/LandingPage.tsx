import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Sparkles, MessageSquare, Globe, Shield, Zap, Star } from "lucide-react";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";

export default function LandingPage() {
  const { t, locale, setLocale } = useLanguage();
  const [upgradePlan, setUpgradePlan] = useState<PlanKey | null>(null);

  const features = [
    { icon: MessageSquare, title: locale === "en" ? "Multi-Platform" : "متعدد المنصات", desc: locale === "en" ? "WhatsApp, Instagram, Messenger, Email & more" : "واتساب، إنستغرام، ماسنجر، بريد إلكتروني والمزيد" },
    { icon: Zap, title: locale === "en" ? "Instant Replies" : "ردود فورية", desc: locale === "en" ? "AI generates perfect replies in seconds" : "الذكاء الاصطناعي ينشئ ردوداً مثالية في ثوانٍ" },
    { icon: Globe, title: locale === "en" ? "Arabic & English" : "عربي وإنجليزي", desc: locale === "en" ? "Full bilingual support with RTL" : "دعم كامل للغتين مع RTL" },
    { icon: Shield, title: locale === "en" ? "Business Context" : "سياق العمل", desc: locale === "en" ? "Remembers your business profile" : "يتذكر ملف عملك" },
    { icon: Star, title: locale === "en" ? "Save & Reuse" : "حفظ وإعادة استخدام", desc: locale === "en" ? "History, favorites, and templates" : "سجل ومفضلات وقوالب" },
    { icon: Sparkles, title: locale === "en" ? "Smart Actions" : "إجراءات ذكية", desc: locale === "en" ? "Rewrite, shorten, expand, persuade" : "إعادة كتابة، اختصار، توسيع، إقناع" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm safe-top">
        <div className="mobile-container flex items-center justify-between h-14">
          <span className="text-base font-bold text-primary">{t.app.name}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocale(locale === "en" ? "ar" : "en")}>
              {locale === "en" ? "عربي" : "EN"}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/signin">{t.landing.signIn}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mobile-container py-16 lg:py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-medium mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          {locale === "en" ? "AI-Powered Business Replies" : "ردود أعمال مدعومة بالذكاء الاصطناعي"}
        </div>
        <h1 className="text-3xl lg:text-5xl font-bold text-foreground leading-tight max-w-2xl mx-auto">
          {t.landing.hero}
        </h1>
        <p className="mt-4 text-muted-foreground max-w-lg mx-auto text-sm lg:text-base">
          {t.landing.heroSub}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Button size="lg" asChild className="text-base">
            <Link to="/app/generate">{t.landing.cta}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-base">
            <a href="#features">{t.landing.ctaSecondary}</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mobile-container py-16">
        <h2 className="text-2xl font-bold text-center mb-10">{t.landing.features}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
              <f.icon className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mobile-container py-16">
        <h2 className="text-2xl font-bold text-center mb-2">{t.landing.pricing}</h2>
        <p className="text-sm text-muted-foreground text-center mb-10">
          {locale === "ar" ? "خطط مرنة تناسب الأعمال الصغيرة" : "Flexible plans for small businesses"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {(["free", "starter", "pro", "business"] as const).map((plan) => {
            const isPro = plan === "pro";
            return (
              <div
                key={plan}
                className={`relative rounded-2xl border p-5 flex flex-col ${
                  isPro
                    ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-lg sm:scale-[1.02]"
                    : "border-border bg-card"
                }`}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
                    {t.plans.recommended}
                  </span>
                )}
                <h3 className="font-bold text-lg">{t.plans[plan]}</h3>
                <p className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">{t.plans[`${plan}Desc` as const]}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{t.plans.price[plan]}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    /{locale === "ar" ? "شهر" : "mo"}
                  </span>
                </div>
                <p className="text-sm font-medium mt-2">
                  {t.plans.limits[plan]} {t.plans.repliesPerMonth}
                </p>
                <ul className="mt-4 space-y-2 flex-1">
                  {t.plans.features[plan].map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-5 w-full" variant={isPro ? "default" : "outline"} asChild>
                  <Link to={plan === "business" ? "/app/settings" : "/app/generate"}>
                    {t.plans.cta[plan]}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mobile-container text-center text-sm text-muted-foreground">
          © 2026 {t.app.name}. {locale === "en" ? "All rights reserved." : "جميع الحقوق محفوظة."}
        </div>
      </footer>
    </div>
  );
}
