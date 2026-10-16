export type Role = "owner" | "pharmacist" | "assistant";
export type StockStatus = "in_stock" | "low" | "out";
export type Tier = "bronze" | "silver" | "gold" | "platinum";
export type PaymentMethod = "cash" | "card" | "transfer";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Tenant {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  licence_number: string | null;
  logo_url: string | null;
  vat_rate: number;
  currency: string;
  receipt_footer: string | null;
  tiers: { tier: Tier; min_spend: number; discount: number }[];
  plan: string;
  status: "trial" | "active" | "past_due" | "suspended";
  trial_ends_at: string | null;
  read_only: boolean;
}

export interface Batch {
  id: number;
  drug_id: number;
  drug?: { id: number; name: string; strength: string | null; form: string | null };
  batch_number: string;
  expiry_date: string;
  days_to_expiry: number;
  is_expired: boolean;
  quantity_received: number;
  quantity_remaining: number;
  cost_price: number;
  value_at_cost: number;
  supplier_id: number | null;
  supplier?: { id: number; name: string } | null;
  purchase_order_id: number | null;
  received_at: string | null;
  expired_flagged_at: string | null;
  written_off_at: string | null;
}

export interface Drug {
  id: number;
  name: string;
  generic_name: string | null;
  brand: string | null;
  nafdac_number: string | null;
  category: string | null;
  form: string | null;
  strength: string | null;
  pack_size: string | null;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  tax_rate: number | null;
  reorder_level: number;
  preferred_supplier_id: number | null;
  preferred_supplier?: { id: number; name: string } | null;
  is_active: boolean;
  stock_on_hand: number | null;
  stock_status: StockStatus | null;
  batches?: Batch[];
  created_at: string;
  updated_at: string;
}

export interface PosDrug {
  id: number;
  name: string;
  generic_name: string | null;
  brand: string | null;
  strength: string | null;
  form: string | null;
  pack_size: string | null;
  barcode: string | null;
  selling_price: number;
  tax_rate: number;
  stock_on_hand: number;
  stock_status: StockStatus;
  fefo_batch: { id: number; batch_number: string; expiry_date: string; quantity_remaining: number } | null;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  tier: Tier;
  discount: number;
  visit_count: number;
  lifetime_spend: number;
  last_visit_at: string | null;
  is_active: boolean;
  recent_sales?: Sale[];
  created_at: string;
}

export interface SaleItem {
  id: number;
  drug_id: number;
  drug_name?: string;
  strength?: string | null;
  batch_id: number;
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_amount: number;
}

export interface Sale {
  id: number;
  reference: string;
  customer_id: number | null;
  customer?: { id: number; code: string; name: string; phone: string | null; tier: Tier } | null;
  served_by?: { id: number; name: string } | null;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  payment_method: PaymentMethod;
  amount_tendered: number | null;
  change_given: number;
  status: "completed" | "voided";
  items_count?: number;
  items?: SaleItem[];
  voided_at: string | null;
  voided_by?: { id: number; name: string } | null;
  void_reason: string | null;
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  is_active: boolean;
  open_orders_count?: number;
  created_at: string;
}

export type PoStatus = "draft" | "sent" | "partial" | "received" | "cancelled";

export interface PurchaseOrderItem {
  id: number;
  drug_id: number;
  drug_name: string;
  strength: string | null;
  pack_size: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_outstanding: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: number;
  reference: string;
  supplier_id: number;
  supplier?: { id: number; name: string; phone?: string | null; email?: string | null };
  status: PoStatus;
  expected_date: string | null;
  total: number;
  notes: string | null;
  created_by?: { id: number; name: string };
  items_count?: number;
  items?: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  plan: string | null;
  amount: number;
  reference: string;
  status: "pending" | "success" | "failed";
  paid_at: string | null;
  created_at: string;
}

export interface DashboardData {
  today: { revenue: number; transactions: number; average_basket: number; yesterday_revenue: number };
  stock: {
    low_stock_count: number;
    out_of_stock_count: number;
    expiring_count: number;
    expiring_value: number;
    expired_count: number;
    expired_value: number;
    sku_count: number;
  };
  trend: { label: string; revenue: number; transactions: number }[];
  low_stock: {
    drug_id: number;
    name: string;
    strength: string | null;
    form: string | null;
    reorder_level: number;
    stock_on_hand: number;
    preferred_supplier_id: number | null;
    status: StockStatus;
  }[];
  expiring: {
    batch_id: number;
    drug_id: number;
    drug_name: string;
    strength: string | null;
    batch_number: string;
    expiry_date: string;
    days_left: number;
    quantity_remaining: number;
    value_at_cost: number;
    is_expired: boolean;
  }[];
  recent_sales: {
    id: number;
    reference: string;
    customer_name: string | null;
    served_by: string | null;
    items_count: number;
    total: number;
    payment_method: PaymentMethod;
    status: "completed" | "voided";
    created_at: string;
  }[];
  generated_at: string;
  onboarding: Onboarding | null;
}

export interface Onboarding {
  steps: {
    key: string;
    title: string;
    description: string;
    done: boolean;
    optional: boolean;
    action: { label: string; to: string };
  }[];
  completed: number;
  total: number;
  complete: boolean;
}

export interface ReportData {
  summary: Record<string, number | Record<string, number>>;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
}
