import { Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUsage } from "@/hooks/use-usage";
import { useLanguage } from "@/i18n/LanguageContext";
import { daysLeft, trialLabel } from "@/lib/trial";

interface Props {
  onUpgrade?: () => void;
  compact?: boolean;
}

export function TrialBanner({ onUpgrade, compact }: Props) {
  const usage = useUsage();
  const { locale } = useLanguage();
  if (usage.loading) return null;

  if (usage.isGuest) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">
            {locale === "ar" ? "ابدأ تجربتك المجانية" : "Start your free trial"}
          </span>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href="/signin">{locale === "ar" ? "تسجيل الدخول" : "Sign in"}</a>
        </Button>
      </div>
    );
  }

  if (usage.planState === "paid") return null;

  if (usage.planState === "trial") {
    const dl = daysLeft(usage.trialEndsAt);
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            {locale === "ar" ? "تجربة مجانية" : "Free trial"} · {trialLabel(dl, locale)}
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {usage.used}/{usage.limit}
          </span>
        </div>
        <Progress value={Math.min(100, (usage.used / Math.max(1, usage.limit)) * 100)} className="h-1.5" />
        {!compact && (
          <p className="text-[11px] text-muted-foreground">
            {locale === "ar"
              ? "كل الميزات المتقدمة مفعلة خلال التجربة."
              : "All premium features unlocked during trial."}
          </p>
        )}
      </div>
    );
  }

  // trial_expired
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-destructive">
            {locale === "ar" ? "انتهت تجربتك المجانية" : "Your free trial has ended"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === "ar"
              ? "قم بالترقية للاستمرار في إنشاء الردود."
              : "Upgrade to keep generating replies."}
          </p>
        </div>
      </div>
      {onUpgrade && (
        <Button size="sm" className="w-full" onClick={onUpgrade}>
          {locale === "ar" ? "ترقية الآن" : "Upgrade now"}
        </Button>
      )}
    </div>
  );
}
