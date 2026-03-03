/* eslint-disable */
// @ts-nocheck
﻿"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Producto, Categoria } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { useSucursalStore } from "@/store/useSucursalStore";
import { formatMoney } from "@/lib/utils-format";
import { cn } from "@/lib/utils";
import { formatDateSafe, isExpired as dateExpired, isExpiringSoon } from "@/lib/utils-date";
import { getCategoryColorByKey, getCategoryColorByName } from "@/lib/category-colors";

// UI Components
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Icons
import {
  Plus,
  Pencil,
  Package,
  Loader2,
  TrendingUp,
  AlertCircle,
  LayoutGrid,
  ArrowRightLeft,
  Barcode,
  Trash2,
  Search,
  Calendar,
  CircleDollarSign,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Image as ImageIcon,
  ExternalLink,
  MoreVertical,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sub-components
import { CreateProductoDialog } from "./create-producto-dialog";
import { EditProductoDialog } from "./edit-producto-dialog";
import { AjustarStockDialog } from "./ajustar-stock-dialog";
import { ProductosFilters } from "./productos-filters";
import { DownloadInventoryButton } from "@/components/download-inventory-button";
import HistoryReportDialog from "./historial-report-dialog";

// --- Interfaces ---
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: "default" | "blue" | "emerald" | "orange" | "red";
}

