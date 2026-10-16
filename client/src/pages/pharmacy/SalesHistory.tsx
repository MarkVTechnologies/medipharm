import { useState } from "react";
import { Title } from "react-head";
import { Receipt, Search } from "lucide-react";
import { PaymentBadge, SaleStatusBadge } from "../../components/ui/Badge";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input, Select } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Spinner";
import { LoadMore, Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useDebounce } from "../../hooks/useDebounce";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import { cn } from "../../lib/cn";
import { formatDateTime, lagosToday } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { Sale } from "../../lib/types";
import { SaleDrawer } from "./SaleDrawer";

export default function SalesHistory() {
  const [from, setFrom] = useState(lagosToday(-6));
  const [to, setTo] = useState(lagosToday());
  const [status, setStatus] = useState("");
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const [open, setOpen] = useState<number | null>(null);

  const list = useInfiniteList<Sale>("/api/sales", { from, to, status, payment_method: method, search: debounced });
  const pageTotal = list.items.filter((s) => s.status === "completed").reduce((sum, s) => sum + s.total, 0);

  return (
    <>
      <Title>Sales history · MediPharm</Title>
      <PageHeader title="Sales history" description={list.meta ? `${list.total} sale${list.total === 1 ? "" : "s"} in range` : undefined} />

      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-border-subtle p-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 lg:col-span-1">
          <Input leading={<Search />} placeholder="Reference e.g. SAL-00123" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by reference" />
          </div>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          <Select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method">
            <option value="">All payments</option>
            <option value="cash">Cash</option>
            <option value="card">Card / POS</option>
            <option value="transfer">Transfer</option>
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="voided">Voided</option>
          </Select>
        </div>

        {list.error && !list.items.length ? (
          <ErrorState error={list.error} onRetry={() => void list.mutate()} />
        ) : list.isLoadingFirst ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : list.items.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No sales in this range" description="Widen the dates or clear a filter." />
        ) : (
          <>
            <Table className="hidden md:block">
              <THead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Served by</Th>
                  <Th align="right">Items</Th>
                  <Th>Payment</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                </tr>
              </THead>
              <tbody>
                {list.items.map((s) => (
                  <Tr key={s.id} onClick={() => setOpen(s.id)}>
                    <Td className="font-mono font-medium text-fg">{s.reference}</Td>
                    <Td className="whitespace-nowrap text-fg-3">{formatDateTime(s.created_at)}</Td>
                    <Td>{s.customer?.name ?? <span className="text-fg-4">Walk-in</span>}</Td>
                    <Td className="text-fg-3">{s.served_by?.name}</Td>
                    <Td align="right">{s.items_count}</Td>
                    <Td><PaymentBadge method={s.payment_method} /></Td>
                    <Td><SaleStatusBadge status={s.status} /></Td>
                    <Td align="right" className={cn("font-semibold text-fg", s.status === "voided" && "text-fg-4 line-through")}>
                      {formatNaira(s.total)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <ul className="divide-y divide-border-subtle md:hidden">
              {list.items.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setOpen(s.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-base font-medium">{s.reference}</p>
                      <p className="text-sm text-fg-3">
                        {formatDateTime(s.created_at)} · {s.customer?.name ?? "Walk-in"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("tabular font-semibold", s.status === "voided" && "text-fg-4 line-through")}>{formatNaira(s.total)}</p>
                      {s.status === "voided" ? <SaleStatusBadge status="voided" /> : <PaymentBadge method={s.payment_method} />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3 text-sm text-fg-3">
              <span>
                Showing {list.items.length} of {list.total}
              </span>
              <span>
                Completed total shown: <span className="tabular font-semibold text-fg-2">{formatNaira(pageTotal)}</span>
              </span>
            </div>
            <LoadMore hasMore={list.hasMore} loading={list.isLoadingMore} onVisible={() => void list.loadMore()} />
          </>
        )}
      </Card>

      <SaleDrawer saleId={open} onClose={() => setOpen(null)} />
    </>
  );
}
