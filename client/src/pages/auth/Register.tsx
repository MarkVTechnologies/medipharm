import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Title } from "react-head";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { useAuth, type RegisterInput } from "../../context/auth";
import { ApiError } from "../../lib/api";
import { AuthShell } from "./AuthShell";

const EMPTY: RegisterInput = {
  pharmacy_name: "",
  phone: "",
  address: "",
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
};

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof RegisterInput) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Could not create your account.", 0));
    } finally {
      setBusy(false);
    }
  };

  const err = (k: string) => error?.field(k);

  return (
    <AuthShell>
      <Title>Start your free trial · MediPharm</Title>
      <h1 className="text-2xl font-semibold tracking-tight">Set up your pharmacy</h1>
      <p className="mt-1 text-md text-fg-3">30 days free. No card needed. NGN and 7.5% VAT are already set.</p>

      {error && !Object.keys(error.errors).length && (
        <p className="mt-4 rounded-md bg-danger-50 px-3 py-2 text-base text-danger-600" role="alert">
          {error.message}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Pharmacy name" required error={err("pharmacy_name")}>
          {(id) => <Input id={id} autoFocus value={form.pharmacy_name} onChange={set("pharmacy_name")} invalid={!!err("pharmacy_name")} placeholder="e.g. HealthPlus Pharmacy, Yaba" />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Pharmacy phone" error={err("phone")}>
            {(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} placeholder="0803 000 0000" />}
          </Field>
          <Field label="Your name" required error={err("name")}>
            {(id) => <Input id={id} autoComplete="name" value={form.name} onChange={set("name")} invalid={!!err("name")} />}
          </Field>
        </div>
        <Field label="Address" error={err("address")}>
          {(id) => <Input id={id} value={form.address} onChange={set("address")} placeholder="Street, area, Lagos" />}
        </Field>
        <Field label="Email" required error={err("email")}>
          {(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set("email")} invalid={!!err("email")} />}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Password" required error={err("password")} hint="At least 8 characters">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} invalid={!!err("password")} />}
          </Field>
          <Field label="Confirm password" required>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password_confirmation} onChange={set("password_confirmation")} />}
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create pharmacy
        </Button>
      </form>

      <p className="mt-6 text-center text-base text-fg-3">
        Already registered?{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
