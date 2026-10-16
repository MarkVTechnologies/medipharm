import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import type { Capability } from "../../lib/permissions";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  capability?: Capability;
  end?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Counter",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/pos", label: "Point of sale", icon: ShoppingCart },
      { to: "/sales", label: "Sales history", icon: Receipt },
      { to: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    title: "Stock",
    items: [
      { to: "/inventory", label: "Inventory", icon: Boxes },
      { to: "/purchase-orders", label: "Purchase orders", icon: ClipboardList, capability: "receivePurchaseOrders" },
      { to: "/suppliers", label: "Suppliers", icon: Truck, capability: "manageSuppliers" },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, capability: "viewReports" },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];
