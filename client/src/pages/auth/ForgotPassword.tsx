import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Title } from "react-head";
import { MailCheck, Mail } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { api, ApiError } from "../../lib/api";
import { AuthShell } from "./AuthShell";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<{ message: string }>("/api/forgot-password", { method: "POST", body: { email: email.trim() }, silentAuth: true });
      setSent(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? (err.field("email") ?? err.message) : "Could not send the link. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <Title>Forgot password · MediPharm</Title>
      {sent ? (
        <div>
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-success-50 text-success-600">
            <MailCheck className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-2 text-md text-fg-3">{sent}</p>
          <p className="mt-4 text-base text-fg-3">
            No email? The pharmacy owner can also set a new password for you in <span className="font-medium text-fg-2">Settings → Staff</span>.
          </p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
          <p className="mt-1 text-md text-fg-3">Enter your email and we'll send you a link to choose a new one.</p>
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <Field label="Email" error={error}>
              {(id) => (
                <Input id={id} type="email" autoComplete="email" autoFocus leading={<Mail />} value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!error} />
              )}
            </Field>
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!email}>
              Send reset link
            </Button>
          </form>
          <p className="mt-6 text-center text-base text-fg-3">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-brand-600 hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
