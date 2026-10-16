import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSWRConfig } from "swr";
import { api, ensureCsrf } from "../lib/api";
import type { Tenant, User } from "../lib/types";
import { AuthContext, type AuthStatus, type RegisterInput } from "./auth";

interface SessionPayload {
  data: { user: User; tenant: Tenant };
}

const LOCK_KEY = "medipharm:locked";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [locked, setLocked] = useState(() => {
    try {
      return sessionStorage.getItem(LOCK_KEY) === "1";
    } catch {
      return false;
    }
  });
  const { mutate } = useSWRConfig();

  const apply = useCallback((payload: SessionPayload) => {
    setUser(payload.data.user);
    setTenant(payload.data.tenant);
    setStatus("authenticated");
  }, []);

  const refresh = useCallback(async () => {
    try {
      apply(await api<SessionPayload>("/api/me", { silentAuth: true }));
    } catch {
      setUser(null);
      setTenant(null);
      setStatus("guest");
    }
  }, [apply]);

  useEffect(() => {
    void ensureCsrf().then(refresh, refresh);
  }, [refresh]);

  // A 401/419 anywhere means the session is gone. The POS cart is kept in
  // sessionStorage and restored after re-auth (FR-1.4).
  useEffect(() => {
    const onExpired = () => {
      setStatus((s) => (s === "authenticated" ? "guest" : s));
      setUser(null);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = useCallback(
    async (email: string, password: string, pharmacy?: string) => {
      await ensureCsrf(true);
      apply(await api<SessionPayload>("/api/login", { method: "POST", body: { email, password, pharmacy }, silentAuth: true }));
    },
    [apply],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await ensureCsrf(true);
      apply(await api<SessionPayload>("/api/register", { method: "POST", body: input, silentAuth: true }));
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await api("/api/logout", { method: "POST", silentAuth: true });
    } finally {
      setUser(null);
      setTenant(null);
      setStatus("guest");
      setLocked(false);
      try {
        sessionStorage.removeItem(LOCK_KEY);
      } catch {
        /* ignore */
      }
      // Drop every cached response so the next user never sees this one's data.
      void mutate(() => true, undefined, { revalidate: false });
    }
  }, [mutate]);

  const lock = useCallback(() => {
    setLocked(true);
    try {
      sessionStorage.setItem(LOCK_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const unlock = useCallback(
    async (password: string) => {
      if (!user || !tenant) return;
      await login(user.email, password, tenant.slug);
      setLocked(false);
      try {
        sessionStorage.removeItem(LOCK_KEY);
      } catch {
        /* ignore */
      }
    },
    [login, user, tenant],
  );

  const value = useMemo(
    () => ({ status, user, tenant, locked, login, register, logout, refresh, lock, unlock }),
    [status, user, tenant, locked, login, register, logout, refresh, lock, unlock],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
