"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Producto } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { formatMoney } from "@/lib/utils-format";

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
  Plus,
  Pencil,
  Package,
  Loader2,
  TrendingUp,
  AlertCircle,
  LayoutGrid,
  ArrowRightLeft,
  DollarSign,
  Box
} from "lucide-react";

import { CreateProductoDialog } from "./create-producto-dialog";
import { EditProductoDialog } from "./edit-producto-dialog";
import { AjustarStockDialog } from "./ajustar-stock-dialog";
import { ProductosFilters } from "./productos-filters";

export function ProductosView() {
  const [items, setItems] = React.useState<Producto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await apiService.getProductos();
      setItems(res.data ?? []);
    } catch (e) {
      toast.error("Error al sincronizar el inventario");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  const filtered = React.useMemo(() => {
    return items.filter((p) => {
      const term = q.trim().toLowerCase();
      const matchesQuery = p.nombre.toLowerCase().includes(term) || p.id.toString().includes(term);
      const matchesStock =
        stockFilter === "all" ? true :
          stockFilter === "low" ? p.stockDisponibleUnits <= 3 && p.stockDisponibleUnits > 0 :
            stockFilter === "out" ? p.stockDisponibleUnits === 0 :
              stockFilter === "available" ? p.stockDisponibleUnits > 0 : true;
      return matchesQuery && matchesStock;
    });
  }, [items, q, stockFilter]);

  const stats = React.useMemo(() => ({
    total: items.length,
    lowStock: items.filter(i => i.stockDisponibleUnits <= 3 && i.stockDisponibleUnits > 0).length,
    outOfStock: items.filter(i => i.stockDisponibleUnits === 0).length,
    valorTotal: items.reduce((acc, i) => acc + (i.precioVenta * i.stockDisponibleUnits), 0)
  }), [items]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-10 text-foreground selection:bg-primary/20">

      {/* HEADER - Adaptado para móvil */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20 mx-auto md:mx-0">
            <Package className="h-3 w-3" />
            Catálogo Permanente
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
            Inventario
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg max-w-md leading-relaxed mx-auto md:mx-0">
            Gestión centralizada de productos y existencias.
          </p>
        </div>

        <CreateProductoDialog
          onCreated={load}
          trigger={
            <Button size="lg" className="w-full md:w-auto rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 font-bold gap-3 px-8 h-14 text-base">
              <Plus className="h-5 w-5 stroke-[3px]" />
              Nuevo Producto
            </Button>
          }
        />
      </header>

      {/* STATS - Scroll lateral en móvil */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-2 md:pb-0">
        <StatCard label="Total" value={stats.total} icon={LayoutGrid} color="blue" />
        <StatCard label="Crítico" value={stats.lowStock} icon={AlertCircle} color="orange" highlight={stats.lowStock > 0} />
        <StatCard label="Sin Stock" value={stats.outOfStock} icon={Package} color="red" highlight={stats.outOfStock > 0} />
        <StatCard label="Valuación" value={formatMoney(stats.valorTotal)} icon={TrendingUp} color="emerald" />
      </div>

      {/* FILTROS */}
      <section className="bg-card/30 p-2 rounded-3xl border border-border/50 backdrop-blur-sm">
        <ProductosFilters
          query={q}
          setQuery={setQ}
          stockFilter={stockFilter}
          setStockFilter={setStockFilter}
        />
      </section>

      {/* CONTENIDO PRINCIPAL: TABLE (Desktop) vs CARDS (Mobile) */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-[400px] flex flex-col items-center justify-center gap-6"
            >
              <Loader2 className="h-16 w-16 animate-spin text-primary opacity-40" />
              <p className="text-sm font-bold tracking-widest uppercase text-muted-foreground animate-pulse">Sincronizando...</p>
            </motion.div>
          ) : (
            <>
              {/* VISTA DESKTOP: TABLE */}
              <div className="hidden md:block">
                <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl shadow-foreground/5 overflow-hidden rounded-[2rem]">
                  <Table>
                    <TableHeader className="bg-muted/50 border-b border-border/50">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="py-6 px-8 text-xs uppercase font-black tracking-widest text-muted-foreground">Producto</TableHead>
                        <TableHead className="text-center text-xs uppercase font-black tracking-widest text-muted-foreground">Stock</TableHead>
                        <TableHead className="text-right text-xs uppercase font-black tracking-widest text-muted-foreground">Finanzas</TableHead>
                        <TableHead className="text-right px-8 text-xs uppercase font-black tracking-widest text-muted-foreground">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p, idx) => (
                        <DesktopRow key={p.id} p={p} idx={idx} load={load} />
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* VISTA MÓVIL: CARDS */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {filtered.map((p, idx) => (
                  <MobileCard key={p.id} p={p} idx={idx} load={load} />
                ))}
              </div>
              
              {filtered.length === 0 && (
                <div className="text-center py-20 opacity-50">
                  <Package className="h-12 w-12 mx-auto mb-4" />
                  <p className="font-medium">No se encontraron productos</p>
                </div>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTES PARA VISTA MÓVIL ---

function MobileCard({ p, idx, load }: { p: Producto; idx: number; load: () => void }) {
  const isLow = p.stockDisponibleUnits <= 3;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Card className="p-5 border-border/50 bg-card/50 backdrop-blur-sm space-y-4 rounded-3xl relative overflow-hidden">
        {/* Indicador de stock lateral */}
        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} />
        
        <div className="flex justify-between items-start pl-2">
          <div className="space-y-1">
            <h3 className="font-bold text-lg leading-tight">{p.nombre}</h3>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              ID-{p.id}
            </span>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-primary">{formatMoney(p.precioVenta)}</div>
            <div className="text-[10px] text-emerald-600 font-bold uppercase italic">
              +{formatMoney(p.precioVenta - p.precioCosto)} margen
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-2xl">
          <div className="flex items-center gap-2">
            <Box className={`h-4 w-4 ${isLow ? 'text-red-500' : 'text-emerald-500'}`} />
            <span className="text-sm font-bold">Existencias:</span>
          </div>
          <Badge 
            variant="outline" 
            className={`text-sm font-black rounded-lg ${isLow ? 'bg-red-500 text-white' : 'bg-emerald-500/10 text-emerald-600'}`}
          >
            {p.stockDisponibleUnits} uds
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <AjustarStockDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button variant="secondary" className="w-full rounded-xl font-bold gap-2 py-6 border-2 border-transparent active:scale-95 transition-transform">
                <ArrowRightLeft className="h-4 w-4" /> Stock
              </Button>
            }
          />
          <EditProductoDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button variant="outline" className="w-full rounded-xl font-bold gap-2 py-6 border-2 border-primary/20 active:scale-95 transition-transform">
                <Pencil className="h-4 w-4" /> Editar
              </Button>
            }
          />
        </div>
      </Card>
    </motion.div>
  );
}

// --- REFACTORIZACIÓN DE FILA DESKTOP ---

function DesktopRow({ p, idx, load }: { p: Producto; idx: number; load: () => void }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.015 }}
      className="group border-b border-border/40 hover:bg-primary/[0.03] transition-all"
    >
      <TableCell className="px-8 py-6">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-lg group-hover:text-primary transition-colors">{p.nombre}</span>
          <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/50 w-fit px-1.5 py-0.5 rounded">SKU-{p.id}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-center">
          <Badge 
            variant="outline"
            className={`px-4 py-1.5 rounded-full font-bold border-2 ${
              p.stockDisponibleUnits <= 3 
              ? 'bg-red-500/10 text-red-600 border-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10'
            }`}
          >
            {p.stockDisponibleUnits} unidades
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <span className="text-xl font-black tabular-nums">{formatMoney(p.precioVenta)}</span>
          <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md mt-1 italic">
            Margen: {formatMoney(p.precioVenta - p.precioCosto)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right px-8">
        <div className="flex justify-end gap-3">
          <AjustarStockDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button variant="ghost" className="h-11 px-4 rounded-xl hover:bg-amber-500 hover:text-white transition-all gap-2 font-bold text-amber-600 border border-amber-500/20">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="hidden lg:inline">Stock</span>
              </Button>
            }
          />
          <EditProductoDialog
            producto={p}
            onUpdated={load}
            trigger={
              <Button variant="ghost" className="h-11 px-4 rounded-xl hover:bg-primary hover:text-white transition-all gap-2 font-bold text-primary border border-primary/20">
                <Pencil className="h-4 w-4" />
                <span className="hidden lg:inline">Editar</span>
              </Button>
            }
          />
        </div>
      </TableCell>
    </motion.tr>
  );
}

// --- COMPONENTE STAT CARD ---

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: "blue" | "orange" | "red" | "emerald";
  highlight?: boolean;
}

function StatCard({ label, value, icon: Icon, color, highlight }: StatCardProps) {
  const colorMap = {
    blue: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    red: "text-red-500 bg-red-500/10 border-red-500/20",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  };

  return (
    <motion.div whileHover={{ y: -5 }} className="min-w-[160px]">
      <Card className={`p-4 md:p-6 border border-border/50 bg-card/50 backdrop-blur-md flex flex-col gap-3 shadow-sm relative overflow-hidden group ${highlight ? 'ring-2 ring-red-500/50' : ''}`}>
        <div className="flex items-center justify-between relative z-10">
          <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</span>
          <div className={`p-2 rounded-lg border ${colorMap[color]}`}>
            <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </div>
        </div>
        <span className="text-2xl md:text-3xl font-black tracking-tight relative z-10 tabular-nums truncate">{value}</span>
      </Card>
    </motion.div>
  );
}