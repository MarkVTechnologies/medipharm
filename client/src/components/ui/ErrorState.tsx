import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "./Button";
import { EmptyState } from "./Card";

/** Failed requests surface a retry affordance, never a dead end (§9.4). */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <EmptyState
      icon={<WifiOff />}
      title="Couldn't load this"
      description={message}
      action={
        onRetry && (
          <Button variant="secondary" icon={<RefreshCw />} onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}
