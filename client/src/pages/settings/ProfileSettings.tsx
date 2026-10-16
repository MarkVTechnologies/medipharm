import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/Input";
import { TierBadge } from "../../components/ui/Badge";
import { useSession } from "../../context/auth";
import { api, ApiError } from "../../lib/api";
import type { Tenant } from "../../lib/types";

export function ProfileSettings() {
  const { tenant, user, refresh } = useSession();
  const readOnly = user.role !== "owner";
  const [f, setF] = useState({
    name: tenant.name,
    address: tenant.address ?? "",
    phone: tenant.phone ?? "",
    email: tenant.email ?? "",
    licence_number: tenant.licence_number ?? "",
    receipt_footer: tenant.receipt_footer ?? "",
    vat_rate: String(tenant.vat_rate),
  });
  const [tiers, setTiers] = useState(tenant.tiers.map((t) => ({ ...t, min_spend: String(t.min_spend), discount: String(t.discount) })));
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(f).forEach(([k, v]) => body.append(k, v));
      tiers.forEach((t, i) => {
        body.append(`tiers[${i}][tier]`, t.tier);
        body.append(`tiers[${i}][min_spend]`, t.min_spend || "0");
        body.append(`tiers[${i}][discount]`, t.discount || "0");
      });
      if (logo) body.append("logo", logo);
      await api<{ data: Tenant }>("/api/settings/tenant", { method: "POST", body });
      await refresh();
      toast.success("Pharmacy profile saved");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err);
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof typeof f, label: string, hint?: string) => (
    <Field label={label} error={error?.field(k)} hint={hint}>
      {(id) => <Input id={id} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={readOnly} />}
    </Field>
  );

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader title="Pharmacy profile" description="Shown on every receipt." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{input("name", "Pharmacy name")}</div>
          <div className="sm:col-span-2">{input("address", "Address")}</div>
          {input("phone", "Phone")}
          {input("email", "Email")}
          {input("licence_number", "Premises licence number", "PCN premises registration")}
          <Field label="Logo" error={error?.field("logo")}>
            {(id) => (
              <div className="flex items-center gap-3">
                {tenant.logo_url && <img src={tenant.logo_url} alt="" className="size-10 rounded-md object-cover ring-1 ring-border" />}
                <input id={id} type="file" accept="image/*" disabled={readOnly} onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="min-w-0 flex-1 text-base file:mr-3 file:h-9 file:rounded-md file:border file:border-border file:bg-canvas file:px-3 file:text-base file:font-medium" />
              </div>
            )}
          </Field>
          <Field label="Receipt footer" error={error?.field("receipt_footer")} className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} value={f.receipt_footer} onChange={(e) => setF({ ...f, receipt_footer: e.target.value })} disabled={readOnly} />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tax & currency" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Standard VAT rate (%)" error={error?.field("vat_rate")} hint="Nigeria: 7.5%. Individual items can be exempt.">
            {(id) => <Input id={id} type="number" step="0.01" min={0} max={100} value={f.vat_rate} onChange={(e) => setF({ ...f, vat_rate: e.target.value })} disabled={readOnly} />}
          </Field>
          <Field label="Currency" hint="Fixed">
            {(id) => <Input id={id} value="NGN — Nigerian Naira (₦)" disabled />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Loyalty tiers" description="Customers move up automatically as their lifetime spend grows. The discount applies at checkout." />
        <CardBody className="space-y-3">
          {tiers.map((t, i) => (
            <div key={t.tier} className="grid grid-cols-[90px_1fr_1fr] items-center gap-3">
              <TierBadge tier={t.tier} />
              <Input type="number" min={0} value={t.min_spend} disabled={readOnly || i === 0} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, min_spend: e.target.value } : x)))} aria-label={`${t.tier} minimum lifetime spend`} />
              <div className="relative">
                <Input type="number" min={0} max={50} step="0.5" value={t.discount} disabled={readOnly} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, discount: e.target.value } : x)))} aria-label={`${t.tier} discount percent`} className="pr-8" />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-fg-4">%</span>
              </div>
            </div>
          ))}
          <p className="grid grid-cols-[90px_1fr_1fr] gap-3 text-xs text-fg-4">
            <span />
            <span>From lifetime spend (₦)</span>
            <span>Discount</span>
          </p>
        </CardBody>
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button type="submit" size="lg" loading={busy}>Save changes</Button>
        </div>
      )}
    </form>
  );
}
