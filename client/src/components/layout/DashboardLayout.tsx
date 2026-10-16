import { Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Menu, X } from "lucide-react";
import { useSession } from "../../context/auth";
import { PageLoader } from "../ui/Spinner";
import { LockScreen } from "./LockScreen";
import { Brand, Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const { tenant, user, locked } = useSession();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isPos = location.pathname.startsWith("/pos");

  useEffect(() => setOpen(false), [location.pathname]);

  const trialDays = tenant.status === "trial" && tenant.trial_ends_at
    ? Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="min-h-dvh bg-app">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-[rgb(12_35_64/0.5)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw]"
              initial={{ x: -288 }}
              animate={{ x: 0 }}
              exit={{ x: -288 }}
              transition={{ duration: 0.18, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <Sidebar onNavigate={() => setOpen(false)} />
              <button
                type="button"
                className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-md text-white/70 hover:bg-white/10"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-sidebar px-4 text-white lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="-ml-2 flex size-11 items-center justify-center rounded-md hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <Brand compact />
          <span className="truncate text-md font-semibold">{tenant.name}</span>
        </header>

        {tenant.read_only ? (
          <div className="no-print flex flex-wrap items-center gap-2 border-b border-warning-500/30 bg-warning-50 px-4 py-2.5 text-base text-warning-600 lg:px-8">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              Your subscription has lapsed — your records are safe and readable, but changes are paused.
            </span>
            {user.role === "owner" && (
              <Link to="/settings/billing" className="font-semibold underline">
                Renew now
              </Link>
            )}
          </div>
        ) : trialDays !== null && trialDays <= 7 ? (
          <div className="no-print flex flex-wrap items-center gap-2 border-b border-info-500/20 bg-info-50 px-4 py-2 text-base text-info-500 lg:px-8">
            <span>
              Free trial: {Math.max(0, trialDays)} day{trialDays === 1 ? "" : "s"} left.
            </span>
            {user.role === "owner" && (
              <Link to="/settings/billing" className="font-semibold underline">
                Choose a plan
              </Link>
            )}
          </div>
        ) : null}

        <main className={isPos ? "" : "mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {locked && <LockScreen />}
    </div>
  );
}
