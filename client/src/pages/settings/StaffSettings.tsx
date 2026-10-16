import { useState } from "react";
import { toast } from "react-toastify";
import { UserPlus } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useSession } from "../../context/auth";
import { useStaff } from "../../hooks/useData";
import { api, ApiError } from "../../lib/api";
import { timeAgo } from "../../lib/dates";
import { ROLE_LABELS } from "../../lib/permissions";
import type { Role, User } from "../../lib/types";

const ROLE_HELP: Record<Role, string> = {
  owner: "Everything, including settings, staff and billing",
  pharmacist: "Sales, inventory, purchase orders, reports, voids",
  assistant: "Sales and customers only",
};

export function StaffSettings() {
  const { user: me } = useSession();
  const { data, mutate } = useStaff(true);
  const [inviting, setInviting] = useState(false);
  const [f, setF] = useState({ name: "", email: "", role: "assistant" as Role, password: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState<string>();

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/settings/staff", { method: "POST", body: f });
      toast.success(`${f.name} can now sign in`);
      setInviting(false);
      setF({ name: "", email: "", role: "assistant", password: "" });
      void mutate();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const update = async (u: User, patch: Partial<Pick<User, "role" | "is_active">>) => {
    try {
      await api(`/api/settings/staff/${u.id}`, { method: "PATCH", body: patch });
      toast.success("Staff updated");
      void mutate();
    } catch (e) {
      toast.error(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : "Update failed");
    }
  };

  const setPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetting) return;
    setBusy(true);
    setResetError(undefined);
    try {
      await api(`/api/settings/staff/${resetting.id}`, { method: "PATCH", body: { password: newPassword } });
      toast.success(`New password set for ${resetting.name}. They've been signed out everywhere.`);
      setResetting(null);
      setNewPassword("");
    } catch (err) {
      setResetError(err instanceof ApiError ? (err.field("password") ?? err.message) : "Could not set the password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Staff" description="Everyone who can sign in to this pharmacy." actions={<Button size="sm" icon={<UserPlus />} onClick={() => setInviting(true)}>Add staff</Button>} />
      <Table>
        <THead>
          <tr>
            <Th>Name</Th>
            <Th>Role</Th>
            <Th className="hidden md:table-cell">Last sign-in</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </THead>
        <tbody>
          {data?.data.map((u) => (
            <Tr key={u.id}>
              <Td>
                <span className="block font-medium text-fg">{u.name} {u.id === me.id && <span className="text-fg-4">(you)</span>}</span>
                <span className="text-sm text-fg-3">{u.email}</span>
              </Td>
              <Td>
                <Select value={u.role} disabled={u.id === me.id} onChange={(e) => void update(u, { role: e.target.value as Role })} className="h-9 w-36" aria-label={`Role for ${u.name}`}>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
              </Td>
              <Td className="hidden text-fg-3 md:table-cell">{u.last_login_at ? timeAgo(u.last_login_at) : "Never"}</Td>
              <Td>{u.is_active ? <Badge tone="success">Active</Badge> : <Badge>Deactivated</Badge>}</Td>
              <Td align="right">
                {u.id !== me.id && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setResetting(u); setNewPassword(""); setResetError(undefined); }}>
                      Set password
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void update(u, { is_active: !u.is_active })}>
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                )}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={inviting} onClose={() => setInviting(false)} title="Add staff member" description="Share the email and temporary password with them; they can change it under My account.">
        <form onSubmit={invite} className="space-y-4">
          <Field label="Full name" error={error?.field("name")}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Email" error={error?.field("email")}>{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Role" error={error?.field("role")} hint={ROLE_HELP[f.role]}>
            {(id) => (
              <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Temporary password" error={error?.field("password")} hint="At least 8 characters">
            {(id) => <Input id={id} type="text" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInviting(false)}>Cancel</Button>
            <Button type="submit" loading={busy}>Add staff</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title={`Set a new password for ${resetting?.name ?? ""}`}
        description="For staff who can't use the email reset. Tell them the new password in person; they can change it under My account."
        size="sm"
      >
        <form onSubmit={setPassword} className="space-y-4">
          <Field label="New password" hint="At least 8 characters" error={resetError}>
            {(id) => <Input id={id} type="text" autoComplete="off" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetting(null)}>Cancel</Button>
            <Button type="submit" loading={busy} disabled={newPassword.length < 8}>Set password</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
