// SWR hooks for server state. Mutations call api() then mutate() the
// affected keys — never refetch the whole page (spec §4.5).

import useSWR, { useSWRConfig } from "swr";
import { fetcher, qs, type Paginated } from "../lib/api";
import type {
  Customer,
  DashboardData,
  Drug,
  Payment,
  PurchaseOrder,
  ReportData,
  Sale,
  Supplier,
  Tenant,
  User,
} from "../lib/types";

export function useDashboard(range: "day" | "week" | "month") {
  return useSWR<{ data: DashboardData }>(`/api/dashboard${qs({ range })}`, fetcher, { refreshInterval: 60_000 });
}

export function useDrug(id: number | string | undefined) {
  return useSWR<{ data: Drug }>(id ? `/api/drugs/${id}` : null, fetcher);
}

export function useCustomer(id: number | string | undefined) {
  return useSWR<{ data: Customer }>(id ? `/api/customers/${id}` : null, fetcher);
}

export function useCustomers(params: Record<string, string | number | undefined>) {
  return useSWR<Paginated<Customer> & { meta: { tier_counts: Record<string, number> } }>(`/api/customers${qs(params)}`, fetcher, {
    keepPreviousData: true,
  });
}

export function useSale(id: number | string | null | undefined) {
  return useSWR<{ data: Sale }>(id ? `/api/sales/${id}` : null, fetcher);
}

export function useSuppliers(params: Record<string, string | number | undefined> = {}) {
  return useSWR<Paginated<Supplier>>(`/api/suppliers${qs({ per_page: 100, ...params })}`, fetcher, { keepPreviousData: true });
}

export function usePurchaseOrders(params: Record<string, string | number | undefined>) {
  return useSWR<Paginated<PurchaseOrder>>(`/api/purchase-orders${qs(params)}`, fetcher, { keepPreviousData: true });
}

export function usePurchaseOrder(id: number | string | undefined) {
  return useSWR<{ data: PurchaseOrder }>(id ? `/api/purchase-orders/${id}` : null, fetcher);
}

export interface ReorderGroup {
  supplier: { id: number; name: string } | null;
  items: {
    drug_id: number;
    name: string;
    strength: string | null;
    pack_size: string | null;
    stock_on_hand: number;
    reorder_level: number;
    suggested_quantity: number;
    unit_cost: number;
  }[];
}

export function useReorderSuggestions(enabled = true) {
  return useSWR<{ data: ReorderGroup[] }>(enabled ? "/api/purchase-orders/suggestions" : null, fetcher);
}

export function useReport(kind: string, params: Record<string, string | undefined>) {
  return useSWR<{ data: ReportData; meta: { from: string; to: string; truncated: boolean } }>(
    `/api/reports/${kind}${qs(params)}`,
    fetcher,
    { keepPreviousData: true },
  );
}

export function useStaff(enabled: boolean) {
  return useSWR<{ data: User[] }>(enabled ? "/api/settings/staff" : null, fetcher);
}

export interface BillingData {
  tenant: Tenant;
  subscription: { plan: string; status: string; starts_at: string | null; renews_at: string | null } | null;
  plans: { key: string; name: string; price: number; seats: number; skus: number | null }[];
  payments: Payment[];
  paystack_configured: boolean;
}

export function useBilling(enabled: boolean) {
  return useSWR<{ data: BillingData }>(enabled ? "/api/billing/subscription" : null, fetcher);
}

/** Revalidate every cached key whose URL starts with one of the prefixes. */
export function useInvalidate() {
  const { mutate } = useSWRConfig();
  return (...prefixes: string[]) =>
    mutate(
      (key) => {
        const k = Array.isArray(key) ? String(key[0]) : typeof key === "string" ? key : String(key ?? "");
        return prefixes.some((p) => k.startsWith(p) || k.includes(`"${p}`) || k.startsWith(`$inf$${p}`));
      },
      undefined,
      { revalidate: true },
    );
}
