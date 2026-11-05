// Valores derivados de la lista de productos: búsqueda, filtros, orden y KPIs.
//
// Extraído de productos-view.tsx (M21) sin cambios de comportamiento.

import * as React from "react";

import type { ProductoViewItem, SortConfig, SortKey } from "./productos-view-types";

export type UseProductosDerivadosOptions = {
  items: ProductoViewItem[];
  statsItems: ProductoViewItem[];
  serverTotal: number;
  q: string;
  stockFilter: string;
  categoryFilter: string;
  subCategoryFilter: string;
  expiryFilter: string;
  sortConfig: SortConfig;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig>>;
};

export function useProductosDerivados({
  items,
  statsItems,
  serverTotal,
  q,
  stockFilter,
  categoryFilter,
  subCategoryFilter,
  expiryFilter,
  sortConfig,
  setSortConfig,
}: UseProductosDerivadosOptions) {
  const isLowStock = React.useCallback((p: ProductoViewItem) => {
    const min = p.stockMinUnits > 0 ? p.stockMinUnits : 5;
    return p.stockDisponibleUnits <= min && p.stockDisponibleUnits > 0;
  }, []);

  const isOutOfStock = React.useCallback((p: ProductoViewItem) => {
    return p.stockDisponibleUnits <= 0;
  }, []);

  // Filtrado
  const filtered = React.useMemo(() => {
    if (!items) return []; // Guard
    return items.filter((p) => {
      const term = q.trim().toLowerCase();
      const matchesQuery =
        p.nombre.toLowerCase().includes(term) ||
        p.id.toString().includes(term) ||
        p.categoria?.nombre.toLowerCase().includes(term) ||
        (p.codigoBarra && p.codigoBarra.toLowerCase().includes(term));

      const matchesStock =
        stockFilter === "all"
          ? true
          : stockFilter === "low"
            ? isLowStock(p)
            : stockFilter === "out"
              ? isOutOfStock(p)
              : stockFilter === "available"
                ? p.stockDisponibleUnits > 0
                : true;

      const matchesCategory =
        categoryFilter === "all" || p.categoria?.nombre === categoryFilter;
      const matchesSubCategory =
        subCategoryFilter === "all" ||
        p.subcategoria?.nombre === subCategoryFilter;

      let matchesExpiry = true;
      if (expiryFilter !== "all") {
        if (!p.fechaVencimiento && expiryFilter === "none")
          matchesExpiry = true;
        else if (!p.fechaVencimiento) matchesExpiry = false;
        else {
          const venc = new Date(p.fechaVencimiento);
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          if (expiryFilter === "expired") matchesExpiry = venc < hoy;
          else if (expiryFilter === "soon") {
            const diff = (venc.getTime() - hoy.getTime()) / (1000 * 3600 * 24);
            matchesExpiry = diff >= 0 && diff <= 7;
          } else if (expiryFilter === "none") matchesExpiry = false;
        }
      }
      return (
        matchesQuery &&
        matchesStock &&
        matchesCategory &&
        matchesSubCategory &&
        matchesExpiry
      );
    });
  }, [
    items,
    q,
    stockFilter,
    categoryFilter,
    subCategoryFilter,
    expiryFilter,
    isLowStock,
    isOutOfStock,
  ]);

  // Ordenamiento
  const sorted = React.useMemo(() => {
    const sortableItems = [...filtered];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue: string | number | null | undefined;
        let bValue: string | number | null | undefined;

        if (sortConfig.key.startsWith("attr:")) {
          const clave = sortConfig.key.slice(5);
          aValue =
            (a.atributosExtra as Record<string, string> | null | undefined)?.[
              clave
            ] ?? "";
          bValue =
            (b.atributosExtra as Record<string, string> | null | undefined)?.[
              clave
            ] ?? "";
        } else if (sortConfig.key === "categoria") {
          aValue = a.categoria?.nombre || "";
          bValue = b.categoria?.nombre || "";
        } else {
          aValue = a[sortConfig.key as keyof ProductoViewItem] as
            | string
            | number
            | null
            | undefined;
          bValue = b[sortConfig.key as keyof ProductoViewItem] as
            | string
            | number
            | null
            | undefined;
        }

        const comparableA = aValue ?? "";
        const comparableB = bValue ?? "";

        if (comparableA < comparableB)
          return sortConfig.direction === "asc" ? -1 : 1;
        if (comparableA > comparableB)
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filtered, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const stats = React.useMemo(
    () => ({
      // total usa el count del servidor (más preciso que items.length que es la página actual)
      total: serverTotal || items?.length || 0,
      lowStock: statsItems?.filter((i) => isLowStock(i)).length || 0,
      outOfStock: statsItems?.filter((i) => isOutOfStock(i)).length || 0,
      valorVenta:
        statsItems?.reduce(
          (acc, i) => acc + Number(i.precioVenta) * i.stockDisponibleUnits,
          0,
        ) || 0,
      utilidad:
        statsItems?.reduce(
          (acc, i) =>
            acc +
            (Number(i.precioVenta) - Number(i.precioCosto)) *
              i.stockDisponibleUnits,
          0,
        ) || 0,
    }),
    [items, serverTotal, statsItems, isLowStock, isOutOfStock],
  );

  const lowStockItems = React.useMemo(
    () => statsItems?.filter((item) => isLowStock(item)) ?? [],
    [statsItems, isLowStock],
  );

  const outOfStockItems = React.useMemo(
    () => statsItems?.filter((item) => isOutOfStock(item)) ?? [],
    [statsItems, isOutOfStock],
  );

  return {
    isLowStock,
    isOutOfStock,
    filtered,
    sorted,
    handleSort,
    stats,
    lowStockItems,
    outOfStockItems,
  };
}
