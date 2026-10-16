import type { Role } from "./types";

// Capability matrix from FR-1.5.
const MATRIX = {
  sell: ["owner", "pharmacist", "assistant"],
  manageInventory: ["owner", "pharmacist"],
  manageCustomers: ["owner", "pharmacist", "assistant"],
  manageSuppliers: ["owner", "pharmacist"],
  receivePurchaseOrders: ["owner", "pharmacist"],
  viewReports: ["owner", "pharmacist"],
  voidSales: ["owner", "pharmacist"],
  manageTenant: ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof MATRIX;

export function can(role: Role | undefined, capability: Capability): boolean {
  return !!role && (MATRIX[capability] as readonly Role[]).includes(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  pharmacist: "Pharmacist",
  assistant: "Assistant",
};
