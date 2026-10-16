import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { useSession } from "../../context/auth";
import { ApiError } from "../../lib/api";
import { Button } from "../ui/Button";
import { Field, Input } from "../ui/Input";

/**
 * Explicit lock for unattended counter terminals (spec §4.4). The session and
 * the in-progress cart stay intact; only the screen is covered.
 */
export function LockScreen() {
  const { user, tenant, unlock, logout } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await unlock(password);
    } catch (err) {
      setError(err instanceof ApiError ? (err.field("email") ?? err.message) : "Could not unlock.");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-sidebar p-4" role="dialog" aria-modal="true" aria-label="Screen locked">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-canvas p-6 shadow-lg">
        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Lock className="size-5" />
          </span>
          <h1 className="text-xl font-semibold">Screen locked</h1>
          <p className="mt-1 text-base text-fg-3">
            {tenant.name} · {user.name}
          </p>
        </div>
        <Field label="Password" error={error}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!error}
            />
          )}
        </Field>
        <Button type="submit" className="mt-4 w-full" size="lg" loading={busy} disabled={!password}>
          Unlock
        </Button>
        <button type="button" onClick={() => void logout()} className="mt-3 w-full text-center text-base text-fg-3 hover:text-fg">
          Not {user.name.split(" ")[0]}? Sign out
        </button>
      </form>
    </div>
  );
}
