import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App as CapApp } from "@capacitor/app";

const NATIVE_AUTH_CALLBACK_URL = "app.lovable.smartreplyai://auth/callback";

const getAuthErrorMessage = (error: unknown, fallback = "Authentication failed") => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || fallback);
  }
  return fallback;
};

export default function SignInPage() {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showAuthError = (label: string, authError: unknown, fallback?: string) => {
    const msg = getAuthErrorMessage(authError, fallback);
    console.error(label, authError);
    setError(translateError(msg));
    setRawError(msg);
  };

  // Handle OAuth deep-link callback on native (e.g. app.lovable.smartreplyai://auth/callback)
  useEffect(() => {
    if (!isNative) return;
    const handleAuthCallback = async (url: string) => {
      console.log("Capacitor auth callback URL:", url);
      try {
        await Browser.close();
      } catch {}
      const [, hash = ""] = url.split("#");
      const query = url.includes("?") ? url.split("?")[1]?.split("#")[0] ?? "" : "";
      const params = new URLSearchParams(hash || query);
      const callbackError = params.get("error_description") || params.get("error");
      if (callbackError) {
        showAuthError("OAuth callback error:", callbackError, "OAuth callback failed");
        setLoading(false);
        return;
      }
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (!access_token || !refresh_token) {
        showAuthError("OAuth callback missing tokens:", url, "OAuth callback did not include a session");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) {
        showAuthError("Set session error:", error, "Could not save auth session");
      } else {
        setLoading(false);
        navigate("/app", { replace: true });
      }
    };
    CapApp.getLaunchUrl().then((launch) => {
      if (launch?.url) void handleAuthCallback(launch.url);
    });
    const sub = CapApp.addListener("appUrlOpen", ({ url }) => {
      void handleAuthCallback(url);
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, [isNative, navigate]);


  const isAr = locale === "ar";

  const translateError = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes("invalid login")) return isAr ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password";
    if (m.includes("email not confirmed")) return isAr ? "يرجى تأكيد البريد الإلكتروني أولاً" : "Please confirm your email first";
    if (m.includes("user already registered")) return isAr ? "هذا الحساب مسجل مسبقاً، سجل دخولك" : "Account already exists, please sign in";
    if (m.includes("password")) return isAr ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters";
    if (m.includes("network") || m.includes("fetch")) return isAr ? "تعذر الاتصال بالخادم. تحقق من الإنترنت" : "Network error. Check your connection";
    return msg;
  };

  const handleEmailAuth = async () => {
    setError(null);
    setRawError(null);
    setInfo(null);
    if (!email || !password) {
      setError(isAr ? "أدخل البريد الإلكتروني وكلمة المرور" : "Enter email and password");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const redirectUrl = isNative ? NATIVE_AUTH_CALLBACK_URL : `${window.location.origin}/app`;
        console.log("Email signup redirect URL:", redirectUrl);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) throw error;
        setInfo(isAr ? "تم إنشاء الحساب! تحقق من بريدك للتأكيد." : "Account created! Check your email to confirm.");
      } else {
        console.log("Email/password sign-in started. Native:", isNative);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/app", { replace: true });
      }
    } catch (e: any) {
      showAuthError("Email auth error:", e, "Email authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setRawError(null);
    setLoading(true);
    try {
      if (isNative) {
        const redirectTo = NATIVE_AUTH_CALLBACK_URL;
        console.log("Google native sign-in started. Redirect URL:", redirectTo);
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        });
        if (error) throw error;
        if (!data?.url) throw new Error("Google OAuth did not return a login URL");
        await Browser.open({ url: data.url, presentationStyle: "fullscreen" });
        return;
      }

      console.log("Google web sign-in started.");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) throw result.error;
      if (!result.redirected) navigate("/app", { replace: true });
    } catch (e: any) {
      showAuthError("Google auth error:", e, "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 animate-slide-up">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">{t.app.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? t.auth.signIn : (isAr ? "إنشاء حساب" : "Create account")}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <div className="font-medium">{error}</div>
              {rawError && rawError !== error && (
                <div className="mt-1 text-xs opacity-80 break-all">{rawError}</div>
              )}
            </AlertDescription>
          </Alert>
        )}
        {info && (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.auth.email}</Label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t.auth.password}</Label>
            <Input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button className="w-full gap-2" size="lg" onClick={handleEmailAuth} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {mode === "signin" ? t.auth.signIn : (isAr ? "إنشاء حساب" : "Create account")}
          </Button>

          <Button variant="outline" className="w-full gap-2" size="lg" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t.auth.googleSignIn}
          </Button>

          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-primary"
            onClick={() => {
              setError(null);
              setInfo(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            disabled={loading}
          >
            {mode === "signin"
              ? (isAr ? "ليس لديك حساب؟ سجّل الآن" : "Don't have an account? Sign up")
              : (isAr ? "لديك حساب؟ سجّل دخولك" : "Already have an account? Sign in")}
          </button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">
            {isAr ? "← العودة للرئيسية" : "← Back to home"}
          </Link>
        </div>
      </div>
    </div>
  );
}
