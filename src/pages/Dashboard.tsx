import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { Sparkles, Building2, BookOpen, Shield, Share2, AlertTriangle, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "@/hooks/use-usage";
import { useState } from "react";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";
import { daysLeft, trialLabel } from "@/lib/trial";

export default function Dashboard() {
  const { locale } = useLanguage();
  const usage = useUsage();
  const [upgradePlan, setUpgradePlan] = useState<PlanKey | null>(null);

  const isAr = locale === "ar";
  const isTrial = usage.planState === "trial";
  const isExpired = usage.planState === "trial_expired";
  const isPaid = usage.planState === "paid";

  const used = isTrial ? usage.trialUsed : usage.used;
  const lim = isTrial ? usage.trialLimit : usage.limit;
  const remaining = Math.max(0, lim - used);
  const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
  const days = daysLeft(usage.trialEndsAt);
  const barColor = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";

  const features = [
    {
      to: "/app/business",
      icon: Building2,
      title: isAr ? "ملف عملي" : "Business Profile",
      desc: isAr ? "خصّص الردود حسب نشاطك التجاري" : "Personalize replies for your business",
    },
    {
      to: "/app/generate",
      icon: BookOpen,
      title: isAr ? "قوالب ذكية" : "Smart Templates",
      desc: isAr ? "قوالب جاهزة لكل نوع عميل" : "Ready-made templates for every scenario",
    },
    {
      to: "/app/generate",
      icon: Shield,
      title: isAr ? "معالج الاعتراضات بالذكاء الاصطناعي" : "AI Objection Handler",
      desc: isAr ? "ردود مدروسة على اعتراضات العملاء" : "Smart responses to customer objections",
    },
    {
      to: "/app/generate",
      icon: Share2,
      title: isAr ? "مشاركة إلى Smart Reply" : "Share To Smart Reply",
      desc: isAr ? "أرسل أي رسالة من تطبيقاتك مباشرة" : "Send any message from other apps directly",
    },
  ];

  return (
    <div className="mobile-container space-y-6 animate-slide-up pb-8">
      <div>
        <h1 className="text-2xl font-bold">
          {isAr ? "مرحبًا بعودتك" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "أنشئ ردودًا احترافية لعملائك خلال ثوانٍ."
            : "Craft professional replies for your customers in seconds."}
        </p>
      </div>

      {/* Status card */}
      {usage.isGuest ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">
              {isAr ? "ابدأ تجربتك المجانية" : "Start your free trial"}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "سجّل الدخول للحصول على 7 أيام مجانية و30 رسالة بكل المميزات."
              : "Sign in to unlock 7 free days and 30 messages with all premium features."}
          </p>
          <Button asChild className="w-full gap-2">
            <Link to="/signin"><LogIn className="h-4 w-4" />{isAr ? "تسجيل الدخول" : "Sign in"}</Link>
          </Button>
        </div>
      ) : isExpired ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-destructive">
                {isAr ? "انتهت التجربة المجانية" : "Free Trial Expired"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isAr ? "الترقية مطلوبة للاستمرار في إنشاء الردود." : "Upgrade required to continue generating replies."}
              </p>
            </div>
          </div>
          <Button className="w-full" onClick={() => setUpgradePlan("pro")}>
            {isAr ? "ترقية الآن" : "Upgrade Now"}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">
                {isPaid
                  ? (isAr ? "الخطة نشطة" : "Plan Active")
                  : (isAr ? "التجربة المجانية نشطة" : "Free Trial Active")}
              </h2>
            </div>
            {isTrial && (
              <span className="text-xs font-medium text-primary bg-primary/15 px-2 py-1 rounded-full">
                {trialLabel(days, locale)}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold tabular-nums">
                {remaining} / {lim}
              </span>
              <span className="text-xs text-muted-foreground">
                {isAr ? "رسالة متبقية" : "messages remaining"}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            {isTrial && (
              <p className="text-xs text-muted-foreground">
                {isAr ? `${days} ${days === 1 ? "يوم" : "أيام"} متبقية في التجربة` : `${days} ${days === 1 ? "day" : "days"} left in your trial`}
              </p>
            )}
          </div>

          <Button asChild size="lg" className="w-full gap-2">
            <Link to="/app/generate">
              <Sparkles className="h-5 w-5" />
              {isAr ? "إنشاء رد" : "Generate Response"}
            </Link>
          </Button>
        </div>
      )}

      {/* Feature cards */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          {isAr ? "استكشف الميزات" : "Explore Features"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => (
            <Link
              key={f.title}
              to={f.to}
              className="rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-start gap-3"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <UpgradeModal open={!!upgradePlan} onOpenChange={(o) => !o && setUpgradePlan(null)} plan={upgradePlan} />
    </div>
  );
}
