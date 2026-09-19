import { useEffect, useMemo, useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyStates";
import { Search, Trash2, Copy, Clock, BarChart3, Layers, MessageCircle, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { copyToClipboard } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type PlatformKey = "whatsapp" | "instagram" | "messenger" | "email" | "chat";
type GoalKey = "sales" | "complaints" | "booking" | "follow_up" | "general";

interface HistoryItem {
  id: string;
  platform: string | null;
  business_type: string | null;
  goal: string | null;
  tone: string | null;
  objection_type: string | null;
  reply_text: string;
  created_at: string;
}

const platformLabel = (p: string | null, isAr: boolean) => {
  const map: Record<string, string> = {
    whatsapp: isAr ? "واتساب" : "WhatsApp",
    instagram: isAr ? "إنستغرام" : "Instagram",
    messenger: isAr ? "ماسنجر" : "Messenger",
    email: isAr ? "بريد" : "Email",
    chat: isAr ? "محادثة" : "Chat",
  };
  return p ? (map[p] ?? p) : "—";
};

const goalLabel = (g: string | null, isAr: boolean) => {
  const map: Record<string, string> = {
    sales: isAr ? "مبيعات" : "Sales",
    complaints: isAr ? "شكاوى" : "Complaints",
    booking: isAr ? "حجوزات" : "Booking",
    follow_up: isAr ? "متابعة" : "Follow-Up",
    general: isAr ? "عام" : "General",
  };
  return g ? (map[g] ?? g) : "—";
};

const ALL_PLATFORMS: PlatformKey[] = ["whatsapp", "instagram", "messenger", "email", "chat"];
const ALL_GOALS: GoalKey[] = ["sales", "complaints", "booking", "follow_up", "general"];

export default function HistoryPage() {
  const { t, locale } = useLanguage();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<PlatformKey | "all">("all");
  const [goal, setGoal] = useState<GoalKey | "all">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("reply_history")
        .select("id, platform, business_type, goal, tone, objection_type, reply_text, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      setItems((data as HistoryItem[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = useMemo(() => items.filter((i) => {
    const q = search.trim().toLowerCase();
    const matchQ = !q || i.reply_text.toLowerCase().includes(q) || (i.business_type ?? "").toLowerCase().includes(q);
    const matchP = platform === "all" || i.platform === platform;
    const matchG = goal === "all" || i.goal === goal;
    return matchQ && matchP && matchG;
  }), [items, search, platform, goal]);

  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const stats = useMemo(() => {
    const total = items.length;
    const thisMonth = items.filter((i) => new Date(i.created_at).getTime() >= monthStart).length;
    const tally = <T extends string>(key: (i: HistoryItem) => T | null): T | null => {
      const m = new Map<T, number>();
      items.forEach((i) => { const k = key(i); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
      let top: T | null = null; let n = 0;
      m.forEach((v, k) => { if (v > n) { n = v; top = k; } });
      return top;
    };
    return {
      total,
      thisMonth,
      topPlatform: tally<string>((i) => i.platform),
      topTone: tally<string>((i) => i.tone),
      topGoal: tally<string>((i) => i.goal),
    };
  }, [items, monthStart]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error: err } = await supabase.from("reply_history").delete().eq("id", id);
      if (err) throw err;
      setItems((p) => p.filter((i) => i.id !== id));
      toast({ title: isAr ? "تم الحذف" : "Deleted" });
    } catch (e: any) {
      toast({ title: t.common.error, description: e?.message ?? "", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (text: string) => { if (await copyToClipboard(text)) toast({ title: t.generate.copied }); };

  const dateFmt = (iso: string) => new Date(iso).toLocaleString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mobile-container space-y-4 animate-slide-up pb-8">
      <div>
        <h1 className="text-xl font-bold">{isAr ? "مركز النشاط" : "Activity Center"}</h1>
        <p className="text-xs text-muted-foreground mt-1">{isAr ? "كل ردودك السابقة وإحصائيات استخدامك" : "All your past replies and usage insights"}</p>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <StatCard icon={BarChart3} label={isAr ? "إجمالي الردود" : "Total Replies"}    value={String(stats.total)} />
        <StatCard icon={TrendingUp} label={isAr ? "هذا الشهر" : "This Month"}            value={String(stats.thisMonth)} />
        <StatCard icon={MessageCircle} label={isAr ? "الأكثر منصّة" : "Top Platform"}   value={stats.topPlatform ? platformLabel(stats.topPlatform, isAr) : "—"} />
        <StatCard icon={Layers} label={isAr ? "الأكثر نبرة" : "Top Tone"}                value={stats.topTone ?? "—"} />
        <StatCard icon={Layers} label={isAr ? "الأكثر هدفاً" : "Top Goal"}               value={stats.topGoal ? goalLabel(stats.topGoal, isAr) : "—"} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.history.search} className="ps-9" />
      </div>

      {/* Filter chips */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Chip active={platform === "all"} onClick={() => setPlatform("all")} label={isAr ? "كل المنصات" : "All platforms"} />
          {ALL_PLATFORMS.map((p) => (
            <Chip key={p} active={platform === p} onClick={() => setPlatform(p)} label={platformLabel(p, isAr)} />
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <Chip active={goal === "all"} onClick={() => setGoal("all")} label={isAr ? "كل الأهداف" : "All goals"} />
          {ALL_GOALS.map((g) => (
            <Chip key={g} active={goal === g} onClick={() => setGoal(g)} label={goalLabel(g, isAr)} />
          ))}
        </div>
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
            <Button variant="outline" size="sm" className="mt-2" onClick={fetchHistory}>{t.common.retry}</Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Clock className="h-12 w-12" />} message={isAr ? "لا توجد سجلات مطابقة" : "No matching records"} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{platformLabel(item.platform, isAr)}</span>
                  {item.business_type && <span className="text-[10px] bg-muted text-foreground/70 px-2 py-0.5 rounded-full">{item.business_type}</span>}
                  <span className="text-[10px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{goalLabel(item.goal, isAr)}</span>
                  {item.tone && <span className="text-[10px] bg-muted text-foreground/70 px-2 py-0.5 rounded-full">{item.tone}</span>}
                  {item.objection_type && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                      {isAr ? `اعتراض: ${item.objection_type}` : `objection: ${item.objection_type}`}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{dateFmt(item.created_at)}</span>
              </div>
              <p className="text-sm line-clamp-3 leading-relaxed" dir="auto">{item.reply_text}</p>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(item.reply_text)} className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />{t.generate.copy}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="gap-1.5 text-xs text-destructive">
                  {deletingId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  {t.history.delete}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] uppercase tracking-wide truncate">{label}</span>
      </div>
      <p className="text-base font-bold truncate">{value}</p>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground/80"}`}
    >
      {label}
    </button>
  );
}
