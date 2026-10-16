import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Title } from "react-head";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Package, Plus, ShoppingCart, TrendingUp } from "lucide-react";
import { RevenueChart } from "../../components/charts/RevenueChart";
import { Badge, PaymentBadge, SaleStatusBadge, StockBadge } from "../../components/ui/Badge";
import { ButtonLink } from "../../components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, StatCard } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Spinner";
import { Tabs } from "../../components/ui/Tabs";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { useSession } from "../../context/auth";
import { useDashboard } from "../../hooks/useData";
import { formatDate, relativeDays, timeAgo } from "../../lib/dates";
import { formatNaira, formatNumber } from "../../lib/money";
import { can } from "../../lib/permissions";
import { cn } from "../../lib/cn";

type Range = "day" | "week" | "month";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-NG", { hour: "numeric", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { user } = useSession();
  const [range, setRange] = useState<Range>("week");
  const { data, error, mutate, isLoading } = useDashboard(range);
  const navigate = useNavigate();
  const d = data?.data;
  const canOrder = can(user.role, "receivePurchaseOrders");

  const change = d && d.today.yesterday_revenue > 0 ? ((d.today.revenue - d.today.yesterday_revenue) / d.today.yesterday_revenue) * 100 : null;

  return (
    <>
      <Title>Dashboard · MediPharm</Title>
      <PageHeader
        title={`${greeting()}, ${user.name.split(" ")[0]}`}
        description="Here's how the pharmacy is doing today."
        actions={
          <ButtonLink to="/pos" icon={<ShoppingCart />} size="lg">
            New sale
          </ButtonLink>
        }
      />

      {error && !d ? (
        <Card>
          <ErrorState error={error} onRetry={() => void mutate()} />
        </Card>
      ) : (
        <div className="space-y-6">
          {d?.onboarding && <OnboardingChecklist data={d.onboarding} onDismissed={() => void mutate()} />}

          {/* Above the fold, no interaction (FR-6.1). */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !d ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-lg" />)
            ) : (
              <>
                <StatCard
                  label="Today's revenue"
                  value={formatNaira(d.today.revenue)}
                  icon={<TrendingUp />}
                  sub={
                    change === null ? (
                      "No sales yesterday to compare"
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 font-medium", change >= 0 ? "text-success-600" : "text-danger-600")}>
                        {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                        {Math.abs(change).toFixed(0)}% <span className="font-normal text-fg-3">vs yesterday</span>
                      </span>
                    )
                  }
                />
                <StatCard
                  label="Transactions today"
                  value={formatNumber(d.today.transactions)}
                  icon={<ShoppingCart />}
                  tone="info"
                  sub={`Avg. basket ${formatNaira(d.today.average_basket)}`}
                />
                <StatCard
                  label="Low / out of stock"
                  value={formatNumber(d.stock.low_stock_count + d.stock.out_of_stock_count)}
                  icon={<Package />}
                  tone={d.stock.out_of_stock_count > 0 ? "danger" : "warning"}
                  sub={`${d.stock.out_of_stock_count} out · ${d.stock.low_stock_count} low of ${d.stock.sku_count} SKUs`}
                />
                <StatCard
                  label="Expiring in 60 days"
                  value={formatNumber(d.stock.expiring_count)}
                  icon={<CalendarClock />}
                  tone="warning"
                  sub={
                    <>
                      <span className="font-medium text-fg-2">{formatNaira(d.stock.expiring_value)}</span> at cost
                      {d.stock.expired_count > 0 && (
                        <span className="text-danger-600"> · {d.stock.expired_count} expired</span>
                      )}
                    </>
                  }
                />
              </>
            )}
          </div>

          <Card>
            <CardHeader
              title="Revenue"
              description={range === "day" ? "Today, by hour" : range === "week" ? "Last 7 days" : "Last 30 days"}
              actions={
                <Tabs
                  size="sm"
                  value={range}
                  onChange={setRange}
                  items={[
                    { value: "day", label: "Day" },
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]}
                />
              }
            />
            <div className="px-3 pt-4 pb-2 sm:px-5">
              {d && d.trend.every((p) => p.revenue === 0) ? (
                <EmptyState
                  icon={<TrendingUp />}
                  title={range === "day" ? "No sales yet today" : "No sales in this period yet"}
                  description="Revenue will chart here as soon as you make sales."
                  className="py-10"
                />
              ) : d ? (
                <RevenueChart
                  data={d.trend}
                  formatLabel={(l) =>
                    range === "day" ? l : new Date(`${l}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short", ...(range === "week" ? { weekday: "short" } : {}) })
                  }
                />
              ) : (
                <Skeleton className="h-[220px]" />
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Low stock"
                description="At or below reorder level"
                actions={
                  <Link to="/inventory?status=low" className="text-sm font-medium text-brand-600 hover:underline">
                    View all
                  </Link>
                }
              />
              {d && d.low_stock.length === 0 ? (
                <EmptyState icon={<Package />} title="Nothing running low" description="Every item is above its reorder level." />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {(d?.low_stock ?? []).map((item) => (
                    <li key={item.drug_id} className="flex min-h-14 items-center gap-3 px-5 py-2">
                      <div className="min-w-0 flex-1">
                        <Link to={`/inventory/${item.drug_id}`} className="block truncate text-md font-medium text-fg hover:text-brand-600">
                          {item.name}
                        </Link>
                        <p className="text-sm text-fg-3">
                          <span className="tabular font-medium text-fg-2">{item.stock_on_hand}</span> left · reorder at {item.reorder_level}
                        </p>
                      </div>
                      <StockBadge status={item.status} />
                      {canOrder && (
                        <button
                          type="button"
                          onClick={() => navigate(`/purchase-orders/new?drug=${item.drug_id}${item.preferred_supplier_id ? `&supplier=${item.preferred_supplier_id}` : ""}`)}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-sm font-medium text-fg-2 hover:bg-subtle"
                        >
                          <Plus className="size-3.5" /> PO
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Expiring batches"
                description="Within 60 days, with value at risk"
                actions={
                  <Link to="/inventory?status=expiring" className="text-sm font-medium text-brand-600 hover:underline">
                    View all
                  </Link>
                }
              />
              {d && d.expiring.length === 0 ? (
                <EmptyState icon={<CalendarClock />} title="No batches expiring soon" />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {(d?.expiring ?? []).map((b) => (
                    <li key={b.batch_id} className="flex min-h-14 items-center gap-3 px-5 py-2">
                      <div className="min-w-0 flex-1">
                        <Link to={`/inventory/${b.drug_id}`} className="block truncate text-md font-medium text-fg hover:text-brand-600">
                          {b.drug_name}
                        </Link>
                        <p className="text-sm text-fg-3">
                          Batch <span className="font-mono">{b.batch_number}</span> · {b.quantity_remaining} units · {formatDate(b.expiry_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tabular text-base font-semibold text-fg">{formatNaira(b.value_at_cost)}</p>
                        <Badge tone={b.is_expired ? "danger" : b.days_left <= 30 ? "warning" : "neutral"}>
                          {b.is_expired && <AlertTriangle className="size-3" />}
                          {relativeDays(b.days_left)}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Recent transactions"
              actions={
                <Link to="/sales" className="text-sm font-medium text-brand-600 hover:underline">
                  Sales history
                </Link>
              }
            />
            {d && d.recent_sales.length === 0 ? (
              <EmptyState icon={<ShoppingCart />} title="No sales yet" description="Your first sale will appear here." action={<ButtonLink to="/pos">Open the till</ButtonLink>} />
            ) : (
              <ul className="divide-y divide-border-subtle">
                {(d?.recent_sales ?? []).map((s) => (
                  <li key={s.id}>
                    <Link to={`/receipts/${s.reference}`} className="flex min-h-14 items-center gap-3 px-5 py-2 hover:bg-muted">
                      <div className="min-w-0 flex-1">
                        <p className="text-md font-medium text-fg">
                          <span className="font-mono text-base">{s.reference}</span>
                          <span className="ml-2 font-normal text-fg-3">{s.customer_name ?? "Walk-in"}</span>
                        </p>
                        <p className="text-sm text-fg-3">
                          {s.items_count} item{s.items_count === 1 ? "" : "s"} · {s.served_by} · {timeAgo(s.created_at)}
                        </p>
                      </div>
                      <div className="hidden sm:block">
                        {s.status === "voided" ? <SaleStatusBadge status="voided" /> : <PaymentBadge method={s.payment_method} />}
                      </div>
                      <p className={cn("tabular w-28 text-right text-md font-semibold", s.status === "voided" ? "text-fg-4 line-through" : "text-fg")}>
                        {formatNaira(s.total)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
