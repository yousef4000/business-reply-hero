import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { MessageCircle, Clock } from "lucide-react";

// Configurable WhatsApp support number (international format, no '+' or spaces)
export const WHATSAPP_SUPPORT_NUMBER = "201000000000";

export type PlanKey = "free" | "starter" | "pro" | "business";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanKey | null;
}

export function UpgradeModal({ open, onOpenChange, plan }: UpgradeModalProps) {
  const { t, locale } = useLanguage();
  const isAr = locale === "ar";

  if (!plan) return null;

  const planName = t.plans[plan];
  const price = t.plans.price[plan];
  const limit = t.plans.limits[plan];

  const waMessage = isAr
    ? `مرحبًا، أريد ترقية حسابي إلى خطة ${planName} في تطبيق ${t.app.name}.`
    : `Hello, I'd like to upgrade my account to the ${planName} plan in ${t.app.name}.`;

  const waUrl = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const handleWhatsApp = () => {
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isAr ? "ترقية الخطة" : "Upgrade Plan"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isAr ? "تفاصيل الخطة وطرق التفعيل" : "Plan details and activation"}
          </DialogDescription>
        </DialogHeader>

        {/* Plan summary card */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {isAr ? "الخطة المختارة" : "Selected Plan"}
            </span>
            <span className="font-bold text-primary">{planName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {isAr ? "السعر" : "Price"}
            </span>
            <span className="font-semibold">
              {price}
              <span className="text-xs text-muted-foreground">/{isAr ? "شهر" : "mo"}</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {isAr ? "حد الردود" : "Reply limit"}
            </span>
            <span className="font-semibold">
              {limit} {t.plans.repliesPerMonth}
            </span>
          </div>
        </div>

        {/* Payment-soon notice */}
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground leading-relaxed">
          {isAr
            ? "الدفع الإلكتروني قريبًا. حاليًا يمكنك التواصل عبر واتساب لتفعيل الخطة يدويًا."
            : "Online payment is being prepared. For now, contact us via WhatsApp to activate your plan manually."}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleWhatsApp} className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white">
            <MessageCircle className="h-4 w-4" />
            {isAr ? "تواصل عبر واتساب للتفعيل" : "Contact via WhatsApp"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full gap-2">
            <Clock className="h-4 w-4" />
            {isAr ? "لاحقًا" : "Later"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
