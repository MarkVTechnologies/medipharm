import { useState } from "react";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { ClipboardList, Mail, MapPin, Pencil, Phone, Plus, Search, Truck } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Field, Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Spinner";
import { useInvalidate, useSuppliers } from "../../hooks/useData";
import { useDebounce } from "../../hooks/useDebounce";
import { api, ApiError } from "../../lib/api";
import type { Supplier } from "../../lib/types";

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const { data, error, mutate, isLoading } = useSuppliers({ search: debounced });
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);

  return (
    <>
      <Title>Suppliers · MediPharm</Title>
      <PageHeader title="Suppliers" description="Who you buy from, and what's on order." actions={<Button icon={<Plus />} onClick={() => setEditing("new")}>Add supplier</Button>} />

      <div className="mb-4 max-w-md">
        <Input leading={<Search />} placeholder="Search suppliers" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search suppliers" />
      </div>

      {error && !data ? (
        <Card><ErrorState error={error} onRetry={() => void mutate()} /></Card>
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44 rounded-lg" />)}</div>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState icon={<Truck />} title={debounced ? "No suppliers match" : "No suppliers yet"} description="Add the wholesalers and manufacturers you order from." action={!debounced && <Button onClick={() => setEditing("new")}>Add supplier</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.data.map((s) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-md font-semibold">{s.name}</h2>
                  <p className="text-sm text-fg-3">{s.contact_person ?? "No contact person"}</p>
                </div>
                <button type="button" onClick={() => setEditing(s)} className="flex size-9 items-center justify-center rounded-md text-fg-3 hover:bg-subtle hover:text-fg" aria-label={`Edit ${s.name}`}>
                  <Pencil className="size-4" />
                </button>
              </div>
              <ul className="mt-3 space-y-1.5 text-base text-fg-2">
                {s.phone && <li className="flex items-center gap-2"><Phone className="size-4 text-fg-4" /><a href={`tel:${s.phone}`} className="hover:text-brand-600">{s.phone}</a></li>}
                {s.email && <li className="flex items-center gap-2"><Mail className="size-4 text-fg-4" /><a href={`mailto:${s.email}`} className="truncate hover:text-brand-600">{s.email}</a></li>}
                {s.address && <li className="flex items-center gap-2"><MapPin className="size-4 text-fg-4" /><span className="truncate">{s.address}</span></li>}
              </ul>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {s.payment_terms && <Badge>{s.payment_terms}</Badge>}
                  {!!s.open_orders_count && <Badge tone="info">{s.open_orders_count} open PO{s.open_orders_count === 1 ? "" : "s"}</Badge>}
                </div>
                <ButtonLink to={`/purchase-orders/new?supplier=${s.id}`} variant="secondary" size="sm" icon={<ClipboardList />}>
                  New PO
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SupplierModal supplier={editing} onClose={() => setEditing(null)} onSaved={() => void mutate()} />
    </>
  );
}

function SupplierModal({ supplier, onClose, onSaved }: { supplier: Supplier | "new" | null; onClose: () => void; onSaved: () => void }) {
  const isNew = supplier === "new";
  const initial = supplier && supplier !== "new" ? supplier : null;
  const [f, setF] = useState(() => blank(initial));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();
  const [lastKey, setLastKey] = useState<unknown>(supplier);
  if (lastKey !== supplier) {
    setLastKey(supplier);
    setF(blank(initial));
    setError(null);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null]));
      await api(isNew ? "/api/suppliers" : `/api/suppliers/${initial?.id}`, { method: isNew ? "POST" : "PATCH", body });
      toast.success(isNew ? "Supplier added" : "Supplier updated");
      onSaved();
      void invalidate("/api/suppliers");
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof ReturnType<typeof blank>, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} error={error?.field(k)} required={k === "name"}>
      {(id) => <Input id={id} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />}
    </Field>
  );

  return (
    <Modal open={!!supplier} onClose={onClose} title={isNew ? "Add supplier" : "Edit supplier"}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">{field("name", "Company name")}</div>
        {field("contact_person", "Contact person")}
        {field("phone", "Phone", { type: "tel" })}
        {field("email", "Email", { type: "email" })}
        {field("payment_terms", "Payment terms", { placeholder: "e.g. Net 30" })}
        <div className="sm:col-span-2">{field("address", "Address")}</div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!f.name.trim()}>Save supplier</Button>
        </div>
      </form>
    </Modal>
  );
}

function blank(s: Supplier | null) {
  return {
    name: s?.name ?? "",
    contact_person: s?.contact_person ?? "",
    phone: s?.phone ?? "",
    email: s?.email ?? "",
    address: s?.address ?? "",
    payment_terms: s?.payment_terms ?? "",
  };
}
