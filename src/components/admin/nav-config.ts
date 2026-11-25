import {
  BadgePercent,
  Boxes,
  CreditCard,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  ChartNoAxesCombined,
  type LucideIcon,
  Mail,
  MessageSquareText,
  Package,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Users,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, permission: "dashboard.view" },
      { label: "Traffic & sources", href: "/admin/analytics", icon: ChartNoAxesCombined, permission: "dashboard.view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart, permission: "orders.view" },
      { label: "Returns", href: "/admin/returns", icon: RotateCcw, permission: "orders.view" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "payments.view" },
      { label: "Customers", href: "/admin/customers", icon: Users, permission: "customers.view" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package, permission: "products.view" },
      { label: "Categories", href: "/admin/categories", icon: FolderTree, permission: "catalog.manage" },
      { label: "Brands & attributes", href: "/admin/catalog", icon: Boxes, permission: "catalog.manage" },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes, permission: "inventory.view" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Coupons", href: "/admin/coupons", icon: BadgePercent, permission: "coupons.manage" },
      { label: "Reviews", href: "/admin/reviews", icon: Star, permission: "reviews.manage" },
      { label: "Messages", href: "/admin/messages", icon: Mail, permission: "messages.manage" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Homepage & banners", href: "/admin/content", icon: ImageIcon, permission: "content.manage" },
      { label: "Blog", href: "/admin/blog", icon: FileText, permission: "content.manage" },
      { label: "Testimonials", href: "/admin/content/testimonials", icon: MessageSquareText, permission: "content.manage" },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Shipping", href: "/admin/shipping", icon: Truck, permission: "shipping.manage" },
      { label: "Store settings", href: "/admin/settings", icon: Settings, permission: "settings.manage" },
      { label: "Staff & roles", href: "/admin/staff", icon: ShieldCheck, permission: "staff.manage" },
      { label: "Activity log", href: "/admin/activity", icon: ScrollText, permission: "logs.view" },
    ],
  },
];

/** Human labels for breadcrumb segments. */
export const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  orders: "Orders",
  returns: "Returns",
  payments: "Payments",
  customers: "Customers",
  products: "Products",
  categories: "Categories",
  catalog: "Brands & attributes",
  inventory: "Inventory",
  coupons: "Coupons",
  reviews: "Reviews",
  messages: "Messages",
  content: "Homepage & banners",
  testimonials: "Testimonials",
  blog: "Blog",
  shipping: "Shipping",
  settings: "Settings",
  staff: "Staff & roles",
  activity: "Activity log",
  analytics: "Traffic & sources",
  new: "New",
  invoice: "Invoice",
};
