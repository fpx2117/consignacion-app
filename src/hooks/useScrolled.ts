"use client";

import * as React from "react";

/** true cuando la pagina esta scrolleada mas alla de `threshold`. Usado por
 * TopBar y SidebarDock para mostrar el mismo fondo solido/borde solo al
 * hacer scroll, en vez de mantener dos listeners con logica divergente. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
