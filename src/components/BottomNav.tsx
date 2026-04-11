import { Home, Sparkles, Clock, Heart, Settings } from "lucide-react";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/app", icon: Home, labelKey: "home" as const },
  { path: "/app/generate", icon: Sparkles, labelKey: "generate" as const },
  { path: "/app/history", icon: Clock, labelKey: "history" as const },
  { path: "/app/favorites", icon: Heart, labelKey: "favorites" as const },
  { path: "/app/settings", icon: Settings, labelKey: "settings" as const },
];

export function BottomNav() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom lg:hidden">
      <div className="flex items-center justify-around h-[var(--bottom-nav-height)]">
        {navItems.map(({ path, icon: Icon, labelKey }) => {
          const isActive = path === "/app"
            ? location.pathname === "/app"
            : location.pathname.startsWith(path);

          return (
            <RouterNavLink
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full px-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{t.nav[labelKey]}</span>
            </RouterNavLink>
          );
        })}
      </div>
    </nav>
  );
}
