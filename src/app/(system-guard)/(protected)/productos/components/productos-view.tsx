"use client";

import * as React from "react";
import { useSucursalStore } from "@/store/useSucursalStore";
import { formatMoney } from "@/lib/date-format/utils-format";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Loader2,
  TrendingUp,
  AlertCircle,
  LayoutGrid,
  Search,
  CircleDollarSign,
  Eye,
  EyeOff,
} from "lucide-react";

import { StatCard } from "./productos-stats";
import { PaginationControls, SortableHead } from "./productos-table-chrome";
import { MobileProductCard, ProductoRow } from "./producto-row";
import { useProductosData } from "./use-productos-data";
import { useProductosConfiguracion } from "./use-productos-configuracion";
import { useProductosDerivados } from "./use-productos-derivados";
import { ProductosHeader } from "./productos-header";
import { COLUMNA_VENCIMIENTO, type SortConfig } from "./productos-view-types";
import { ProductosFilters } from "./productos-filters";
import { ProductosAgotadosSheetContent } from "./productos-agotados-sheet-content";
import { ProductosBajoStockSheetContent } from "./productos-bajo-stock-sheet-content";
import { ColumnasProductoPicker } from "./columnas-producto-picker";


export function ProductosView() {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const catalogoHref = activeSucursalId
    ? `/lista?sucursalId=${activeSucursalId}`
    : "/lista";

  // Estados para Filtros
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = React.useState("all");
  const [expiryFilter, setExpiryFilter] = React.useState("all");

  // Paginación
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "nombre",
    direction: "asc",
  });
  const [showSensitiveData, setShowSensitiveData] = React.useState(false);
  const [stockDrawer, setStockDrawer] = React.useState<"low" | "out" | null>(
    null,
  );

  const {
    items,
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
  } = useProductosData({
    activeSucursalId,
    itemsPerPage,
    debouncedQ,
    categoryFilter,
  });

  const {
    columnasAtributos,
    rubroNegocio,
    candidatasAtributos,
    columnasAtributosGenericos,
    labelAtributoFijo,
    mostrarNombreProducto,
    handleColumnasAtributosChange,
  } = useProductosConfiguracion({ activeSucursalId, statsItems });

  // Debounce de búsqueda (400ms)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);



  // Al cambiar de sucursal: resetear filtros Y recargar en un solo efecto
  const prevSucursalRef = React.useRef(activeSucursalId);
  React.useEffect(() => {
    const sucursalChanged = prevSucursalRef.current !== activeSucursalId;
    prevSucursalRef.current = activeSucursalId;

    if (sucursalChanged) {
      setCategoryFilter("all");
      setSubCategoryFilter("all");
      setStockFilter("all");
      setExpiryFilter("all");
      setQ("");
      setDebouncedQ("");
      setServerPage(1);
      // Cargar con filtros limpios directamente (sin depender de estados recién seteados)
      load(1, "", null, itemsPerPage);
    }
  }, [activeSucursalId, load, itemsPerPage, setServerPage]);

  // Al cambiar filtros de búsqueda/categoría (sin cambio de sucursal)
  React.useEffect(() => {
    load(1, debouncedQ, serverCategoriaId, itemsPerPage);
    setServerPage(1);
  }, [debouncedQ, serverCategoriaId, itemsPerPage, load, setServerPage]);

  const {
    isLowStock,
    isOutOfStock,
    filtered,
    sorted,
    handleSort,
    stats,
    lowStockItems,
    outOfStockItems,
  } = useProductosDerivados({
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
  });

  const renderStockDrawerContent = () => {
    if (stockDrawer === "out") {
      return (
        <ProductosAgotadosSheetContent
          productos={outOfStockItems}
          onStockUpdated={reload}
        />
      );
    }

    if (stockDrawer === "low") {
      return (
        <ProductosBajoStockSheetContent
          productos={lowStockItems}
          onStockUpdated={reload}
        />
      );
    }

    return null;
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-6 md:p-10 pb-20 text-foreground selection:bg-primary/20 font-sans">
      {/* HEADER */}
      <ProductosHeader catalogoHref={catalogoHref} reload={reload} />

      {/* STATS */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Indicadores del inventario
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSensitiveData((prev) => !prev)}
          className="h-8 rounded-lg text-xs font-semibold"
        >
          {showSensitiveData ? (
            <>
              <EyeOff className="h-3.5 w-3.5 mr-1.5" /> Ocultar sensibles
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Mostrar sensibles
            </>
          )}
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Items"
          value={stats.total}
          icon={LayoutGrid}
          color="default"
        />
        <StatCard
          label="Stock Bajo"
          value={stats.lowStock}
          icon={AlertCircle}
          color="orange"
          trend={stats.lowStock > 0 ? "Atención requerida" : "Todo en orden"}
          trendUp={stats.lowStock === 0}
          clickable={true}
          onClick={() => setStockDrawer("low")}
        />
        <StatCard
          label="Agotados"
          value={stats.outOfStock}
          icon={Package}
          color="red"
          trend={stats.outOfStock > 0 ? "Reponer urgente" : "Stock saludable"}
          trendUp={stats.outOfStock === 0}
          clickable={true}
          onClick={() => setStockDrawer("out")}
        />
        <StatCard
          label="Valuación Total"
          value={showSensitiveData ? formatMoney(stats.valorVenta) : "••••••"}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          label="Utilidad Est."
          value={showSensitiveData ? formatMoney(stats.utilidad) : "••••••"}
          icon={CircleDollarSign}
          color="blue"
        />
      </div>

      <div className="space-y-4">
        {/* FILTROS & CONTROLES */}
        <Card className="p-1 bg-card/50 backdrop-blur-sm border-border/60 shadow-sm rounded-2xl">
          <ProductosFilters
            query={q}
            setQuery={setQ}
            stockFilter={stockFilter}
            setStockFilter={setStockFilter}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            subCategoryFilter={subCategoryFilter}
            setSubCategoryFilter={setSubCategoryFilter}
            expiryFilter={expiryFilter}
            setExpiryFilter={setExpiryFilter}
            categories={allCategories}
          />
        </Card>

        {/* Selector de columnas dinámicas (atributosExtra) — solo tabla desktop */}
        <div className="hidden md:flex justify-end">
          <ColumnasProductoPicker
            candidatas={candidatasAtributos}
            seleccionadas={columnasAtributos}
            onChange={handleColumnasAtributosChange}
            rubroNegocio={rubroNegocio}
          />
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="h-[400px] flex flex-col items-center justify-center gap-4 bg-card/30 rounded-2xl border border-border/50">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            <span className="text-sm font-medium text-muted-foreground animate-pulse">
              Cargando inventario...
            </span>
          </div>
        )}

        {/* CONTENIDO PRINCIPAL (Desktop TABLE + Mobile CARDS) */}
        {!loading && (
          <>
            {/* --- VISTA DESKTOP (TABLA) --- */}
            <div className="hidden md:block">
              <Card className="border-border/60 bg-card/40 backdrop-blur-xl shadow-sm rounded-2xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-b border-border/60">
                      {/* Grupo identidad: qué es el producto */}
                      <SortableHead
                        label="Producto"
                        sortKey="nombre"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className="pl-6 w-[30%]"
                      />
                      {columnasAtributosGenericos.map((clave) => (
                        <SortableHead
                          key={clave}
                          label={labelAtributoFijo.get(clave) ?? clave}
                          sortKey={`attr:${clave}`}
                          currentSort={sortConfig}
                          onSort={handleSort}
                          className="text-center capitalize"
                        />
                      ))}
                      <SortableHead
                        label="Categoría / Subcat."
                        sortKey="categoria"
                        currentSort={sortConfig}
                        onSort={handleSort}
                      />

                      {/* Grupo comercial/operativo: cómo está en el negocio */}
                      <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                        Estado
                      </TableHead>
                      <SortableHead
                        label="Stock"
                        sortKey="stockDisponibleUnits"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className="text-center"
                      />
                      {columnasAtributos.includes(COLUMNA_VENCIMIENTO) && (
                        <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                          Vencimiento
                        </TableHead>
                      )}
                      <SortableHead
                        label="Precio"
                        sortKey="precioVenta"
                        currentSort={sortConfig}
                        onSort={handleSort}
                        className="text-right pr-6"
                      />
                      <TableHead className="w-[180px] text-right pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground/70">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((p, idx) => (
                      <ProductoRow
                        key={p.id}
                        p={p}
                        idx={idx}
                        load={reload}
                        isLow={isLowStock(p)}
                        isOut={isOutOfStock(p)}
                        columnasAtributos={columnasAtributos}
                        mostrarNombreProducto={mostrarNombreProducto}
                      />
                    ))}
                    {sorted.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7 + columnasAtributos.length}
                          className="h-[300px] text-center"
                        >
                          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-60">
                            <Search className="h-12 w-12 stroke-[1.5]" />
                            <p className="text-lg font-medium">
                              No se encontraron productos
                            </p>
                            <Button
                              variant="link"
                              onClick={() => {
                                setQ("");
                                setStockFilter("all");
                                setCategoryFilter("all");
                                setExpiryFilter("all");
                              }}
                            >
                              Limpiar filtros
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* PAGINACIÓN (Desktop) */}
                {filtered.length > 0 && (
                  <PaginationControls
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={(v) => {
                      setItemsPerPage(v);
                      load(1, debouncedQ, serverCategoriaId, v);
                      setServerPage(1);
                    }}
                    totalItems={serverTotal || filtered.length}
                    currentItems={sorted.length}
                    serverPage={serverPage}
                    serverTotalPages={serverTotalPages}
                    onServerPrev={() => {
                      load(
                        Math.max(1, serverPage - 1),
                        debouncedQ,
                        serverCategoriaId,
                        itemsPerPage,
                      );
                      setServerPage((p) => Math.max(1, p - 1));
                    }}
                    onServerNext={() => {
                      load(
                        Math.min(serverTotalPages, serverPage + 1),
                        debouncedQ,
                        serverCategoriaId,
                        itemsPerPage,
                      );
                      setServerPage((p) => Math.min(serverTotalPages, p + 1));
                    }}
                  />
                )}
              </Card>
            </div>

            {/* --- VISTA MOBILE (CARDS) --- */}
            <div className="md:hidden space-y-4">
              {sorted.map((p, idx) => (
                <MobileProductCard
                  key={p.id}
                  p={p}
                  idx={idx}
                  load={reload}
                  isLow={isLowStock(p)}
                  isOut={isOutOfStock(p)}
                  columnasAtributos={columnasAtributos}
                  labelAtributoFijo={labelAtributoFijo}
                />
              ))}

              {sorted.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-60 py-20 text-center">
                  <Search className="h-12 w-12 stroke-[1.5]" />
                  <p className="text-lg font-medium">
                    No se encontraron productos
                  </p>
                  <Button
                    variant="link"
                    onClick={() => {
                      setQ("");
                      setStockFilter("all");
                      setCategoryFilter("all");
                      setExpiryFilter("all");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              )}

              {/* PAGINACIÓN (Mobile) */}
              {filtered.length > 0 && (
                <PaginationControls
                  itemsPerPage={itemsPerPage}
                  setItemsPerPage={(v) => {
                    setItemsPerPage(v);
                    load(1, debouncedQ, serverCategoriaId, v);
                    setServerPage(1);
                  }}
                  totalItems={serverTotal || filtered.length}
                  currentItems={sorted.length}
                  isMobile
                  serverPage={serverPage}
                  serverTotalPages={serverTotalPages}
                  onServerPrev={() => {
                    load(
                      Math.max(1, serverPage - 1),
                      debouncedQ,
                      serverCategoriaId,
                      itemsPerPage,
                    );
                    setServerPage((p) => Math.max(1, p - 1));
                  }}
                  onServerNext={() => {
                    load(
                      Math.min(serverTotalPages, serverPage + 1),
                      debouncedQ,
                      serverCategoriaId,
                      itemsPerPage,
                    );
                    setServerPage((p) => Math.min(serverTotalPages, p + 1));
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Sheet de detalle de KPI de stock */}
      {/* ── Sheet KPI de stock — responsive: bottom en mobile, right en desktop ── */}
      <Sheet
        open={stockDrawer !== null}
        onOpenChange={(open) => !open && setStockDrawer(null)}
      >
        <SheetContent
          side="bottom"
          overlayClassName="backdrop-blur-none sm:hidden"
          className={cn(
            "sm:hidden rounded-t-3xl p-0 flex flex-col",
            "max-h-[90dvh] h-auto",
          )}
        >
          {renderStockDrawerContent()}
        </SheetContent>
        <SheetContent
          side="right"
          overlayClassName="hidden sm:block sm:backdrop-blur-[2px]"
          className={cn(
            "hidden sm:flex flex-col",
            "w-[380px] max-w-[90vw] p-0 h-full overflow-x-hidden",
          )}
        >
          {renderStockDrawerContent()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// --- SUB COMPONENTS ---

