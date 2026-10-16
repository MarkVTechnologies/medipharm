import { useCallback, useEffect, useState } from "react";
import { cartKey, EMPTY_CART, heldKey, readStore, writeStore, type Cart, type HeldSale } from "../lib/cart";
import { formatNaira } from "../lib/money";

/**
 * Cart persisted in sessionStorage keyed by tenant + user (FR-1.4): it
 * survives refresh, session expiry and re-login. Held sales persist in
 * localStorage so a counter interruption never loses a basket (FR-3.8).
 */
export function useCart(tenantId: number, userId: number) {
  const key = cartKey(tenantId, userId);
  const hKey = heldKey(tenantId, userId);

  const [cart, setCart] = useState<Cart>(() => readStore(sessionStorage, key, EMPTY_CART));
  const [held, setHeld] = useState<HeldSale[]>(() => readStore(localStorage, hKey, []));

  useEffect(() => writeStore(sessionStorage, key, cart), [key, cart]);
  useEffect(() => writeStore(localStorage, hKey, held), [hKey, held]);

  const clear = useCallback(() => setCart(EMPTY_CART), []);

  const hold = useCallback(
    (total: number) => {
      if (!cart.lines.length) return;
      const label = cart.customer?.name ?? `${cart.lines.length} item${cart.lines.length === 1 ? "" : "s"} · ${formatNaira(total)}`;
      setHeld((h) => [{ id: crypto.randomUUID(), held_at: new Date().toISOString(), label, cart }, ...h].slice(0, 20));
      setCart(EMPTY_CART);
    },
    [cart],
  );

  const resume = useCallback(
    (id: string, currentTotal: number) => {
      const target = held.find((h) => h.id === id);
      if (!target) return;
      setHeld((h) => {
        const rest = h.filter((x) => x.id !== id);
        // Swapping: an in-progress basket is held, never discarded.
        if (cart.lines.length) {
          const label = cart.customer?.name ?? `${cart.lines.length} items · ${formatNaira(currentTotal)}`;
          return [{ id: crypto.randomUUID(), held_at: new Date().toISOString(), label, cart }, ...rest];
        }
        return rest;
      });
      setCart(target.cart);
    },
    [held, cart],
  );

  const discardHeld = useCallback((id: string) => setHeld((h) => h.filter((x) => x.id !== id)), []);

  return { cart, setCart, clear, held, hold, resume, discardHeld };
}
