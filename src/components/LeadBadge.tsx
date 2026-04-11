import { cn } from "@/lib/utils";

interface LeadBadgeProps {
  temperature: "hot" | "warm" | "cold";
  className?: string;
}

const labels = { hot: "🔥 Hot", warm: "🌤 Warm", cold: "❄️ Cold" };
const labelsAr = { hot: "🔥 ساخن", warm: "🌤 دافئ", cold: "❄️ بارد" };

export function LeadBadge({ temperature, className }: LeadBadgeProps) {
  const lang = document.documentElement.lang;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        temperature === "hot" && "bg-destructive/10 text-destructive",
        temperature === "warm" && "bg-warning/10 text-warning",
        temperature === "cold" && "bg-primary/10 text-primary",
        className
      )}
    >
      {lang === "ar" ? labelsAr[temperature] : labels[temperature]}
    </span>
  );
}
