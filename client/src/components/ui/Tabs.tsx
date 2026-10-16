import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** Segmented filter / tab strip. Scrolls horizontally on narrow screens. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="tablist" className={cn("-mx-1 flex gap-1 overflow-x-auto px-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-8 text-sm" : "h-9 text-base",
              active ? "bg-canvas text-fg shadow-sm ring-1 ring-border-subtle" : "text-fg-3 hover:bg-subtle hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("tabular rounded-xs px-1 text-xs", active ? "bg-brand-50 text-brand-700" : "bg-subtle text-fg-3")}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
