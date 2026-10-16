import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Title } from "react-head";
import { Mail, KeyRound } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Field, Input, Select } from "../../components/ui/Input";
import { useAuth } from "../../context/auth";
import { ApiError } from "../../lib/api";
import { AuthShell } from "./AuthShell";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [pharmacies, setPharmacies] = useState<{ slug: string; name: string }[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password, pharmacy || undefined);
    } catch (err) {
      if (err instanceof ApiError) {
        const list = err.data.pharmacies as { slug: string; name: string }[] | undefined;
        if (list?.length) {
          setPharmacies(list);
          setPharmacy(list[0].slug);
        }
        setError(err);
      } else {
        setError(new ApiError("Could not sign in. Check your connection.", 0));
      }
    } finally {
      setBusy(false);
    }
  };

  const fieldError = error?.field("email") ?? (error && !Object.keys(error.errors).length ? error.message : undefined);

  return (
    <AuthShell>
      <Title>Sign in · MediPharm</Title>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-md text-fg-3">Sign in to your pharmacy.</p>

      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Email" error={fieldError}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              autoFocus
              required
              leading={<Mail />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!fieldError}
              placeholder="you@pharmacy.com"
            />
          )}
        </Field>
        <Field label="Password">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              required
              leading={<KeyRound />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {pharmacies.length > 1 && (
          <Field label="Pharmacy" hint="This email is registered with more than one pharmacy." error={error?.field("pharmacy") && !pharmacy ? error.field("pharmacy") : undefined}>
            {(id) => (
              <Select id={id} value={pharmacy} onChange={(e) => setPharmacy(e.target.value)}>
                {pharmacies.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email || !password}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-base text-fg-3">
        New to MediPharm?{" "}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          Start a free trial
        </Link>
      </p>

      {import.meta.env.DEV && (
        <div className="mt-8 rounded-md border border-dashed border-border bg-muted p-3 text-sm text-fg-3">
          <p className="font-semibold text-fg-2">Demo logins (password: <span className="font-mono">password</span>)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {["owner", "pharmacist", "assistant"].map((r) => (
              <button
                key={r}
                type="button"
                className="rounded-xs bg-canvas px-2 py-1 font-mono text-xs ring-1 ring-border hover:ring-brand-400"
                onClick={() => {
                  setEmail(`${r}@medipharm.test`);
                  setPassword("password");
                }}
              >
                {r}@medipharm.test
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}
