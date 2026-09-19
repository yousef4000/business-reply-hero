import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Globe, User, Building2, CreditCard, ChevronRight, LogOut, Database, Shield, Download, Trash2, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { UpgradeModal, type PlanKey } from "@/components/UpgradeModal";
import { useUsage } from "@/hooks/use-usage";
import { supabase } from "@/integrations/supabase/client";
import { TrialBanner } from "@/components/TrialBanner";
import { daysLeft, trialLabel } from "@/lib/trial";
import { openBillingPortal, fetchPlanInfo, type PlanInfo } from "@/lib/lemon";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { t, locale, setLocale } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const usage = useUsage();
  const ar = locale === "ar";
  const [upgradePlan, setUpgradePlan] = useState<PlanKey | null>(null);
  const [confirmDeleteData, setConfirmDeleteData] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const refreshPlanInfo = useCallback(async () => {
    const info = await fetchPlanInfo();
    setPlanInfo(info);
  }, []);

  useEffect(() => {
    refreshPlanInfo();
    const { data: sub } = supabase.auth.onAuthStateChange(() => refreshPlanInfo());
    return () => sub.subscription.unsubscribe();
  }, [refreshPlanInfo]);

  // Refresh plan info when returning from Lemon Squeezy checkout (tab regains focus)
  useEffect(() => {
    const handler = () => refreshPlanInfo();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [refreshPlanInfo]);

  const handleManageBilling = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    try {
      const res = await openBillingPortal();
      if (res.status === "none") {
        toast({ title: ar ? "لا يوجد اشتراك نشط" : "No active subscription", variant: "default" });
      } else if (res.status === "error") {
        toast({ title: t.common.error, description: res.message, variant: "destructive" });
      }
    } finally {
      setPortalBusy(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { toast({ title: t.common.error, description: error.message, variant: "destructive" }); return; }
    toast({ title: ar ? "تم تسجيل الخروج" : "Signed out" });
    navigate("/");
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const url = `https://wcbrzxqivsjucfepzarj.supabase.co/functions/v1/export-business-data`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const a = document.createElement("a");
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = `smart-reply-hub-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(obj);
    } catch (e: any) {
      toast({ title: ar ? "فشل التصدير" : "Export failed", description: e.message || "", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (mode: "data_only" | "full") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE", mode } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: ar ? "تم الحذف" : "Deleted" });
      if (mode === "full") {
        await supabase.auth.signOut();
        navigate("/");
      } else {
        setConfirmDeleteData(false);
      }
    } catch (e: any) {
      toast({ title: ar ? "فشل الحذف" : "Delete failed", description: e.message || "", variant: "destructive" });
    } finally {
      setBusy(false);
      setDeleteText("");
    }
  };

  const planLabel = usage.isGuest
    ? (ar ? "زائر" : "Guest")
    : usage.planState === "trial" ? (ar ? "تجربة مجانية" : "Free Trial")
    : usage.planState === "trial_expired" ? (ar ? "انتهت التجربة" : "Trial Ended")
    : t.plans[usage.plan as "free" | "starter" | "pro" | "business"] ?? usage.plan;

  return (
    <div className="mobile-container space-y-6 animate-slide-up pb-8">
      <h1 className="text-xl font-bold">{t.settings.title}</h1>

      <TrialBanner onUpgrade={() => setUpgradePlan("pro")} />

      {/* Language */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.language}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant={locale === "en" ? "default" : "outline"} size="sm" onClick={() => setLocale("en")}>English</Button>
          <Button variant={locale === "ar" ? "default" : "outline"} size="sm" onClick={() => setLocale("ar")}>العربية</Button>
        </div>
      </div>

      {/* Business profile link */}
      <Link to="/app/business" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold">{ar ? "ملف عملي" : "My Business Profile"}</p>
            <p className="text-xs text-muted-foreground">{ar ? "اجعل الردود مخصصة لنشاطك" : "Personalize every reply"}</p>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground ${ar ? "rotate-180" : ""}`} />
      </Link>

      {/* Knowledge Base link */}
      <Link to="/app/knowledge" className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Database className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-sm font-semibold">{ar ? "قاعدة المعرفة" : "Knowledge Base"}</p>
            <p className="text-xs text-muted-foreground">{ar ? "ارفع ملفات، روابط، سياسات" : "Upload files, URLs, policies"}</p>
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground ${ar ? "rotate-180" : ""}`} />
      </Link>

      {/* Billing */}
      {(() => {
        const isTrial = usage.planState === "trial";
        const isExpired = usage.planState === "trial_expired";
        const isPaid = usage.planState === "paid";
        const used = isTrial ? usage.trialUsed : usage.used;
        const lim = isTrial ? usage.trialLimit : usage.limit;
        const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
        const days = daysLeft(usage.trialEndsAt);
        const usageLine = isExpired ? (ar ? "انتهت تجربتك المجانية" : "Trial ended") : `${used} ${t.settings.of} ${lim} ${ar ? "رسالة" : "messages used"}`;
        const renewsAt = planInfo?.renewsAt;
        const renewFmt = renewsAt
          ? new Date(renewsAt).toLocaleDateString(ar ? "ar-EG" : "en-US", { year: "numeric", month: "short", day: "numeric" })
          : null;
        return (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">{t.settings.billing}</h2></div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{t.settings.currentPlan}: <span className="text-primary">{planLabel}</span></p>
              {isPaid ? (
                <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={portalBusy} className="gap-1.5">
                  {portalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  {ar ? "إدارة الاشتراك" : "Manage Billing"}
                </Button>
              ) : (
                <Button variant={isExpired ? "default" : "outline"} size="sm" onClick={() => setUpgradePlan("pro")}>{t.settings.upgrade}</Button>
              )}
            </div>
            {usage.loading ? <p className="text-xs text-muted-foreground">{t.common.loading}</p> : (
              <div className="space-y-1.5">
                {isTrial && <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{ar ? "الأيام المتبقية" : "Days remaining"}</span><span className="font-semibold">{trialLabel(days, locale)}</span></div>}
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{ar ? "الرسائل المستخدمة" : "Messages used"}</span><span className="font-semibold">{usageLine}</span></div>
                {!isExpired && lim > 0 && <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{ar ? "المتبقي" : "Remaining"}</span><span className="font-semibold">{Math.max(0, lim - used)} {ar ? "رسالة" : "messages"}</span></div>}
                {!isExpired && lim > 0 && <div className="h-2 w-full rounded-full bg-muted overflow-hidden mt-1"><div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>}
                {isPaid && renewFmt && <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60"><span className="text-muted-foreground">{ar ? "تاريخ التجديد" : "Renewal date"}</span><span className="font-semibold">{renewFmt}</span></div>}
              </div>
            )}
          </div>
        );
      })()}

      {/* Privacy & Legal */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">{ar ? "الخصوصية والقانوني" : "Privacy & Legal"}</h2></div>
        <Link to="/privacy" className="block text-sm text-primary hover:underline">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
        <Link to="/terms" className="block text-sm text-primary hover:underline">{ar ? "شروط الاستخدام" : "Terms of Service"}</Link>
        <Link to="/data-deletion" className="block text-sm text-primary hover:underline">{ar ? "حذف الحساب والبيانات" : "Account & Data Deletion"}</Link>
      </div>

      {/* Data controls */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">{ar ? "بياناتي" : "My Data"}</h2></div>
        <Button variant="outline" className="w-full gap-2" disabled={busy} onClick={handleExport}>
          <Download className="h-4 w-4" />{ar ? "تصدير بياناتي (JSON)" : "Export my data (JSON)"}
        </Button>
        <Button variant="outline" className="w-full gap-2 text-destructive" disabled={busy} onClick={() => setConfirmDeleteData(true)}>
          <Trash2 className="h-4 w-4" />{ar ? "حذف بيانات النشاط" : "Delete business data"}
        </Button>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">{t.settings.account}</h2></div>
        <Button variant="outline" className="w-full text-destructive gap-2" onClick={handleSignOut}><LogOut className="h-4 w-4" />{t.settings.signOut}</Button>
        <Button variant="destructive" className="w-full gap-2" onClick={() => setConfirmDeleteAccount(true)}>
          <AlertTriangle className="h-4 w-4" />{ar ? "حذف الحساب نهائيًا" : "Delete account permanently"}
        </Button>
      </div>

      <UpgradeModal open={!!upgradePlan} onOpenChange={(o) => !o && setUpgradePlan(null)} plan={upgradePlan} />

      {/* Delete business data */}
      <Dialog open={confirmDeleteData} onOpenChange={(o) => { if (!o) setConfirmDeleteData(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "حذف بيانات النشاط؟" : "Delete business data?"}</DialogTitle>
            <DialogDescription>{ar ? "سيُحذف ملف العمل، الملفات المرفوعة، وقاعدة المعرفة. لا يمكن التراجع." : "Your business profile, uploaded files, and knowledge base will be erased. Cannot be undone."}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteData(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" disabled={busy} onClick={() => handleDelete("data_only")}>{ar ? "حذف" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete account */}
      <Dialog open={confirmDeleteAccount} onOpenChange={(o) => { if (!o) { setConfirmDeleteAccount(false); setDeleteText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "حذف الحساب نهائيًا؟" : "Permanently delete account?"}</DialogTitle>
            <DialogDescription>{ar ? "سيُحذف حسابك وكل بياناتك فورًا ونهائيًا. اكتب DELETE للتأكيد." : "Your account and all data will be deleted immediately and permanently. Type DELETE to confirm."}</DialogDescription>
          </DialogHeader>
          <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDeleteAccount(false); setDeleteText(""); }}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" disabled={busy || deleteText !== "DELETE"} onClick={() => handleDelete("full")}>{ar ? "حذف الحساب" : "Delete account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
