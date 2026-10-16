import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, PartyPopper, X } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import type { Onboarding } from "../../lib/types";

/** First-run checklist for owners (spec G3). Ticks come from real data. */
export function OnboardingChecklist({ data, onDismissed }: { data: Onboarding; onDismissed: () => void }) {
  const [busy, setBusy] = useState(false);
  const pct = Math.round((data.completed / data.total) * 100);
  const next = data.steps.find((s) => !s.done && !s.optional) ?? data.steps.find((s) => !s.done);

  const dismiss = async () => {
    setBusy(true);
    try {
      await api("/api/onboarding/dismiss", { method: "POST" });
      onDismissed();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle bg-brand-50 px-5 py-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-md font-semibold text-fg">
            {data.complete && <PartyPopper className="size-4 text-brand-600" />}
            {data.complete ? "Your pharmacy is ready" : "Get your pharmacy ready"}
          </h2>
          <p className="mt-0.5 text-sm text-fg-3">
            {data.complete ? "Everything essential is set up. You can hide this now." : `${data.completed} of ${data.total} done — most pharmacies finish in under 20 minutes.`}
          </p>
          <div className="mt-3 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Setup progress">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-fg-3 hover:bg-white hover:text-fg"
          aria-label="Hide setup checklist"
          title="Hide checklist"
        >
          <X className="size-4" />
        </button>
      </div>
      <ol className="divide-y divide-border-subtle">
        {data.steps.map((step) => {
          const isNext = step === next;
          return (
            <li key={step.key} className={cn("flex items-center gap-4 px-5 py-3", isNext && "bg-muted")}>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                  step.done ? "border-success-500 bg-success-500 text-white" : isNext ? "border-brand-500" : "border-border",
                )}
                aria-hidden="true"
              >
                {step.done && <Check className="size-4" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-md font-medium", step.done ? "text-fg-3 line-through decoration-fg-4" : "text-fg")}>
                  {step.title}
                  {step.optional && <span className="ml-2 text-xs font-normal text-fg-4 no-underline">Optional</span>}
                  <span className="sr-only">{step.done ? " (done)" : " (to do)"}</span>
                </p>
                {!step.done && <p className="text-sm text-fg-3">{step.description}</p>}
              </div>
              {!step.done && (
                <Link
                  to={step.action.to}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center rounded-md px-3 text-base font-medium whitespace-nowrap",
                    isNext ? "bg-brand-500 text-white hover:bg-brand-600" : "border border-border text-fg-2 hover:bg-subtle",
                  )}
                >
                  {step.action.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
