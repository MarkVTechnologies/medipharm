import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

const ease = [0.2, 0.7, 0.3, 1] as const;

/**
 * Accessible modal: focus moves in on open and returns on close, Escape closes,
 * body scroll locks. 180ms transitions (spec §8.4).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Render as a right-hand drawer instead of a centred dialog. */
  side?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Parents usually pass an inline onClose; keep the effect from re-running (and stealing focus) every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea, button:not([data-close])");
      (target ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={cn("fixed inset-0 z-50 flex", side ? "justify-end" : "items-end justify-center sm:items-center sm:p-4")}>
          <motion.div
            className="absolute inset-0 bg-[rgb(12_35_64/0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={cn(
              "relative flex w-full flex-col bg-canvas shadow-lg outline-none",
              side ? "h-full max-w-xl" : cn("max-h-[92vh] rounded-t-xl sm:rounded-xl", widths[size]),
            )}
            initial={side ? { x: 40, opacity: 0 } : { y: 16, opacity: 0, scale: 0.98 }}
            animate={side ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side ? { x: 40, opacity: 0 } : { y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-fg">{title}</h2>
                {description && <p className="mt-0.5 text-base text-fg-3">{description}</p>}
              </div>
              <button
                type="button"
                data-close
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-1 inline-flex size-9 items-center justify-center rounded-md text-fg-3 hover:bg-subtle hover:text-fg"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
