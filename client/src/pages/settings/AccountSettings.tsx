import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/Input";
import { useSession } from "../../context/auth";
import { api, ApiError } from "../../lib/api";

export function AccountSettings() {
  const { user, refresh } = useSession();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [pw, setPw] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);

  const submit = async (which: "profile" | "password", body: Record<string, string>) => {
    setBusy(which);
    setError(null);
    try {
      await api("/api/settings/account", { method: "PATCH", body });
      await refresh();
      toast.success(which === "password" ? "Password changed" : "Account updated");
      if (which === "password") setPw({ current_password: "", password: "", password_confirmation: "" });
    } catch (e) {
      if (e instanceof ApiError) setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="My account" />
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); void submit("profile", { name, email }); }} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={error?.field("name")}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label="Email" error={error?.field("email")}>{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" loading={busy === "profile"}>Save</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Change password" />
        <CardBody>
          <form onSubmit={(e) => { e.preventDefault(); void submit("password", pw); }} className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password" error={error?.field("current_password")}>
              {(id) => <Input id={id} type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />}
            </Field>
            <Field label="New password" error={error?.field("password")}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />}
            </Field>
            <Field label="Confirm new password">
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw.password_confirmation} onChange={(e) => setPw({ ...pw, password_confirmation: e.target.value })} />}
            </Field>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" loading={busy === "password"} disabled={!pw.current_password || !pw.password}>Change password</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
