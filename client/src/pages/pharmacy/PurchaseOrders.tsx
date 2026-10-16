import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { ClipboardList, Lightbulb, Plus } from "lucide-react";
import { PoStatusBadge } from "../../components/ui/Badge";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Spinner";
import { Pagination, Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Tabs } from "../../components/ui/Tabs";
import { useInvalidate, usePurchaseOrders, useReorderSuggestions } from "../../hooks/useData";
import { api } from "../../lib/api";
import { formatDate } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { PurchaseOrder } from "../../lib/types";

export default function PurchaseOrders() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const { data, error, mutate, isLoading } = usePurchaseOrders({ status, page });
  const { data: suggestions } = useReorderSuggestions();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [creating, setCreating] = useState<number | null>(null);

  const groups = (suggestions?.data ?? []).filter((g) => g.supplier);
  const unassigned = (suggestions?.data ?? []).find((g) => !g.supplier);

  // One-click PO draft from a supplier's reorder group (FR-5.4).
  const draftFrom = async (index: number) => {
    const g = groups[index];
    if (!g.supplier) return;
    setCreating(index);
    try {
      const res = await api<{ data: PurchaseOrder }>("/api/purchase-orders", {
        method: "POST",
        body: {
          supplier_id: g.supplier.id,
          items: g.items.map((i) => ({ drug_id: i.drug_id, quantity_ordered: i.suggested_quantity, unit_cost: i.unit_cost })),
        },
      });
      toast.success(`Draft ${res.data.reference} created`);
      void invalidate("/api/purchase-orders");
      navigate(`/purchase-orders/${res.data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the draft");
    } finally {
      setCreating(null);
    }
  };

  return (
    <>
      <Title>Purchase orders · MediPharm</Title>
      <PageHeader
        title="Purchase orders"
        description="Receiving a PO is how stock enters the system — batch, expiry and cost captured at the door."
        actions={<ButtonLink to="/purchase-orders/new" icon={<Plus />}>New purchase order</ButtonLink>}
      />

      {groups.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title={<span className="flex items-center gap-2"><Lightbulb className="size-4 text-warning-500" /> Reorder suggestions</span>}
            description="Items at or below reorder level, grouped by preferred supplier."
          />
          <ul className="divide-y divide-border-subtle">
            {groups.map((g, i) => (
              <li key={g.supplier!.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-md font-medium">{g.supplier!.name}</p>
                  <p className="truncate text-sm text-fg-3">
                    {g.items.length} item{g.items.length === 1 ? "" : "s"}: {g.items.slice(0, 4).map((x) => x.name).join(", ")}
                    {g.items.length > 4 && "…"}
                  </p>
                </div>
                <span className="tabular text-base text-fg-2">
                  ≈ {formatNaira(g.items.reduce((s, x) => s + x.unit_cost * x.suggested_quantity, 0))}
                </span>
                <Button size="sm" variant="secondary" loading={creating === i} onClick={() => draftFrom(i)}>
                  Create draft PO
                </Button>
              </li>
            ))}
          </ul>
          {unassigned && (
            <p className="border-t border-border-subtle px-5 py-3 text-sm text-fg-3">
              {unassigned.items.length} low item{unassigned.items.length === 1 ? " has" : "s have"} no preferred supplier — set one on the drug to include it here.
            </p>
          )}
        </Card>
      )}

      <Card>
        <div className="border-b border-border-subtle bg-muted px-3 py-2">
          <Tabs
            size="sm"
            value={status}
            onChange={(s) => { setStatus(s); setPage(1); }}
            items={[
              { value: "open", label: "Open" },
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Sent" },
              { value: "partial", label: "Partial" },
              { value: "received", label: "Received" },
              { value: "cancelled", label: "Cancelled" },
              { value: "", label: "All" },
            ]}
          />
        </div>
        {error && !data ? (
          <ErrorState error={error} onRetry={() => void mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !data?.data.length ? (
          <EmptyState icon={<ClipboardList />} title="No purchase orders here" action={<ButtonLink to="/purchase-orders/new">New purchase order</ButtonLink>} />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Supplier</Th>
                  <Th>Status</Th>
                  <Th align="right" className="hidden sm:table-cell">Lines</Th>
                  <Th className="hidden md:table-cell">Expected</Th>
                  <Th className="hidden lg:table-cell">Created</Th>
                  <Th align="right">Total</Th>
                </tr>
              </THead>
              <tbody>
                {data.data.map((po) => (
                  <Tr key={po.id} onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                    <Td className="font-mono font-medium text-fg">{po.reference}</Td>
                    <Td>{po.supplier?.name}</Td>
                    <Td><PoStatusBadge status={po.status} /></Td>
                    <Td align="right" className="hidden sm:table-cell">{po.items_count}</Td>
                    <Td className="hidden text-fg-3 md:table-cell">{formatDate(po.expected_date)}</Td>
                    <Td className="hidden text-fg-3 lg:table-cell">{formatDate(po.created_at)} · {po.created_by?.name}</Td>
                    <Td align="right" className="font-semibold text-fg">{formatNaira(po.total)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.meta.page} lastPage={data.meta.last_page} total={data.meta.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
