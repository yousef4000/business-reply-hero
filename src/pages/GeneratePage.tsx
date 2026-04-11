import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadBadge } from "@/components/LeadBadge";
import { copyToClipboard, shareContent } from "@/lib/share";
import { Sparkles, Copy, Share2, Heart, BookmarkPlus, RefreshCw, Minimize2, Maximize2, Megaphone, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const platforms = ["whatsapp", "instagram", "messenger", "email", "chat"] as const;
const tones = ["professional", "friendly", "casual", "persuasive", "empathetic"] as const;

export default function GeneratePage() {
  const { t, locale } = useLanguage();
  const { toast } = useToast();
  const [platform, setPlatform] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [replyGoal, setReplyGoal] = useState("");
  const [tone, setTone] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Demo result state
  const [result, setResult] = useState<{
    replyText: string;
    leadTemperature: "hot" | "warm" | "cold";
    followUp: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!customerMessage.trim()) return;
    setIsGenerating(true);
    // Simulate AI generation (will be replaced with real API call)
    setTimeout(() => {
      setResult({
        replyText: locale === "en"
          ? `Thank you for reaching out! We appreciate your interest in our ${businessType || "services"}. I'd be happy to help you with your inquiry. Let me get back to you with the details shortly. Is there anything specific you'd like to know?`
          : `شكراً لتواصلك! نقدر اهتمامك بـ${businessType || "خدماتنا"}. يسعدني مساعدتك في استفسارك. سأعود إليك بالتفاصيل قريباً. هل هناك شيء محدد تود معرفته؟`,
        leadTemperature: "warm",
        followUp: locale === "en"
          ? "Follow up in 24 hours with pricing details and availability."
          : "تابع خلال 24 ساعة مع تفاصيل الأسعار والتوفر.",
      });
      setIsGenerating(false);
    }, 1500);
  };

  const handleCopy = async () => {
    if (!result) return;
    const ok = await copyToClipboard(result.replyText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: t.generate.copied });
    }
  };

  const handleShare = async () => {
    if (!result) return;
    await shareContent(result.replyText, t.app.name);
  };

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

      {/* Result */}
      {result && (
        <div className="space-y-4 animate-slide-up">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.generate.result}</h2>
              <LeadBadge temperature={result.leadTemperature} />
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{result.replyText}</p>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t.generate.copied : t.generate.copy}
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="h-3.5 w-3.5" />{t.generate.share}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Heart className="h-3.5 w-3.5" />{t.generate.favorite}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <BookmarkPlus className="h-3.5 w-3.5" />{t.generate.save}
              </Button>
            </div>

            {/* Rewrite Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <RefreshCw className="h-3 w-3" />{t.generate.actions.rewrite}
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <Minimize2 className="h-3 w-3" />{t.generate.actions.shorten}
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <Maximize2 className="h-3 w-3" />{t.generate.actions.expand}
              </Button>
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <Megaphone className="h-3 w-3" />{t.generate.actions.persuade}
              </Button>
            </div>
          </div>

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
