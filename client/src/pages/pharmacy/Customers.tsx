import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { Search, UserPlus, Users } from "lucide-react";
import { SaleStatusBadge, TierBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Field, Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Skeleton, Spinner } from "../../components/ui/Spinner";
import { Pagination, Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Tabs } from "../../components/ui/Tabs";
import { useCustomer, useCustomers, useInvalidate } from "../../hooks/useData";
import { useDebounce } from "../../hooks/useDebounce";
import { api, ApiError } from "../../lib/api";
import { formatDate, formatDateTime } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { Customer, Tier } from "../../lib/types";
import { NewCustomerForm } from "./pos/CustomerPicker";

export default function Customers() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const [tier, setTier] = useState<"" | Tier>("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidate();

  const { data, error, mutate, isLoading } = useCustomers({ search: debounced, tier, sort, page });
  const counts = data?.meta.tier_counts ?? {};

  return (
    <>
      <Title>Customers · MediPharm</Title>
      <PageHeader
        title="Customers"
        description="Loyalty tiers apply their discount automatically at the counter."
        actions={<Button icon={<UserPlus />} onClick={() => setAdding(true)}>Add customer</Button>}
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border-subtle p-4 md:flex-row md:items-center">
          <div className="flex-1">
            <Input leading={<Search />} placeholder="Name, phone or CUS code" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search customers" />
          </div>
          <Tabs
            size="sm"
            value={sort}
            onChange={setSort}
            items={[
              { value: "name", label: "A–Z" },
              { value: "spend", label: "Top spend" },
              { value: "recent", label: "Recent" },
            ]}
          />
        </div>
        <div className="border-b border-border-subtle bg-muted px-3 py-2">
          <Tabs<"" | Tier>
            size="sm"
            value={tier}
            onChange={(t) => { setTier(t); setPage(1); }}
            items={[
              { value: "", label: "All" },
              { value: "bronze", label: "Bronze", count: counts.bronze },
              { value: "silver", label: "Silver", count: counts.silver },
              { value: "gold", label: "Gold", count: counts.gold },
              { value: "platinum", label: "Platinum", count: counts.platinum },
            ]}
          />
        </div>

        {error && !data ? (
          <ErrorState error={error} onRetry={() => void mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<Users />} title={debounced || tier ? "No customers match" : "No customers yet"} description="Attach customers at checkout to track loyalty and lifetime value." />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>Customer</Th>
                  <Th className="hidden sm:table-cell">Phone</Th>
                  <Th>Tier</Th>
                  <Th align="right" className="hidden md:table-cell">Visits</Th>
                  <Th align="right">Lifetime spend</Th>
                  <Th className="hidden lg:table-cell">Last visit</Th>
                </tr>
              </THead>
              <tbody>
                {data.data.map((c) => (
                  <Tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
                    <Td>
                      <span className="block font-medium text-fg">{c.name}</span>
                      <span className="font-mono text-xs text-fg-4">{c.code}</span>
                    </Td>
                    <Td className="hidden text-fg-3 sm:table-cell">{c.phone ?? "—"}</Td>
                    <Td><TierBadge tier={c.tier} /></Td>
                    <Td align="right" className="hidden md:table-cell">{c.visit_count}</Td>
                    <Td align="right" className="font-medium text-fg">{formatNaira(c.lifetime_spend)}</Td>
                    <Td className="hidden text-fg-3 lg:table-cell">{c.last_visit_at ? formatDate(c.last_visit_at) : "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.meta.page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="New customer">
        <NewCustomerForm
          onCancel={() => setAdding(false)}
          onCreated={(c) => {
            setAdding(false);
            void invalidate("/api/customers");
            navigate(`/customers/${c.id}`);
          }}
        />
      </Modal>

      <CustomerDrawer id={id} onClose={() => navigate("/customers")} />
    </>
  );
}

function CustomerDrawer({ id, onClose }: { id?: string; onClose: () => void }) {
  const { data, mutate } = useCustomer(id);
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);
  const c = data?.data;

  return (
    <Modal side open={!!id} onClose={onClose} title={c?.name ?? "Customer"} description={c ? `${c.code} · customer since ${formatDate(c.created_at)}` : undefined}>
      {!c ? (
        <div className="flex justify-center py-12 text-brand-500"><Spinner /></div>
      ) : editing ? (
        <EditCustomer
          customer={c}
          onDone={() => {
            setEditing(false);
            void mutate();
            void invalidate("/api/customers");
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Tier" value={<TierBadge tier={c.tier} />} sub={c.discount > 0 ? `${c.discount}% off` : "No discount"} />
            <Stat label="Visits" value={c.visit_count} />
            <Stat label="Lifetime" value={formatNaira(c.lifetime_spend)} />
          </div>
          <dl className="divide-y divide-border-subtle rounded-md border border-border-subtle text-base">
            <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-3">Phone</dt><dd>{c.phone ?? "—"}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-3">Email</dt><dd>{c.email ?? "—"}</dd></div>
            <div className="flex justify-between px-4 py-2.5"><dt className="text-fg-3">Last visit</dt><dd>{formatDateTime(c.last_visit_at)}</dd></div>
          </dl>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit details</Button>
          <div>
            <h3 className="mb-2 text-md font-semibold">Recent purchases</h3>
            {!c.recent_sales?.length ? (
              <p className="text-base text-fg-3">No purchases yet.</p>
            ) : (
              <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
                {c.recent_sales.map((s) => (
                  <li key={s.id}>
                    <Link to={`/receipts/${s.reference}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted">
                      <span>
                        <span className="block font-mono text-base">{s.reference}</span>
                        <span className="text-sm text-fg-3">{formatDateTime(s.created_at)} · {s.items_count} items</span>
                      </span>
                      <span className="text-right">
                        <span className="tabular block font-semibold">{formatNaira(s.total)}</span>
                        {s.status === "voided" && <SaleStatusBadge status="voided" />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditCustomer({ customer, onDone, onCancel }: { customer: Customer; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: customer.name, phone: customer.phone ?? "", email: customer.email ?? "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/customers/${customer.id}`, { method: "PATCH", body: { name: f.name, phone: f.phone || null, email: f.email || null } });
      toast.success("Customer updated");
      onDone();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" error={error?.field("name")}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <Field label="Phone" error={error?.field("phone")}>{(id) => <Input id={id} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
      <Field label="Email" error={error?.field("email")}>{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={busy}>Save</Button>
      </div>
    </form>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <p className="text-xs text-fg-3">{label}</p>
      <div className="tabular mt-1 text-md font-semibold">{value}</div>
      {sub && <p className="text-xs text-fg-3">{sub}</p>}
    </div>
  );
}
