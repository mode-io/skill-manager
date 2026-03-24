import { useEffect } from "react";
import { X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps): JSX.Element {
  useEffect(() => {
    if (!onDismiss) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss error"><X size={16} /></button>
      )}
    </div>
  );
}
