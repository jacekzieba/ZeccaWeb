import { useCallback, useState } from "react";

/**
 * Szerokość kontenera wykresu. Callback ref podpina obserwatora za każdym razem,
 * gdy kontener się pojawi albo zostanie podmieniony — także wtedy, gdy wykres
 * najpierw nic nie renderował (za mało punktów) i dostał dane później.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(initialWidth: number, minWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const ref = useCallback(
    (node: T | null) => {
      if (!node) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) setWidth(Math.max(minWidth, entry.contentRect.width));
      });
      ro.observe(node);
      return () => ro.disconnect();
    },
    [minWidth],
  );
  return { ref, width };
}
