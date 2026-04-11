import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Globe, User, Building2, CreditCard } from "lucide-react";

const tones = ["professional", "friendly", "casual", "persuasive", "empathetic"] as const;

export default function SettingsPage() {
  const { t, locale, setLocale } = useLanguage();
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    businessName: "",
    services: "",
    pricing: "",
    faqs: "",
    hours: "",
    policies: "",
    preferredTone: "professional",
  });

  const handleSave = () => {
    localStorage.setItem("smartreply-profile", JSON.stringify(profile));
    toast({ title: t.settings.saved });
  };

  return (
    <div className="mobile-container space-y-6 animate-slide-up pb-8">
      <h1 className="text-xl font-bold">{t.settings.title}</h1>

      {/* Language */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.language}</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant={locale === "en" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("en")}
          >
            English
          </Button>
          <Button
            variant={locale === "ar" ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale("ar")}
          >
            العربية
          </Button>
        </div>
      </div>

      {/* Business Profile */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.profile}</h2>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t.settings.businessName}</Label>
            <Input
              value={profile.businessName}
              onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.settings.services}</Label>
            <Textarea
              value={profile.services}
              onChange={(e) => setProfile((p) => ({ ...p, services: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.settings.pricingInfo}</Label>
            <Textarea
              value={profile.pricing}
              onChange={(e) => setProfile((p) => ({ ...p, pricing: e.target.value }))}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.settings.hours}</Label>
            <Input
              value={profile.hours}
              onChange={(e) => setProfile((p) => ({ ...p, hours: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.settings.preferredTone}</Label>
            <Select value={profile.preferredTone} onValueChange={(v) => setProfile((p) => ({ ...p, preferredTone: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tones.map((tn) => (
                  <SelectItem key={tn} value={tn}>{t.generate.tones[tn]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} className="w-full">{t.settings.save}</Button>
        </div>
      </div>

      {/* Billing */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.billing}</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t.settings.currentPlan}: <span className="text-primary">{t.plans.free}</span></p>
            <p className="text-xs text-muted-foreground">12 {t.settings.of} 25 {t.settings.repliesUsed}</p>
          </div>
          <Button variant="outline" size="sm">{t.settings.upgrade}</Button>
        </div>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t.settings.account}</h2>
        </div>
        <Button variant="outline" className="w-full text-destructive">{t.settings.signOut}</Button>
      </div>
    </div>
  );
}
