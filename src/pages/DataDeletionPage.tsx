import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export default function DataDeletionPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  return (
    <div className="min-h-screen bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-3xl px-5 py-10 space-y-6">
        <Link to="/" className="text-sm text-primary hover:underline">← {ar ? "العودة للرئيسية" : "Back to home"}</Link>
        <h1 className="text-3xl font-bold">{ar ? "حذف الحساب والبيانات" : "Account & Data Deletion"}</h1>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "حذف داخل التطبيق (الطريقة الأسرع)" : "In-app deletion (fastest)"}</h2>
          <ol className="list-decimal pl-6 space-y-1 text-sm">
            <li>{ar ? "سجّل الدخول إلى حسابك." : "Sign in to your account."}</li>
            <li>{ar ? "افتح الإعدادات." : "Open Settings."}</li>
            <li>{ar ? "تحت قسم الحساب، اختر:" : "Under the Account section, choose:"}
              <ul className="list-disc pl-6 mt-1">
                <li>{ar ? "«حذف بيانات النشاط» — يمسح ملف العمل والملفات والمعرفة فقط." : "“Delete Business Data” — wipes only your business profile, files, and knowledge."}</li>
                <li>{ar ? "«حذف الحساب نهائيًا» — يمسح كل شيء بما في ذلك تسجيل الدخول." : "“Delete Account” — wipes everything including your sign-in."}</li>
              </ul>
            </li>
          </ol>
          <p className="text-sm text-muted-foreground">{ar
            ? "الحذف نهائي وفوري ولا يمكن استعادته."
            : "Deletion is immediate, permanent, and cannot be undone."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "إذا لم تستطع تسجيل الدخول" : "If you can't sign in"}</h2>
          <p className="text-sm">{ar
            ? "أرسل بريدًا إلى "
            : "Send an email to "}
            <a className="text-primary underline" href="mailto:support@smartreplyhub.app">support@smartreplyhub.app</a>
            {ar ? " من نفس البريد المسجل، واطلب «حذف الحساب». سنحذفه خلال 7 أيام عمل." : " from the same email address you registered with, requesting “Delete my account.” We will remove it within 7 business days."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "ما الذي يُحذف" : "What gets deleted"}</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>{ar ? "ملف العمل وجميع الحقول." : "Your business profile and all fields."}</li>
            <li>{ar ? "كل الوثائق والملفات المرفوعة." : "All uploaded files and documents."}</li>
            <li>{ar ? "قاعدة المعرفة والـ embeddings." : "Your knowledge base and embeddings."}</li>
            <li>{ar ? "بيانات الاشتراك والاستخدام." : "Subscription and usage data."}</li>
            <li>{ar ? "(الحذف الكامل) بيانات تسجيل الدخول نفسها." : "(Full deletion) your sign-in record itself."}</li>
          </ul>
        </section>

        <div className="pt-4 flex gap-4 text-sm">
          <Link to="/privacy" className="text-primary hover:underline">{ar ? "الخصوصية" : "Privacy"}</Link>
          <Link to="/terms" className="text-primary hover:underline">{ar ? "الشروط" : "Terms"}</Link>
        </div>
      </div>
    </div>
  );
}
