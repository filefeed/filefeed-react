import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Ctx = {
  open: boolean;
  openPortal: () => void;
  closePortal: () => void;
  portalContainer: HTMLDivElement | null;
};

export const FilefeedContext = createContext<Ctx | null>(null);

export function FilefeedProvider(props: { publishableKey?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Create and own a portal container
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("data-filefeed-portal", "true");
    document.body.appendChild(el);
    containerRef.current = el;
    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
      containerRef.current = null;
    };
  }, []);

  const openPortal = useCallback(() => {
    setOpen(true);
  }, []);

  const closePortal = useCallback(() => {
    setOpen(false);
  }, []);

  const value = useMemo<Ctx>(() => ({
    open,
    openPortal,
    closePortal,
    portalContainer: containerRef.current,
  }), [open, openPortal, closePortal]);

  return (
    <FilefeedContext.Provider value={value}>
      {props.children}
      {/* Consumers render UI into this container via portal when open === true */}
      {open && containerRef.current
        ? createPortal(<div id="filefeed-portal-root" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999 }} />, containerRef.current)
        : null}
    </FilefeedContext.Provider>
  );
}


