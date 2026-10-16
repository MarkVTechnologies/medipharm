import { useState } from "react";
import { Title } from "react-head";
import { Download } from "lucide-react";
import { Card, PageHeader } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input, Select } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Spinner";
import { Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Tabs } from "../../components/ui/Tabs";
import { useReport } from "../../hooks/useData";
import { apiUrl, qs } from "../../lib/api";
import { formatDate, formatDateTime, lagosToday } from "../../lib/dates";
import { formatNaira, formatNumber } from "../../lib/money";
import { cn } from "../../lib/cn";

type Kind = "sales" | "inventory" | "financial" | "customers";

const GROUPS: Record<Kind, { param?: string; options?: [string, string][] }> = {
  sales: { param: "group", options: [["day", "By day"], ["drug", "By drug"], ["category", "By category"], ["staff", "By staff"], ["payment_method", "By payment method"]] },
  inventory: { param: "view", options: [["valuation", "Valuation"], ["movement", "Stock movement"], ["dead_stock", "Dead stock"], ["expiry", "Expiry exposure"]] },
  financial: {},
  customers: {},
};

const MONEY_KEYS = /revenue|cogs|margin|value|spend|vat|discount|sales|collected|subtotal|basket/;

const SUMMARY_LABELS: Record<string, string> = {
  transactions: "Transactions", items_sold: "Items sold", subtotal: "Gross sales", discount: "Discounts", vat: "VAT collected",
  revenue: "Revenue", average_basket: "Average basket", value_at_cost: "Stock at cost", value_at_retail: "Stock at retail",
  potential_margin: "Potential margin", units_on_hand: "Units on hand", sku_count: "Active SKUs", gross_sales: "Gross sales",
  discounts: "Discounts", net_sales: "Net sales", vat_collected: "VAT collected", total_collected: "Total collected", cogs: "COGS",
  gross_margin: "Gross margin", gross_margin_percent: "Gross margin %", total_customers: "Customers", new_customers: "New in period",
  active_customers: "Active in period", returning_customers: "Returning", retention_rate: "Retention",
};

const PRESETS: [string, number][] = [["Today", 0], ["7 days", 6], ["30 days", 29], ["90 days", 89]];

export default function Reports() {
  const [kind, setKind] = useState<Kind>("sales");
  const [group, setGroup] = useState<Record<Kind, string>>({ sales: "day", inventory: "valuation", financial: "", customers: "" });
  const [from, setFrom] = useState(lagosToday(-29));
  const [to, setTo] = useState(lagosToday());

  const cfg = GROUPS[kind];
  const params = { from, to, ...(cfg.param ? { [cfg.param]: group[kind] } : {}) };
  const { data, error, mutate, isLoading } = useReport(kind, params);
  const report = data?.data;

  const summary = report
    ? Object.entries(report.summary).filter(([, v]) => typeof v === "number") as [string, number][]
    : [];
  const tiers = report?.summary.tier_distribution as Record<string, number> | undefined;

  const fmt = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") {
      if (key.endsWith("percent") || key === "retention_rate") return `${value}%`;
      return MONEY_KEYS.test(key) && !/count|transactions|items|units|customers/.test(key) ? formatNaira(value) : formatNumber(value);
    }
    if (key === "date" && typeof value === "string") return value.length > 10 ? formatDateTime(value) : formatDate(value);
    if (key === "last_sold" || key === "expiry_date") return formatDate(String(value));
    return String(value);
  };

  return (
    <>
      <Title>Reports · MediPharm</Title>
      <PageHeader
        title="Reports"
        actions={
          <a
            href={apiUrl(`/api/reports/${kind}${qs({ ...params, format: "csv" })}`)}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-canvas px-4 text-base font-medium text-fg-2 shadow-xs hover:bg-subtle"
          >
            <Download className="size-4" /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs<Kind>
          value={kind}
          onChange={setKind}
          items={[
            { value: "sales", label: "Sales" },
            { value: "inventory", label: "Inventory" },
            { value: "financial", label: "Financial" },
            { value: "customers", label: "Customers" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(([label, days]) => (
            <button
              key={label}
              type="button"
              onClick={() => { setFrom(lagosToday(-days)); setTo(lagosToday()); }}
              className={cn(
                "h-8 rounded-md px-2.5 text-sm font-medium",
                from === lagosToday(-days) && to === lagosToday() ? "bg-brand-50 text-brand-700" : "text-fg-3 hover:bg-subtle",
              )}
            >
              {label}
            </button>
          ))}
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" aria-label="From date" />
          <span className="text-fg-4">–</span>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" aria-label="To date" />
          {cfg.options && (
            <Select value={group[kind]} onChange={(e) => setGroup({ ...group, [kind]: e.target.value })} className="h-9 w-48" aria-label="Breakdown">
              {cfg.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          )}
        </div>
      </div>

      {error && !data ? (
        <Card><ErrorState error={error} onRetry={() => void mutate()} /></Card>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
            {isLoading && !report
              ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
              : summary.map(([k, v]) => (
                  <Card key={k} className="p-4">
                    <p className="text-sm text-fg-3">{SUMMARY_LABELS[k] ?? k}</p>
                    <p className="tabular mt-1 text-xl font-semibold">{fmt(k, v)}</p>
                  </Card>
                ))}
            {tiers && (
              <Card className="col-span-2 p-4">
                <p className="text-sm text-fg-3">Tier distribution</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {Object.entries(tiers).map(([t, n]) => (
                    <span key={t} className="text-base capitalize">
                      {t} <span className="tabular font-semibold">{n}</span>
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <Card className={cn(isLoading && "opacity-60 transition-opacity")}>
            {!report ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : report.rows.length === 0 ? (
              <p className="py-12 text-center text-base text-fg-3">No data in this range.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    {report.columns.map((c) => (
                      <Th key={c.key} align={typeof report.rows[0][c.key] === "number" ? "right" : undefined}>{c.label}</Th>
                    ))}
                  </tr>
                </THead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <Tr key={i}>
                      {report.columns.map((c) => (
                        <Td key={c.key} align={typeof row[c.key] === "number" ? "right" : undefined} className={cn(c.key === report.columns[0].key && "font-medium text-fg", c.key === "type" && "capitalize")}>
                          {fmt(c.key, row[c.key])}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {data?.meta.truncated && (
              <p className="border-t border-border-subtle px-4 py-3 text-sm text-fg-3">Showing the first 500 rows. Export CSV for the full report.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
