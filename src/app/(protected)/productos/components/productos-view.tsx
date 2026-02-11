"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Producto } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { formatMoney } from "@/lib/utils-format";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  Clock,
  CircleDollarSign
} from "lucide-react";

// Sub-components
import { CreateProductoDialog } from "./create-producto-dialog";
import { EditProductoDialog } from "./edit-producto-dialog";
import { AjustarStockDialog } from "./ajustar-stock-dialog";
import { ProductosFilters } from "./productos-filters";
import { DownloadInventoryButton } from "@/components/download-inventory-button";
// 👇 AQUÍ IMPORTAMOS EL DIALOGO DE HISTORIAL
import  HistoryReportDialog  from "./historial-report-dialog"; 
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'orange' | 'red' | 'emerald';
  highlight?: boolean;
}

export function ProductosView() {
  const [items, setItems] = React.useState<Producto[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Estados para Filtros
  const [q, setQ] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [expiryFilter, setExpiryFilter] = React.useState("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getProductos();
      const activos = res.data?.filter((p: Producto) => p.activo !== false) ?? [];
      setItems(activos);
    } catch (e) {
      toast.error("Error al sincronizar el inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const isLowStock = React.useCallback((p: Producto) => {
    const min = p.stockMinUnits > 0 ? p.stockMinUnits : 5; 
    return p.stockDisponibleUnits <= min && p.stockDisponibleUnits > 0;
  }, []);

  const isOutOfStock = React.useCallback((p: Producto) => {
    return p.stockDisponibleUnits <= 0;
  }, []);

  const categories = React.useMemo(() => {
    const cats = new Set(items.map(p => p.categoria?.nombre).filter(Boolean));
    return Array.from(cats) as string[];
  }, [items]);

  const filtered = React.useMemo(() => {
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
           hoy.setHours(0,0,0,0);
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

  const stats = React.useMemo(() => ({
    total: items.length,
    lowStock: items.filter(i => isLowStock(i)).length,
    outOfStock: items.filter(i => isOutOfStock(i)).length,
    valorVenta: items.reduce((acc, i) => acc + (Number(i.precioVenta) * i.stockDisponibleUnits), 0),
    utilidad: items.reduce((acc, i) => acc + ((Number(i.precioVenta) - Number(i.precioCosto)) * i.stockDisponibleUnits), 0)
  }), [items, isLowStock, isOutOfStock]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-10 text-foreground selection:bg-primary/20">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20 mx-auto md:mx-0">
            <Package className="h-3 w-3" />
            Catálogo Maestro
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Inventario
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <div className="flex gap-2 w-full sm:w-auto">
            <DownloadInventoryButton />
            {/* 👇 AQUÍ SE USA EL COMPONENTE IMPORTADO */}
            <HistoryReportDialog /> 
          </div>
          <CreateProductoDialog
            onCreated={load}
            trigger={
              <Button size="lg" className="w-full sm:w-auto rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 font-bold gap-3 px-8 h-12 text-base">
                <Plus className="h-5 w-5 stroke-[3px]" />
                Nuevo Producto
              </Button>
            }
          />
        </div>
      </header>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Items" value={stats.total} icon={LayoutGrid} color="blue" />
        <StatCard label="Stock Bajo" value={stats.lowStock} icon={AlertCircle} color="orange" highlight={stats.lowStock > 0} />
        <StatCard label="Agotados" value={stats.outOfStock} icon={Package} color="red" highlight={stats.outOfStock > 0} />
        <StatCard label="Valuación" value={formatMoney(stats.valorVenta)} icon={TrendingUp} color="emerald" />
        <StatCard label="Utilidad Est." value={formatMoney(stats.utilidad)} icon={CircleDollarSign} color="blue" />
      </div>

      {/* FILTROS */}
      <section className="bg-card/30 p-2 rounded-3xl border border-border/50 backdrop-blur-sm relative z-20">
        <ProductosFilters
          query={q} setQuery={setQ}
          stockFilter={stockFilter} setStockFilter={setStockFilter}
          categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
          expiryFilter={expiryFilter} setExpiryFilter={setExpiryFilter}
          categories={categories}
        />
      </section>

      {/* TABLA PRINCIPAL */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-[400px] flex flex-col items-center justify-center gap-6">
              <Loader2 className="h-16 w-16 animate-spin text-primary opacity-40" />
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground animate-pulse">Sincronizando...</p>
            </motion.div>
          ) : (
            <>
              <div className="hidden md:block">
                <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50 border-b border-border/50">
                      <TableRow className="hover:bg-transparent border-none text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                        <TableHead className="py-6 px-8 w-[25%] text-left">Producto</TableHead>
                        <TableHead className="text-center">Categoría</TableHead>
                        <TableHead className="text-center">Vencimiento</TableHead>
                        <TableHead className="text-center">Existencias</TableHead>
                        <TableHead className="text-right">Precio & Margen</TableHead>
                        <TableHead className="text-right px-8">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p, idx) => (
                        <DesktopRow key={p.id} p={p} idx={idx} load={load} isLow={isLowStock(p)} isOut={isOutOfStock(p)} />
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filtered.map((p, idx) => (
                  <MobileCard key={p.id} p={p} idx={idx} load={load} isLow={isLowStock(p)} isOut={isOutOfStock(p)} />
                ))}
              </div>
              
              {filtered.length === 0 && (
                <div className="text-center py-20 opacity-50 flex flex-col items-center">
                  <Search className="h-10 w-10 text-muted-foreground mb-4" />
                  <h3 className="font-bold text-foreground">Sin resultados</h3>
                </div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- SUB COMPONENTES (DesktopRow, MobileCard, StatCard, DeleteButton) ---

function DesktopRow({ p, idx, load, isLow, isOut }: { p: Producto; idx: number; load: () => void; isLow: boolean; isOut: boolean }) {
  const { fechaStr, isExpired, isSoon } = React.useMemo(() => {
    if (!p.fechaVencimiento) return { fechaStr: null, isExpired: false, isSoon: false };
    const fechaObj = new Date(p.fechaVencimiento);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diferenciaDias = Math.ceil((fechaObj.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return {
      fechaStr: fechaObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      isExpired: fechaObj < hoy,
      isSoon: diferenciaDias <= 7 && diferenciaDias >= 0
    };
  }, [p.fechaVencimiento]);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.015, 0.4) }}
      className="group border-b border-border/40 hover:bg-primary/[0.03] transition-all"
    >
      <TableCell className="px-8 py-5">
        <div className="flex flex-col gap-1.5">
          <span className="font-bold text-sm group-hover:text-primary transition-colors leading-none">{p.nombre}</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono font-medium">ID-{p.id}</span>
            {p.codigoBarra && (
              <span className="text-[9px] font-mono text-primary/70 bg-primary/5 px-2 py-0.5 rounded border border-primary/10 flex items-center gap-1">
                <Barcode className="h-3 w-3" /> {p.codigoBarra}
              </span>
            )}
          </div>
        </div>
      </TableCell>

      <TableCell className="text-center">
        <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
           <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
             {p.categoria?.nombre || "General"}
           </span>
        </div>
      </TableCell>
      
      <TableCell className="text-center">
        {fechaStr ? (
          <div className={cn(
            "inline-flex flex-col items-center px-2.5 py-1 rounded-xl text-[10px] font-bold border",
            isExpired ? 'bg-red-500/10 text-red-600 border-red-500/20' : 
            isSoon ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse' : 
            'bg-muted/50 text-muted-foreground'
          )}>
            <span className="flex items-center gap-1">{isSoon && !isExpired ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}{fechaStr}</span>
            {isExpired && <span className="text-[7px] uppercase tracking-tighter font-black">Vencido</span>}
          </div>
        ) : <span className="text-muted-foreground/30 text-[9px] italic font-medium tracking-tight">No vence</span>}
      </TableCell>

      <TableCell className="text-center">
        <div className="inline-flex items-center px-3 py-1 rounded-full font-black text-[11px] border-2">
          <div className={cn(
            "flex items-center gap-1",
            isOut ? 'text-red-600' : 
            isLow ? 'text-orange-600' : 
            'text-emerald-600'
          )}>
             {p.stockDisponibleUnits} uds.
          </div>
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-black tabular-nums leading-none">{formatMoney(p.precioVenta)}</span>
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/10">
            Margen: {formatMoney(Number(p.precioVenta) - Number(p.precioCosto))}
          </span>
        </div>
      </TableCell>
      
      <TableCell className="text-right px-8">
        <div className="flex justify-end items-center gap-2">
          <AjustarStockDialog producto={p} onUpdated={load} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-amber-500 hover:text-white transition-all text-amber-600 bg-amber-500/5"><ArrowRightLeft className="h-4 w-4" /></Button>} />
          <EditProductoDialog producto={p} onUpdated={load} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary hover:text-white transition-all text-primary bg-primary/5"><Pencil className="h-4 w-4" /></Button>} />
          <DeleteButton id={p.id} nombre={p.nombre} onDeleted={load} />
        </div>
      </TableCell>
    </motion.tr>
  );
}

function StatCard({ label, value, icon: Icon, color, highlight }: StatCardProps) {
  const colorMap = {
    blue: "text-blue-500",
    orange: "text-orange-500",
    red: "text-red-500",
    emerald: "text-emerald-500",
  };
  return (
    <Card className={cn(
      "p-4 border-border/50 bg-card/50 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden group transition-all",
      highlight && "ring-2 ring-red-500/50 shadow-lg shadow-red-500/10"
    )}>
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</span>
        <Icon className={cn("h-3.5 w-3.5", colorMap[color])} />
      </div>
      <span className="text-base md:text-lg font-black tracking-tight tabular-nums truncate relative z-10">{value}</span>
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1",
        color === 'blue' ? 'bg-blue-500' : color === 'orange' ? 'bg-orange-500' : color === 'red' ? 'bg-red-500' : 'bg-emerald-500'
      )} />
    </Card>
  );
}

function DeleteButton({ id, nombre, onDeleted }: { id: number; nombre: string; onDeleted: () => void }) {
  const [deleting, setDeleting] = React.useState(false);
  async function handleDelete() {
    setDeleting(true);
    try {
      await apiService.deleteProducto(id);
      toast.success("Eliminado");
      onDeleted();
    } catch { toast.error("Error al eliminar"); }
    finally { setDeleting(false); }
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground/60 hover:text-red-600 hover:bg-red-500/10">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader><AlertDialogTitle>¿Eliminar {nombre}?</AlertDialogTitle></AlertDialogHeader>
        <AlertDialogDescription>Esta acción no se puede deshacer. El producto dejará de estar disponible en el inventario.</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">No, cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl">Sí, eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MobileCard({ p, idx, load, isLow, isOut }: { p: Producto; idx: number; load: () => void; isLow: boolean; isOut: boolean }) {
  const fechaTexto = React.useMemo(() => {
    if (!p.fechaVencimiento) return null;
    return new Date(p.fechaVencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }, [p.fechaVencimiento]);

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
      <Card className="p-4 border-border/50 bg-card/50 backdrop-blur-sm space-y-3 rounded-2xl relative overflow-hidden shadow-sm">
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1.5",
          isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-emerald-500'
        )} />
        
        <div className="flex justify-between items-start pl-2">
          <div className="space-y-1 pr-2">
            <h3 className="font-bold text-sm leading-tight text-foreground/90">{p.nombre}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[8px] h-4 uppercase font-black bg-muted border-none px-1.5">
                {p.categoria?.nombre || "General"}
              </Badge>
              {p.codigoBarra && <span className="text-[9px] text-muted-foreground font-mono">{p.codigoBarra}</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-black text-primary text-lg tabular-nums leading-none">
              {formatMoney(p.precioVenta)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pl-2 pr-1 pt-1">
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border",
            isOut ? 'bg-red-500/10 border-red-500/20 text-red-600' : 
            isLow ? 'bg-orange-500/10 border-orange-500/20 text-orange-600' : 
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
          )}>
            <Package className="h-3.5 w-3.5" />
            <span className="text-xs font-black">{p.stockDisponibleUnits} uds.</span>
          </div>

          {fechaTexto ? (
             <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-muted/50 px-2 py-1 rounded-md">
               <Calendar className="h-3 w-3 opacity-70" />
               <span>{fechaTexto}</span>
             </div>
          ) : (
             <span className="text-[10px] text-muted-foreground/30 italic pr-1">No vence</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 pl-2">
          <AjustarStockDialog producto={p} onUpdated={load} trigger={<Button variant="secondary" className="h-9 text-xs rounded-xl font-bold bg-muted/80 hover:bg-muted">Ajustar Stock</Button>} />
          <EditProductoDialog producto={p} onUpdated={load} trigger={<Button variant="outline" className="h-9 text-xs rounded-xl font-bold border-primary/20 text-primary hover:bg-primary/5">Editar</Button>} />
        </div>
      </Card>
    </motion.div>
  );
}