import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

export default function SignInPage() {
  const { t, locale } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">{t.app.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.auth.signIn}</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.auth.email}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.auth.password}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full gap-2" size="lg">
            <Mail className="h-4 w-4" />
            {t.auth.signIn}
          </Button>
          <Button variant="outline" className="w-full gap-2" size="lg">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t.auth.googleSignIn}
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">
            {locale === "en" ? "← Back to home" : "← العودة للرئيسية"}
          </Link>
        </div>
      </div>
    </div>
  );
}
