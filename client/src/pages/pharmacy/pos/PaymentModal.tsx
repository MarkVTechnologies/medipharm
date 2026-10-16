import { useEffect, useRef, useState } from "react";
import { Banknote, CreditCard, Landmark } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { quickCashAmounts, type CartTotals } from "../../../lib/cart";
import { cn } from "../../../lib/cn";
import { formatNaira } from "../../../lib/money";
import type { PaymentMethod } from "../../../lib/types";

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote; key: string }[] = [
  { value: "cash", label: "Cash", icon: Banknote, key: "1" },
  { value: "card", label: "Card / POS", icon: CreditCard, key: "2" },
  { value: "transfer", label: "Transfer", icon: Landmark, key: "3" },
];

export function PaymentModal({
  open,
  totals,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  totals: CartTotals;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, tendered: number | null) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const cashRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setTendered("");
    }
  }, [open]);

  useEffect(() => {
    if (open && method === "cash") window.setTimeout(() => cashRef.current?.focus(), 40);
  }, [open, method]);

  const tenderedNum = tendered === "" ? 0 : Number(tendered);
  const change = tenderedNum - totals.total;
  const cashShort = method === "cash" && (tendered === "" || change < -0.001);

  const submit = () => {
    if (busy || cashShort) return;
    onConfirm(method, method === "cash" ? tenderedNum : null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const m = METHODS.find((x) => x.key === e.key && !(e.target instanceof HTMLInputElement));
    if (m) {
      e.preventDefault();
      setMethod(m.value);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Take payment"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Back to cart
          </Button>
          <Button size="lg" variant="success" onClick={submit} loading={busy} disabled={cashShort} className="min-w-44">
            Complete sale · Enter
          </Button>
        </>
      }
    >
      <div onKeyDown={onKeyDown}>
        <div className="mb-5 rounded-lg bg-sidebar px-5 py-4 text-white">
          <p className="text-sm text-sidebar-fg-muted">Amount due</p>
          <p className="tabular text-4xl font-semibold tracking-tight">{formatNaira(totals.total)}</p>
          <p className="mt-1 text-sm text-sidebar-fg-muted">
            {totals.items} item{totals.items === 1 ? "" : "s"}
            {totals.discount > 0 && ` · ${formatNaira(totals.discount)} discount`} · VAT {formatNaira(totals.vat)}
          </p>
        </div>

        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
          {METHODS.map(({ value, label, icon: Icon, key }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={method === value}
              data-autofocus={method === value && value !== "cash" ? true : undefined}
              onClick={() => setMethod(value)}
              className={cn(
                "flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 text-base font-semibold transition-colors",
                method === value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-border-subtle text-fg-2 hover:border-border",
              )}
            >
              <Icon className="size-5" />
              {label}
              <span className="text-xs font-normal text-fg-4">Key {key}</span>
            </button>
          ))}
        </div>

        {method === "cash" && (
          <div className="mt-5">
            <label htmlFor="tendered" className="text-sm font-medium text-fg-2">
              Cash received
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl text-fg-3">₦</span>
              <input
                id="tendered"
                ref={cashRef}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                className="tabular h-14 w-full rounded-md border border-border bg-canvas pr-4 pl-10 text-2xl font-semibold focus:border-brand-500 focus:shadow-[0_0_0_3px_rgb(25_118_210/0.2)] focus:outline-none"
                placeholder="0"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickCashAmounts(totals.total).map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTendered(String(amt))}
                  className="tabular h-11 rounded-md border border-border px-3 text-base font-medium text-fg-2 hover:border-brand-400 hover:bg-brand-50"
                >
                  {formatNaira(amt).replace(/\.00$/, "")}
                </button>
              ))}
            </div>
            <div
              className={cn(
                "mt-4 flex items-center justify-between rounded-lg px-4 py-3",
                tendered === "" ? "bg-muted text-fg-3" : change >= 0 ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-600",
              )}
              aria-live="polite"
            >
              <span className="text-md font-medium">{change >= 0 || tendered === "" ? "Change to give" : "Still owed"}</span>
              <span className="tabular text-2xl font-semibold">{tendered === "" ? "—" : formatNaira(Math.abs(change))}</span>
            </div>
          </div>
        )}

        {method !== "cash" && (
          <p className="mt-5 rounded-md bg-info-50 px-4 py-3 text-base text-info-500">
            {method === "card" ? "Charge the POS terminal, then confirm once it's approved." : "Confirm the transfer has landed in the account before completing."}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-danger-50 px-3 py-2 text-base text-danger-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
