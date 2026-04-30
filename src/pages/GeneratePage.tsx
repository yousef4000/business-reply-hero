import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadBadge } from "@/components/LeadBadge";
import { copyToClipboard, shareContent } from "@/lib/share";
import { Sparkles, Copy, Share2, Heart, BookmarkPlus, RefreshCw, Minimize2, Maximize2, Megaphone, Check, Brain, MessageSquare, Target, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUsage, getGuestUsage, bumpGuestUsage, GUEST_LIMIT } from "@/hooks/use-usage";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";
import { Progress } from "@/components/ui/progress";

const platforms = ["whatsapp", "instagram", "messenger", "email", "chat"] as const;
const tones = ["professional", "friendly", "casual", "persuasive", "empathetic"] as const;

interface Classification {
  messageType: string;
  customerIntent: string;
  objectionType: string;
}

interface GenerationResult {
  classification: Classification;
  replies: {
    soft: string;
    persuasive: string;
    directClosing: string;
  };
  leadTemperature: "hot" | "warm" | "cold";
  followUp: string;
}

const replyStyleLabels = {
  en: { soft: "Soft", persuasive: "Persuasive", directClosing: "Direct Close" },
  ar: { soft: "لطيف", persuasive: "مقنع", directClosing: "إغلاق مباشر" },
};

const classificationLabels = {
  en: {
    messageType: "Message Type",
    customerIntent: "Customer Intent",
    objectionType: "Objection Type",
    types: { objection: "Objection", inquiry: "Inquiry", complaint: "Complaint", followUp: "Follow-up", greeting: "Greeting", request: "Request", comparison: "Comparison", negotiation: "Negotiation" },
    objections: { price: "Price", hesitation: "Hesitation", comparison: "Comparison", discount: "Discount Request", trust: "Trust", timing: "Timing", none: "None" },
  },
  ar: {
    messageType: "نوع الرسالة",
    customerIntent: "نية العميل",
    objectionType: "نوع الاعتراض",
    types: { objection: "اعتراض", inquiry: "استفسار", complaint: "شكوى", followUp: "متابعة", greeting: "تحية", request: "طلب", comparison: "مقارنة", negotiation: "تفاوض" },
    objections: { price: "السعر", hesitation: "تردد", comparison: "مقارنة", discount: "طلب خصم", trust: "ثقة", timing: "توقيت", none: "لا يوجد" },
  },
};

export default function GeneratePage() {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
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

  const getBusinessProfile = () => {
    try {
      const saved = localStorage.getItem("smartreply-profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!customerMessage.trim()) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-reply", {
        body: {
          platform: platform || "chat",
          businessType,
          replyGoal,
          tone: tone || "professional",
          customerMessage,
          language: locale,
          businessProfile: getBusinessProfile(),
        },
      });

      if (fnError) throw new Error(fnError.message || "Generation failed");
      if (data?.error) throw new Error(data.error);

      setResult(data as GenerationResult);
      setSelectedStyle("persuasive");
    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "Something went wrong");
      toast({ title: t.common.error, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (text: string, style: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedStyle(style);
      setTimeout(() => setCopiedStyle(null), 2000);
      toast({ title: t.generate.copied });
    }
  };

  const handleShare = async (text: string) => {
    await shareContent(text, t.app.name);
  };

  const cls = classificationLabels[locale];
  const styleLabels = replyStyleLabels[locale];

  return (
    <div className="mobile-container space-y-5 animate-slide-up">
      <h1 className="text-xl font-bold">{t.generate.title}</h1>

      {/* Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t.generate.platform}</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue placeholder={t.generate.platformPlaceholder} /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p}>{t.generate.platforms[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.generate.tone}</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue placeholder={t.generate.tone} /></SelectTrigger>
              <SelectContent>
                {tones.map((tn) => (
                  <SelectItem key={tn} value={tn}>{t.generate.tones[tn]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.generate.businessType}</Label>
          <Input
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder={t.generate.businessTypePlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.generate.replyGoal}</Label>
          <Input
            value={replyGoal}
            onChange={(e) => setReplyGoal(e.target.value)}
            placeholder={t.generate.replyGoalPlaceholder}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t.generate.customerMessage}</Label>
          <Textarea
            value={customerMessage}
            onChange={(e) => setCustomerMessage(e.target.value)}
            placeholder={t.generate.customerMessagePlaceholder}
            rows={4}
            className="resize-none"
          />
        </div>

        <Button
          size="lg"
          className="w-full text-base gap-2"
          onClick={handleGenerate}
          disabled={isGenerating || !customerMessage.trim()}
        >
          {isGenerating ? (
            <><RefreshCw className="h-4 w-4 animate-spin" />{t.generate.generating}</>
          ) : (
            <><Sparkles className="h-4 w-4" />{t.generate.generateBtn}</>
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleGenerate}>
              {t.common.retry}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Classification Card */}
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

          {/* Lead Temperature */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t.generate.result}</h2>
            <LeadBadge temperature={result.leadTemperature} />
          </div>

          {/* Reply Style Tabs */}
          <div className="flex gap-2">
            {(["soft", "persuasive", "directClosing"] as const).map((style) => (
              <Button
                key={style}
                variant={selectedStyle === style ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setSelectedStyle(style)}
              >
                {styleLabels[style]}
              </Button>
            ))}
          </div>

          {/* Selected Reply */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" dir="auto">
              {result.replies[selectedStyle]}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(result.replies[selectedStyle], selectedStyle)}
                className="gap-1.5"
              >
                {copiedStyle === selectedStyle ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedStyle === selectedStyle ? t.generate.copied : t.generate.copy}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleShare(result.replies[selectedStyle])} className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" />{t.generate.share}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" />{t.generate.favorite}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <BookmarkPlus className="h-3.5 w-3.5" />{t.generate.save}
              </Button>
            </div>
          </div>

          {/* All 3 replies preview */}
          <details className="group">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              {locale === "en" ? "View all 3 options" : "عرض الخيارات الثلاثة"}
            </summary>
            <div className="mt-3 space-y-3">
              {(["soft", "persuasive", "directClosing"] as const).map((style) => (
                <div
                  key={style}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedStyle === style ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedStyle(style)}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-primary">{styleLabels[style]}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); handleCopy(result.replies[style], style); }}
                    >
                      {copiedStyle === style ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed" dir="auto">{result.replies[style]}</p>
                </div>
              ))}
            </div>
          </details>

          {/* Follow-up */}
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">{t.generate.followUp}</p>
            <p className="text-sm">{result.followUp}</p>
          </div>
        </div>
      )}
    </div>
  );
}
