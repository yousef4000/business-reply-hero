import { Home, Sparkles, Clock, Heart, Settings, Building2, Dna, BarChart3 } from "lucide-react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/app", icon: Home, labelKey: "home" as const },
  { path: "/app/generate", icon: Sparkles, labelKey: "generate" as const },
  { path: "/app/analytics", icon: BarChart3, labelKey: "analytics" as const },
  { path: "/app/business", icon: Building2, labelKey: "business" as const },
  { path: "/app/business-dna", icon: Dna, labelKey: "dna" as const },
  { path: "/app/history", icon: Clock, labelKey: "history" as const },
  { path: "/app/favorites", icon: Heart, labelKey: "favorites" as const },
  { path: "/app/settings", icon: Settings, labelKey: "settings" as const },
];

export function DesktopSidebar() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-60 border-e border-border bg-card min-h-screen">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-primary">{t.app.name}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{t.app.tagline}</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ path, icon: Icon, labelKey }) => {
          const isActive = path === "/app"
            ? location.pathname === "/app"
            : location.pathname.startsWith(path);

          return (
            <RouterNavLink
              key={path}
              to={path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.nav[labelKey]}</span>
            </RouterNavLink>
          );
        })}
      </nav>
    </aside>
  );
}
