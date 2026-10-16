import { CheckCircle2, ExternalLink, Printer } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Link } from "react-router-dom";
import { Button, buttonClass } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { apiUrl } from "../../../lib/api";
import { formatNaira } from "../../../lib/money";
import type { Sale } from "../../../lib/types";

export function whatsappLink(sale: Pick<Sale, "reference" | "total">, receiptUrl: string, pharmacy: string, phone?: string | null) {
  const text = `Thank you for shopping at ${pharmacy}. Receipt ${sale.reference} — ${formatNaira(sale.total)}.\n${receiptUrl}`;
  const to = phone ? phone.replace(/\D/g, "").replace(/^0/, "234") : "";
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

export function SaleCompleteModal({
  sale,
  receiptUrl,
  pharmacy,
  onNewSale,
}: {
  sale: Sale | null;
  receiptUrl: string | null;
  pharmacy: string;
  onNewSale: () => void;
}) {
  const print = () => {
    if (!sale) return;
    window.open(apiUrl(`/api/sales/${sale.id}/receipt?print=1`), "receipt", "width=420,height=720");
  };

  return (
    <Modal
      open={!!sale}
      onClose={onNewSale}
      title="Sale complete"
      size="sm"
      footer={
        <Button size="lg" className="w-full" onClick={onNewSale} data-autofocus>
          New sale · Enter
        </Button>
      }
    >
      {sale && (
        <div className="text-center">
          <CheckCircle2 className="mx-auto size-12 text-success-500" />
          <p className="mt-2 font-mono text-base text-fg-3">{sale.reference}</p>
          <p className="tabular mt-1 text-3xl font-semibold">{formatNaira(sale.total)}</p>
          {sale.payment_method === "cash" && (
            <div className="mt-4 rounded-lg bg-success-50 px-4 py-3 text-success-600">
              <p className="text-sm font-medium">Change to give</p>
              <p className="tabular text-2xl font-semibold">{formatNaira(sale.change_given)}</p>
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<Printer />} onClick={print}>
              Print receipt
            </Button>
            {receiptUrl && (
              <a
                className={buttonClass("secondary", "md", "text-[#128C7E]")}
                href={whatsappLink(sale, receiptUrl, pharmacy, sale.customer?.phone)}
                target="_blank"
                rel="noreferrer"
              >
                <FaWhatsapp /> WhatsApp
              </a>
            )}
          </div>
          <Link to={`/receipts/${sale.reference}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
            View receipt <ExternalLink className="size-3.5" />
          </Link>
        </div>
      )}
    </Modal>
  );
}
