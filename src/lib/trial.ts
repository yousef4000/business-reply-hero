export function daysLeft(trialEndsAt: string | null | undefined): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

export function trialLabel(daysRemaining: number, locale: "en" | "ar"): string {
  if (locale === "ar") {
    if (daysRemaining <= 0) return "انتهت التجربة";
    if (daysRemaining === 1) return "يوم واحد متبقي";
    if (daysRemaining === 2) return "يومان متبقيان";
    return `${daysRemaining} أيام متبقية`;
  }
  if (daysRemaining <= 0) return "Trial expired";
  if (daysRemaining === 1) return "1 day left";
  return `${daysRemaining} days left`;
}
