import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { Archive, ArrowLeft, PackagePlus, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import { Badge, StockBadge } from "../../components/ui/Badge";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, StatCard } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Field, Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageLoader } from "../../components/ui/Spinner";
import { Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useSession } from "../../context/auth";
import { useDrug, useInvalidate, useSuppliers } from "../../hooks/useData";
import { api, ApiError } from "../../lib/api";
import { formatDate, lagosToday, relativeDays } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import { can } from "../../lib/permissions";
import type { Batch } from "../../lib/types";

export default function DrugDetail() {
  const { id } = useParams();
  const { user, tenant } = useSession();
  const { data, error, mutate } = useDrug(id);
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const canEdit = can(user.role, "manageInventory");
  const [adding, setAdding] = useState(false);
  const [adjusting, setAdjusting] = useState<Batch | null>(null);
  const [writingOff, setWritingOff] = useState<Batch | null>(null);

  if (error && !data) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!data) return <PageLoader />;
  const d = data.data;
  const batches = (d.batches ?? []).filter((b) => !b.written_off_at && b.quantity_remaining > 0);
  const valueAtCost = batches.filter((b) => !b.is_expired).reduce((s, b) => s + b.value_at_cost, 0);

  const refresh = () => {
    void mutate();
    void invalidate("/api/drugs", "/api/dashboard", "/api/pos/search");
  };

  const archive = async () => {
    try {
      await api(`/api/drugs/${d.id}`, { method: "DELETE" });
      toast.success(`${d.name} archived`);
      void invalidate("/api/drugs", "/api/dashboard");
      navigate("/inventory");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not archive");
    }
  };

  const restore = async () => {
    await api(`/api/drugs/${d.id}`, { method: "PATCH", body: { is_active: true } });
    toast.success("Restored");
    refresh();
  };

  return (
    <>
      <Title>{d.name} · MediPharm</Title>
      <PageHeader
        back={
          <Link to="/inventory" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-fg-3 hover:text-fg">
            <ArrowLeft className="size-4" /> Inventory
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {d.name} {d.strength && <span className="font-normal text-fg-3">{d.strength}</span>}
            {d.is_active ? <StockBadge status={d.stock_status} /> : <Badge>Archived</Badge>}
          </span>
        }
        description={[d.generic_name, d.brand, d.form, d.pack_size].filter(Boolean).join(" · ")}
        actions={
          canEdit && (
            <>
              {d.is_active ? (
                <Button variant="ghost" icon={<Archive />} onClick={archive}>
                  Archive
                </Button>
              ) : (
                <Button variant="secondary" onClick={restore}>
                  Restore
                </Button>
              )}
              <ButtonLink to={`/inventory/${d.id}/edit`} variant="secondary" icon={<Pencil />}>
                Edit
              </ButtonLink>
              <Button icon={<PackagePlus />} onClick={() => setAdding(true)}>
                Add batch
              </Button>
            </>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Sellable on hand" value={d.stock_on_hand ?? 0} sub={`Reorder at ${d.reorder_level}`} />
        <StatCard label="Selling price" value={formatNaira(d.selling_price)} sub={`Cost ${formatNaira(d.cost_price)}`} />
        <StatCard label="Stock value at cost" value={formatNaira(valueAtCost)} />
        <StatCard
          label="VAT"
          value={d.tax_rate === null ? `${tenant.vat_rate}%` : d.tax_rate === 0 ? "Exempt" : `${d.tax_rate}%`}
          sub={d.tax_rate === null ? "Tenant default" : "Item override"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Batches" description="Drawn first-expiry-first-out at the counter" />
          {batches.length === 0 ? (
            <EmptyState
              icon={<PackagePlus />}
              title="No stock on hand"
              description="Add a batch, or receive a purchase order."
              action={canEdit && <Button onClick={() => setAdding(true)}>Add batch</Button>}
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Batch</Th>
                  <Th>Expiry</Th>
                  <Th align="right">Remaining</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">Value</Th>
                  {canEdit && <Th />}
                </tr>
              </THead>
              <tbody>
                {batches.map((b, i) => (
                  <Tr key={b.id}>
                    <Td>
                      <span className="font-mono font-medium text-fg">{b.batch_number}</span>
                      {i === 0 && !b.is_expired && <Badge tone="brand" className="ml-2">Next out</Badge>}
                      <span className="block text-sm text-fg-3">{b.supplier?.name ?? "—"}</span>
                    </Td>
                    <Td>
                      {formatDate(b.expiry_date)}
                      <span className="block">
                        <Badge tone={b.is_expired ? "danger" : b.days_to_expiry <= 60 ? "warning" : "neutral"}>{relativeDays(b.days_to_expiry)}</Badge>
                      </span>
                    </Td>
                    <Td align="right" className="font-semibold text-fg">
                      {b.quantity_remaining}
                      <span className="block text-xs font-normal text-fg-4">of {b.quantity_received}</span>
                    </Td>
                    <Td align="right">{formatNaira(b.cost_price)}</Td>
                    <Td align="right">{formatNaira(b.value_at_cost)}</Td>
                    {canEdit && (
                      <Td align="right" className="whitespace-nowrap">
                        <button type="button" onClick={() => setAdjusting(b)} className="inline-flex size-9 items-center justify-center rounded-md text-fg-3 hover:bg-subtle hover:text-fg" aria-label="Adjust quantity" title="Adjust quantity">
                          <SlidersHorizontal className="size-4" />
                        </button>
                        <button type="button" onClick={() => setWritingOff(b)} className="inline-flex size-9 items-center justify-center rounded-md text-fg-3 hover:bg-danger-50 hover:text-danger-600" aria-label="Write off" title="Write off">
                          <Trash2 className="size-4" />
                        </button>
                      </Td>
                    )}
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Details" />
          <dl className="divide-y divide-border-subtle text-base">
            {[
              ["NAFDAC number", d.nafdac_number],
              ["Barcode", d.barcode],
              ["Category", d.category],
              ["Preferred supplier", d.preferred_supplier?.name],
              ["Last updated", formatDate(d.updated_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-5 py-3">
                <dt className="text-fg-3">{k}</dt>
                <dd className="text-right font-medium text-fg-2">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <AddBatchModal open={adding} drugId={d.id} defaultCost={d.cost_price} onClose={() => setAdding(false)} onDone={refresh} />
      <AdjustModal batch={adjusting} onClose={() => setAdjusting(null)} onDone={refresh} />
      <WriteOffModal batch={writingOff} onClose={() => setWritingOff(null)} onDone={refresh} />
    </>
  );
}

function AddBatchModal({ open, drugId, defaultCost, onClose, onDone }: { open: boolean; drugId: number; defaultCost: number; onClose: () => void; onDone: () => void }) {
  const { data: suppliers } = useSuppliers();
  const [f, setF] = useState({ batch_number: "", expiry_date: "", quantity: "", cost_price: "", supplier_id: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/drugs/${drugId}/batches`, {
        method: "POST",
        body: {
          batch_number: f.batch_number,
          expiry_date: f.expiry_date,
          quantity: Number(f.quantity),
          cost_price: f.cost_price === "" ? defaultCost : Number(f.cost_price),
          supplier_id: f.supplier_id ? Number(f.supplier_id) : null,
        },
      });
      toast.success("Batch added");
      setF({ batch_number: "", expiry_date: "", quantity: "", cost_price: "", supplier_id: "" });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add batch" description="For stock that didn't come through a purchase order.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch number" required error={error?.field("batch_number")}>
          {(id) => <Input id={id} value={f.batch_number} onChange={(e) => setF({ ...f, batch_number: e.target.value })} className="font-mono" />}
        </Field>
        <Field label="Expiry date" required error={error?.field("expiry_date")}>
          {(id) => <Input id={id} type="date" min={lagosToday(1)} value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} />}
        </Field>
        <Field label="Quantity" required error={error?.field("quantity")}>
          {(id) => <Input id={id} type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}
        </Field>
        <Field label="Unit cost (₦)" error={error?.field("cost_price")} hint={`Defaults to ${formatNaira(defaultCost)}`}>
          {(id) => <Input id={id} type="number" min={0} step="0.01" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} />}
        </Field>
        <Field label="Supplier" className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}>
              <option value="">—</option>
              {suppliers?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Add batch</Button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustModal({ batch, onClose, onDone }: { batch: Batch | null; onClose: () => void; onDone: () => void }) {
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("Stock count correction");
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const change = batch && counted !== "" ? Number(counted) - batch.quantity_remaining : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!batch || change === 0) return;
    setBusy(true);
    try {
      await api(`/api/batches/${batch.id}/adjust`, { method: "POST", body: { quantity: change, reason } });
      toast.success("Quantity adjusted");
      setCounted("");
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!batch} onClose={onClose} title="Adjust quantity" description={batch ? `Batch ${batch.batch_number} · system shows ${batch.quantity_remaining}` : undefined} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Counted on shelf" required error={error?.field("quantity")}>
          {(id) => <Input id={id} type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} />}
        </Field>
        {counted !== "" && (
          <p className="text-base text-fg-3">
            Change: <span className={change < 0 ? "font-semibold text-danger-600" : "font-semibold text-success-600"}>{change > 0 ? `+${change}` : change}</span>
          </p>
        )}
        <Field label="Reason" required error={error?.field("reason")}>
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={change === 0 || !reason}>Save adjustment</Button>
        </div>
      </form>
    </Modal>
  );
}

function WriteOffModal({ batch, onClose, onDone }: { batch: Batch | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("Expired");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!batch) return;
    setBusy(true);
    try {
      await api(`/api/batches/${batch.id}/write-off`, { method: "POST", body: { reason } });
      toast.success("Batch written off");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not write off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!batch}
      onClose={onClose}
      title="Write off batch"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={busy}>Write off {batch?.quantity_remaining} units</Button>
        </>
      }
    >
      {batch && (
        <div className="space-y-4">
          <p className="text-md text-fg-2">
            Remove all <strong>{batch.quantity_remaining}</strong> units of batch <span className="font-mono">{batch.batch_number}</span> from stock. This is recorded in the audit trail and cannot be undone.
          </p>
          <p className="rounded-md bg-danger-50 px-3 py-2 text-base text-danger-600">Value lost at cost: {formatNaira(batch.value_at_cost)}</p>
          <Field label="Reason">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        </div>
      )}
    </Modal>
  );
}
