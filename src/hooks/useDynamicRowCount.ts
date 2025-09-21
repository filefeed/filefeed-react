import { useCallback, useEffect, useState } from "react";

export function useDynamicRowCount() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [maxRows, setMaxRows] = useState(18);

  const setContainerRef = useCallback((el: HTMLElement | null) => {
    setContainer(el);
  }, []);

  useEffect(() => {
    if (!container) return;

    const calculate = () => {
      const containerHeight = container.clientHeight;
      const headerHeight = 24 + 2; // 24px row height + borders
      const rowHeight = 24 + 1; // 24px row height + border
      const padding = 32; // Container padding
      const availableHeight = containerHeight - headerHeight - padding;
      const calculatedRows = Math.floor(availableHeight / rowHeight);
      const newMaxRows = Math.max(5, Math.min(50, calculatedRows));
      setMaxRows(newMaxRows);
    };

    calculate();
    const ro = new ResizeObserver(calculate);
    ro.observe(container);
    return () => ro.disconnect();
  }, [container]);

  return { setContainerRef, maxRows } as const;
}
