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

  const planLabel = usage.isGuest
    ? (locale === "ar" ? "زائر" : "Guest")
    : usage.planState === "trial"
      ? (locale === "ar" ? "تجربة مجانية" : "Free Trial")
      : usage.planState === "trial_expired"
        ? (locale === "ar" ? "انتهت التجربة" : "Trial Ended")
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
      {(() => {
        const isTrial = usage.planState === "trial";
        const isExpired = usage.planState === "trial_expired";
        const used = isTrial ? usage.trialUsed : usage.used;
        const lim = isTrial ? usage.trialLimit : usage.limit;
        const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
        const days = daysLeft(usage.trialEndsAt);
        const usageLine = isExpired
          ? (locale === "ar" ? "انتهت تجربتك المجانية" : "Trial ended")
          : `${used} ${t.settings.of} ${lim} ${locale === "ar" ? "رسالة" : "messages used"}`;
        return (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{t.settings.billing}</h2>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">
                {t.settings.currentPlan}: <span className="text-primary">{planLabel}</span>
              </p>
              <Button variant={isExpired ? "default" : "outline"} size="sm" onClick={() => setUpgradePlan("pro")}>
                {t.settings.upgrade}
              </Button>
            </div>

            {usage.loading ? (
              <p className="text-xs text-muted-foreground">{t.common.loading}</p>
            ) : (
              <div className="space-y-1.5">
                {isTrial && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{locale === "ar" ? "الأيام المتبقية" : "Days remaining"}</span>
                    <span className="font-semibold">{trialLabel(days, locale)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{locale === "ar" ? "الرسائل المستخدمة" : "Messages used"}</span>
                  <span className="font-semibold">{usageLine}</span>
                </div>
                {!isExpired && lim > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{locale === "ar" ? "المتبقي" : "Remaining"}</span>
                    <span className="font-semibold">{Math.max(0, lim - used)} {locale === "ar" ? "رسالة" : "messages"}</span>
                  </div>
                )}
                {!isExpired && lim > 0 && (
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

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
