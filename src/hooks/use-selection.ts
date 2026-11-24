"use client";

import { useCallback, useMemo, useState } from "react";

/** Row selection state for bulk actions in admin tables. */
export function useSelection(ids: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const visible = useMemo(() => new Set(ids), [ids]);
  const current = useMemo(() => [...selected].filter((id) => visible.has(id)), [selected, visible]);
  const allSelected = ids.length > 0 && current.length === ids.length;
  const someSelected = current.length > 0 && !allSelected;
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = useCallback(() => setSelected(allSelected ? new Set() : new Set(ids)), [allSelected, ids]);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected: current, isSelected: (id: string) => selected.has(id), toggle, toggleAll, clear, allSelected, someSelected };
}
