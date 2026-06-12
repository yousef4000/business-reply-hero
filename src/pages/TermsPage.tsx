import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export default function TermsPage() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  return (
    <div className="min-h-screen bg-background text-foreground" dir={ar ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-3xl px-5 py-10 space-y-6">
        <Link to="/" className="text-sm text-primary hover:underline">← {ar ? "العودة للرئيسية" : "Back to home"}</Link>
        <h1 className="text-3xl font-bold">{ar ? "شروط الاستخدام" : "Terms of Service"}</h1>
        <p className="text-sm text-muted-foreground">{ar ? "آخر تحديث: 12 يونيو 2026" : "Last updated: June 12, 2026"}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "استخدام الخدمة" : "Use of service"}</h2>
          <p className="text-sm">{ar
            ? "تستخدم Smart Reply Hub لتوليد ردود خدمة العملاء بناءً على بيانات نشاطك. يجب أن تملك الحق في رفع أي محتوى ترفعه."
            : "You use Smart Reply Hub to generate customer-service replies based on your business data. You must have the right to upload any content you upload."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "محتوى المستخدم" : "User content"}</h2>
          <p className="text-sm">{ar
            ? "تحتفظ بملكية بياناتك. تمنحنا ترخيصًا محدودًا لمعالجتها فقط لتشغيل الخدمة."
            : "You retain ownership of your data. You grant us a limited license to process it solely to operate the service."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "الاستخدام المحظور" : "Prohibited use"}</h2>
          <p className="text-sm">{ar
            ? "ممنوع استخدام الخدمة لأي نشاط غير قانوني، محتوى مضلل طبي/مالي، أو خداع للعملاء."
            : "Do not use the service for illegal activity, misleading medical/financial content, or deception of customers."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "إخلاء المسؤولية" : "Disclaimer"}</h2>
          <p className="text-sm">{ar
            ? "الردود يولدها ذكاء اصطناعي وقد تحتوي على أخطاء. أنت مسؤول عن مراجعة كل رد قبل إرساله."
            : "Replies are AI-generated and may contain errors. You are responsible for reviewing each reply before sending it."}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{ar ? "الإلغاء والاسترداد" : "Cancellation"}</h2>
          <p className="text-sm">{ar
            ? "يمكنك إلغاء اشتراكك في أي وقت. لا توجد استردادات جزئية للفترة الحالية."
            : "You can cancel your subscription anytime. No partial refunds for the current period."}</p>
        </section>

        <p className="text-sm">{ar ? "للتواصل: " : "Contact: "}<a className="text-primary underline" href="mailto:support@smartreplyhub.app">support@smartreplyhub.app</a></p>

        <div className="pt-4 flex gap-4 text-sm">
          <Link to="/privacy" className="text-primary hover:underline">{ar ? "الخصوصية" : "Privacy"}</Link>
          <Link to="/data-deletion" className="text-primary hover:underline">{ar ? "حذف البيانات" : "Data deletion"}</Link>
        </div>
      </div>
    </div>
  );
}
