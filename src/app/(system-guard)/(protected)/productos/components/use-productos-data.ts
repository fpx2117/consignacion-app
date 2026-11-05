// Carga de datos de la vista de productos.
//
// Extraído de productos-view.tsx (M21) sin cambios de comportamiento. Sólo se
// mueve el estado de datos y la función de carga; los efectos que disparan `load`
// quedan en la vista porque dependen del estado de filtros.

import * as React from "react";
import { toast } from "sonner";

import type { Categoria, Producto } from "@/lib/types";

import type { ProductoViewItem } from "./productos-view-types";

export type UseProductosDataOptions = {
  activeSucursalId: number | null;
  itemsPerPage: number;
  debouncedQ: string;
  categoryFilter: string;
};

export function useProductosData({
  activeSucursalId,
  itemsPerPage,
  debouncedQ,
  categoryFilter,
}: UseProductosDataOptions) {
  const [items, setItems] = React.useState<ProductoViewItem[]>([]);
  const [statsItems, setStatsItems] = React.useState<ProductoViewItem[]>([]);
  const [allCategories, setAllCategories] = React.useState<Categoria[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [serverTotal, setServerTotal] = React.useState(0);
  const [serverTotalPages, setServerTotalPages] = React.useState(1);
  const [serverPage, setServerPage] = React.useState(1);

  // Obtener categoriaId para enviar al servidor
  const serverCategoriaId = React.useMemo(() => {
    if (categoryFilter === "all") return null;
    const cat = allCategories.find((c) => c.nombre === categoryFilter);
    return cat?.id ?? null;
  }, [categoryFilter, allCategories]);

  const load = React.useCallback(
    async (
      page: number = 1,
      search: string = "",
      categoriaId: number | null = null,
      limit: number = 10,
    ) => {
      setLoading(true);
      try {
        // Cache buster para evitar respuestas stale al cambiar de sucursal
        const bust = `_t=${Date.now()}`;
        const sp = new URLSearchParams();
        sp.set("page", String(page));
        sp.set("limit", String(limit));
        if (search) sp.set("search", search);
        if (categoriaId) sp.set("categoriaId", String(categoriaId));
        sp.set("_t", String(Date.now()));

        const sid = activeSucursalId;
        const sucursalHeaders: HeadersInit = sid
          ? { "x-sucursal-id": String(sid) }
          : {};

        const [resPaginados, resCategorias, resStats] = await Promise.all([
          fetch(`/api/productos?${sp.toString()}`, {
            headers: { "Content-Type": "application/json", ...sucursalHeaders },
            cache: "no-store",
          }).then((r) => r.json()),
          fetch(`/api/categorias?${bust}`, {
            headers: sucursalHeaders,
            cache: "no-store",
          }).then((r) => r.json()),
          fetch(`/api/productos?${bust}`, {
            headers: sucursalHeaders,
            cache: "no-store",
          }).then((r) => r.json()),
        ]);

        const paginadosPayload = resPaginados;
        const activos = Array.isArray(paginadosPayload?.data)
          ? paginadosPayload.data.filter((p: Producto) => p.activo !== false)
          : [];
        setItems(activos);
        setServerTotal(paginadosPayload.total ?? 0);
        setServerTotalPages(paginadosPayload.totalPages ?? 1);
        setServerPage(paginadosPayload.page ?? page);

        const cats = Array.isArray(resCategorias)
          ? resCategorias
          : Array.isArray(resCategorias?.data)
            ? resCategorias.data
            : [];
        setAllCategories(cats);

        const statsRaw = Array.isArray(resStats)
          ? resStats
          : Array.isArray(resStats?.data)
            ? resStats.data
            : [];
        setStatsItems(statsRaw);
      } catch (e) {
        console.error("Error loading data:", e);
        toast.error("Error al sincronizar datos");
        setItems([]);
        setStatsItems([]);
      } finally {
        setLoading(false);
      }
    },
    [activeSucursalId],
  );

  // Wrapper sin argumentos para subcomponentes (reload de la página actual)
  const reload = React.useCallback(() => {
    load(serverPage, debouncedQ, serverCategoriaId, itemsPerPage);
  }, [load, serverPage, debouncedQ, serverCategoriaId, itemsPerPage]);

  return {
    items,
    setItems,
    statsItems,
    allCategories,
    loading,
    serverTotal,
    serverTotalPages,
    serverPage,
    setServerPage,
    serverCategoriaId,
    load,
    reload,
  };
}
