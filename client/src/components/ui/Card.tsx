import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border-subtle bg-canvas shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-md font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-1 text-md text-fg-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: "brand" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    danger: "bg-danger-50 text-danger-600",
    info: "bg-info-50 text-info-500",
  };
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-3">{label}</p>
          <p className="tabular mt-1.5 truncate text-2xl font-semibold tracking-tight text-fg">{value}</p>
        </div>
        {icon && <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md [&_svg]:size-[18px]", tones[tone])}>{icon}</span>}
      </div>
      {sub && <div className="mt-2 text-sm text-fg-3">{sub}</div>}
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-subtle text-fg-3 [&_svg]:size-5">{icon}</span>}
      <p className="text-md font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-base text-fg-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
