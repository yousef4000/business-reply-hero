import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { locale } = useLanguage();
  const isAr = locale === "ar";

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <p className="text-lg text-muted-foreground">
          {isAr ? "الصفحة غير موجودة" : "Page not found"}
        </p>
        <Button asChild className="gap-2">
          <Link to="/">
            <Home className="h-4 w-4" />
            {isAr ? "العودة للرئيسية" : "Back to Home"}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
