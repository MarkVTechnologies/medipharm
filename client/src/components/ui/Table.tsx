import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { useInView } from "react-intersection-observer";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left text-base">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border-subtle bg-muted">{children}</thead>;
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 px-4 text-xs font-semibold tracking-wide whitespace-nowrap text-fg-3 uppercase",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, onClick, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("h-11 border-b border-border-subtle last:border-0", onClick && "cursor-pointer hover:bg-muted", className)}
      onClick={onClick}
      {...props}
    />
  );
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "right" | "center" }) {
  return (
    <td
      className={cn("px-4 py-2 align-middle text-fg-2", align === "right" && "tabular text-right", align === "center" && "text-center", className)}
      {...props}
    />
  );
}

/** Infinite-scroll sentinel: calls onVisible when scrolled into view. */
export function LoadMore({ hasMore, loading, onVisible }: { hasMore: boolean; loading: boolean; onVisible: () => void }) {
  const { ref } = useInView({ rootMargin: "200px", onChange: (inView) => inView && hasMore && !loading && onVisible() });
  if (!hasMore) return null;
  return (
    <div ref={ref} className="flex justify-center py-4 text-fg-3">
      {loading ? (
        <Spinner className="size-5" />
      ) : (
        <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={onVisible}>
          Load more
        </button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  lastPage,
  total,
  onPage,
}: {
  page: number;
  lastPage: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (lastPage <= 1) return <div className="px-4 py-3 text-sm text-fg-3">{total} result{total === 1 ? "" : "s"}</div>;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-sm text-fg-3">
      <span>
        Page {page} of {lastPage} · {total} results
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="h-8 rounded-md border border-border bg-canvas px-3 font-medium text-fg-2 hover:bg-subtle disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="h-8 rounded-md border border-border bg-canvas px-3 font-medium text-fg-2 hover:bg-subtle disabled:opacity-40"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
