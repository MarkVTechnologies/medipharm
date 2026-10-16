import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import useSWR from "swr";
import { Title } from "react-head";
import { ArrowLeft, FileDown, Printer, ShoppingCart } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Button, buttonClass } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { PageLoader } from "../../components/ui/Spinner";
import { formatDateTime } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { Sale, Tenant } from "../../lib/types";
import { whatsappLink } from "./pos/SaleCompleteModal";

interface ReceiptPayload {
  data: { sale: Sale; tenant: Tenant; share_url: string; pdf_url: string };
}

const METHODS: Record<string, string> = { cash: "Cash", card: "Card / POS", transfer: "Bank transfer" };

/**
 * Stable receipt URL /receipts/{reference} (FR-7.1). Prints at 80mm thermal
 * width or A4 via the print stylesheet — no PDF round-trip (FR-7.2).
 */
export default function ReceiptPage() {
  const { reference } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data, error, mutate } = useSWR<ReceiptPayload>(reference ? `/api/receipts/${reference}` : null);

  if (error && !data) return <div className="p-6"><ErrorState error={error} onRetry={() => void mutate()} /></div>;
  if (!data) return <PageLoader />;
  const { sale, tenant, share_url, pdf_url } = data.data;

  return (
    <div className="min-h-dvh bg-app px-4 py-6">
      <Title>Receipt {sale.reference} · {tenant.name}</Title>

      <div className="no-print mx-auto mb-4 flex max-w-[360px] flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/sales"))}>
          Back
        </Button>
        <div className="ml-auto flex gap-2">
          <a className={buttonClass("secondary", "sm", "text-[#128C7E]")} href={whatsappLink(sale, share_url, tenant.name, sale.customer?.phone)} target="_blank" rel="noreferrer">
            <FaWhatsapp /> Share
          </a>
          <a className={buttonClass("secondary", "sm")} href={pdf_url}>
            <FileDown /> PDF
          </a>
          <Button size="sm" icon={<Printer />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <article className="print-receipt mx-auto w-full max-w-[360px] rounded-lg bg-canvas p-5 font-mono text-sm leading-relaxed text-fg shadow-sm">
        {sale.status === "voided" && <p className="mb-3 border-2 border-danger-500 py-1 text-center font-bold tracking-widest text-danger-600">VOIDED</p>}
        <header className="text-center">
          <h1 className="font-sans text-lg font-bold">{tenant.name}</h1>
          {tenant.address && <p className="text-fg-3">{tenant.address}</p>}
          {tenant.phone && <p className="text-fg-3">Tel: {tenant.phone}</p>}
          {tenant.licence_number && <p className="text-fg-3">Premises licence: {tenant.licence_number}</p>}
        </header>
        <Divider />
        <Row k="Receipt" v={<strong>{sale.reference}</strong>} />
        <Row k="Date" v={formatDateTime(sale.created_at)} />
        <Row k="Served by" v={sale.served_by?.name} />
        {sale.customer && <Row k="Customer" v={`${sale.customer.name} (${sale.customer.code})`} />}
        <Divider />
        {sale.items?.map((i) => (
          <div key={i.id} className="mb-1.5">
            <p className="font-semibold">
              {i.drug_name} {i.strength}
            </p>
            <div className="flex justify-between text-fg-3">
              <span>
                {i.quantity} × {formatNaira(i.unit_price)} · {i.batch_number}
              </span>
              <span className="text-fg">{formatNaira(i.line_total)}</span>
            </div>
          </div>
        ))}
        <Divider />
        <Row k="Subtotal" v={formatNaira(sale.subtotal)} />
        {sale.discount > 0 && <Row k="Discount" v={`−${formatNaira(sale.discount)}`} />}
        <Row k="VAT" v={formatNaira(sale.vat)} />
        <div className="mt-1 flex justify-between text-md font-bold">
          <span>TOTAL</span>
          <span>{formatNaira(sale.total)}</span>
        </div>
        <Row k="Paid by" v={METHODS[sale.payment_method]} />
        {sale.payment_method === "cash" && (
          <>
            <Row k="Tendered" v={formatNaira(sale.amount_tendered)} />
            <Row k="Change" v={formatNaira(sale.change_given)} />
          </>
        )}
        <Divider />
        {tenant.receipt_footer && <p className="text-center text-fg-3">{tenant.receipt_footer}</p>}
        <p className="mt-2 text-center text-xs text-fg-4">Powered by MediPharm</p>
      </article>

      {params.get("new") && (
        <div className="no-print mx-auto mt-4 max-w-[360px]">
          <Button className="w-full" size="lg" icon={<ShoppingCart />} onClick={() => navigate("/pos")}>
            New sale
          </Button>
        </div>
      )}
      <p className="no-print mx-auto mt-4 max-w-[360px] text-center text-xs text-fg-4">
        Customer link valid 30 days · <a href={share_url} target="_blank" rel="noreferrer" className="underline">preview</a>
      </p>
    </div>
  );
}

function Divider() {
  return <hr className="my-2.5 border-0 border-t border-dashed border-border-strong" />;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-fg-3">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
