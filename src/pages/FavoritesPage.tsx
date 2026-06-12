import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { EmptyState } from "@/components/EmptyStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Heart, Copy, Trash2, Search, Pencil, Tag } from "lucide-react";
import { copyToClipboard } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "smartreply-favorites-v2";

type CategoryKey =
  | "sales_closing"
  | "price_objections"
  | "complaints"
  | "booking"
  | "follow_up"
  | "custom";

interface FavoriteItem {
  id: string;
  platform: string;
  tone: string;
  category: CategoryKey;
  replyText: string;
  savedAt: string; // ISO
}

const SEED: FavoriteItem[] = [
  { id: "1", platform: "WhatsApp", tone: "friendly",     category: "booking",          replyText: "شكراً لتواصلك! لدينا موعد متاح غداً الساعة 5 مساءً. هل يناسبك؟",                                              savedAt: new Date(Date.now() - 86_400_000 * 2).toISOString() },
  { id: "2", platform: "Instagram", tone: "persuasive", category: "price_objections",  replyText: "نعم السعر يعكس جودة وخبرة سنوات. عملاؤنا يرون نتائج مضمونة، تحب أرشحلك الباقة الأنسب؟",                          savedAt: new Date(Date.now() - 86_400_000 * 5).toISOString() },
];

const useFavorites = () => {
  const [items, setItems] = useState<FavoriteItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : SEED;
    } catch { return SEED; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);
  return [items, setItems] as const;
};

const categoryLabel = (k: CategoryKey, isAr: boolean) => {
  const ar: Record<CategoryKey, string> = {
    sales_closing: "إغلاق المبيعات",
    price_objections: "اعتراضات السعر",
    complaints: "شكاوى العملاء",
    booking: "حجز المواعيد",
    follow_up: "متابعات",
    custom: "مخصص",
  };
  const en: Record<CategoryKey, string> = {
    sales_closing: "Sales Closing",
    price_objections: "Price Objections",
    complaints: "Complaints",
    booking: "Booking",
    follow_up: "Follow-Ups",
    custom: "Custom",
  };
  return (isAr ? ar : en)[k];
};

const ALL_CATEGORIES: CategoryKey[] = ["sales_closing","price_objections","complaints","booking","follow_up","custom"];

export default function FavoritesPage() {
  const { t, locale } = useLanguage();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const [items, setItems] = useFavorites();
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<CategoryKey | "all">("all");
  const [editing, setEditing] = useState<FavoriteItem | null>(null);

  const filtered = useMemo(() => items.filter((it) => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || it.replyText.toLowerCase().includes(q) || it.platform.toLowerCase().includes(q);
    const matchC = activeCat === "all" || it.category === activeCat;
    return matchQ && matchC;
  }), [items, search, activeCat]);

  const handleRemove = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const handleCopy = async (text: string) => { if (await copyToClipboard(text)) toast({ title: t.generate.copied }); };
  const handleSaveEdit = () => {
    if (!editing) return;
    setItems((p) => p.map((i) => (i.id === editing.id ? editing : i)));
    setEditing(null);
    toast({ title: isAr ? "تم الحفظ" : "Saved" });
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

      {filtered.length === 0 ? (
        <EmptyState icon={<Heart className="h-12 w-12" />} message={isAr ? "لا توجد ردود مطابقة" : "No matching replies"} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{item.platform}</span>
                <span className="text-[10px] bg-muted text-foreground/70 px-2 py-0.5 rounded-full">{item.tone}</span>
                <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Tag className="h-2.5 w-2.5" />
                  {categoryLabel(item.category, isAr)}
                </span>
                <span className="text-[10px] text-muted-foreground ms-auto">{dateFmt(item.savedAt)}</span>
              </div>
              <p className="text-sm leading-relaxed" dir="auto">{item.replyText}</p>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(item.replyText)} className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />{t.generate.copy}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(item)} className="gap-1.5 text-xs">
                  <Pencil className="h-3 w-3" />{isAr ? "تعديل" : "Edit"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)} className="gap-1.5 text-xs text-destructive">
                  <Trash2 className="h-3 w-3" />{t.favorites.remove}
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
                  value={editing.replyText}
                  onChange={(e) => setEditing({ ...editing, replyText: e.target.value })}
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
