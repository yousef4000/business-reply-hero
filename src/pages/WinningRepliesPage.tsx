import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Search, Copy, Trash2, RefreshCw, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard } from "@/lib/share";

interface WinningReply {
  id: string;
  title: string | null;
  customer_message: string | null;
  reply_text: string;
  objection_type: string | null;
  customer_intent: string | null;
  industry: string | null;
  tags: string[];
  usage_count: number;
  created_at: string;
}

const objLabels: Record<string, { en: string; ar: string }> = {
  price: { en: "Price", ar: "السعر" },
  trust: { en: "Trust", ar: "ثقة" },
  timing: { en: "Timing", ar: "توقيت" },
  hesitation: { en: "Hesitation", ar: "تردد" },
  comparison: { en: "Comparison", ar: "مقارنة" },
  discount: { en: "Discount", ar: "خصم" },
  none: { en: "No objection", ar: "بدون اعتراض" },
};

export default function WinningRepliesPage() {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<WinningReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [objectionFilter, setObjectionFilter] = useState<string | null>(null);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);

  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("winning_replies")
      .select("id,title,customer_message,reply_text,objection_type,customer_intent,industry,tags,usage_count,created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: t("Load failed", "فشل التحميل"), description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as WinningReply[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const industries = useMemo(() => {
    const s = new Set(rows.map((r) => r.industry).filter(Boolean) as string[]);
    return Array.from(s).slice(0, 12);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (objectionFilter && r.objection_type !== objectionFilter) return false;
      if (industryFilter && r.industry !== industryFilter) return false;
      if (!q) return true;
      return (
        (r.title || "").toLowerCase().includes(q) ||
        (r.reply_text || "").toLowerCase().includes(q) ||
        (r.customer_message || "").toLowerCase().includes(q) ||
        (r.customer_intent || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, objectionFilter, industryFilter]);

  const handleCopy = async (text: string, id: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      toast({ title: t("Copied ✅", "تم النسخ ✅") });
      supabase.rpc("bump_winning_reply_usage", { _id: id }).then(() => load());
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("Delete this saved reply?", "حذف هذا الرد المحفوظ؟"))) return;
    const { error } = await supabase.from("winning_replies").delete().eq("id", id);
    if (error) {
      toast({ title: t("Delete failed", "فشل الحذف"), description: error.message, variant: "destructive" });
    } else {
      setRows((r) => r.filter((x) => x.id !== id));
    }
  };

  const objectionTypes = ["price", "trust", "timing", "hesitation", "comparison", "discount"];

  return (
    <div className="mobile-container space-y-5 animate-slide-up">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          {t("Winning Replies Library", "مكتبة الردود الناجحة")}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "Your proven replies — automatically used as templates for similar customer messages.",
            "ردودك المثبتة الفعالية — تُستخدم تلقائياً كقوالب للرسائل المشابهة.",
          )}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search saved replies…", "ابحث في الردود المحفوظة…")}
          className="ps-9"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="h-3 w-3" />
          {t("Filter by objection", "تصنيف حسب الاعتراض")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setObjectionFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              objectionFilter === null
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            {t("All", "الكل")}
          </button>
          {objectionTypes.map((o) => (
            <button
              key={o}
              onClick={() => setObjectionFilter(objectionFilter === o ? null : o)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                objectionFilter === o
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {objLabels[o][locale]}
            </button>
          ))}
        </div>
        {industries.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
              <Filter className="h-3 w-3" />
              {t("Filter by industry", "تصنيف حسب المجال")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setIndustryFilter(null)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  industryFilter === null
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {t("All", "الكل")}
              </button>
              {industries.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setIndustryFilter(industryFilter === ind ? null : ind)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    industryFilter === ind
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          {t("Loading…", "جاري التحميل…")}
        </p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
          <Trophy className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? t(
                  "No saved replies yet. Generate a reply, then tap the Trophy icon to save it as a winning reply.",
                  "لا توجد ردود محفوظة بعد. أنشئ رداً واضغط على أيقونة الكأس لحفظه كرد ناجح.",
                )
              : t("No replies match these filters.", "لا توجد ردود تطابق هذه التصفية.")}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {r.title && <p className="text-sm font-semibold truncate">{r.title}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {r.objection_type && r.objection_type !== "none" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {objLabels[r.objection_type]?.[locale] || r.objection_type}
                      </span>
                    )}
                    {r.industry && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {r.industry}
                      </span>
                    )}
                    {r.usage_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        · {r.usage_count} {t("uses", "استخدام")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(r.reply_text, r.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {r.customer_intent && (
                <p className="text-xs text-muted-foreground italic">
                  {t("Intent: ", "النية: ")}{r.customer_intent}
                </p>
              )}
              {r.customer_message && (
                <p className="text-xs text-muted-foreground border-s-2 border-border ps-2" dir="auto">
                  {r.customer_message.length > 140 ? `${r.customer_message.slice(0, 140)}…` : r.customer_message}
                </p>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap" dir="auto">{r.reply_text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
