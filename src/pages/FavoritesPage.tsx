import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { EmptyState } from "@/components/EmptyStates";
import { Button } from "@/components/ui/button";
import { Heart, Copy, Trash2 } from "lucide-react";
import { copyToClipboard } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

interface FavoriteItem {
  id: string;
  platform: string;
  replyText: string;
}

const demoFavorites: FavoriteItem[] = [
  { id: "1", platform: "WhatsApp", replyText: "Thank you for your interest! We have availability this week. Would you like me to book a slot for you?" },
  { id: "2", platform: "Instagram", replyText: "Hi! 🌟 Great question. Our services start at $50/session, and we offer package discounts. DM us for details!" },
];

export default function FavoritesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState(demoFavorites);

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast({ title: t.generate.copied });
  };

  return (
    <div className="mobile-container space-y-4 animate-slide-up">
      <h1 className="text-xl font-bold">{t.favorites.title}</h1>

      {items.length === 0 ? (
        <EmptyState icon={<Heart className="h-12 w-12" />} message={t.favorites.empty} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{item.platform}</span>
              <p className="text-sm">{item.replyText}</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleCopy(item.replyText)} className="gap-1.5 text-xs">
                  <Copy className="h-3 w-3" />{t.generate.copy}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(item.id)} className="gap-1.5 text-xs text-destructive">
                  <Trash2 className="h-3 w-3" />{t.favorites.remove}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
