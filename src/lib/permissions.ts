/**
 * Role-based access control definitions.
 * Permissions are stored in the database (Role ↔ Permission) and are editable by a Super Admin.
 * This file defines the canonical permission keys and the default grants used by the seed.
 * Enforcement happens on the server (see lib/auth/guards.ts); the UI only hides what the server would reject.
 */

export const PERMISSIONS = {
  "dashboard.view": { name: "View dashboard & analytics", group: "General" },
  "products.view": { name: "View products", group: "Catalog" },
  "products.manage": { name: "Create, edit and delete products", group: "Catalog" },
  "catalog.manage": { name: "Manage categories, brands, attributes & collections", group: "Catalog" },
  "inventory.view": { name: "View inventory", group: "Inventory" },
  "inventory.manage": { name: "Adjust stock", group: "Inventory" },
  "orders.view": { name: "View orders", group: "Sales" },
  "orders.manage": { name: "Update orders, returns and invoices", group: "Sales" },
  "payments.view": { name: "View payments", group: "Sales" },
  "payments.manage": { name: "Record COD collections & process refunds", group: "Sales" },
  "customers.view": { name: "View customers", group: "Customers" },
  "customers.manage": { name: "Edit and block customers", group: "Customers" },
  "coupons.manage": { name: "Manage coupons", group: "Marketing" },
  "reviews.manage": { name: "Moderate reviews", group: "Marketing" },
  "content.manage": { name: "Manage banners, homepage, blog & pages", group: "Content" },
  "messages.manage": { name: "Contact messages & newsletter", group: "Content" },
  "shipping.manage": { name: "Manage shipping zones and methods", group: "Settings" },
  "settings.manage": { name: "Manage general store settings", group: "Settings" },
  "settings.critical": { name: "Manage critical settings (maintenance, currency, tax)", group: "Settings" },
  "staff.manage": { name: "Manage staff accounts and roles", group: "System" },
  "logs.view": { name: "View activity logs", group: "System" },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

export const DEFAULT_ROLES: Record<string, { name: string; description: string; permissions: PermissionKey[] }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full access, including staff accounts and critical settings.",
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: "Admin",
    description: "Runs the store day to day. Cannot manage staff or critical settings.",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "staff.manage" && p !== "settings.critical"),
  },
  MANAGER: {
    name: "Manager",
    description: "Catalog, sales and marketing operations.",
    permissions: [
      "dashboard.view",
      "products.view",
      "products.manage",
      "catalog.manage",
      "inventory.view",
      "inventory.manage",
      "orders.view",
      "orders.manage",
      "payments.view",
      "customers.view",
      "coupons.manage",
      "reviews.manage",
      "content.manage",
      "messages.manage",
      "shipping.manage",
    ],
  },
  PRODUCT_MANAGER: {
    name: "Product Manager",
    description: "Manages the catalog. No access to payments or settings.",
    permissions: ["dashboard.view", "products.view", "products.manage", "catalog.manage", "inventory.view"],
  },
  INVENTORY_MANAGER: {
    name: "Inventory Manager",
    description: "Tracks and adjusts stock levels.",
    permissions: ["dashboard.view", "products.view", "inventory.view", "inventory.manage"],
  },
  ORDER_MANAGER: {
    name: "Order Manager",
    description: "Processes orders, returns and COD collections. Cannot modify settings.",
    permissions: [
      "dashboard.view",
      "orders.view",
      "orders.manage",
      "payments.view",
      "customers.view",
      "inventory.view",
    ],
  },
  CONTENT_MANAGER: {
    name: "Content Manager",
    description: "Manages banners, homepage, blog, reviews and messages.",
    permissions: ["dashboard.view", "content.manage", "reviews.manage", "messages.manage"],
  },
};

export interface PermissionSubject {
  roles: string[];
  permissions: string[];
}

export function hasPermission(subject: PermissionSubject | null | undefined, key: PermissionKey): boolean {
  if (!subject) return false;
  if (subject.roles.includes(SUPER_ADMIN_ROLE)) return true;
  return subject.permissions.includes(key);
}

export function hasAnyPermission(subject: PermissionSubject | null | undefined, keys: PermissionKey[]): boolean {
  return keys.some((k) => hasPermission(subject, k));
}
