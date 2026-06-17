import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadBadge } from "@/components/LeadBadge";
import { copyToClipboard, shareContent } from "@/lib/share";
import { Sparkles, Copy, Share2, Heart, BookmarkPlus, RefreshCw, Check, Brain, MessageSquare, Target, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUsage } from "@/hooks/use-usage";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";
import { TrialBanner } from "@/components/TrialBanner";
import { ObjectionCard, type ObjectionAnalysis } from "@/components/ObjectionCard";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, getTemplatesFor } from "@/lib/templates";

const platforms = ["whatsapp", "instagram", "messenger", "email", "chat"] as const;
const tones = ["professional", "friendly", "casual", "persuasive", "empathetic"] as const;

interface Classification {
  messageType: string;
  customerIntent: string;
  objectionType: string;
  buyingStage?: string;
  purchaseProbability?: number;
}

interface GenerationResult {
  classification: Classification;
  replies: { soft: string; persuasive: string; directClosing: string };
  leadTemperature: "hot" | "warm" | "cold";
  followUp: string;
  objection_analysis?: ObjectionAnalysis;
}

const replyStyleLabels = {
  en: { soft: "Soft", persuasive: "Persuasive", directClosing: "Direct Close" },
  ar: { soft: "لطيف", persuasive: "مقنع", directClosing: "إغلاق مباشر" },
};

const classificationLabels = {
  en: {
    messageType: "Message Type", customerIntent: "Customer Intent", objectionType: "Objection Type",
    types: { objection: "Objection", inquiry: "Inquiry", complaint: "Complaint", followUp: "Follow-up", greeting: "Greeting", request: "Request", comparison: "Comparison", negotiation: "Negotiation" },
    objections: { price: "Price", hesitation: "Hesitation", comparison: "Comparison", discount: "Discount Request", trust: "Trust", timing: "Timing", none: "None" },
  },
  ar: {
    messageType: "نوع الرسالة", customerIntent: "نية العميل", objectionType: "نوع الاعتراض",
    types: { objection: "اعتراض", inquiry: "استفسار", complaint: "شكوى", followUp: "متابعة", greeting: "تحية", request: "طلب", comparison: "مقارنة", negotiation: "تفاوض" },
    objections: { price: "السعر", hesitation: "تردد", comparison: "مقارنة", discount: "طلب خصم", trust: "ثقة", timing: "توقيت", none: "لا يوجد" },
  },
};

