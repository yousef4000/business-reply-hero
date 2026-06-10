import { Brain, Target, Lightbulb } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export interface ObjectionAnalysis {
  type: string;
  strategy: string;
  coaching_tip: string;
}

const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  price: { en: "Price objection", ar: "اعتراض على السعر" },
  trust: { en: "Trust objection", ar: "اعتراض على الثقة" },
  timing: { en: "Timing objection", ar: "اعتراض على التوقيت" },
  competitor: { en: "Competitor comparison", ar: "مقارنة بالمنافس" },
  need: { en: "Need uncertainty", ar: "عدم تأكد من الحاجة" },
  budget: { en: "Budget concerns", ar: "قلق بشأن الميزانية" },
  decision_maker: { en: "Decision-maker objection", ar: "اعتراض من صاحب القرار" },
  none: { en: "No objection detected", ar: "لا يوجد اعتراض" },
};

export function ObjectionCard({ analysis }: { analysis: ObjectionAnalysis }) {
  const { locale } = useLanguage();
  if (!analysis || !analysis.type || analysis.type === "none") return null;

  const typeLabel =
    TYPE_LABELS[analysis.type]?.[locale] ??
    analysis.type.replace(/_/g, " ");

  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-amber-500" />
        <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
          {locale === "ar" ? "مدرّب المبيعات الذكي" : "AI Sales Coach"}
        </h3>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {locale === "ar" ? "نوع الاعتراض" : "Objection type"}
          </p>
          <p className="font-semibold">{typeLabel}</p>
        </div>

        <div className="flex items-start gap-2">
          <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {locale === "ar" ? "استراتيجية المبيعات" : "Sales strategy"}
            </p>
            <p className="text-sm">{analysis.strategy}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-primary/5 p-2">
          <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] text-primary uppercase tracking-wide font-semibold">
              {locale === "ar" ? "نصيحة المدرّب" : "Coaching tip"}
            </p>
            <p className="text-sm leading-relaxed">{analysis.coaching_tip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
