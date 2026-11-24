"use client";

import { createContext, useContext } from "react";

export interface StoreContextValue {
  siteName: string;
  currency: string;
  user: { id: string; name: string; email: string; isStaff: boolean } | null;
}

const StoreContext = createContext<StoreContextValue>({ siteName: "Oakline", currency: "BDT", user: null });

export function StoreProvider({ value, children }: { value: StoreContextValue; children: React.ReactNode }) {
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
