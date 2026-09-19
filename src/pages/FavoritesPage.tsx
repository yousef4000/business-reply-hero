import { useEffect, useMemo, useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { EmptyState } from "@/components/EmptyStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Heart, Copy, Trash2, Search, Pencil, Tag, Loader2, AlertCircle } from "lucide-react";
import { copyToClipboard } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type CategoryKey =
  | "sales_closing"
  | "price_objections"
  | "complaints"
  | "booking"
  | "follow_up"
  | "custom";

interface FavoriteItem {
  id: string;
  platform: string | null;
  tone: string | null;
  category: string | null;
  reply_text: string;
  created_at: string;
}

const categoryLabel = (k: string | null, isAr: boolean) => {
  const ar: Record<string, string> = {
    sales_closing: "إغلاق المبيعات",
    price_objections: "اعتراضات السعر",
    complaints: "شكاوى العملاء",
    booking: "حجز المواعيد",
    follow_up: "متابعات",
    custom: "مخصص",
  };
  const en: Record<string, string> = {
    sales_closing: "Sales Closing",
    price_objections: "Price Objections",
    complaints: "Complaints",
    booking: "Booking",
    follow_up: "Follow-Ups",
    custom: "Custom",
  };
  if (!k) return isAr ? "مخصص" : "Custom";
  return (isAr ? ar : en)[k] ?? k;
};

const ALL_CATEGORIES: CategoryKey[] = ["sales_closing", "price_objections", "complaints", "booking", "follow_up", "custom"];

export default function FavoritesPage() {
  const { t, locale } = useLanguage();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<CategoryKey | "all">("all");
  const [editing, setEditing] = useState<FavoriteItem | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("reply_history")
        .select("id, platform, tone, category, reply_text, created_at")
        .eq("is_favorite", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      setItems((data as FavoriteItem[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load favorites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const filtered = useMemo(() => items.filter((it) => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || it.reply_text.toLowerCase().includes(q) || (it.platform ?? "").toLowerCase().includes(q);
    const matchC = activeCat === "all" || it.category === activeCat;
    return matchQ && matchC;
  }), [items, search, activeCat]);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const { error: err } = await supabase
        .from("reply_history")
        .update({ is_favorite: false })
        .eq("id", id);
      if (err) throw err;
      setItems((p) => p.filter((i) => i.id !== id));
      toast({ title: isAr ? "تمت الإزالة" : "Removed" });
    } catch (e: any) {
      toast({ title: t.common.error, description: e?.message ?? "", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleCopy = async (text: string) => { if (await copyToClipboard(text)) toast({ title: t.generate.copied }); };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      const { error: err } = await supabase
        .from("reply_history")
        .update({ category: editing.category, reply_text: editing.reply_text })
        .eq("id", editing.id);
      if (err) throw err;
      setItems((p) => p.map((i) => (i.id === editing.id ? editing : i)));
      setEditing(null);
      toast({ title: isAr ? "تم الحفظ" : "Saved" });
    } catch (e: any) {
      toast({ title: t.common.error, description: e?.message ?? "", variant: "destructive" });
    }
  };

  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="mobile-container space-y-4 animate-slide-up pb-8">
      <div>
        <h1 className="text-xl font-bold">{isAr ? "مكتبة الردود" : "Response Library"}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {isAr ? "ردودك المحفوظة لإعادة الاستخدام بسرعة" : "Your saved replies for fast reuse"}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? "ابحث في المكتبة..." : "Search library..."} className="ps-9" />
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button
          onClick={() => setActiveCat("all")}
          className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${activeCat === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80"}`}
        >
          {isAr ? "الكل" : "All"}
        </button>
        {ALL_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCat(c)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${activeCat === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80"}`}
          >
            {categoryLabel(c, isAr)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{t.common.loading}</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchFavorites}>{t.common.retry}</Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Heart className="h-12 w-12" />} message={isAr ? "لا توجد ردود مطابقة" : "No matching replies"} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.platform && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{item.platform}</span>}
                {item.tone && <span className="text-[10px] bg-muted text-foreground/70 px-2 py-0.5 rounded-full">{item.tone}</span>}
                <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5" />
                  {categoryLabel(item.category, isAr)}
                </span>
                <span className="text-[10px] text-muted-foreground ms-auto">{dateFmt(item.created_at)}</span>
              </div>
              <p className="text-sm leading-relaxed" dir="auto">{item.reply_text}</p>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(item.reply_text)} className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />{t.generate.copy}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(item)} className="gap-1.5 text-xs">
                  <Pencil className="h-3 w-3" />{isAr ? "تعديل" : "Edit"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)} disabled={removingId === item.id} className="gap-1.5 text-xs text-destructive">
                  {removingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  {t.favorites.remove}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "تعديل الرد المحفوظ" : "Edit saved reply"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">{isAr ? "التصنيف" : "Category"}</label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {ALL_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, category: c })}
                      className={`text-[11px] px-2.5 py-1 rounded-full border ${editing.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
                    >
                      {categoryLabel(c, isAr)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">{isAr ? "نص الرد" : "Reply text"}</label>
                <Textarea
                  value={editing.reply_text}
                  onChange={(e) => setEditing({ ...editing, reply_text: e.target.value })}
                  rows={6}
                  className="mt-1.5"
                  dir="auto"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSaveEdit}>{isAr ? "حفظ" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
