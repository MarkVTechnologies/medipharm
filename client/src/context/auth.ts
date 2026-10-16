import { createContext, useContext } from "react";
import type { Tenant, User } from "../lib/types";

export type AuthStatus = "loading" | "authenticated" | "guest";

export interface RegisterInput {
  pharmacy_name: string;
  phone?: string;
  address?: string;
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  tenant: Tenant | null;
  locked: boolean;
  login: (email: string, password: string, pharmacy?: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  lock: () => void;
  unlock: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** For pages that only render inside ProtectedRoute. */
export function useSession(): { user: User; tenant: Tenant } & AuthState {
  const auth = useAuth();
  if (!auth.user || !auth.tenant) throw new Error("useSession used outside an authenticated route");
  return { ...auth, user: auth.user, tenant: auth.tenant };
}
