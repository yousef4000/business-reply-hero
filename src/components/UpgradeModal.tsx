import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { MessageCircle, Clock, ShoppingBag, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  isBillingAvailable,
  purchasePlan,
  restorePurchases,
  type PaidPlan,
} from "@/lib/billing";

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
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);

  if (!plan) return null;

  const planName = t.plans[plan];
  const price = t.plans.price[plan];
  const limit = t.plans.limits[plan];
  const billingOn = isBillingAvailable();
  const isPaidPlan = plan !== "free";

  const waMessage = isAr
    ? `مرحبًا، أريد ترقية حسابي إلى خطة ${planName} في تطبيق ${t.app.name}.`
    : `Hello, I'd like to upgrade my account to the ${planName} plan in ${t.app.name}.`;

  const waUrl = `https://wa.me/${WHATSAPP_SUPPORT_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const handleWhatsApp = () => {
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  const handleBuy = async () => {
    if (!isPaidPlan) return;
    setBusy("buy");
    try {
      const res = await purchasePlan(plan as PaidPlan);
      switch (res.status) {
        case "success":
          toast.success(isAr ? "تم تفعيل خطتك بنجاح ✅" : "Plan activated ✅");
          onOpenChange(false);
          break;
        case "pending":
          toast(
            isAr
              ? "تم استلام عملية الشراء، جاري التحقق…"
              : "Purchase received, verifying…",
          );
          onOpenChange(false);
          break;
        case "cancelled":
          toast(isAr ? "تم إلغاء عملية الدفع." : "Payment cancelled.");
          break;
        case "unsupported":
          toast.error(
            isAr
              ? "الدفع متاح فقط داخل تطبيق Android."
              : "Payment is available only inside the Android app.",
          );
          break;
        default:
          toast.error(
            isAr
              ? "تعذر إتمام الدفع، حاول مرة أخرى."
              : "Payment failed, please try again.",
          );
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    setBusy("restore");
    try {
      const { restored, results } = await restorePurchases();
      if (results[0]?.status === "unsupported") {
        toast.error(
          isAr
            ? "الاستعادة متاحة فقط على Android."
            : "Restore is only available on Android.",
        );
      } else if (restored > 0) {
        toast.success(
          isAr ? "تمت استعادة مشترياتك بنجاح." : "Purchases restored.",
        );
        onOpenChange(false);
      } else {
        toast(
          isAr
            ? "لا توجد مشتريات للاستعادة."
            : "No purchases to restore.",
        );
      }
    } finally {
      setBusy(null);
    }
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
              <span className="text-xs text-muted-foreground">
                /{isAr ? "شهر" : "mo"}
              </span>
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

        {/* Notice */}
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground leading-relaxed">
          {billingOn
            ? isAr
              ? "الدفع آمن عبر Google Play. يمكنك إلغاء الاشتراك من إعدادات Google Play في أي وقت."
              : "Secure payment via Google Play. You can cancel from Google Play settings anytime."
            : isAr
              ? "الدفع الإلكتروني متاح داخل تطبيق Android. حاليًا يمكنك التواصل عبر واتساب لتفعيل الخطة."
              : "Online payment is available inside the Android app. For now, contact us via WhatsApp."}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {billingOn && isPaidPlan && (
            <Button
              onClick={handleBuy}
              disabled={busy !== null}
              className="w-full gap-2"
            >
              {busy === "buy" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              {isAr ? "شراء عبر Google Play" : "Buy via Google Play"}
            </Button>
          )}

          {billingOn && (
            <Button
              variant="outline"
              onClick={handleRestore}
              disabled={busy !== null}
              className="w-full gap-2"
            >
              {busy === "restore" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              {isAr ? "استعادة المشتريات" : "Restore purchases"}
            </Button>
          )}

          {!billingOn && (
            <Button
              onClick={handleWhatsApp}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white"
            >
              <MessageCircle className="h-4 w-4" />
              {isAr ? "تواصل عبر واتساب للتفعيل" : "Contact via WhatsApp"}
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full gap-2"
          >
            <Clock className="h-4 w-4" />
            {isAr ? "لاحقًا" : "Later"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
