import { NavLink } from "react-router-dom";
import { Lock, LogOut } from "lucide-react";
import { useSession } from "../../context/auth";
import { cn } from "../../lib/cn";
import { can, ROLE_LABELS } from "../../lib/permissions";
import { NAV_SECTIONS } from "./nav";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-md bg-brand-500 text-white shadow-sm">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <path d="M13 7h6v6h6v6h-6v6h-6v-6H7v-6h6z" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-md font-semibold tracking-tight">MediPharm</span>
          <span className="block text-xs text-sidebar-fg-muted">Pharmacy Edition</span>
        </span>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, tenant, logout, lock } = useSession();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-fg">
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>

      <div className="mx-3 mb-2 rounded-md bg-sidebar-hover px-3 py-2.5">
        <p className="truncate text-base font-semibold" title={tenant.name}>
          {tenant.name}
        </p>
        <p className="text-xs text-sidebar-fg-muted capitalize">
          {tenant.plan} plan · {tenant.status.replace("_", " ")}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.capability || can(user.role, i.capability));
          if (!items.length) return null;
          return (
            <div key={section.title} className="mb-4">
              <p className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-sidebar-fg-muted uppercase">{section.title}</p>
              <ul className="space-y-0.5">
                {items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "flex h-10 items-center gap-3 rounded-md px-3 text-md font-medium transition-colors",
                          isActive ? "bg-sidebar-active text-white" : "text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={cn("size-[18px]", isActive && "text-brand-300")} />
                          {label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">{user.name}</p>
            <p className="text-xs text-sidebar-fg-muted">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={lock}
            className="flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
          >
            <Lock className="size-4" /> Lock
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium text-sidebar-fg-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
