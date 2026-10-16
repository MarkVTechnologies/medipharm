import { Navigate, NavLink, useParams } from "react-router-dom";
import { Title } from "react-head";
import { PageHeader } from "../../components/ui/Card";
import { useSession } from "../../context/auth";
import { cn } from "../../lib/cn";
import { AccountSettings } from "./AccountSettings";
import { BillingSettings } from "./BillingSettings";
import { ProfileSettings } from "./ProfileSettings";
import { StaffSettings } from "./StaffSettings";

const TABS = [
  { key: "profile", label: "Pharmacy profile", owner: false },
  { key: "account", label: "My account", owner: false },
  { key: "staff", label: "Staff", owner: true },
  { key: "billing", label: "Billing", owner: true },
] as const;

export default function Settings() {
  const { tab } = useParams();
  const { user } = useSession();
  const isOwner = user.role === "owner";
  const tabs = TABS.filter((t) => !t.owner || isOwner);
  if (!tabs.some((t) => t.key === tab)) return <Navigate to="/settings/profile" replace />;

  return (
    <>
      <Title>Settings · MediPharm</Title>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:px-0" aria-label="Settings sections">
          {tabs.map((t) => (
            <NavLink
              key={t.key}
              to={`/settings/${t.key}`}
              className={({ isActive }) =>
                cn(
                  "flex h-10 shrink-0 items-center rounded-md px-3 text-md font-medium whitespace-nowrap",
                  isActive ? "bg-canvas text-fg shadow-sm ring-1 ring-border-subtle" : "text-fg-3 hover:bg-subtle hover:text-fg",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "profile" && <ProfileSettings />}
          {tab === "account" && <AccountSettings />}
          {tab === "staff" && <StaffSettings />}
          {tab === "billing" && <BillingSettings />}
        </div>
      </div>
    </>
  );
}
