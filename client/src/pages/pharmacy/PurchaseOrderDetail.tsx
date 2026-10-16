import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { ArrowLeft, PackageCheck, Send, XCircle } from "lucide-react";
import { PoStatusBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { PageLoader } from "../../components/ui/Spinner";
import { Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useInvalidate, usePurchaseOrder } from "../../hooks/useData";
import { api, ApiError } from "../../lib/api";
import { formatDate, lagosToday } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { PurchaseOrder } from "../../lib/types";

interface ReceiveLine {
  item_id: number;
  include: boolean;
  batch_number: string;
  expiry_date: string;
  quantity: string;
  unit_cost: string;
}

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const { data, error, mutate } = usePurchaseOrder(id);
  const invalidate = useInvalidate();
  const [receiving, setReceiving] = useState(false);
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [recvError, setRecvError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const po = data?.data;

  useEffect(() => {
    if (po?.items) {
      setLines(
        po.items
          .filter((i) => i.quantity_outstanding > 0)
          .map((i) => ({ item_id: i.id, include: true, batch_number: "", expiry_date: "", quantity: String(i.quantity_outstanding), unit_cost: String(i.unit_cost) })),
      );
    }
  }, [po]);

  if (error && !data) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!po) return <PageLoader />;

  const receivable = ["draft", "sent", "partial"].includes(po.status);

  const setStatus = async (status: "sent" | "cancelled") => {
    try {
      await api<{ data: PurchaseOrder }>(`/api/purchase-orders/${po.id}`, { method: "PATCH", body: { status } });
      toast.success(status === "sent" ? "Marked as sent" : "Purchase order cancelled");
      void mutate();
      void invalidate("/api/purchase-orders");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const receive = async () => {
    setBusy(true);
    setRecvError(null);
    try {
      const payload = lines
        .filter((l) => l.include && Number(l.quantity) > 0)
        .map((l) => ({ item_id: l.item_id, batch_number: l.batch_number, expiry_date: l.expiry_date, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) }));
      await api(`/api/purchase-orders/${po.id}/receive`, { method: "POST", body: { lines: payload } });
      toast.success("Stock received — batches created");
      setReceiving(false);
      void mutate();
      void invalidate("/api/purchase-orders", "/api/drugs", "/api/dashboard", "/api/pos/search");
    } catch (e) {
      if (e instanceof ApiError) {
        setRecvError(e);
        toast.error(Object.keys(e.errors).length ? "Check the highlighted lines" : e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // Map validation errors (lines.N.field) back to rows, accounting for excluded rows.
  const included = lines.map((l, i) => ({ l, i })).filter(({ l }) => l.include && Number(l.quantity) > 0);
  const rowError = (rowIndex: number, field: string) => {
    const pos = included.findIndex(({ i }) => i === rowIndex);
    return pos >= 0 ? recvError?.field(`lines.${pos}.${field}`) : undefined;
  };

  const itemById = new Map(po.items?.map((i) => [i.id, i]));
  const update = (idx: number, patch: Partial<ReceiveLine>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const canReceive = included.length > 0 && included.every(({ l }) => l.batch_number && l.expiry_date);

  return (
    <>
      <Title>{po.reference} · MediPharm</Title>
      <PageHeader
        back={
          <Link to="/purchase-orders" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-fg-3 hover:text-fg">
            <ArrowLeft className="size-4" /> Purchase orders
          </Link>
        }
        title={<span className="flex items-center gap-3"><span className="font-mono">{po.reference}</span><PoStatusBadge status={po.status} /></span>}
        description={`${po.supplier?.name} · created ${formatDate(po.created_at)} by ${po.created_by?.name}${po.expected_date ? ` · expected ${formatDate(po.expected_date)}` : ""}`}
        actions={
          receivable &&
          !receiving && (
            <>
              {po.status === "draft" && (
                <Button variant="secondary" icon={<Send />} onClick={() => setStatus("sent")}>
                  Mark as sent
                </Button>
              )}
              {po.status !== "partial" && (
                <Button variant="ghost" icon={<XCircle />} onClick={() => setStatus("cancelled")}>
                  Cancel PO
                </Button>
              )}
              <Button icon={<PackageCheck />} onClick={() => setReceiving(true)}>
                Receive delivery
              </Button>
            </>
          )
        }
      />

      {receiving ? (
        <Card>
          <CardHeader
            title="Receive delivery"
            description="Enter the batch number and expiry printed on each carton. Untick anything that didn't arrive — the PO stays open as partial."
          />
          <Table>
            <THead>
              <tr>
                <Th className="w-10" />
                <Th>Drug</Th>
                <Th>Batch number</Th>
                <Th>Expiry</Th>
                <Th align="right">Qty received</Th>
                <Th align="right">Unit cost (₦)</Th>
              </tr>
            </THead>
            <tbody>
              {lines.map((l, idx) => {
                const item = itemById.get(l.item_id)!;
                return (
                  <Tr key={l.item_id} className={l.include ? "" : "opacity-50"}>
                    <Td>
                      <input type="checkbox" checked={l.include} onChange={(e) => update(idx, { include: e.target.checked })} className="size-4 accent-brand-500" aria-label={`Receive ${item.drug_name}`} />
                    </Td>
                    <Td>
                      <span className="block font-medium text-fg">{item.drug_name} <span className="font-normal text-fg-3">{item.strength}</span></span>
                      <span className="text-sm text-fg-3">{item.quantity_outstanding} outstanding of {item.quantity_ordered}</span>
                    </Td>
                    <Td>
                      <Input value={l.batch_number} onChange={(e) => update(idx, { batch_number: e.target.value })} disabled={!l.include} className="h-9 w-36 font-mono" invalid={!!rowError(idx, "batch_number")} aria-label="Batch number" />
                    </Td>
                    <Td>
                      <Input type="date" min={lagosToday(1)} value={l.expiry_date} onChange={(e) => update(idx, { expiry_date: e.target.value })} disabled={!l.include} className="h-9 w-40" invalid={!!rowError(idx, "expiry_date")} aria-label="Expiry date" title={rowError(idx, "expiry_date")} />
                    </Td>
                    <Td align="right">
                      <Input type="number" min={1} value={l.quantity} onChange={(e) => update(idx, { quantity: e.target.value })} disabled={!l.include} className="ml-auto h-9 w-20 text-right" aria-label="Quantity received" />
                    </Td>
                    <Td align="right">
                      <Input type="number" min={0} step="0.01" value={l.unit_cost} onChange={(e) => update(idx, { unit_cost: e.target.value })} disabled={!l.include} className="ml-auto h-9 w-28 text-right" aria-label="Unit cost" />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          {recvError && !Object.keys(recvError.errors).length && <p className="px-5 pt-3 text-base text-danger-600">{recvError.message}</p>}
          <div className="flex justify-end gap-2 border-t border-border-subtle px-5 py-4">
            <Button variant="secondary" onClick={() => setReceiving(false)}>Cancel</Button>
            <Button icon={<PackageCheck />} loading={busy} disabled={!canReceive} onClick={receive}>
              Receive {included.length} line{included.length === 1 ? "" : "s"} into stock
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <THead>
              <tr>
                <Th>Drug</Th>
                <Th align="right">Ordered</Th>
                <Th align="right">Received</Th>
                <Th align="right">Unit cost</Th>
                <Th align="right">Line total</Th>
              </tr>
            </THead>
            <tbody>
              {po.items?.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <span className="block font-medium text-fg">{i.drug_name} <span className="font-normal text-fg-3">{i.strength}</span></span>
                    <span className="text-sm text-fg-3">{i.pack_size}</span>
                  </Td>
                  <Td align="right">{i.quantity_ordered}</Td>
                  <Td align="right" className={i.quantity_received >= i.quantity_ordered ? "text-success-600" : ""}>{i.quantity_received}</Td>
                  <Td align="right">{formatNaira(i.unit_cost)}</Td>
                  <Td align="right" className="font-medium text-fg">{formatNaira(i.line_total)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="flex justify-between border-t border-border-subtle px-5 py-4">
            <span className="text-fg-3">{po.notes}</span>
            <span className="tabular text-lg font-semibold">Total {formatNaira(po.total)}</span>
          </div>
        </Card>
      )}
    </>
  );
}
