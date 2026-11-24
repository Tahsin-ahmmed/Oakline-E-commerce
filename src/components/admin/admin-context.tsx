"use client";

import { createContext, useContext } from "react";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

export interface AdminContextValue {
  user: { id: string; name: string; email: string; roles: string[]; permissions: string[] };
  currency: string;
  siteName: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ value, children }: { value: AdminContextValue; children: React.ReactNode }) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return { ...ctx, can: (key: PermissionKey) => hasPermission(ctx.user, key) };
}
