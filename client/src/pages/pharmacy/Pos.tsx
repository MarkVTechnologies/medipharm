import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Title } from "react-head";
import { toast } from "react-toastify";
import { Barcode, Clock, Minus, PauseCircle, Plus, ScanLine, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { StockBadge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { useSession } from "../../context/auth";
import { useCart } from "../../hooks/useCart";
import { useInvalidate } from "../../hooks/useData";
import { useDebounce } from "../../hooks/useDebounce";
import { api, ApiError, qs } from "../../lib/api";
import { addToCart, cartTotals, checkoutPayload, type CartLine } from "../../lib/cart";
import { cn } from "../../lib/cn";
import { formatDate, timeAgo } from "../../lib/dates";
import { formatNaira } from "../../lib/money";
import type { PaymentMethod, PosDrug, Sale } from "../../lib/types";
import { CustomerPicker } from "./pos/CustomerPicker";
import { PaymentModal } from "./pos/PaymentModal";
import { SaleCompleteModal } from "./pos/SaleCompleteModal";

interface SearchResponse {
  data: PosDrug[];
  meta: { barcode_match: boolean };
}

export default function Pos() {
  const { user, tenant } = useSession();
  const { cart, setCart, clear, held, hold, resume, discardHeld } = useCart(tenant.id, user.id);
  const invalidate = useInvalidate();

  const [q, setQ] = useState("");
  const query = useDebounce(q.trim(), 200);
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string>();
  const [completed, setCompleted] = useState<{ sale: Sale; url: string } | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);

  // SWR caches by query key, so re-typing a recent search is instant (FR-3.1).
  const { data, isLoading } = useSWR<SearchResponse>(query ? `/api/pos/search${qs({ q: query })}` : null, { keepPreviousData: true });
  const results = query ? (data?.data ?? []) : [];
  const totals = useMemo(() => cartTotals(cart), [cart]);

  useEffect(() => setHighlight(0), [query]);

  const focusSearch = useCallback(() => window.setTimeout(() => searchRef.current?.focus(), 0), []);

  const add = useCallback(
    (drug: PosDrug) => {
      if (drug.stock_on_hand <= 0) {
        toast.warn(`${drug.name} is out of stock.`);
        return;
      }
      const existing = cart.lines.find((l) => l.drug_id === drug.id);
      if (existing && existing.quantity >= drug.stock_on_hand) {
        toast.warn(`Only ${drug.stock_on_hand} ${drug.name} in stock.`);
        return;
      }
      setCart((c) => addToCart(c, drug));
      setQ("");
      focusSearch();
    },
    [cart.lines, setCart, focusSearch],
  );

  // Enter: a barcode scan adds immediately with no confirmation (FR-3.2);
  // otherwise the highlighted result is added.
  const onSearchKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Escape") {
      setQ("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      const term = q.trim();
      if (!term) {
        if (cart.lines.length) setPaying(true);
        return;
      }
      if (term === query && results[highlight] && !(data?.meta.barcode_match === false && /^\d{8,}$/.test(term) && results.length !== 1)) {
        add(results[highlight]);
        return;
      }
      try {
        const res = await api<SearchResponse>(`/api/pos/search${qs({ q: term })}`);
        if (res.meta.barcode_match || res.data.length === 1) add(res.data[0]);
        else if (!res.data.length) toast.info(`Nothing matches “${term}”.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Search failed");
      }
    }
  };

  // Global shortcuts: F2 or / to search, F9 to charge, F8 to hold.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paying || completed || heldOpen) return;
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "F2" || (e.key === "/" && !inField)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F9" && cart.lines.length) {
        e.preventDefault();
        setPaying(true);
      } else if (e.key === "F8" && cart.lines.length) {
        e.preventDefault();
        hold(totals.total);
        toast.info("Sale held");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paying, completed, heldOpen, cart.lines.length, hold, totals.total]);

  useEffect(() => {
    focusSearch();
  }, [focusSearch]);

  const setQty = (drugId: number, quantity: number) =>
    setCart((c) => ({
      ...c,
      lines: c.lines.map((l) => (l.drug_id === drugId ? { ...l, quantity: Math.max(1, Math.min(quantity || 1, l.stock_on_hand)) } : l)),
    }));

  const remove = (drugId: number) => setCart((c) => ({ ...c, lines: c.lines.filter((l) => l.drug_id !== drugId) }));

  const checkout = async (method: PaymentMethod, tendered: number | null) => {
    setBusy(true);
    setPayError(undefined);
    try {
      const res = await api<{ data: Sale; receipt_url: string }>("/api/sales", { method: "POST", body: checkoutPayload(cart, method, tendered) });
      clear();
      setPaying(false);
      setCompleted({ sale: res.data, url: res.receipt_url });
      void invalidate("/api/dashboard", "/api/pos/search", "/api/drugs", "/api/sales", "/api/customers");
    } catch (err) {
      if (err instanceof ApiError) {
        // "No longer available": sync the line with what's actually left.
        const drugId = err.data.drug_id as number | undefined;
        const available = err.data.available as number | undefined;
        if (drugId !== undefined && available !== undefined) {
          setCart((c) => ({
            ...c,
            lines: available > 0
              ? c.lines.map((l) => (l.drug_id === drugId ? { ...l, stock_on_hand: available, quantity: Math.min(l.quantity, available) } : l))
              : c.lines.filter((l) => l.drug_id !== drugId),
          }));
        }
        setPayError(err.field("amount_tendered") ?? err.field("items") ?? err.message);
      } else {
        setPayError("Network problem — the sale was NOT recorded. Check the connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const newSale = () => {
    setCompleted(null);
    focusSearch();
  };

  return (
    <>
      <Title>Point of sale · MediPharm</Title>
      <div className="grid min-h-[calc(100dvh-56px)] lg:h-dvh lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* ── Search & results ─────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col border-border-subtle lg:border-r">
          <div className="border-b border-border-subtle bg-canvas px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">Point of sale</h1>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" icon={<Clock />} onClick={() => setHeldOpen(true)} disabled={!held.length}>
                  Held {held.length > 0 && <span className="tabular rounded-xs bg-brand-50 px-1 text-brand-700">{held.length}</span>}
                </Button>
              </div>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-4" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search drug, generic, brand — or scan a barcode"
                aria-label="Search drugs"
                autoComplete="off"
                spellCheck={false}
                className="h-14 w-full rounded-lg border border-border bg-canvas pr-24 pl-12 text-lg shadow-xs placeholder:text-fg-4 focus:border-brand-500 focus:shadow-[0_0_0_3px_rgb(25_118_210/0.2)] focus:outline-none"
              />
              <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2 text-fg-4">
                {isLoading && query && <Spinner className="size-4" />}
                <kbd className="hidden rounded-xs border border-border px-1.5 py-0.5 font-mono text-xs sm:inline">F2</kbd>
              </span>
            </div>
          </div>

          <div className="min-h-[240px] flex-1 overflow-y-auto bg-app p-3 sm:p-4">
            {!query ? (
              <EmptyState
                icon={<ScanLine />}
                title="Scan or type to add items"
                description={
                  <span className="inline-flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <span><Kbd>↑</Kbd><Kbd>↓</Kbd> choose</span>
                    <span><Kbd>Enter</Kbd> add</span>
                    <span><Kbd>F9</Kbd> charge</span>
                    <span><Kbd>F8</Kbd> hold</span>
                  </span>
                }
              />
            ) : results.length === 0 && !isLoading ? (
              <EmptyState icon={<Barcode />} title={`Nothing matches “${query}”`} description="Try the generic name, or check the spelling." />
            ) : (
              <ul className="grid gap-2" role="listbox" aria-label="Search results">
                {results.map((d, i) => (
                  <li key={d.id} role="option" aria-selected={i === highlight}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => add(d)}
                      disabled={d.stock_on_hand <= 0}
                      className={cn(
                        "flex min-h-16 w-full items-center gap-4 rounded-lg border bg-canvas px-4 py-3 text-left transition-colors",
                        i === highlight ? "border-brand-400 ring-2 ring-brand-100" : "border-border-subtle hover:border-border",
                        d.stock_on_hand <= 0 && "opacity-60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-md font-semibold text-fg">
                          {d.name} {d.strength && <span className="font-normal text-fg-3">{d.strength}</span>}
                        </p>
                        <p className="truncate text-sm text-fg-3">
                          {[d.generic_name, d.brand, d.form, d.pack_size].filter(Boolean).join(" · ")}
                        </p>
                        {d.fefo_batch && (
                          <p className="mt-0.5 text-xs text-fg-4">
                            Next batch <span className="font-mono">{d.fefo_batch.batch_number}</span> · exp {formatDate(d.fefo_batch.expiry_date)}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tabular text-md font-semibold">{formatNaira(d.selling_price)}</p>
                        <p className="mt-0.5 flex items-center justify-end gap-1.5 text-sm text-fg-3">
                          <span className="tabular">{d.stock_on_hand}</span>
                          <StockBadge status={d.stock_status} />
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Cart ──────────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col bg-canvas" aria-label="Cart">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h2 className="flex items-center gap-2 text-md font-semibold">
              <ShoppingCart className="size-4 text-fg-3" /> Current sale
              {totals.items > 0 && <span className="tabular text-fg-3">· {totals.items} item{totals.items === 1 ? "" : "s"}</span>}
            </h2>
            {cart.lines.length > 0 && (
              <button type="button" onClick={clear} className="text-sm font-medium text-fg-3 hover:text-danger-600">
                Clear
              </button>
            )}
          </div>

          <div className="px-4 pt-3">
            <CustomerPicker value={cart.customer} onChange={(customer) => setCart((c) => ({ ...c, customer }))} />
          </div>

          {/* Not animated: list motion costs perceived speed (spec §3.2). */}
          <ul className="min-h-[160px] flex-1 divide-y divide-border-subtle overflow-y-auto px-4">
            {cart.lines.length === 0 ? (
              <li className="py-12 text-center text-base text-fg-4">Cart is empty</li>
            ) : (
              cart.lines.map((line) => <CartRow key={line.drug_id} line={line} onQty={setQty} onRemove={remove} />)
            )}
          </ul>

          <div className="sticky bottom-0 border-t border-border-subtle bg-canvas px-4 pt-3 pb-4">
            <dl className="space-y-1 text-base">
              <Row label="Subtotal" value={formatNaira(totals.subtotal)} />
              {totals.discount > 0 && <Row label={`Discount (${cart.customer?.tier})`} value={`−${formatNaira(totals.discount)}`} className="text-success-600" />}
              <Row label="VAT" value={formatNaira(totals.vat)} />
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-md font-semibold">Total</dt>
                <dd className="tabular text-3xl font-semibold tracking-tight">{formatNaira(totals.total)}</dd>
              </div>
            </dl>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
              <Button
                variant="secondary"
                size="lg"
                icon={<PauseCircle />}
                disabled={!cart.lines.length}
                onClick={() => {
                  hold(totals.total);
                  toast.info("Sale held");
                  focusSearch();
                }}
              >
                Hold
              </Button>
              <Button
                size="lg"
                variant="success"
                className="h-12 text-lg"
                disabled={!cart.lines.length || tenant.read_only}
                onClick={() => {
                  setPayError(undefined);
                  setPaying(true);
                }}
              >
                Charge {totals.total > 0 && formatNaira(totals.total)}
                <kbd className="ml-1 hidden rounded-xs bg-white/20 px-1.5 font-mono text-xs sm:inline">F9</kbd>
              </Button>
            </div>
          </div>
        </section>
      </div>

      <PaymentModal open={paying} totals={totals} busy={busy} error={payError} onClose={() => { setPaying(false); focusSearch(); }} onConfirm={checkout} />

      <SaleCompleteModal sale={completed?.sale ?? null} receiptUrl={completed?.url ?? null} pharmacy={tenant.name} onNewSale={newSale} />

      <Modal open={heldOpen} onClose={() => setHeldOpen(false)} title="Held sales" description="Resume a basket that was set aside.">
        {held.length === 0 ? (
          <p className="py-6 text-center text-fg-3">No held sales.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {held.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-md font-medium">{h.label}</p>
                  <p className="text-sm text-fg-3">
                    {h.cart.lines.length} line{h.cart.lines.length === 1 ? "" : "s"} · held {timeAgo(h.held_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    resume(h.id, totals.total);
                    setHeldOpen(false);
                    focusSearch();
                  }}
                >
                  Resume
                </Button>
                <button type="button" onClick={() => discardHeld(h.id)} className="flex size-8 items-center justify-center rounded-md text-fg-4 hover:bg-danger-50 hover:text-danger-600" aria-label="Discard held sale">
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function CartRow({ line, onQty, onRemove }: { line: CartLine; onQty: (id: number, q: number) => void; onRemove: (id: number) => void }) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-md font-medium text-fg">
            {line.name} {line.strength && <span className="font-normal text-fg-3">{line.strength}</span>}
          </p>
          <p className="text-xs text-fg-4">
            {line.batch_number ? (
              <>
                Batch <span className="font-mono">{line.batch_number}</span> · exp {formatDate(line.expiry_date)}
              </>
            ) : (
              "FEFO batch"
            )}{" "}
            · {formatNaira(line.unit_price)} each
          </p>
        </div>
        <button type="button" onClick={() => onRemove(line.drug_id)} className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-fg-4 hover:bg-danger-50 hover:text-danger-600" aria-label={`Remove ${line.name}`}>
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center rounded-md border border-border">
          <button type="button" onClick={() => onQty(line.drug_id, line.quantity - 1)} disabled={line.quantity <= 1} className="flex size-9 items-center justify-center text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Decrease quantity">
            <Minus className="size-4" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={line.stock_on_hand}
            value={line.quantity}
            onChange={(e) => onQty(line.drug_id, Number(e.target.value))}
            onFocus={(e) => e.target.select()}
            className="tabular h-9 w-12 border-x border-border text-center text-md font-semibold focus:outline-none"
            aria-label={`Quantity of ${line.name}`}
          />
          <button type="button" onClick={() => onQty(line.drug_id, line.quantity + 1)} disabled={line.quantity >= line.stock_on_hand} className="flex size-9 items-center justify-center text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Increase quantity">
            <Plus className="size-4" />
          </button>
        </div>
        <p className="tabular text-md font-semibold">{formatNaira(line.unit_price * line.quantity)}</p>
      </div>
    </li>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between text-fg-3", className)}>
      <dt className="capitalize">{label}</dt>
      <dd className="tabular font-medium text-fg-2">{value}</dd>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="mx-0.5 rounded-xs border border-border bg-canvas px-1.5 py-0.5 font-mono text-xs text-fg-2">{children}</kbd>;
}
