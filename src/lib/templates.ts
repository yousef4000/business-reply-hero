// Smart Templates: business_type -> quick goal chips (EN/AR)

export type BusinessTypeKey =
  | "clinic"
  | "restaurant"
  | "ecommerce"
  | "gym"
  | "courses"
  | "salon"
  | "real_estate"
  | "services"
  | "other";

export const BUSINESS_TYPES: BusinessTypeKey[] = [
  "clinic",
  "restaurant",
  "ecommerce",
  "gym",
  "courses",
  "salon",
  "real_estate",
  "services",
  "other",
];

export const BUSINESS_TYPE_LABELS: Record<BusinessTypeKey, { en: string; ar: string }> = {
  clinic: { en: "Clinic", ar: "عيادة" },
  restaurant: { en: "Restaurant", ar: "مطعم" },
  ecommerce: { en: "E-commerce", ar: "متجر إلكتروني" },
  gym: { en: "Gym", ar: "صالة رياضية" },
  courses: { en: "Course Provider", ar: "مقدم كورسات" },
  salon: { en: "Salon / Spa", ar: "صالون / سبا" },
  real_estate: { en: "Real Estate", ar: "عقارات" },
  services: { en: "Services", ar: "خدمات" },
  other: { en: "Other", ar: "أخرى" },
};

export const TEMPLATES: Record<BusinessTypeKey, { en: string; ar: string }[]> = {
  clinic: [
    { en: "Book appointment", ar: "حجز موعد" },
    { en: "Ask about pricing", ar: "السؤال عن الأسعار" },
    { en: "Reschedule appointment", ar: "تغيير الموعد" },
    { en: "Handle complaint", ar: "معالجة شكوى" },
  ],
  restaurant: [
    { en: "Place order", ar: "إنشاء طلب" },
    { en: "Ask about menu", ar: "السؤال عن المنيو" },
    { en: "Follow up order", ar: "متابعة الطلب" },
    { en: "Handle complaint", ar: "معالجة شكوى" },
  ],
  ecommerce: [
    { en: "Product price inquiry", ar: "السؤال عن السعر" },
    { en: "Product availability", ar: "توفر المنتج" },
    { en: "Size / specs inquiry", ar: "السؤال عن المقاس" },
    { en: "Close the sale", ar: "إغلاق البيع" },
    { en: "Follow up order", ar: "متابعة الطلب" },
  ],
  gym: [
    { en: "Membership inquiry", ar: "السؤال عن الاشتراك" },
    { en: "Pricing inquiry", ar: "السؤال عن الأسعار" },
    { en: "Free trial request", ar: "طلب تجربة مجانية" },
    { en: "Schedule a visit", ar: "تحديد زيارة" },
  ],
  courses: [
    { en: "Course pricing", ar: "أسعار الكورس" },
    { en: "Course details", ar: "تفاصيل الكورس" },
    { en: "Enrollment inquiry", ar: "استفسار عن التسجيل" },
    { en: "Follow-up lead", ar: "متابعة عميل محتمل" },
  ],
  salon: [
    { en: "Book a session", ar: "حجز جلسة" },
    { en: "Service pricing", ar: "أسعار الخدمات" },
    { en: "Available slots", ar: "المواعيد المتاحة" },
  ],
  real_estate: [
    { en: "Property details", ar: "تفاصيل العقار" },
    { en: "Schedule viewing", ar: "تحديد معاينة" },
    { en: "Negotiate price", ar: "التفاوض على السعر" },
  ],
  services: [
    { en: "Service pricing", ar: "أسعار الخدمة" },
    { en: "Project timeline", ar: "مدة المشروع" },
    { en: "Send proposal", ar: "إرسال عرض" },
  ],
  other: [
    { en: "Answer inquiry", ar: "الرد على استفسار" },
    { en: "Handle complaint", ar: "معالجة شكوى" },
    { en: "Close the sale", ar: "إغلاق البيع" },
  ],
};

export function getTemplatesFor(type: string, locale: "en" | "ar"): string[] {
  const key = (BUSINESS_TYPES.includes(type as BusinessTypeKey) ? type : "other") as BusinessTypeKey;
  return TEMPLATES[key].map((t) => t[locale]);
}
