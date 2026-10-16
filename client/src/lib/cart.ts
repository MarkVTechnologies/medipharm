// POS cart state and pure totals. The cart lives in sessionStorage keyed by
// tenant + user so it survives session expiry, refresh and network failure
// (FR-1.4, §9.4). Held sales live in localStorage so they survive a closed tab.

import { percentOf, toKobo } from "./money";
import type { Customer, PaymentMethod, PosDrug } from "./types";

export interface CartLine {
  drug_id: number;
  name: string;
  strength: string | null;
  form: string | null;
  unit_price: number;
  tax_rate: number;
  quantity: number;
  stock_on_hand: number;
  batch_number: string | null;
  expiry_date: string | null;
}

export interface Cart {
  lines: CartLine[];
  customer: Pick<Customer, "id" | "code" | "name" | "phone" | "tier" | "discount"> | null;
}

export interface HeldSale {
  id: string;
  held_at: string;
  label: string;
  cart: Cart;
}

export const EMPTY_CART: Cart = { lines: [], customer: null };

export function cartKey(tenantId: number, userId: number): string {
  return `medipharm:cart:${tenantId}:${userId}`;
}

export function heldKey(tenantId: number, userId: number): string {
  return `medipharm:held:${tenantId}:${userId}`;
}

export function readStore<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the cart still works in memory */
  }
}

export function lineFromDrug(drug: PosDrug, quantity = 1): CartLine {
  return {
    drug_id: drug.id,
    name: drug.name,
    strength: drug.strength,
    form: drug.form,
    unit_price: drug.selling_price,
    tax_rate: drug.tax_rate,
    quantity,
    stock_on_hand: drug.stock_on_hand,
    batch_number: drug.fefo_batch?.batch_number ?? null,
    expiry_date: drug.fefo_batch?.expiry_date ?? null,
  };
}

export function addToCart(cart: Cart, drug: PosDrug, quantity = 1): Cart {
  const existing = cart.lines.find((l) => l.drug_id === drug.id);
  if (existing) {
    return {
      ...cart,
      lines: cart.lines.map((l) =>
        l.drug_id === drug.id ? { ...l, quantity: Math.min(l.quantity + quantity, drug.stock_on_hand), stock_on_hand: drug.stock_on_hand } : l,
      ),
    };
  }
  return { ...cart, lines: [...cart.lines, lineFromDrug(drug, Math.min(quantity, drug.stock_on_hand))] };
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  items: number;
}

/**
 * Mirrors the server's arithmetic (subtotal − discount + VAT, per line, in kobo)
 * for display. The server recomputes and is always the authority.
 */
export function cartTotals(cart: Cart): CartTotals {
  const discountPct = cart.customer?.discount ?? 0;
  let subtotal = 0;
  let discount = 0;
  let vat = 0;
  let items = 0;
  for (const line of cart.lines) {
    const gross = toKobo(line.unit_price) * line.quantity;
    const lineDiscount = percentOf(gross, discountPct);
    subtotal += gross;
    discount += lineDiscount;
    vat += percentOf(gross - lineDiscount, line.tax_rate);
    items += line.quantity;
  }
  return {
    subtotal: subtotal / 100,
    discount: discount / 100,
    vat: vat / 100,
    total: (subtotal - discount + vat) / 100,
    items,
  };
}

export function checkoutPayload(cart: Cart, method: PaymentMethod, tendered: number | null) {
  return {
    items: cart.lines.map((l) => ({ drug_id: l.drug_id, quantity: l.quantity })),
    customer_id: cart.customer?.id ?? null,
    payment_method: method,
    amount_tendered: method === "cash" ? tendered : null,
  };
}

/** Quick cash buttons: exact, then the next sensible note totals. */
export function quickCashAmounts(total: number): number[] {
  const notes = [500, 1000, 2000, 5000, 10000, 20000, 50000];
  const options = new Set<number>([Math.ceil(total)]);
  for (const step of notes) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) options.add(rounded);
    if (options.size >= 4) break;
  }
  return [...options].sort((a, b) => a - b).slice(0, 4);
}
