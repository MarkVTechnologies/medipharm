import type { ReactNode } from "react";
import { CalendarClock, ShieldCheck, Zap } from "lucide-react";
import { Brand } from "../../components/layout/Sidebar";

const POINTS = [
  { icon: Zap, title: "A sale in under 30 seconds", body: "Keyboard-first counter. Scan, charge, print — next customer." },
  { icon: CalendarClock, title: "Expiry caught before it costs you", body: "Every batch tracked. FEFO picks the right one automatically." },
  { icon: ShieldCheck, title: "Safe through power cuts", body: "Every checkout is all-or-nothing. No half-recorded sales, ever." },
];

/** Split layout: brand panel left, form right. Stacks on mobile. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-sidebar-fg lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 size-[480px] rounded-full bg-brand-500/20 blur-3xl"
        />
        <Brand />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white">
            Run your whole counter from one browser tab.
          </h2>
          <p className="mt-3 text-md text-sidebar-fg-muted">
            Inventory with batch-level expiry, point of sale, customers, suppliers and reports — built for Nigerian community pharmacies.
          </p>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-200">
                  <Icon className="size-[18px]" />
                </span>
                <span>
                  <span className="block text-md font-semibold text-white">{title}</span>
                  <span className="block text-base text-sidebar-fg-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-sm text-sidebar-fg-muted">© {new Date().getFullYear()} Mark V Technologies Limited · Lagos</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 rounded-lg bg-sidebar p-3 text-white lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