type SortKey = "nombre" | "precioVenta" | "stockDisponibleUnits" | "categoria";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export function ProductosView() {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const [items, setItems] = React.useState<Producto[]>([]);
  const [allCategories, setAllCategories] = React.useState<Categoria[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Estados para Filtros
  const [q, setQ] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [expiryFilter, setExpiryFilter] = React.useState("all");

  // Paginación y Ordenamiento
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({ key: "nombre", direction: "asc" });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [resProductos, resCategorias] = await Promise.all([
        apiService.getProductos(),
        apiService.getCategorias()
      ]);

      const activos = Array.isArray(resProductos) ? resProductos.filter((p: Producto) => p.activo !== false) : [];
      setItems(activos);
      setAllCategories(Array.isArray(resCategorias) ? resCategorias : []);
    } catch (e) {
      console.error("Error loading data:", e);
      toast.error("Error al sincronizar datos");
      setItems([]);
      setAllCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load, activeSucursalId]);

  // --- Lógica de Negocio ---
  const isLowStock = React.useCallback((p: Producto) => {
    const min = p.stockMinUnits > 0 ? p.stockMinUnits : 5;
    return p.stockDisponibleUnits <= min && p.stockDisponibleUnits > 0;
  }, []);

  const isOutOfStock = React.useCallback((p: Producto) => {
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
        stockFilter === "all" ? true :
          stockFilter === "low" ? isLowStock(p) :
            stockFilter === "out" ? isOutOfStock(p) :
              stockFilter === "available" ? p.stockDisponibleUnits > 0 : true;

      const matchesCategory = categoryFilter === "all" || p.categoria?.nombre === categoryFilter;

      let matchesExpiry = true;
      if (expiryFilter !== "all") {
        if (!p.fechaVencimiento && expiryFilter === "none") matchesExpiry = true;
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
      return matchesQuery && matchesStock && matchesCategory && matchesExpiry;
    });
  }, [items, q, stockFilter, categoryFilter, expiryFilter, isLowStock, isOutOfStock]);

  // Ordenamiento
  const sorted = React.useMemo(() => {
    const sortableItems = [...filtered];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Producto];
        let bValue: any = b[sortConfig.key as keyof Producto];

        if (sortConfig.key === "categoria") {
          aValue = a.categoria?.nombre || "";
          bValue = b.categoria?.nombre || "";
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filtered, sortConfig]);

  // Paginación
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage, itemsPerPage]);

  // Reseteo de página al filtrar
  React.useEffect(() => {
    setCurrentPage(1);
  }, [q, stockFilter, categoryFilter, expiryFilter, itemsPerPage]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const stats = React.useMemo(() => ({
    total: items?.length || 0,
    lowStock: items?.filter(i => isLowStock(i)).length || 0,
    outOfStock: items?.filter(i => isOutOfStock(i)).length || 0,
    valorVenta: items?.reduce((acc, i) => acc + (Number(i.precioVenta) * i.stockDisponibleUnits), 0) || 0,
    utilidad: items?.reduce((acc, i) => acc + ((Number(i.precioVenta) - Number(i.precioCosto)) * i.stockDisponibleUnits), 0) || 0
  }), [items, isLowStock, isOutOfStock]);

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
            Gestiona tu catálogo, controla existencias y supervisá la rentabilidad en tiempo real.
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
              <Button asChild variant="ghost" size="sm" className="h-9 px-3 rounded-lg font-bold text-sm hover:bg-background hover:text-primary transition-all">
                <Link href="/lista" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Catálogo
                </Link>
              </Button>
            </div>
            {/* CTA principal */}
            <CreateProductoDialog
              onCreated={load}
              trigger={
                <Button size="lg" className="h-10 px-5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:scale-[1.02]">
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
              onCreated={load}
              trigger={
                <Button size="default" className="h-10 px-4 rounded-xl font-bold shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" />
                  Nuevo
                </Button>
              }
            />
            {/* Dropdown ⋯ — siempre al extremo derecho */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-border/60">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-56 rounded-xl border-border/60 shadow-xl p-1.5 space-y-0.5">
                {/* Auditoría — [&_span]:!inline fuerza el texto aunque tenga hidden sm:inline */}
                <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none [&_span]:!inline">
                  <HistoryReportDialog />
                </div>
                {/* Ver PDF */}
                <div className="[&_button]:w-full [&_button]:justify-start [&_button]:rounded-lg [&_button]:h-10 [&_button]:text-sm [&_button]:font-semibold [&_button]:px-3 [&_button]:border-0 [&_button]:bg-transparent [&_button]:shadow-none">
                  <DownloadInventoryButton />
                </div>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem asChild className="rounded-lg font-semibold cursor-pointer h-10">
                  <Link href="/lista" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5">
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard label="Total Items" value={stats.total} icon={LayoutGrid} color="default" />
        <StatCard label="Stock Bajo" value={stats.lowStock} icon={AlertCircle} color="orange" trend={stats.lowStock > 0 ? "Atención requerida" : "Todo en orden"} trendUp={stats.lowStock === 0} />
        <StatCard label="Agotados" value={stats.outOfStock} icon={Package} color="red" trend={stats.outOfStock > 0 ? "Reponer urgente" : "Stock saludable"} trendUp={stats.outOfStock === 0} />
        <StatCard label="Valuación Total" value={formatMoney(stats.valorVenta)} icon={TrendingUp} color="emerald" />
        <StatCard label="Utilidad Est." value={formatMoney(stats.utilidad)} icon={CircleDollarSign} color="blue" />
      </div>

      <div className="space-y-4">
        {/* FILTROS & CONTROLES */}
        <Card className="p-1 bg-card/50 backdrop-blur-sm border-border/60 shadow-sm rounded-2xl">
          <ProductosFilters
            query={q} setQuery={setQ}
            stockFilter={stockFilter} setStockFilter={setStockFilter}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            expiryFilter={expiryFilter} setExpiryFilter={setExpiryFilter}
            categories={allCategories}
          />
        </Card>

        {/* LOADING STATE */}
        {loading && (
          <div className="h-[400px] flex flex-col items-center justify-center gap-4 bg-card/30 rounded-2xl border border-border/50">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-50" />
            <span className="text-sm font-medium text-muted-foreground animate-pulse">Cargando inventario...</span>
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
                      <SortableHead label="Producto" sortKey="nombre" currentSort={sortConfig} onSort={handleSort} className="pl-6 w-[30%]" />
                      <SortableHead label="Categoría" sortKey="categoria" currentSort={sortConfig} onSort={handleSort} />
                      <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground/70">Estado</TableHead>
                      <SortableHead label="Stock" sortKey="stockDisponibleUnits" currentSort={sortConfig} onSort={handleSort} className="text-center" />
                      <TableHead className="text-center font-bold text-xs uppercase tracking-wider text-muted-foreground/70">Vencimiento</TableHead>
                      <SortableHead label="Precio" sortKey="precioVenta" currentSort={sortConfig} onSort={handleSort} className="text-right pr-6" />
                      <TableHead className="w-[180px] text-right pr-6 font-bold text-xs uppercase tracking-wider text-muted-foreground/70">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((p, idx) => (
                      <ProductoRow key={p.id} p={p} idx={idx} load={load} isLow={isLowStock(p)} isOut={isOutOfStock(p)} />
                    ))}
                    {paginatedItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-[300px] text-center">
                          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-60">
                            <Search className="h-12 w-12 stroke-[1.5]" />
                            <p className="text-lg font-medium">No se encontraron productos</p>
                            <Button variant="link" onClick={() => { setQ(""); setStockFilter("all"); setCategoryFilter("all"); setExpiryFilter("all"); }}>
                              Limpiar filtros
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* PAGINACIÃ“N (Desktop) */}
                {filtered.length > 0 && (
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    setItemsPerPage={setItemsPerPage}
                    setCurrentPage={setCurrentPage}
                    totalItems={filtered.length}
                    currentItems={paginatedItems.length}
                  />
                )}
              </Card>
            </div>

            {/* --- VISTA MOBILE (CARDS) --- */}
            <div className="md:hidden space-y-4">
              {paginatedItems.map((p, idx) => (
                <MobileProductCard key={p.id} p={p} idx={idx} load={load} isLow={isLowStock(p)} isOut={isOutOfStock(p)} />
              ))}

              {paginatedItems.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground opacity-60 py-20 text-center">
                  <Search className="h-12 w-12 stroke-[1.5]" />
                  <p className="text-lg font-medium">No se encontraron productos</p>
                  <Button variant="link" onClick={() => { setQ(""); setStockFilter("all"); setCategoryFilter("all"); setExpiryFilter("all"); }}>
                    Limpiar filtros
                  </Button>
                </div>
              )}

              {/* PAGINACIÃ“N (Mobile) */}
              {filtered.length > 0 && (
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  setItemsPerPage={setItemsPerPage}
                  setCurrentPage={setCurrentPage}
                  totalItems={filtered.length}
                  currentItems={paginatedItems.length}
                  isMobile
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

function PaginationControls({
  currentPage, totalPages, itemsPerPage, setItemsPerPage, setCurrentPage, totalItems, currentItems, isMobile = false
}: {
  currentPage: number, totalPages: number, itemsPerPage: number, setItemsPerPage: (v: number) => void, setCurrentPage: React.Dispatch<React.SetStateAction<number>>, totalItems: number, currentItems: number, isMobile?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/20", isMobile && "flex-col border rounded-xl bg-card")}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Mostrando {currentItems} de <span className="font-bold text-foreground">{totalItems}</span></span>
      </div>

      <div className={cn("flex items-center gap-4", isMobile && "w-full justify-between")}>
        {!isMobile && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filas:</span>
            <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
              <SelectTrigger className="h-8 w-[70px] text-xs font-bold">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm font-bold">{currentPage}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{totalPages}</span>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function SortableHead({ label, sortKey, currentSort, onSort, className }: { label: string, sortKey: SortKey, currentSort: SortConfig, onSort: (k: SortKey) => void, className?: string }) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead className={cn("py-4 transition-colors cursor-pointer select-none hover:bg-muted/50 hover:text-foreground", className)} onClick={() => onSort(sortKey)}>
      <div className={cn("flex items-center gap-2", className?.includes("text-right") && "justify-end", className?.includes("text-center") && "justify-center")}>
        <span className={cn("font-bold text-xs uppercase tracking-wider", isActive ? "text-primary" : "text-muted-foreground/70")}>{label}</span>
        <ArrowUpDown className={cn("h-3 w-3 transition-opacity", isActive ? "text-primary opacity-100" : "opacity-0")} />
      </div>
    </TableHead>
  );
}

function ProductoRow({ p, idx, load, isLow, isOut }: { p: Producto; idx: number; load: () => void; isLow: boolean; isOut: boolean }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="group border-b border-border/40 hover:bg-muted/30 transition-colors"
    >
      <TableCell className="pl-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-muted/50 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
            {p.imagenUrl ? (
              <img src={p.imagenUrl} alt={p.nombre} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-foreground text-sm leading-none group-hover:text-primary transition-colors">{p.nombre}</span>
            <div className="flex items-center gap-2 pt-1">
              {p.codigoBarra ? (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono text-muted-foreground border-border/60 bg-background/50 gap-1 rounded-md">
                  <Barcode className="h-3 w-3 opacity-50" /> {p.codigoBarra}
                </Badge>
              ) : (
                <span className="text-[10px] text-muted-foreground/40 italic">Sin código</span>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      <TableCell className="text-left">
        {(() => {
          const catName = p.categoria?.nombre || "General";
          const color = p.categoria?.color ? getCategoryColorByKey(p.categoria.color) : getCategoryColorByName(catName);
          return (
            <Badge variant="secondary" className={cn("px-2.5 py-0.5 rounded-lg font-bold text-[10px] border uppercase tracking-tight gap-1.5", color.bg, color.text, color.border)}>
              <div className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
              {catName}
            </Badge>
          );
        })()}
      </TableCell>

      <TableCell className="text-center">
        {isOut ? (
          <Badge variant="destructive" className="rounded-full px-2 py-0 text-[10px] font-black uppercase">Agotado</Badge>
        ) : isLow ? (
          <Badge className="bg-orange-500 hover:bg-orange-600 rounded-full px-2 py-0 text-[10px] font-black uppercase">Bajo Stock</Badge>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Disponible</span>
          </div>
        )}
      </TableCell>

      <TableCell className="text-center">
        <span className={cn(
          "text-sm font-bold tabular-nums",
          isOut ? "text-destructive" : isLow ? "text-orange-500" : "text-foreground"
        )}>
          {p.stockDisponibleUnits}
        </span>
      </TableCell>

      <TableCell className="text-center">
        {(() => {
          if (!p.fechaVencimiento) return <span className="text-[10px] text-muted-foreground/40 italic">Sin venc.</span>;
          const expired = dateExpired(p.fechaVencimiento);
          const soon = isExpiringSoon(p.fechaVencimiento);
          return (
            <div className="flex flex-col items-center gap-0.5">
              <span className={cn(
                "text-xs font-bold tabular-nums flex items-center gap-1",
                expired ? "text-red-600" : soon ? "text-orange-500" : "text-muted-foreground"
              )}>
                <Calendar className="h-3 w-3" />
                {formatDateSafe(p.fechaVencimiento)}
              </span>
              {expired && <span className="text-[9px] font-black text-red-600 uppercase">Vencido</span>}
              {soon && <span className="text-[9px] font-black text-orange-500 uppercase">Pronto</span>}
            </div>
          );
        })()}
      </TableCell>

      <TableCell className="text-right pr-6">
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-black text-foreground text-sm tabular-nums">{formatMoney(p.precioVenta)}</span>
          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-1.5 rounded-md tabular-nums">
            Margen: {formatMoney(Number(p.precioVenta) - Number(p.precioCosto))}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-right pr-6">
        {/* ACCIONES INLINE (SIN DROPDOWN) */}
        <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <AjustarStockDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg" title="Ajustar Stock">
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            }
          />
          <EditProductoDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg" title="Editar">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteButton
            id={p.id}
            nombre={p.nombre}
            onDeleted={load}
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg" title="Eliminar">
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </TableCell>
    </motion.tr>
  );
}

function MobileProductCard({ p, idx, load, isLow, isOut }: { p: Producto; idx: number; load: () => void; isLow: boolean; isOut: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
      <Card className="p-4 bg-card border-border/50 shadow-sm rounded-2xl relative overflow-hidden space-y-3">
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", isOut ? "bg-red-500" : isLow ? "bg-orange-500" : "bg-emerald-500")} />

        <div className="flex justify-between items-start pl-3 gap-3">
          <div className="h-14 w-14 rounded-xl bg-muted/50 border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
            {p.imagenUrl ? (
              <img src={p.imagenUrl} alt={p.nombre} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-foreground text-sm leading-tight">{p.nombre}</h3>
            <div className="flex items-center gap-2">
              {(() => {
                const catName = p.categoria?.nombre || "General";
                const color = p.categoria?.color ? getCategoryColorByKey(p.categoria.color) : getCategoryColorByName(catName);
                return (
                  <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 font-bold border rounded-md gap-1", color.bg, color.text, color.border)}>
                    <div className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                    {catName}
                  </Badge>
                );
              })()}
            </div>
          </div>
          <div className="text-right">
            <span className="block font-black text-lg text-primary tabular-nums">{formatMoney(p.precioVenta)}</span>
            {p.codigoBarra && (
              <span className="text-[10px] font-mono text-muted-foreground/60">{p.codigoBarra}</span>
            )}
          </div>
        </div>

        {p.fechaVencimiento && (() => {
          const expired = dateExpired(p.fechaVencimiento);
          const soon = isExpiringSoon(p.fechaVencimiento);
          return (
            <div className={cn(
              "flex items-center gap-1.5 pl-3 text-[11px] font-bold",
              expired ? "text-red-600" : soon ? "text-orange-500" : "text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              Vence: {formatDateSafe(p.fechaVencimiento)}
              {expired && <Badge variant="destructive" className="text-[9px] h-4 px-1 rounded-md ml-1">Vencido</Badge>}
              {soon && <Badge className="bg-orange-500 text-[9px] h-4 px-1 rounded-md ml-1">Pronto</Badge>}
            </div>
          );
        })()}

        <div className="flex items-center justify-between pl-3 pr-1 pt-2 border-t border-dashed border-border/50 mt-2">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1",
              isOut ? "bg-red-500/10 text-red-600" : isLow ? "bg-orange-500/10 text-orange-600" : "bg-emerald-500/10 text-emerald-600"
            )}>
              <Package className="h-3.5 w-3.5" />
              {p.stockDisponibleUnits} uds.
            </span>
          </div>

          {/* â”€â”€ DROPDOWN DE ACCIONES (Mobile) â”€â”€ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/60">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-border/60 shadow-xl">
              {/* Ajustar Stock */}
              <AjustarStockDialog
                producto={p}
                onUpdated={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-amber-600 dark:text-amber-400 cursor-pointer rounded-lg focus:text-amber-600 focus:bg-amber-50 dark:focus:bg-amber-950/40"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Ajustar Stock
                  </DropdownMenuItem>
                }
              />
              {/* Editar */}
              <EditProductoDialog
                producto={p}
                onUpdated={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-blue-600 dark:text-blue-400 cursor-pointer rounded-lg focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-950/40"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar Producto
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuSeparator />
              {/* Eliminar */}
              <DeleteButton
                id={p.id}
                nombre={p.nombre}
                onDeleted={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-red-600 dark:text-red-400 cursor-pointer rounded-lg focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color = "default", trend, trendUp }: StatCardProps) {
  const colors = {
    default: "bg-primary/5 text-primary",
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    red: "bg-red-500/10 text-red-600",
  };

  return (
    <Card className="p-5 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm relative overflow-hidden group hover:bg-card/80 transition-all">
      <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className={cn("h-16 w-16", colors[color].split(" ")[1])} />
      </div>
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">{label}</p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-black tracking-tight text-foreground">{value}</h3>
          </div>
          {trend && (
            <p className={cn("text-[10px] font-bold flex items-center gap-1", trendUp ? "text-emerald-600" : "text-red-500")}>
              {trendUp ? <TrendingUp className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {trend}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function DeleteButton({ id, nombre, onDeleted, trigger }: { id: number; nombre: string; onDeleted: () => void, trigger: React.ReactNode }) {
  const [deleting, setDeleting] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiService.deleteProducto(id);
      toast.success("Eliminado correctamente");
      onDeleted();
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleting(false); setOpen(false); }
  }

  return (
    <>
      <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        {trigger}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-red-100 dark:bg-red-900/30 p-3 rounded-full w-fit mb-2">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">Â¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground">
              Estás a punto de eliminar <span className="font-bold text-foreground">"{nombre}"</span>. Esta acción es irreversible y afectará los reportes de inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:flex-row sm:justify-center pt-2">
            <AlertDialogCancel className="h-11 rounded-xl mt-0" onClick={() => setOpen(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
