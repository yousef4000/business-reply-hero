import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PrivacyPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  return (
    <div className="min-h-screen bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-3xl px-5 py-10 space-y-6">
        <Link to="/" className="text-sm text-primary hover:underline">← {ar ? "العودة للرئيسية" : "Back to home"}</Link>
        <h1 className="text-3xl font-bold">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
        <p className="text-sm text-muted-foreground">{ar ? "آخر تحديث: 12 يونيو 2026" : "Last updated: June 12, 2026"}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "ما الذي نجمعه" : "Information we collect"}</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>{ar ? "بيانات الحساب: البريد الإلكتروني، حالة الاشتراك." : "Account data: email, subscription status."}</li>
            <li>{ar ? "بيانات نشاطك التجاري التي ترفعها بنفسك (ملفات، روابط، نصوص يدوية، سياسات، قوائم أسعار)." : "Business data you upload yourself (files, URLs, manual text, policies, price lists)."}</li>
            <li>{ar ? "الرسائل التي تطلب توليد ردود لها — لا نخزنها بعد التوليد إلا إذا حفظتها أنت." : "Customer messages you submit for reply generation — not retained after generation unless you save them."}</li>
            <li>{ar ? "بيانات استخدام أساسية (عدد الردود، خطة الاشتراك)." : "Basic usage data (replies count, plan)."}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "لماذا نجمعها وكيف نستخدمها" : "Why we collect it and how we use it"}</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>{ar ? "تحسين دقة الردود التي يولدها الذكاء الاصطناعي بناءً على نشاطك." : "To improve AI-generated reply accuracy based on your business."}</li>
            <li>{ar ? "تشغيل الاشتراك والفوترة." : "To operate subscriptions and billing."}</li>
            <li>{ar ? "حماية الخدمة من إساءة الاستخدام." : "To protect the service from abuse."}</li>
          </ul>
          <p className="text-sm font-semibold">{ar
            ? "وثائق عملك تُستخدم فقط لتحسين الردود داخل التطبيق."
            : "Your business documents are used only to improve replies inside the app."}</p>
          <p className="text-sm font-semibold">{ar ? "لا نبيع بياناتك أبدًا." : "We never sell your data."}</p>
          <p className="text-sm font-semibold">{ar
            ? "لا نشاركها مع أطراف ثالثة باستثناء مزودي الخدمة الضروريين لتشغيل التطبيق (الاستضافة، قاعدة البيانات، مزود نموذج الذكاء الاصطناعي)."
            : "We do not share it with third parties except service providers required for the app to function (hosting, database, AI model provider)."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "مدة الاحتفاظ" : "Retention"}</h2>
          <p className="text-sm">{ar
            ? "تُحتفظ بياناتك طالما الحساب نشط. يمكنك حذف بيانات نشاطك أو حسابك بالكامل في أي وقت من الإعدادات."
            : "Data is retained as long as your account is active. You can delete your business data or your entire account at any time from Settings."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "حقوقك" : "Your rights"}</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>{ar ? "الوصول إلى بياناتك وتصديرها (JSON)." : "Access and export your data (JSON)."}</li>
            <li>{ar ? "تعديل أو حذف ملف العمل والمعرفة في أي وقت." : "Edit or delete your business profile and knowledge any time."}</li>
            <li>{ar ? "حذف الحساب بالكامل." : "Delete your account entirely."}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "الأمان" : "Security"}</h2>
          <p className="text-sm">{ar
            ? "الملفات المرفوعة تُخزّن مشفّرة. الوصول مقيّد بصاحب الحساب فقط عبر سياسات الأمان على مستوى الصف. الاتصال يستخدم HTTPS."
            : "Uploaded files are stored encrypted. Access is restricted to the owning account via row-level security policies. All transport uses HTTPS."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "التواصل" : "Contact"}</h2>
          <p className="text-sm">{ar ? "للاستفسارات حول الخصوصية: " : "For privacy questions: "}<a className="text-primary underline" href="mailto:support@smartreplyhub.app">support@smartreplyhub.app</a></p>
        </section>

        <div className="pt-4 flex gap-4 text-sm">
          <Link to="/terms" className="text-primary hover:underline">{ar ? "الشروط" : "Terms"}</Link>
          <Link to="/data-deletion" className="text-primary hover:underline">{ar ? "حذف البيانات" : "Data deletion"}</Link>
        </div>
      </div>
    </div>
  );
}
