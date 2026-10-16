import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Title } from "react-head";
import { Boxes, Download, Plus, Search, Upload } from "lucide-react";
import { StockBadge } from "../../components/ui/Badge";
import { ButtonLink } from "../../components/ui/Button";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input, Select } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Spinner";
import { LoadMore, Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Tabs } from "../../components/ui/Tabs";
import { useSession } from "../../context/auth";
import { useDebounce } from "../../hooks/useDebounce";
import { useInfiniteList } from "../../hooks/useInfiniteList";
import { apiUrl } from "../../lib/api";
import { formatNaira } from "../../lib/money";
import { can } from "../../lib/permissions";
import type { Drug } from "../../lib/types";

type Status = "" | "low" | "out" | "expiring" | "inactive";

export default function Inventory() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const debounced = useDebounce(search, 250);
  const status = (params.get("status") ?? "") as Status;
  const category = params.get("category") ?? "";
  const navigate = useNavigate();
  const canEdit = can(user.role, "manageInventory");

  const list = useInfiniteList<Drug>("/api/drugs", { search: debounced, status, category });
  const categories = (list.meta?.categories as string[] | undefined) ?? [];

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <Title>Inventory · MediPharm</Title>
      <PageHeader
        title="Inventory"
        description={list.meta ? `${list.total} item${list.total === 1 ? "" : "s"}` : "Every SKU, stock on hand and status"}
        actions={
          canEdit && (
            <>
              <ButtonLink to="/inventory/import" variant="secondary" icon={<Upload />}>
                Import CSV
              </ButtonLink>
              <ButtonLink to="/inventory/new" icon={<Plus />}>
                Add drug
              </ButtonLink>
            </>
          )
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border-subtle p-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <Input leading={<Search />} placeholder="Search name, generic, brand or barcode" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search inventory" />
          </div>
          <Select value={category} onChange={(e) => setParam("category", e.target.value)} className="lg:w-56" aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <a href={apiUrl("/api/drugs/import/template")} className="hidden items-center gap-1.5 text-sm font-medium text-fg-3 hover:text-brand-600 xl:inline-flex">
            <Download className="size-4" /> CSV template
          </a>
        </div>
        <div className="border-b border-border-subtle bg-muted px-3 py-2">
          <Tabs<Status>
            size="sm"
            value={status}
            onChange={(v) => setParam("status", v)}
            items={[
              { value: "", label: "All" },
              { value: "low", label: "Low stock" },
              { value: "out", label: "Out of stock" },
              { value: "expiring", label: "Expiring ≤60d" },
              { value: "inactive", label: "Archived" },
            ]}
          />
        </div>

        {list.error && !list.items.length ? (
          <ErrorState error={list.error} onRetry={() => void list.mutate()} />
        ) : list.isLoadingFirst ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={<Boxes />}
            title={debounced || status || category ? "No items match these filters" : "Your catalogue is empty"}
            description={debounced || status || category ? "Clear a filter or try another search." : "Import your catalogue from a CSV — it's the fastest way to get started."}
            action={canEdit && !debounced && !status && <ButtonLink to="/inventory/import" icon={<Upload />}>Import CSV</ButtonLink>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <Table className="hidden md:block">
              <THead>
                <tr>
                  <Th>Drug</Th>
                  <Th>Category</Th>
                  <Th>NAFDAC</Th>
                  <Th align="right">On hand</Th>
                  <Th>Status</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">Price</Th>
                </tr>
              </THead>
              <tbody>
                {list.items.map((d) => (
                  <Tr key={d.id} onClick={() => navigate(`/inventory/${d.id}`)}>
                    <Td className="max-w-[320px]">
                      <Link to={`/inventory/${d.id}`} className="block truncate font-medium text-fg hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
                        {d.name} {d.strength && <span className="font-normal text-fg-3">{d.strength}</span>}
                      </Link>
                      <span className="block truncate text-sm text-fg-3">{[d.generic_name, d.brand, d.pack_size].filter(Boolean).join(" · ")}</span>
                    </Td>
                    <Td className="text-fg-3">{d.category ?? "—"}</Td>
                    <Td className="font-mono text-sm text-fg-3">{d.nafdac_number ?? "—"}</Td>
                    <Td align="right" className="font-semibold text-fg">
                      {d.stock_on_hand}
                    </Td>
                    <Td>
                      <StockBadge status={d.stock_status} />
                    </Td>
                    <Td align="right">{formatNaira(d.cost_price)}</Td>
                    <Td align="right" className="font-medium text-fg">
                      {formatNaira(d.selling_price)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {/* Mobile cards */}
            <ul className="divide-y divide-border-subtle md:hidden">
              {list.items.map((d) => (
                <li key={d.id}>
                  <Link to={`/inventory/${d.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-md font-medium">
                        {d.name} <span className="font-normal text-fg-3">{d.strength}</span>
                      </p>
                      <p className="text-sm text-fg-3">
                        {formatNaira(d.selling_price)} · {d.stock_on_hand} on hand
                      </p>
                    </div>
                    <StockBadge status={d.stock_status} />
                  </Link>
                </li>
              ))}
            </ul>
            <LoadMore hasMore={list.hasMore} loading={list.isLoadingMore} onVisible={() => void list.loadMore()} />
          </>
        )}
      </Card>
    </>
  );
}
