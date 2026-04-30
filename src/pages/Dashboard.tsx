import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { Sparkles, Clock, Heart, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUsage } from "@/hooks/use-usage";

export default function Dashboard() {
  const { t, locale } = useLanguage();
  const usage = useUsage();
  const usagePct = Math.min(100, (usage.used / Math.max(1, usage.limit)) * 100);

  const stats = [
    { label: locale === "en" ? "This Month" : "ردود هذا الشهر", value: String(usage.used), icon: Sparkles, color: "text-primary" },
    { label: locale === "en" ? "Limit" : "الحد الشهري", value: String(usage.limit), icon: TrendingUp, color: "text-success" },
    { label: locale === "en" ? "Saved" : "محفوظة", value: "0", icon: Heart, color: "text-destructive" },
    { label: locale === "en" ? "History" : "السجل", value: "0", icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="mobile-container space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold">{locale === "en" ? "Welcome back!" : "مرحباً بعودتك!"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.app.tagline}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Action */}
      <Button size="lg" className="w-full text-base gap-2" asChild>
        <Link to="/app/generate">
          <Sparkles className="h-5 w-5" />
          {t.generate.generateBtn}
        </Link>
      </Button>

      {/* Usage */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{t.settings.usage}</span>
          <span className="text-xs text-muted-foreground">89 / 500 {t.settings.repliesUsed}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary rounded-full h-2 transition-all" style={{ width: "18%" }} />
        </div>
      </div>

      {/* Recent */}
      <div>
        <h2 className="text-sm font-semibold mb-3">{locale === "en" ? "Recent Replies" : "الردود الأخيرة"}</h2>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-3 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">WhatsApp</span>
              <span className="text-xs text-muted-foreground">{locale === "en" ? "2 hours ago" : "منذ ساعتين"}</span>
            </div>
            <p className="text-sm text-foreground line-clamp-2">
              {locale === "en"
                ? "Thank you for reaching out! We'd love to help you with your booking..."
                : "شكراً لتواصلك! يسعدنا مساعدتك في حجزك..."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
