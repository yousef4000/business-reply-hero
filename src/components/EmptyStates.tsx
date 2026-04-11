import { WifiOff, RefreshCw, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="text-muted-foreground mb-4">{icon || <Inbox className="h-12 w-12" />}</div>
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon={<WifiOff className="h-12 w-12" />}
      message={t.common.noConnection}
      action={onRetry ? { label: t.common.retry, onClick: onRetry } : undefined}
    />
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useLanguage();
  return (
    <EmptyState
      icon={<RefreshCw className="h-12 w-12" />}
      message={message || t.common.error}
      action={onRetry ? { label: t.common.retry, onClick: onRetry } : undefined}
    />
  );
}
