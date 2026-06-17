import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerMessage: string;
  replyText: string;
  defaultObjectionType?: string;
  defaultCustomerIntent?: string;
  defaultIndustry?: string;
}

const OBJECTION_TYPES = ["price", "trust", "timing", "hesitation", "comparison", "discount", "none"] as const;
const objLabels: Record<string, { en: string; ar: string }> = {
  price: { en: "Price", ar: "السعر" },
  trust: { en: "Trust", ar: "ثقة" },
  timing: { en: "Timing", ar: "توقيت" },
  hesitation: { en: "Hesitation", ar: "تردد" },
  comparison: { en: "Comparison", ar: "مقارنة" },
  discount: { en: "Discount", ar: "خصم" },
  none: { en: "No objection", ar: "بدون اعتراض" },
};

export function SaveWinningReplyDialog({
  open, onOpenChange, customerMessage, replyText,
  defaultObjectionType, defaultCustomerIntent, defaultIndustry,
}: Props) {
  const { locale } = useLanguage();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [objectionType, setObjectionType] = useState(defaultObjectionType || "none");
  const [customerIntent, setCustomerIntent] = useState(defaultCustomerIntent || "");
  const [industry, setIndustry] = useState(defaultIndustry || "");
  const [editableReply, setEditableReply] = useState(replyText);
  const [saving, setSaving] = useState(false);

  // Reset editable reply when dialog opens with a new reply
  if (open && editableReply !== replyText && !saving) {
    // Only reset on first open per replyText (avoid clobbering user edits)
  }

  const t = (en: string, ar: string) => (locale === "ar" ? ar : en);

  const handleSave = async () => {
    if (!editableReply.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("save-winning-reply", {
        body: {
          title: title.trim() || undefined,
          customer_message: customerMessage,
          reply_text: editableReply,
          objection_type: objectionType,
          customer_intent: customerIntent.trim() || undefined,
          industry: industry.trim() || undefined,
        },
      });
      if (error) throw error;
      toast({
        title: t("Saved to Winning Replies 🏆", "تمت الإضافة إلى الردود الناجحة 🏆"),
        description: t("This reply will guide future AI generations.", "سيستخدم هذا الرد كنموذج للردود القادمة."),
      });
      onOpenChange(false);
      setTitle("");
    } catch (e: any) {
      toast({ title: t("Save failed", "فشل الحفظ"), description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            {t("Save Winning Reply", "حفظ كرد ناجح")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Saved replies are used as proven templates the next time a similar message arrives.",
              "الردود المحفوظة تُستخدم كقوالب موثوقة عند وصول رسائل مشابهة.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("Title (optional)", "العنوان (اختياري)")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("e.g. Price objection — premium clinic", "مثلاً: اعتراض على السعر — عيادة")}
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("Objection type", "نوع الاعتراض")}</Label>
              <Select value={objectionType} onValueChange={setObjectionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OBJECTION_TYPES.map((o) => (
                    <SelectItem key={o} value={o}>{objLabels[o][locale]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("Industry", "المجال")}</Label>
              <Input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder={t("e.g. Clinic, Gym", "مثلاً: عيادة، جيم")}
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("Customer intent", "نية العميل")}</Label>
            <Input
              value={customerIntent}
              onChange={(e) => setCustomerIntent(e.target.value)}
              placeholder={t("e.g. wants discount before booking", "مثلاً: يطلب خصم قبل الحجز")}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("Reply text", "نص الرد")}</Label>
            <Textarea
              value={editableReply}
              onChange={(e) => setEditableReply(e.target.value)}
              rows={5}
              className="resize-none text-sm"
              dir="auto"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("Cancel", "إلغاء")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !editableReply.trim()} className="gap-1.5">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            {t("Save to Library", "حفظ في المكتبة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