export default function GeneratePage() {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [platform, setPlatform] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [replyGoal, setReplyGoal] = useState("");
  const [tone, setTone] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<"soft" | "persuasive" | "directClosing">("persuasive");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const usage = useUsage();

  // Receive shared text from Android share-target / web share target
  useEffect(() => {
    const shared = params.get("shared");
    if (shared) {
      setCustomerMessage(shared);
      const next = new URLSearchParams(params);
      next.delete("shared");
      setParams(next, { replace: true });
    }
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string;
      if (detail) setCustomerMessage(detail);
    };
    window.addEventListener("smartreply:shared", handler);
    if ((window as any).__sharedText) {
      setCustomerMessage((window as any).__sharedText);
      (window as any).__sharedText = null;
    }
    return () => window.removeEventListener("smartreply:shared", handler);
  }, []); // eslint-disable-line

  const limitMessage =
    usage.planState === "trial_expired"
      ? (locale === "ar" ? "انتهت تجربتك المجانية. قم بالترقية للمتابعة." : "Your free trial has ended. Upgrade to continue.")
      : (locale === "ar" ? "لقد استخدمت كل الردود المتاحة في خطتك هذا الشهر. قم بالترقية للمتابعة." : "You've used all your replies for this month. Upgrade to continue.");

  const signInMessage = locale === "ar"
    ? "سجّل الدخول لبدء تجربتك المجانية (7 أيام و30 رسالة)."
    : "Sign in to start your free trial (7 days, 30 messages).";

  const handleGenerate = async () => {
    if (!customerMessage.trim()) return;

    if (!usage.loading && usage.isGuest) {
      setLimitReached(true);
      setError(signInMessage);
      return;
    }

    if (!usage.loading && usage.planState === "trial_expired") {
      setLimitReached(true);
      setError(limitMessage);
      setUpgradeOpen(true);
      return;
    }

    if (!usage.loading && usage.used >= usage.limit && usage.limit > 0) {
      setLimitReached(true);
      setError(limitMessage);
      setUpgradeOpen(true);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setLimitReached(false);
    setResult(null);

    // Direct fetch with a hard abort — avoids supabase-js invoke() hanging
    // forever on a stuck auth-session lock (request never even gets sent).
    const controller = new AbortController();
    const abortTimer = setTimeout(() => {
      console.warn("[generate] client timeout reached, aborting request");
      controller.abort();
    }, 50_000);

    try {
      // Get the access token with its own short timeout so a deadlocked
      // session refresh can't block the request from ever being sent.
      let accessToken: string | null = null;
      try {
        const sess = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error("session_timeout")), 5_000)),
        ]);
        accessToken = (sess as any)?.data?.session?.access_token ?? null;
      } catch {
        console.warn("[generate] getSession timed out, falling back to stored token");
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const raw = localStorage.getItem(`sb-${projectId}-auth-token`);
          if (raw) accessToken = JSON.parse(raw)?.access_token ?? null;
        } catch { /* ignore */ }
      }

      if (!accessToken) {
        setLimitReached(true);
        setError(signInMessage);
        return;
      }

      console.log("[generate] sending request");
      const t0 = Date.now();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-reply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          signal: controller.signal,
          body: JSON.stringify({
            platform: platform || "chat",
            businessType,
            replyGoal,
            tone: tone || "professional",
            customerMessage,
            language: locale,
          }),
        },
      );
      console.log(`[generate] response status=${resp.status} in ${Date.now() - t0}ms`);

      const payload = (await resp.json().catch(() => null)) as any;
      const data = resp.ok ? payload : null;
      const fnError = resp.ok ? null : new Error(payload?.error || `HTTP ${resp.status}`);
      const code = payload?.code || (!resp.ok ? payload?.error : undefined);

      if (code === "TRIAL_EXPIRED") {
        setLimitReached(true);
        setError(locale === "ar" ? "انتهت تجربتك المجانية. قم بالترقية للمتابعة." : "Your free trial has ended. Upgrade to continue.");
        setUpgradeOpen(true);
        usage.refresh();
        return;
      }
      if (code === "USAGE_LIMIT_REACHED" || code === "TRIAL_LIMIT_REACHED") {
        setLimitReached(true);
        setError(limitMessage);
        setUpgradeOpen(true);
        usage.refresh();
        return;
      }
      if (code === "AI_TIMEOUT") {
        setError(
          locale === "ar"
            ? "استغرق الذكاء الاصطناعي وقتاً طويلاً. حاول مرة أخرى."
            : "The AI took too long to respond. Please try again.",
        );
        return;
      }

      if (fnError) throw new Error(fnError.message || "Generation failed");
      if (data?.error) throw new Error(data.error);

      setResult(data as GenerationResult);
      setSelectedStyle("persuasive");
      usage.refresh();
    } catch (err: any) {
      console.error("Generation error:", err);
      if (err?.name === "AbortError") {
        setError(
          locale === "ar"
            ? "استغرق توليد الرد وقتاً أطول من المتوقع. حاول مرة أخرى."
            : "Generation took longer than expected. Please try again.",
        );
      } else {
        setError(err.message || "Something went wrong");
        toast({ title: t.common.error, variant: "destructive" });
      }
    } finally {
      clearTimeout(abortTimer);
      setIsGenerating(false);
    }
  };

  // Fire-and-forget feedback so the AI learns the user's style over time.
  const recordFeedback = (
    action: "copied" | "favorited" | "edited_and_used",
    finalReply: string,
    originalReply?: string,
  ) => {
    if (!customerMessage.trim() || !finalReply.trim()) return;
    try {
      supabase.functions
        .invoke("record-feedback", {
          body: {
            customer_message: customerMessage,
            reply_text: finalReply,
            original_reply: originalReply,
            action,
            business_type: businessType || undefined,
            intent_tag: result?.classification?.messageType,
          },
        })
        .catch(() => { /* ignore — non-blocking */ });
    } catch { /* ignore */ }
  };

  const handleCopy = async (text: string, style: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedStyle(style);
      setTimeout(() => setCopiedStyle(null), 2000);
      toast({ title: locale === "ar" ? "تم النسخ ✅" : "Copied ✅" });
      // Detect if user edited the reply before copying (textarea-based edits aren't
      // wired yet; for now we treat raw copy as 'copied'. Edited path will use the
      // textarea hook below when we add it.)
      recordFeedback("copied", text);
    }
  };

  const handleShare = async (text: string) => {
    await shareContent(text, t.app.name);
    recordFeedback("copied", text);
  };

  const handleFavorite = (text: string) => {
    recordFeedback("favorited", text);
    toast({ title: locale === "ar" ? "تمت الإضافة للمفضلة ⭐" : "Added to favorites ⭐" });
  };

  const cls = classificationLabels[locale];
  const styleLabels = replyStyleLabels[locale];

  const templates = businessType ? getTemplatesFor(businessType, locale) : [];

  return (
    <div className="mobile-container space-y-5 animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{t.generate.title}</h1>
      </div>

      <TrialBanner onUpgrade={() => setUpgradeOpen(true)} />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t.generate.platform}</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue placeholder={t.generate.platformPlaceholder} /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (<SelectItem key={p} value={p}>{t.generate.platforms[p]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.generate.tone}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue placeholder={t.generate.tone} /></SelectTrigger>
              <SelectContent>
                {tones.map((tn) => (<SelectItem key={tn} value={tn}>{t.generate.tones[tn]}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.generate.businessType}</Label>
          <Select value={businessType} onValueChange={setBusinessType}>
            <SelectTrigger><SelectValue placeholder={t.generate.businessTypePlaceholder} /></SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((b) => (
                <SelectItem key={b} value={b}>{BUSINESS_TYPE_LABELS[b][locale]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {templates.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {locale === "ar" ? "قوالب سريعة" : "Quick templates"}
            </Label>
            <div className="flex flex-wrap gap-2">
              {templates.map((tpl) => (
                <button
                  type="button"
                  key={tpl}
                  onClick={() => setReplyGoal(tpl)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    replyGoal === tpl
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">{t.generate.replyGoal}</Label>
          <Input value={replyGoal} onChange={(e) => setReplyGoal(e.target.value)} placeholder={t.generate.replyGoalPlaceholder} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.generate.customerMessage}</Label>
          <Textarea value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} placeholder={t.generate.customerMessagePlaceholder} rows={4} className="resize-none" />
        </div>

        <Button size="lg" className="w-full text-base gap-2" onClick={handleGenerate} disabled={isGenerating || !customerMessage.trim()}>
          {isGenerating ? (<><RefreshCw className="h-4 w-4 animate-spin" />{t.generate.generating}</>) : (<><Sparkles className="h-4 w-4" />{t.generate.generateBtn}</>)}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive font-medium">{error}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {limitReached ? (
                usage.isGuest ? (
                  <Button variant="default" size="sm" asChild>
                    <a href="/signin">{locale === "ar" ? "تسجيل الدخول" : "Sign in"}</a>
                  </Button>
                ) : (
                  <Button variant="default" size="sm" onClick={() => setUpgradeOpen(true)}>
                    {locale === "ar" ? "ترقية الخطة" : "Upgrade Plan"}
                  </Button>
                )
              ) : (
                <Button variant="outline" size="sm" onClick={handleGenerate}>{t.common.retry}</Button>
              )}
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-slide-up">
          {result.objection_analysis && <ObjectionCard analysis={result.objection_analysis} />}

          <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {locale === "en" ? "AI Analysis" : "تحليل الذكاء الاصطناعي"}
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{cls.messageType}:</span>
                <span className="font-medium">
                  {cls.types[result.classification.messageType as keyof typeof cls.types] || result.classification.messageType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{cls.objectionType}:</span>
                <span className="font-medium">
                  {cls.objections[result.classification.objectionType as keyof typeof cls.objections] || result.classification.objectionType}
                </span>
              </div>
              <div className="col-span-1 sm:col-span-3 text-xs text-muted-foreground">
                {cls.customerIntent}: <span className="text-foreground">{result.classification.customerIntent}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.generate.result}</h2>
            <LeadBadge temperature={result.leadTemperature} />
          </div>

          <div className="flex gap-2">
            {(["soft", "persuasive", "directClosing"] as const).map((style) => (
              <Button key={style} variant={selectedStyle === style ? "default" : "outline"} size="sm" className="flex-1 text-xs" onClick={() => setSelectedStyle(style)}>
                {styleLabels[style]}
              </Button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" dir="auto">
              {result.replies[selectedStyle]}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button size="sm" onClick={() => handleCopy(result.replies[selectedStyle], selectedStyle)} className="flex-1 gap-1.5 h-9">
                {copiedStyle === selectedStyle ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="text-sm font-medium">
                  {copiedStyle === selectedStyle ? (locale === "ar" ? "تم النسخ" : "Copied") : (locale === "ar" ? "نسخ" : "Copy")}
                </span>
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleShare(result.replies[selectedStyle])} className="h-9 w-9 shrink-0" aria-label={t.generate.share} title={t.generate.share}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleFavorite(result.replies[selectedStyle])} className="h-9 w-9 shrink-0" aria-label={t.generate.favorite} title={t.generate.favorite}>
                <Heart className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={t.generate.save} title={t.generate.save}>
                <BookmarkPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card/50">
            <button type="button" onClick={() => setShowAllOptions((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors" aria-expanded={showAllOptions}>
              <span>{locale === "ar" ? "عرض الخيارات الثلاثة" : "View all 3 options"}</span>
              <span className="text-[10px]">{showAllOptions ? "▲" : "▼"}</span>
            </button>
            {showAllOptions && (
              <div className="px-3 pb-3 space-y-2">
                {(["soft", "persuasive", "directClosing"] as const).map((style) => (
                  <div key={style} className={`rounded-lg border p-3 cursor-pointer transition-colors ${selectedStyle === style ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`} onClick={() => setSelectedStyle(style)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-primary">{styleLabels[style]}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleCopy(result.replies[style], style); }}>
                        {copiedStyle === style ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed" dir="auto">{result.replies[style]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t.generate.followUp}</p>
            <p className="text-sm leading-relaxed">{result.followUp}</p>
          </div>

          <div className="h-6" aria-hidden />
        </div>
      )}

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        plan={"pro" as PlanKey}
      />
    </div>
  );
}
