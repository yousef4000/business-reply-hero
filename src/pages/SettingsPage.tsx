import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Globe, User, Building2, CreditCard, ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";
import { useUsage } from "@/hooks/use-usage";
import { supabase } from "@/integrations/supabase/client";
import { TrialBanner } from "@/components/TrialBanner";
import { daysLeft, trialLabel } from "@/lib/trial";

export default function SettingsPage() {
  const { t, locale, setLocale } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const usage = useUsage();
  const [upgradePlan, setUpgradePlan] = useState<PlanKey | null>(null);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: t.common.error, description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: locale === "ar" ? "تم تسجيل الخروج" : "Signed out" });
    navigate("/");
  };

  const planLabel = usage.planState === "trial"
    ? (locale === "ar" ? "تجربة مجانية" : "Free trial")
    : usage.planState === "trial_expired"
      ? (locale === "ar" ? "انتهت التجربة" : "Trial ended")
      : t.plans[usage.plan as "free" | "starter" | "pro" | "business"] ?? usage.plan;

  return (
    <div className="mobile-container space-y-6 animate-slide-up pb-8">
      <h1 className="text-xl font-bold">{t.settings.title}</h1>

      <TrialBanner onUpgrade={() => setUpgradePlan("pro")} />

      {/* Language */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.language}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant={locale === "en" ? "default" : "outline"} size="sm" onClick={() => setLocale("en")}>English</Button>
          <Button variant={locale === "ar" ? "default" : "outline"} size="sm" onClick={() => setLocale("ar")}>العربية</Button>
        </div>
      </div>

      {/* My Business Profile (link) */}
      <Link
        to="/app/business"
        className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {locale === "ar" ? "ملف عملي" : "My Business Profile"}
            </p>
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "اجعل الردود مخصصة لنشاطك التجاري"
                : "Personalize every reply with your business info"}
            </p>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground ${locale === "ar" ? "rotate-180" : ""}`} />
      </Link>

      {/* Billing */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.billing}</h2>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {t.settings.currentPlan}: <span className="text-primary">{planLabel}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {usage.loading
                ? t.common.loading
                : usage.planState === "trial"
                  ? `${usage.used} ${t.settings.of} ${usage.limit} · ${trialLabel(daysLeft(usage.trialEndsAt), locale)}`
                  : usage.planState === "trial_expired"
                    ? (locale === "ar" ? "انتهت تجربتك المجانية" : "Trial ended")
                    : `${usage.used} ${t.settings.of} ${usage.limit} ${t.settings.repliesUsed}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setUpgradePlan("pro")}>{t.settings.upgrade}</Button>
        </div>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.account}</h2>
        </div>
        <Button variant="outline" className="w-full text-destructive gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {t.settings.signOut}
        </Button>
      </div>

      <UpgradeModal open={!!upgradePlan} onOpenChange={(o) => !o && setUpgradePlan(null)} plan={upgradePlan} />
    </div>
  );
}
