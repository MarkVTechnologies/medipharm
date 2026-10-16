import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Check, CreditCard } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { PageLoader } from "../../components/ui/Spinner";
import { Table, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useSession } from "../../context/auth";
import { useBilling } from "../../hooks/useData";
import { api, ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDate } from "../../lib/dates";
import { formatNaira } from "../../lib/money";

export function BillingSettings() {
  const { refresh } = useSession();
  const { data, mutate } = useBilling(true);
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const verified = useRef(false);

  // Back from Paystack's hosted page: confirm the charge (the webhook is the
  // source of truth; this covers a late webhook).
  const reference = params.get("reference");
  useEffect(() => {
    if (!reference || verified.current) return;
    verified.current = true;
    void api<{ data: { status: string } | null }>("/api/billing/verify", { method: "POST", body: { reference } })
      .then((r) => {
        if (r.data?.status === "success") toast.success("Payment received — thank you!");
        else toast.info("Payment is still processing. This page will update when Paystack confirms.");
      })
      .catch(() => toast.error("Could not confirm the payment yet."))
      .finally(() => {
        void mutate();
        void refresh();
        setParams({}, { replace: true });
      });
  }, [reference, mutate, refresh, setParams]);

  if (!data) return <PageLoader />;
  const { tenant, subscription, plans, payments, paystack_configured } = data.data;

  const pay = async (plan: string) => {
    setBusy(plan);
    try {
      const res = await api<{ data: { authorization_url: string } }>("/api/billing/initialize", { method: "POST", body: { plan } });
      window.location.href = res.data.authorization_url;
    } catch (e) {
      toast.error(e instanceof ApiError ? (e.field("plan") ?? e.message) : "Could not start payment");
      setBusy(null);
    }
  };

  const statusTone = { trial: "info", active: "success", past_due: "warning", suspended: "danger" } as const;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-fg-3">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-semibold capitalize">
              {tenant.plan} <Badge tone={statusTone[tenant.status]}>{tenant.status.replace("_", " ")}</Badge>
            </p>
            <p className="mt-1 text-base text-fg-3">
              {tenant.status === "trial"
                ? `Free trial ends ${formatDate(tenant.trial_ends_at)}`
                : subscription?.renews_at
                  ? `Renews ${formatDate(subscription.renews_at)}`
                  : ""}
            </p>
          </div>
          {tenant.read_only && (
            <p className="max-w-sm rounded-md bg-warning-50 px-3 py-2 text-base text-warning-600">
              Read-only until payment. Nothing has been deleted — every record is still here.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const current = p.key === tenant.plan && tenant.status === "active";
          return (
            <Card key={p.key} className={cn("flex flex-col p-5", current && "ring-2 ring-brand-500")}>
              <p className="text-md font-semibold">{p.name}</p>
              <p className="mt-2">
                <span className="tabular text-3xl font-semibold tracking-tight">{formatNaira(p.price).replace(/\.00$/, "")}</span>
                <span className="text-base text-fg-3"> / month</span>
              </p>
              <ul className="mt-4 space-y-2 text-base text-fg-2">
                <li className="flex gap-2"><Check className="size-4 text-success-500" /> {p.seats} staff seats</li>
                <li className="flex gap-2"><Check className="size-4 text-success-500" /> {p.skus ? `Up to ${p.skus.toLocaleString()} SKUs` : "Unlimited SKUs"}</li>
                <li className="flex gap-2"><Check className="size-4 text-success-500" /> Receipts, reports, CSV import</li>
              </ul>
              <Button className="mt-5" variant={current ? "secondary" : "primary"} icon={<CreditCard />} loading={busy === p.key} disabled={!paystack_configured || !!busy} onClick={() => pay(p.key)}>
                {current ? "Renew" : "Choose plan"}
              </Button>
            </Card>
          );
        })}
      </div>
      {!paystack_configured && (
        <p className="text-sm text-fg-3">Paystack keys are not configured on the server yet (PAYSTACK_SECRET_KEY in .env), so payment is disabled.</p>
      )}

      <Card>
        <CardHeader title="Payment history" />
        {payments.length === 0 ? (
          <p className="px-5 py-8 text-center text-base text-fg-3">No payments yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Plan</Th>
                <Th>Reference</Th>
                <Th>Status</Th>
                <Th align="right">Amount</Th>
              </tr>
            </THead>
            <tbody>
              {payments.map((p) => (
                <Tr key={p.id}>
                  <Td>{formatDate(p.paid_at ?? p.created_at)}</Td>
                  <Td className="capitalize">{p.plan}</Td>
                  <Td className="font-mono text-sm">{p.reference}</Td>
                  <Td><Badge tone={p.status === "success" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status}</Badge></Td>
                  <Td align="right" className="font-medium text-fg">{formatNaira(p.amount)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
