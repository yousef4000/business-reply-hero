import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Globe, Trash2, Sparkles, Upload, Loader2, CheckCircle2, AlertCircle, ChevronLeft } from "lucide-react";

type Source = {
  id: string;
  source_type: string;
  title: string | null;
  original_name: string | null;
  source_url: string | null;
  char_count: number;
  chunk_count: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

const ACCEPT_EXT: Record<string, string> = {
  pdf: ".pdf",
  docx: ".docx",
  txt: ".txt,.md",
  xlsx: ".xlsx,.xls",
};

const sourceTypeFromName = (name: string): string | null => {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".txt") || n.endsWith(".md")) return "txt";
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return "xlsx";
  return null;
};

export default function KnowledgeBasePage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const { toast } = useToast();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [manualText, setManualText] = useState("");
  const [consentNeeded, setConsentNeeded] = useState<null | (() => Promise<void>)>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("id,source_type,title,original_name,source_url,char_count,chunk_count,status,error_message,created_at")
      .order("created_at", { ascending: false });
    if (error) toast({ title: ar ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    setSources((data as Source[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Poll while any source is processing
  useEffect(() => {
    if (!sources.some((s) => s.status === "processing" || s.status === "pending")) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [sources]);

  const ensureConsent = async (action: () => Promise<void>) => {
    const { data } = await supabase
      .from("user_consents")
      .select("id")
      .eq("consent_type", "knowledge_upload")
      .limit(1);
    if (data && data.length) return action();
    setConsentNeeded(() => action);
  };

  const acceptConsent = async () => {
    if (!consentChecked || !consentNeeded) return;
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user) {
      await supabase.from("user_consents").insert({ user_id: userRes.user.id, consent_type: "knowledge_upload" });
    }
    const action = consentNeeded;
    setConsentNeeded(null);
    setConsentChecked(false);
    await action();
  };

  const invokeIngest = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ingest-knowledge", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: ar ? "تم الاستيراد" : "Imported", description: ar ? "جاري المعالجة..." : "Processing..." });
      await load();
    } catch (e: any) {
      toast({ title: ar ? "فشل الاستيراد" : "Import failed", description: e.message || "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleUrlImport = () => {
    if (!urlInput.trim()) return;
    const url = urlInput.trim();
    ensureConsent(async () => {
      await invokeIngest({ source_type: "url", source_url: url, title: url });
      setUrlInput("");
    });
  };

  const handleManualImport = () => {
    if (!manualText.trim()) return;
    const text = manualText.trim();
    ensureConsent(async () => {
      await invokeIngest({ source_type: "manual", manual_text: text, title: (ar ? "نص يدوي" : "Manual entry") });
      setManualText("");
    });
  };

  const handleFile = async (file: File) => {
    const type = sourceTypeFromName(file.name);
    if (!type) {
      toast({ title: ar ? "نوع غير مدعوم" : "Unsupported file", description: file.name, variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: ar ? "الملف كبير جدًا" : "File too large", description: ar ? "الحد 15 ميجابايت" : "Max 15 MB", variant: "destructive" });
      return;
    }
    ensureConsent(async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) return;
      const path = `${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      setBusy(true);
      const { error: upErr } = await supabase.storage.from("business-docs").upload(path, file, { upsert: false });
      if (upErr) {
        setBusy(false);
        toast({ title: ar ? "فشل الرفع" : "Upload failed", description: upErr.message, variant: "destructive" });
        return;
      }
      setBusy(false);
      await invokeIngest({ source_type: type, storage_path: path, original_name: file.name, title: file.name });
    });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("knowledge_sources").delete().eq("id", id);
    if (error) toast({ title: ar ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    else { toast({ title: ar ? "تم الحذف" : "Deleted" }); load(); }
  };

  const handleAutoAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-business");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: ar ? "تم تحليل البيانات" : "Profile updated", description: ar ? "تم تحديث ملف العمل تلقائيًا" : "Business profile auto-filled" });
    } catch (e: any) {
      toast({ title: ar ? "فشل التحليل" : "Analysis failed", description: e.message || "", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const totalChunks = sources.filter((s) => s.status === "ready").reduce((a, s) => a + (s.chunk_count || 0), 0);
  const readyCount = sources.filter((s) => s.status === "ready").length;

  return (
    <div className="mobile-container space-y-5 animate-slide-up pb-8">
      <div className="flex items-center justify-between">
        <Link to="/app/business" className="text-xs text-muted-foreground flex items-center gap-1">
          <ChevronLeft className={`h-3.5 w-3.5 ${ar ? "rotate-180" : ""}`} />
          {ar ? "ملف العمل" : "Business profile"}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold">{ar ? "قاعدة المعرفة" : "Knowledge Base"}</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {ar
            ? "ارفع ملفات نشاطك (PDF، Word، Excel، نصوص، روابط) ليصبح الذكاء الاصطناعي أعمق فهمًا لعملك."
            : "Import your business docs (PDF, Word, Excel, text, URLs). The AI uses semantic search to find relevant pieces for every reply."}
        </p>
      </div>

      {/* Stats + auto-analyze */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <span className="font-semibold">{readyCount}</span> {ar ? "مصدر جاهز" : "sources ready"} · <span className="font-semibold">{totalChunks}</span> {ar ? "قطعة معرفية" : "chunks indexed"}
        </div>
        <Button size="sm" disabled={analyzing || !readyCount} onClick={handleAutoAnalyze}>
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {ar ? "تحليل تلقائي لملف العمل" : "Auto-fill business profile"}
        </Button>
      </div>

      {/* File upload */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{ar ? "ارفع ملفات" : "Upload files"}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{ar ? "PDF، DOCX، XLSX، TXT — حتى 15 ميجابايت" : "PDF, DOCX, XLSX, TXT — up to 15 MB"}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={Object.values(ACCEPT_EXT).join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {ar ? "اختر ملفًا" : "Choose file"}
        </Button>
      </div>

      {/* URL import */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{ar ? "استيراد من رابط" : "Import from URL"}</h2>
        </div>
        <Input
          type="url"
          placeholder="https://yourbusiness.com/about"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
        />
        <Button className="w-full" disabled={busy || !urlInput.trim()} onClick={handleUrlImport}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {ar ? "استيراد" : "Import"}
        </Button>
      </div>

      {/* Manual text */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{ar ? "نص يدوي" : "Manual text"}</h2>
        </div>
        <textarea
          className="w-full min-h-[120px] rounded-md border border-input bg-background p-2 text-sm"
          placeholder={ar ? "الصق سياسات، أسئلة شائعة، قائمة أسعار، خدمات..." : "Paste policies, FAQs, pricing, services..."}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <Button className="w-full" disabled={busy || !manualText.trim()} onClick={handleManualImport}>
          {ar ? "إضافة" : "Add"}
        </Button>
      </div>

      {/* Sources list */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">{ar ? "المصادر" : "Sources"}</h2>
        {loading ? (
          <p className="text-xs text-muted-foreground">{ar ? "جاري التحميل..." : "Loading..."}</p>
        ) : sources.length === 0 ? (
          <p className="text-xs text-muted-foreground">{ar ? "لا توجد مصادر بعد." : "No sources yet."}</p>
        ) : (
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.title || s.original_name || s.source_url || s.id}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="uppercase">{s.source_type}</span>
                    {s.status === "ready" && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {s.chunk_count} {ar ? "قطعة" : "chunks"}
                      </span>
                    )}
                    {(s.status === "processing" || s.status === "pending") && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {ar ? "جاري المعالجة" : "Processing"}
                      </span>
                    )}
                    {s.status === "error" && (
                      <span className="flex items-center gap-1 text-destructive" title={s.error_message || ""}>
                        <AlertCircle className="h-3 w-3" />
                        {ar ? "خطأ" : "Error"}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleDelete(s.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-md" aria-label="delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Consent modal */}
      <Dialog open={!!consentNeeded} onOpenChange={(o) => { if (!o) { setConsentNeeded(null); setConsentChecked(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "موافقة على رفع البيانات" : "Data upload consent"}</DialogTitle>
            <DialogDescription>
              {ar
                ? "قبل المتابعة، يرجى التأكيد على ما يلي:"
                : "Before continuing, please confirm:"}
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} />
            <span>
              {ar
                ? "أؤكد أن لدي صلاحية رفع هذه المعلومات واستخدامها داخل Smart Reply Hub، وأنها لن تُستخدم إلا لتحسين الردود."
                : "I confirm I have permission to upload and use this business information inside Smart Reply Hub, and that it will be used only to improve replies."}
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            {ar ? "اقرأ " : "Read our "}<Link to="/privacy" className="text-primary underline">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</Link>.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConsentNeeded(null); setConsentChecked(false); }}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button disabled={!consentChecked} onClick={acceptConsent}>{ar ? "موافق" : "I agree"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
