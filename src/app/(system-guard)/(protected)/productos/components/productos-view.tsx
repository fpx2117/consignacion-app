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
  Plus,
  Package,
  Loader2,
  TrendingUp,
  AlertCircle,
  LayoutGrid,
  Search,
  CircleDollarSign,
  ExternalLink,
  MoreVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { CreateProductoDialog } from "./create-producto-dialog";
import { FacturaProveedorDialog } from "./factura-proveedor-dialog";
import { StatCard } from "./productos-stats";
import { PaginationControls, SortableHead } from "./productos-table-chrome";
import { MobileProductCard, ProductoRow } from "./producto-row";
import { useProductosData } from "./use-productos-data";
import { useProductosConfiguracion } from "./use-productos-configuracion";
import {
  COLUMNA_VENCIMIENTO,
  type ProductoViewItem,
  type SortConfig,
  type SortKey,
} from "./productos-view-types";
import { ProductosFilters } from "./productos-filters";
import { DownloadInventoryButton } from "@/components/reports/download-inventory-button";
import HistoryReportDialog from "./historial-report-dialog";
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

  // --- Lógica de Negocio ---
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
            string | number | null | undefined;
          bValue = b[sortConfig.key as keyof ProductoViewItem] as
            string | number | null | undefined;
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div className="space-y-1.5">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Package className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            Inventario
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl">
            Gestiona tu catálogo, controla existencias y supervisá la
            rentabilidad en tiempo real.
          </p>
        </div>

        {/* â”€â”€ BOTONES HEADER â”€â”€ */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* DESKTOP: todos los botones visibles */}
          <div className="hidden sm:flex items-center gap-2">
            {/* Grupo secundario */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50">
              <HistoryReportDialog />
              <DownloadInventoryButton />
              <FacturaProveedorDialog onCreated={reload} />
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-9 px-3 rounded-lg font-bold text-sm hover:bg-background hover:text-primary transition-all"
              >
                <Link
                  href={catalogoHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Catálogo
                </Link>
              </Button>
            </div>
            {/* CTA principal */}
            <CreateProductoDialog
              onCreated={reload}
              onCategoriasChanged={reload}
              trigger={
                <Button
                  size="lg"
                  className="h-10 px-5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
                >
                  <Plus className="h-4 w-4 mr-2 stroke-[3px]" />
                  Nuevo Producto
                </Button>
              }
            />
          </div>

          {/* MOBILE: CTA principal izquierda, ⋯ derecha */}
          <div className="flex sm:hidden items-center justify-between w-full">
            {/* CTA principal siempre visible */}
            <CreateProductoDialog
              onCreated={reload}
              onCategoriasChanged={reload}
              trigger={
                <Button
                  size="default"
                  className="h-10 px-4 rounded-xl font-bold shadow-lg shadow-primary/20"
                >
                  <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" />
                  Nuevo
                </Button>
              }
            />
            {/* Dropdown ⋯ — siempre al extremo derecho */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-border/60"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="bottom"
                className="w-56 rounded-xl border-border/60 shadow-xl p-1.5 space-y-0.5"
              >
                {/* Auditoría — [&_span]:!inline fuerza el texto aunque tenga hidden sm:inline */}
                <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none [&_span]:!inline">
                  <HistoryReportDialog />
                </div>
                {/* Ver PDF */}
                <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none">
                  <DownloadInventoryButton />
                </div>
                <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none">
                  <FacturaProveedorDialog onCreated={reload} />
                </div>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  asChild
                  className="rounded-lg font-semibold cursor-pointer h-10"
                >
                  <Link
                    href={catalogoHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5"
                  >
                    <ExternalLink className="h-4 w-4 text-primary" />
                    Ver Catálogo público
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

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

