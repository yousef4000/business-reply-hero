import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Target, MessageSquare, Sparkles, ThumbsUp, ThumbsDown, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Analytics {
  total: number;
  success: number;
  failure: number;
  success_rate: number | null;
  best_tone: Array<{ name: string; total: number; success: number; success_rate: number }>;
  best_style: Array<{ name: string; total: number; success: number; success_rate: number }>;
  top_objections: Array<{ name: string; total: number; success: number }>;
  top_closing: Array<{ context: string; wins: number; sample: string }>;
  recent: Array<{ outcome: string; tone?: string; reply_style?: string; objection_type?: string; created_at: string }>;
}

const styleLabels: Record<string, { en: string; ar: string }> = {
  soft: { en: "Soft", ar: "لطيف" },
  persuasive: { en: "Persuasive", ar: "مقنع" },
  directClosing: { en: "Direct Close", ar: "إغلاق مباشر" },
};
const toneLabels: Record<string, { en: string; ar: string }> = {
  professional: { en: "Professional", ar: "احترافي" },
  friendly: { en: "Friendly", ar: "ودود" },
  casual: { en: "Casual", ar: "غير رسمي" },
  persuasive: { en: "Persuasive", ar: "مقنع" },
  empathetic: { en: "Empathetic", ar: "متعاطف" },
};
const objLabels: Record<string, { en: string; ar: string }> = {
  price: { en: "Price", ar: "السعر" },
  hesitation: { en: "Hesitation", ar: "تردد" },
  comparison: { en: "Comparison", ar: "مقارنة" },
  discount: { en: "Discount", ar: "خصم" },
  trust: { en: "Trust", ar: "ثقة" },
  timing: { en: "Timing", ar: "توقيت" },
};

export default function AnalyticsPage() {
  const { locale } = useLanguage();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setError(locale === "ar" ? "سجّل الدخول لعرض التحليلات." : "Sign in to view your insights.");
        setLoading(false);
        return;
      }
      const { data: res, error } = await supabase.rpc("get_reply_analytics", { _user_id: u.user.id });
      if (error) throw error;
      setData(res as unknown as Analytics);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);
  const label = (map: Record<string, { en: string; ar: string }>, k?: string | null) =>
    k && map[k] ? (locale === "ar" ? map[k].ar : map[k].en) : (k ?? "—");

  if (loading) {
    return (
      <div className="mobile-container py-8">
        <p className="text-sm text-muted-foreground">{t("Loading insights…", "جاري تحميل التحليلات…")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mobile-container py-8 space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={load}>{t("Retry", "إعادة المحاولة")}</Button>
      </div>
    );
  }

  const empty = !data || data.total === 0;
  const successRate = data?.success_rate ?? null;

  return (
    <div className="mobile-container space-y-5 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("Smart Memory Insights", "تحليلات الذاكرة الذكية")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "What works for your customers — learned from your Success / Failure feedback.",
              "ما الذي يعمل مع عملائك — مبني على تقييمك (نجاح / فشل) لكل رد.",
            )}
          </p>
        </div>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
          <Sparkles className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {t(
              "No feedback yet. After generating a reply, tap Success or Failure to start training your AI.",
              "لا توجد تقييمات بعد. بعد توليد أي رد، اضغط نجاح أو فشل لبدء تدريب الذكاء الاصطناعي.",
            )}
          </p>
        </div>
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t("Success Rate", "نسبة النجاح")}</div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {successRate !== null ? `${successRate}%` : "—"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {data!.success}/{data!.total} {t("replies", "رد")}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-success" />
                {t("Wins", "نجاح")}
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-success">{data!.success}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <ThumbsDown className="h-3 w-3 text-destructive" />
                {t("Misses", "فشل")}
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1 text-destructive">{data!.failure}</div>
            </div>
          </div>

          {/* Best tone */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("Best Performing Tone", "أفضل نبرة أداءً")}
            </h2>
            {data!.best_tone.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("Need at least 2 outcomes per tone.", "يحتاج تقييمين على الأقل لكل نبرة.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {data!.best_tone.map((row) => (
                  <li key={row.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-28 truncate">{label(toneLabels, row.name)}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${row.success_rate}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums w-20 text-end text-muted-foreground">
                      {row.success_rate}% · {row.total}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Best reply style */}
          {data!.best_style.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("Best Reply Style", "أفضل أسلوب رد")}
              </h2>
              <ul className="space-y-2">
                {data!.best_style.map((row) => (
                  <li key={row.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-28 truncate">{label(styleLabels, row.name)}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${row.success_rate}%` }} />
                    </div>
                    <span className="text-xs tabular-nums w-20 text-end text-muted-foreground">
                      {row.success_rate}% · {row.total}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Top objections */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              {t("Most Common Objections", "أكثر الاعتراضات شيوعاً")}
            </h2>
            {data!.top_objections.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("No objections recorded yet.", "لا توجد اعتراضات مسجلة بعد.")}
              </p>
            ) : (
              <ul className="space-y-2">
                {data!.top_objections.map((o) => (
                  <li key={o.name} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{label(objLabels, o.name)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {o.success}/{o.total} {t("wins", "نجاح")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top closing strategies */}
          {data!.top_closing.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                {t("Top Closing Strategies", "أفضل أساليب الإغلاق")}
              </h2>
              <ul className="space-y-3">
                {data!.top_closing.map((c, i) => (
                  <li key={i} className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">
                        {label(objLabels, c.context) || c.context}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.wins} {t("wins", "نجاح")}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/80" dir="auto">
                      {c.sample.length > 220 ? `${c.sample.slice(0, 220)}…` : c.sample}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Recent trend */}
          {data!.recent.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-4 space-y-2">
              <h2 className="text-sm font-semibold">{t("Recent activity", "النشاط الأخير")}</h2>
              <div className="flex flex-wrap gap-1.5">
                {data!.recent.map((r, i) => (
                  <span
                    key={i}
                    title={`${r.outcome} · ${r.tone ?? ""} · ${r.reply_style ?? ""}`}
                    className={`inline-block w-3 h-3 rounded-sm ${
                      r.outcome === "success" ? "bg-success" : "bg-destructive"
                    }`}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
