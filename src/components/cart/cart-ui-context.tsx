"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface CartUI {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
}

const CartUIContext = createContext<CartUI>({ isOpen: false, open: () => {}, close: () => {}, setOpen: () => {} });

export function CartUIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close, setOpen }), [isOpen, open, close]);
  return <CartUIContext.Provider value={value}>{children}</CartUIContext.Provider>;
}

export function useCartUI() {
  return useContext(CartUIContext);
}
