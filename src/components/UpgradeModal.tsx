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
import { Clock, ShoppingBag, RotateCcw, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  isBillingAvailable,
  purchasePlan,
  restorePurchases,
  type PaidPlan,
} from "@/lib/billing";

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

  // Friendly Arabic/English error messages keyed by purchase status / code.
  const messageFor = (status: string, raw?: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      success: { ar: "تم تفعيل خطتك بنجاح ✅", en: "Plan activated ✅" },
      pending: {
        ar: "تم استلام عملية الشراء، جاري التحقق من Google Play…",
        en: "Purchase received, verifying with Google Play…",
      },
      cancelled: { ar: "تم إلغاء عملية الدفع.", en: "Payment cancelled." },
      expired: {
        ar: "انتهت صلاحية اشتراكك. يرجى التجديد عبر Google Play.",
        en: "Your subscription expired. Please renew via Google Play.",
      },
      billing_unavailable: {
        ar: "خدمة Google Play Billing غير متوفرة على هذا الجهاز.",
        en: "Google Play Billing is not available on this device.",
      },
      network: {
        ar: "تعذر الاتصال بـ Google Play. تحقق من الإنترنت وحاول مجددًا.",
        en: "Could not reach Google Play. Check your connection and retry.",
      },
      failed: {
        ar: "تعذر إتمام الدفع. حاول مرة أخرى أو تواصل مع الدعم.",
        en: "Payment failed. Please try again or contact support.",
      },
    };
    const m = map[status] ?? map.failed;
    return isAr ? m.ar : m.en;
  };

  const handleBuy = async () => {
    if (!isPaidPlan) return;
    if (!billingOn) {
      toast(
        isAr
          ? "سيتم تفعيل الاشتراكات عبر Google Play قبل الإطلاق الرسمي."
          : "Subscriptions will be enabled via Google Play before official launch.",
      );
      return;
    }
    setBusy("buy");
    try {
      const res = await purchasePlan(plan as PaidPlan, "monthly");
      switch (res.status) {
        case "success":
          toast.success(messageFor("success"));
          onOpenChange(false);
          break;
        case "pending":
          toast(messageFor("pending"));
          onOpenChange(false);
          break;
        case "cancelled":
          toast(messageFor("cancelled"));
          break;
        case "unsupported":
          toast.error(messageFor("billing_unavailable"));
          break;
        default: {
          const raw = (res as any)?.message ?? "";
          const code = /network|timeout|offline/i.test(raw) ? "network" : "failed";
          toast.error(messageFor(code, raw));
        }
      }
    } catch (e: any) {
      toast.error(messageFor("failed", e?.message));
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!billingOn) {
      toast(
        isAr
          ? "الاستعادة متاحة فقط داخل تطبيق Android."
          : "Restore is only available inside the Android app.",
      );
      return;
    }
    setBusy("restore");
    try {
      const { restored, results } = await restorePurchases();
      if (results[0]?.status === "unsupported") {
        toast.error(messageFor("billing_unavailable"));
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
            {isAr ? "تفاصيل الخطة وطرق التفعيل عبر Google Play" : "Plan details and Google Play activation"}
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
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground leading-relaxed flex gap-2">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            {billingOn
              ? isAr
                ? "اشترك مباشرة عبر Google Play واستمتع بجميع المميزات فوراً. يمكنك الإلغاء من إعدادات Google Play في أي وقت."
                : "Subscribe directly via Google Play and unlock all features instantly. Cancel anytime from Google Play settings."
              : isAr
                ? "سيتم تفعيل الاشتراكات عبر Google Play قبل الإطلاق الرسمي."
                : "Subscriptions will be enabled via Google Play before official launch."}
          </span>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isPaidPlan && (
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
              {isAr ? "اشترك الآن" : "Subscribe Now"}
            </Button>
          )}

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
