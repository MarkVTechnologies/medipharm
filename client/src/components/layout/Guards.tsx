import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/auth";
import { can, type Capability } from "../../lib/permissions";
import { EmptyState } from "../ui/Card";
import { PageLoader } from "../ui/Spinner";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader />;
  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <PageLoader />;
  if (status === "authenticated") {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/"} replace />;
  }
  return <Outlet />;
}

export function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { user } = useAuth();
  if (!can(user?.role, capability)) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="You don't have access to this page"
        description="Ask the pharmacy owner if you need it."
        className="min-h-[50vh]"
      />
    );
  }
  return <>{children}</>;
}
