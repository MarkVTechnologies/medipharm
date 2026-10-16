import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Ban, FileDown, Printer } from "lucide-react";
import { PaymentBadge, SaleStatusBadge, TierBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Field, Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { useSession } from "../../context/auth";
import { useInvalidate, useSale } from "../../hooks/useData";
import { api, apiUrl } from "../../lib/api";
import { formatDateTime } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import { can } from "../../lib/permissions";

export function SaleDrawer({ saleId, onClose }: { saleId: number | null; onClose: () => void }) {
  const { user } = useSession();
  const { data, mutate } = useSale(saleId);
  const invalidate = useInvalidate();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const sale = data?.data;

  const doVoid = async () => {
    if (!sale) return;
    setBusy(true);
    try {
      await api(`/api/sales/${sale.id}/void`, { method: "POST", body: { reason } });
      toast.success(`${sale.reference} voided — stock restored to its batches`);
      setVoiding(false);
      setReason("");
      void mutate();
      void invalidate("/api/sales", "/api/dashboard", "/api/drugs", "/api/pos/search", "/api/customers");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not void");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      side
      open={saleId !== null}
      onClose={onClose}
      title={sale ? <span className="font-mono">{sale.reference}</span> : "Sale"}
      description={sale ? formatDateTime(sale.created_at) : undefined}
      footer={
        sale && (
          <>
            {sale.status === "completed" && can(user.role, "voidSales") && (
              <Button variant="ghost" className="mr-auto text-danger-600 hover:bg-danger-50" icon={<Ban />} onClick={() => setVoiding(true)}>
                Void / refund
              </Button>
            )}
            <a href={apiUrl(`/api/sales/${sale.id}/receipt?format=pdf`)} className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-base font-medium text-fg-2 hover:bg-subtle">
              <FileDown className="size-4" /> PDF
            </a>
            <Button icon={<Printer />} onClick={() => window.open(apiUrl(`/api/sales/${sale.id}/receipt?print=1`), "receipt", "width=420,height=720")}>
              Print
            </Button>
          </>
        )
      }
    >
      {!sale ? (
        <div className="flex justify-center py-12 text-brand-500">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <SaleStatusBadge status={sale.status} />
            <PaymentBadge method={sale.payment_method} />
            <span className="text-base text-fg-3">Served by {sale.served_by?.name}</span>
          </div>

          {sale.status === "voided" && (
            <div className="rounded-md bg-danger-50 px-4 py-3 text-base text-danger-600">
              Voided {formatDateTime(sale.voided_at)} by {sale.voided_by?.name}
              {sale.void_reason && <> — “{sale.void_reason}”</>}
            </div>
          )}

          {sale.customer && (
            <Link to={`/customers/${sale.customer.id}`} className="flex items-center justify-between rounded-md border border-border-subtle px-4 py-3 hover:bg-muted">
              <span>
                <span className="block text-md font-medium">{sale.customer.name}</span>
                <span className="text-sm text-fg-3">{sale.customer.code} · {sale.customer.phone ?? "no phone"}</span>
              </span>
              <TierBadge tier={sale.customer.tier} />
            </Link>
          )}

          <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
            {sale.items?.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-md font-medium">
                    {i.drug_name} <span className="font-normal text-fg-3">{i.strength}</span>
                  </p>
                  <p className="text-sm text-fg-3">
                    {i.quantity} × {formatNaira(i.unit_price)} · batch <span className="font-mono">{i.batch_number}</span>
                  </p>
                </div>
                <p className="tabular font-semibold">{formatNaira(i.line_total)}</p>
              </li>
            ))}
          </ul>

          <dl className="space-y-1.5 text-base">
            <Line k="Subtotal" v={formatNaira(sale.subtotal)} />
            {sale.discount > 0 && <Line k="Discount" v={`−${formatNaira(sale.discount)}`} />}
            <Line k="VAT" v={formatNaira(sale.vat)} />
            <div className="flex justify-between border-t border-border-subtle pt-2 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatNaira(sale.total)}</dd>
            </div>
            {sale.payment_method === "cash" && (
              <>
                <Line k="Tendered" v={formatNaira(sale.amount_tendered)} />
                <Line k="Change" v={formatNaira(sale.change_given)} />
              </>
            )}
          </dl>
        </div>
      )}

      <Modal
        open={voiding}
        onClose={() => setVoiding(false)}
        title="Void this sale?"
        description="Quantities go back to the exact batches they came from. This is recorded against your name."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVoiding(false)}>Cancel</Button>
            <Button variant="danger" loading={busy} disabled={!reason.trim()} onClick={doVoid}>Void sale</Button>
          </>
        }
      >
        <Field label="Reason" required>
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer returned unopened pack" autoFocus />}
        </Field>
      </Modal>
    </Modal>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-fg-3">
      <dt>{k}</dt>
      <dd className="tabular text-fg-2">{v}</dd>
    </div>
  );
}
