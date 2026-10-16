import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { api, ApiError } from "../../lib/api";
import { AuthShell } from "./AuthShell";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ message: string }>("/api/reset-password", {
        method: "POST",
        body: { token, password, password_confirmation: confirm },
        silentAuth: true,
      });
      toast.success(res.message);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Could not reset your password. Check your connection.", 0));
    } finally {
      setBusy(false);
    }
  };

  const tokenError = !token ? "This page needs the link from your email." : error?.field("token");

  return (
    <AuthShell>
      <Title>Choose a new password · MediPharm</Title>
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-md text-fg-3">You'll be signed out everywhere else once it's changed.</p>

      {tokenError && (
        <div className="mt-6 rounded-md bg-danger-50 px-4 py-3 text-base text-danger-600" role="alert">
          {tokenError}{" "}
          <Link to="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="New password" hint="At least 8 characters" error={error?.field("password")}>
          {(id) => <Input id={id} type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} invalid={!!error?.field("password")} />}
        </Field>
        <Field label="Confirm new password">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        {error && !Object.keys(error.errors).length && <p className="text-base text-danger-600">{error.message}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!token || !password || !confirm}>
          Change password
        </Button>
      </form>
    </AuthShell>
  );
}
