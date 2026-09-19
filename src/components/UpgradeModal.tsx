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
import { ShoppingBag, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { startCheckout, type PaidPlan } from "@/lib/lemon";

export type PlanKey = "free" | "starter" | "pro" | "business";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanKey | null;
}

export function UpgradeModal({ open, onOpenChange, plan }: UpgradeModalProps) {
  const { t, locale } = useLanguage();
  const isAr = locale === "ar";
  const [busy, setBusy] = useState(false);

  if (!plan) return null;

  const planName = t.plans[plan];
  const price = t.plans.price[plan];
  const limit = t.plans.limits[plan];
  const isPaidPlan = plan !== "free";

  const handleCheckout = async () => {
    if (!isPaidPlan || busy) return;
    setBusy(true);
    try {
      const res = await startCheckout(plan as PaidPlan);
      switch (res.status) {
        case "redirecting":
          toast(
            isAr
              ? "جارٍ تحويلك إلى صفحة الدفع…"
              : "Redirecting you to checkout…",
          );
          break;
        case "unauthenticated":
          toast.error(
            isAr ? "يرجى تسجيل الدخول أولاً." : "Please sign in first.",
          );
          break;
        case "not_configured":
          toast.error(
            isAr
              ? "الدفع غير مُفعّل بعد. تواصل مع الدعم."
              : "Payments are not configured yet. Contact support.",
          );
          break;
        default:
          toast.error(
            isAr
              ? "تعذر بدء الدفع. حاول مرة أخرى."
              : "Could not start checkout. Please try again.",
          );
      }
    } catch {
      toast.error(
        isAr
          ? "تعذر بدء الدفع. حاول مرة أخرى."
          : "Could not start checkout. Please try again.",
      );
    } finally {
      setBusy(false);
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
            {isAr
              ? "تفاصيل الخطة والدفع عبر Lemon Squeezy"
              : "Plan details and Lemon Squeezy checkout"}
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
            {isAr
              ? "ادفع بأمان عبر Lemon Squeezy. يمكنك الإلغاء في أي وقت من بوابة إدارة الاشتراك."
              : "Pay securely via Lemon Squeezy. Cancel anytime from the billing portal."}
          </span>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {isPaidPlan && (
            <Button
              onClick={handleCheckout}
              disabled={busy}
              className="w-full gap-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              {isAr ? "اشترك الآن" : "Subscribe Now"}
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            {isAr ? "لاحقًا" : "Later"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
