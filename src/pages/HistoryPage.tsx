import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyStates";
import { LeadBadge } from "@/components/LeadBadge";
import { Search, Trash2, Copy, Clock } from "lucide-react";
import { copyToClipboard } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

interface HistoryItem {
  id: string;
  platform: string;
  replyText: string;
  leadTemperature: "hot" | "warm" | "cold";
  createdAt: string;
}

const demoHistory: HistoryItem[] = [
  { id: "1", platform: "WhatsApp", replyText: "Thank you for your inquiry! We'd be happy to schedule a consultation for you. Our next available slot is tomorrow at 3 PM. Would that work for you?", leadTemperature: "hot", createdAt: "2 hours ago" },
  { id: "2", platform: "Instagram", replyText: "Hi there! 👋 Thanks for your interest in our services. We offer both in-person and virtual sessions. Which would you prefer?", leadTemperature: "warm", createdAt: "5 hours ago" },
  { id: "3", platform: "Email", replyText: "Dear Customer, Thank you for reaching out regarding our pricing plans. I've attached our latest brochure with all the details.", leadTemperature: "cold", createdAt: "1 day ago" },
];

export default function HistoryPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState(demoHistory);

  const filtered = items.filter((item) =>
    item.replyText.toLowerCase().includes(search.toLowerCase()) ||
    item.platform.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast({ title: t.generate.copied });
  };

  return (
    <div className="mobile-container space-y-4 animate-slide-up">
      <h1 className="text-xl font-bold">{t.history.title}</h1>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.history.search}
          className="ps-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Clock className="h-12 w-12" />} message={t.history.empty} />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{item.platform}</span>
                  <LeadBadge temperature={item.leadTemperature} />
                </div>
                <span className="text-xs text-muted-foreground">{item.createdAt}</span>
              </div>
              <p className="text-sm line-clamp-3">{item.replyText}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(item.replyText)} className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />{t.generate.copy}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="gap-1.5 text-xs text-destructive">
                  <Trash2 className="h-3 w-3" />{t.history.delete}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
