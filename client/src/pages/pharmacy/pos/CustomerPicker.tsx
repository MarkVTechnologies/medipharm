import { useState } from "react";
import useSWR from "swr";
import { Search, UserPlus, X } from "lucide-react";
import { toast } from "react-toastify";
import { TierBadge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Field, Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { useDebounce } from "../../../hooks/useDebounce";
import { api, ApiError, qs, type Paginated } from "../../../lib/api";
import type { Cart } from "../../../lib/cart";
import { formatNaira } from "../../../lib/money";
import type { Customer } from "../../../lib/types";

type Picked = NonNullable<Cart["customer"]>;

export function CustomerPicker({ value, onChange }: { value: Cart["customer"]; onChange: (c: Picked | null) => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const query = useDebounce(q, 200);
  const { data } = useSWR<Paginated<Customer>>(open && !creating ? `/api/customers${qs({ search: query, per_page: 8, sort: "recent" })}` : null);

  const pick = (c: Customer) => {
    onChange({ id: c.id, code: c.code, name: c.name, phone: c.phone, tier: c.tier, discount: c.discount });
    setOpen(false);
    setQ("");
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-fg">{value.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-fg-3">
            <TierBadge tier={value.tier} />
            {value.discount > 0 ? `${value.discount}% discount applied` : value.code}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="flex size-9 items-center justify-center rounded-md text-fg-3 hover:bg-white" aria-label="Remove customer">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center gap-2 rounded-md border border-dashed border-border px-3 text-base text-fg-3 hover:border-brand-400 hover:text-brand-600"
      >
        <UserPlus className="size-4" /> Attach customer (optional)
      </button>

      <Modal open={open} onClose={() => { setOpen(false); setCreating(false); }} title={creating ? "New customer" : "Attach customer"} size="md">
        {creating ? (
          <NewCustomerForm
            initialName={/^\d/.test(q) ? "" : q}
            initialPhone={/^\d/.test(q) ? q : ""}
            onCreated={(c) => {
              setCreating(false);
              pick(c);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <>
            <Input leading={<Search />} placeholder="Name, phone or CUS code" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            <ul className="mt-3 divide-y divide-border-subtle">
              {(data?.data ?? []).map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pick(c)} className="flex min-h-12 w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-md font-medium">{c.name}</p>
                      <p className="text-sm text-fg-3">
                        {c.phone ?? "No phone"} · {c.visit_count} visits · {formatNaira(c.lifetime_spend)}
                      </p>
                    </div>
                    <TierBadge tier={c.tier} />
                  </button>
                </li>
              ))}
              {data && data.data.length === 0 && <li className="py-6 text-center text-base text-fg-3">No customer matches “{query}”.</li>}
            </ul>
            <Button variant="secondary" className="mt-3 w-full" icon={<UserPlus />} onClick={() => setCreating(true)}>
              Add new customer
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}

export function NewCustomerForm({
  initialName = "",
  initialPhone = "",
  onCreated,
  onCancel,
}: {
  initialName?: string;
  initialPhone?: string;
  onCreated: (c: Customer) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ data: Customer }>("/api/customers", { method: "POST", body: { name, phone: phone || null, email: email || null } });
      toast.success(`${res.data.name} added (${res.data.code})`);
      onCreated(res.data);
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name" required error={error?.field("name")}>
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}
      </Field>
      <Field label="Phone" error={error?.field("phone")} hint="Used to find them at the counter and for WhatsApp receipts">
        {(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
      </Field>
      <Field label="Email" error={error?.field("email")}>
        {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      {error && !Object.keys(error.errors).length && <p className="text-base text-danger-600">{error.message}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          Save customer
        </Button>
      </div>
    </form>
  );
}
