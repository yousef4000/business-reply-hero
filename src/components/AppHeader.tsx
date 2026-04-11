import { Globe } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { t, locale, setLocale } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm safe-top">
      <div className="flex items-center justify-between px-4 h-14">
        <h2 className="text-base font-semibold text-foreground lg:hidden">{t.app.name}</h2>
        <div className="hidden lg:block" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          className="gap-1.5 text-muted-foreground"
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium">{locale === "en" ? "عربي" : "EN"}</span>
        </Button>
      </div>
    </header>
  );
}
