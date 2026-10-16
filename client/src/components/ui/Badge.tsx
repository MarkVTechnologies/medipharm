import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import type { PoStatus, StockStatus, Tier } from "../../lib/types";

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-fg-2",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-info-50 text-info-500",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-xs px-1.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function StockBadge({ status }: { status: StockStatus | null }) {
  if (!status) return null;
  const map = { in_stock: ["success", "In stock"], low: ["warning", "Low"], out: ["danger", "Out"] } as const;
  const [tone, label] = map[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

const tierStyles: Record<Tier, string> = {
  bronze: "bg-[#f6ede4] text-[#8a5a2b]",
  silver: "bg-subtle text-fg-2",
  gold: "bg-warning-50 text-warning-600",
  platinum: "bg-brand-50 text-brand-700",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <span className={cn("inline-flex h-5 items-center rounded-xs px-1.5 text-xs font-semibold capitalize", tierStyles[tier])}>{tier}</span>;
}

export function PoStatusBadge({ status }: { status: PoStatus }) {
  const map: Record<PoStatus, Tone> = { draft: "neutral", sent: "info", partial: "warning", received: "success", cancelled: "danger" };
  return (
    <Badge tone={map[status]} className="capitalize">
      {status}
    </Badge>
  );
}

export function SaleStatusBadge({ status }: { status: "completed" | "voided" }) {
  return status === "voided" ? <Badge tone="danger">Voided</Badge> : <Badge tone="success">Completed</Badge>;
}

export function PaymentBadge({ method }: { method: string }) {
  const labels: Record<string, string> = { cash: "Cash", card: "Card / POS", transfer: "Transfer" };
  return <Badge tone="neutral">{labels[method] ?? method}</Badge>;
}
