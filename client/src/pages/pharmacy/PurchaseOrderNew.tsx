import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { ArrowLeft, Trash2 } from "lucide-react";
import { DrugSearchSelect } from "../../components/DrugSearchSelect";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/Input";
import { Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useInvalidate, useSuppliers } from "../../hooks/useData";
import { api, ApiError } from "../../lib/api";
import { lagosToday } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { Drug, PurchaseOrder } from "../../lib/types";

interface Line {
  drug_id: number;
  name: string;
  strength: string | null;
  pack_size: string | null;
  on_hand: number;
  quantity: string;
  unit_cost: string;
}

export default function PurchaseOrderNew() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: suppliers } = useSuppliers();
  const [supplierId, setSupplierId] = useState(params.get("supplier") ?? "");
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<"draft" | "sent" | null>(null);

  const addDrug = (d: Drug) =>
    setLines((ls) =>
      ls.some((l) => l.drug_id === d.id)
        ? ls
        : [...ls, {
            drug_id: d.id, name: d.name, strength: d.strength, pack_size: d.pack_size, on_hand: d.stock_on_hand ?? 0,
            quantity: String(Math.max(1, d.reorder_level * 2 - (d.stock_on_hand ?? 0))), unit_cost: String(d.cost_price),
          }],
    );

  // Prefill from the dashboard's "add to PO".
  const prefill = params.get("drug");
  useEffect(() => {
    if (!prefill) return;
    void api<{ data: Drug }>(`/api/drugs/${prefill}`).then((r) => addDrug(r.data)).catch(() => undefined);
  }, [prefill]);

  const total = lines.reduce((s, l) => s + (Number(l.unit_cost) || 0) * (Number(l.quantity) || 0), 0);

  const save = async (status: "draft" | "sent") => {
    setBusy(status);
    setError(null);
    try {
      const res = await api<{ data: PurchaseOrder }>("/api/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: Number(supplierId),
          status,
          expected_date: expected || null,
          notes: notes || null,
          items: lines.map((l) => ({ drug_id: l.drug_id, quantity_ordered: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
        },
      });
      toast.success(`${res.data.reference} ${status === "sent" ? "saved as sent" : "saved as draft"}`);
      void invalidate("/api/purchase-orders");
      navigate(`/purchase-orders/${res.data.id}`);
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e);
        toast.error(e.message);
      }
    } finally {
      setBusy(null);
    }
  };

  const update = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.drug_id === id ? { ...l, ...patch } : l)));

  return (
    <>
      <Title>New purchase order · MediPharm</Title>
      <PageHeader
        back={
          <Link to="/purchase-orders" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-fg-3 hover:text-fg">
            <ArrowLeft className="size-4" /> Purchase orders
          </Link>
        }
        title="New purchase order"
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Items" />
          <CardBody className="border-b border-border-subtle">
            <DrugSearchSelect onPick={addDrug} exclude={lines.map((l) => l.drug_id)} />
            {error?.field("items") && <p className="mt-2 text-sm text-danger-600">{error.field("items")}</p>}
          </CardBody>
          {lines.length === 0 ? (
            <EmptyState title="No items yet" description="Search above to add drugs to this order." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Drug</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Unit cost (₦)</Th>
                  <Th align="right">Line total</Th>
                  <Th />
                </tr>
              </THead>
              <tbody>
                {lines.map((l) => (
                  <Tr key={l.drug_id}>
                    <Td>
                      <span className="block font-medium text-fg">{l.name} <span className="font-normal text-fg-3">{l.strength}</span></span>
                      <span className="text-sm text-fg-3">{l.pack_size}</span>
                    </Td>
                    <Td align="right">{l.on_hand}</Td>
                    <Td align="right">
                      <Input type="number" min={1} value={l.quantity} onChange={(e) => update(l.drug_id, { quantity: e.target.value })} className="ml-auto h-9 w-20 text-right" aria-label={`Quantity of ${l.name}`} />
                    </Td>
                    <Td align="right">
                      <Input type="number" min={0} step="0.01" value={l.unit_cost} onChange={(e) => update(l.drug_id, { unit_cost: e.target.value })} className="ml-auto h-9 w-28 text-right" aria-label={`Unit cost of ${l.name}`} />
                    </Td>
                    <Td align="right" className="font-medium text-fg">{formatNaira((Number(l.unit_cost) || 0) * (Number(l.quantity) || 0))}</Td>
                    <Td align="right">
                      <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.drug_id !== l.drug_id))} className="inline-flex size-9 items-center justify-center rounded-md text-fg-4 hover:bg-danger-50 hover:text-danger-600" aria-label={`Remove ${l.name}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <Field label="Supplier" required error={error?.field("supplier_id")}>
                {(id) => (
                  <Select id={id} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">Choose supplier…</option>
                    {suppliers?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Expected delivery">
                {(id) => <Input id={id} type="date" min={lagosToday()} value={expected} onChange={(e) => setExpected(e.target.value)} />}
              </Field>
              <Field label="Notes">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />}</Field>
              <div className="flex items-baseline justify-between border-t border-border-subtle pt-4">
                <span className="text-fg-3">Order total</span>
                <span className="tabular text-xl font-semibold">{formatNaira(total)}</span>
              </div>
              <div className="grid gap-2">
                <Button size="lg" loading={busy === "sent"} disabled={!supplierId || !lines.length || !!busy} onClick={() => save("sent")}>
                  Save & mark as sent
                </Button>
                <Button variant="secondary" loading={busy === "draft"} disabled={!supplierId || !lines.length || !!busy} onClick={() => save("draft")}>
                  Save as draft
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
