"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiService } from "@/lib/apiService";
import type { Cliente, Consignacion, Venta } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  ArrowLeft, FolderOpen, ChevronRight, 
  Search, Package, Clock, 
  ArrowUpRight, ChevronLeft, Calendar as CalendarIcon, X,
  ShoppingCart, ReceiptText
} from "lucide-react";
import { DetailSkeleton } from "../details/skeletons";
import { cn } from "@/lib/utils";

// --- TIPOS ---
type OperacionTipo = "CONSIGNACION" | "VENTA_DIRECTA";

interface OperacionDisplay {
  id: number;
  tipo: OperacionTipo;
  fecha: string;
  referencia: string;
  total?: number;
  itemsCount?: number;
  estado?: string; // Para consignaciones (ABIERTA/CERRADA)
}

export default function ClienteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [loading, setLoading] = React.useState(true);
  const [cliente, setCliente] = React.useState<Cliente | null>(null);
  const [operaciones, setOperaciones] = React.useState<OperacionDisplay[]>([]);
  
  const [q, setQ] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 8;

  React.useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!id || isNaN(id)) return;
      
      setLoading(true);
      try {
        const [cRes, consRes, ventasRes] = await Promise.all([
          apiService.getCliente(id),
          apiService.getConsignaciones(),
          apiService.getVentas()
        ]);
        
        if (!isMounted) return;

        setCliente(cRes.data || cRes);

        const listaOperaciones: OperacionDisplay[] = [];

        // 1. CONSIGNACIONES (Remitos de Mercadería)
        if (consRes.data) {
          const consignaciones = (consRes.data as any[])
            .filter((c) => c.clienteId === id);
            
          consignaciones.forEach(c => {
             listaOperaciones.push({
                id: c.id,
                tipo: "CONSIGNACION",
                fecha: c.fecha,
                referencia: `Remito #${String(c.numeroFolio || c.id).padStart(4, '0')}`,
                itemsCount: c.detalles?.length || 0,
                estado: c.estado
             });
          });
        }

        // 2. VENTAS DIRECTAS (POS)
        // Filtramos estrictamente: Solo ventas que NO tienen liquidacionId
        if (ventasRes.data) {
           const ventasDirectas = (ventasRes.data as Venta[])
             .filter((v) => v.clienteId === id)
             .filter((v) => !v.liquidacionId); // <--- FILTRO CLAVE: Solo POS puro

           ventasDirectas.forEach(v => {
              // Formateo visual del ticket (puedes ajustar el padStart)
              const ticketId = String(v.id).padStart(3, '0');
              
              listaOperaciones.push({
                 id: v.id,
                 tipo: "VENTA_DIRECTA",
                 fecha: v.fecha,
                 referencia: `Ticket #${ticketId}`,
                 total: v.total,
                 itemsCount: v.detalles?.length || 0
              });
           });
        }

        // Ordenar: Más reciente primero
        listaOperaciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

        setOperaciones(listaOperaciones);

      } catch (e) {
        console.error("Error cargando perfil:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [id]);

  // --- FILTROS ---
  const filtered = React.useMemo(() => {
    return operaciones.filter(op => {
      const fechaDoc = new Date(op.fecha);
      const refLower = op.referencia.toLowerCase();
      const qLower = q.toLowerCase();
      
      const matchesText = q === "" || refLower.includes(qLower);

      const matchesDate = !date || (
        fechaDoc.getDate() === date.getDate() &&
        fechaDoc.getMonth() === date.getMonth() &&
        fechaDoc.getFullYear() === date.getFullYear()
      );

      return matchesText && matchesDate;
    });
  }, [operaciones, q, date]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  if (loading) return <DetailSkeleton />;
  if (!cliente) return <div className="h-screen flex items-center justify-center text-muted-foreground">Cliente no encontrado</div>;

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <div className="mx-auto w-full max-w-4xl p-6 md:p-12 space-y-10">
        
        {/* NAV */}
        <nav className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="rounded-full shadow-sm bg-card border-border">
            <Link href="/clientes"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Expediente Digital</p>
            <h2 className="text-sm font-bold text-muted-foreground/70">{cliente.nombre}</h2>
          </div>
        </nav>

        {/* HEADER */}
        <header>
          <Card className="bg-card/50 backdrop-blur-xl border-border rounded-[2.5rem] p-8 md:p-10 shadow-xl overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
              <div className="flex items-center gap-6">
                <div className="h-20 w-20 bg-gradient-to-br from-primary/10 to-primary/5 rounded-[1.8rem] flex items-center justify-center border border-primary/10">
                  <FolderOpen className="h-9 w-9 text-primary" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase leading-none">
                    {cliente.nombre}
                  </h1>
                  <div className="flex gap-2 mt-2">
                    <Badge className={cn("border-none text-[9px] font-black px-3 rounded-full", 
                      cliente.activo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {cliente.activo ? "ACTIVO" : "INACTIVO"}
                    </Badge>
                    {cliente.nombre.toLowerCase().includes("consumidor final") && (
                        <Badge variant="outline" className="text-[9px] font-bold border-indigo-200 text-indigo-500">
                            VENTA CASUAL
                        </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Movimientos</span>
                <Badge variant="secondary" className="rounded-xl py-1.5 px-4 font-bold text-xs tracking-tighter">
                  {operaciones.length} REGISTRADOS
                </Badge>
              </div>
            </div>

            {/* FILTROS INPUTS */}
            <div className="mt-12 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={q}
                  onChange={(e) => { setQ(e.target.value); setCurrentPage(1); }}
                  placeholder="BUSCAR TICKET O REMITO..." 
                  className="h-14 bg-muted/30 border-border rounded-2xl pl-12 text-[11px] font-bold tracking-widest uppercase focus-visible:ring-primary/50"
                />
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-14 w-full sm:w-[220px] justify-start text-left font-bold rounded-2xl border-border bg-muted/30 text-[11px] tracking-widest uppercase", !date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: es }) : <span>Fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-3xl border-border shadow-2xl" align="end">
                    <Calendar mode="single" selected={date} onSelect={(d) => { setDate(d); setCurrentPage(1); }} initialFocus locale={es} />
                  </PopoverContent>
                </Popover>
                {date && (
                  <Button variant="ghost" size="icon" onClick={() => setDate(undefined)} className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive">
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </header>

        {/* TIMELINE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Historial</h3>
            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-[9px] font-black px-2 text-muted-foreground">{currentPage} / {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <AnimatePresence mode="popLayout">
              {paginatedItems.map((op, index) => {
                const dateObj = new Date(op.fecha);
                const isPOS = op.tipo === "VENTA_DIRECTA";

                return (
                  <motion.div
                    key={`${op.tipo}-${op.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => router.push(isPOS ? `/ventas/${op.id}` : `/consignaciones/${op.id}`)}
                    className="group relative flex items-center justify-between p-5 bg-card/30 hover:bg-card border border-border/50 hover:border-primary/30 rounded-[1.8rem] cursor-pointer transition-all duration-300"
                  >
                    <div className="flex items-center gap-6">
                      
                      {/* FECHA CARD */}
                      <div className={cn(
                          "flex flex-col items-center justify-center h-14 w-14 rounded-2xl border transition-colors",
                          isPOS 
                            ? "bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800" // Azul Índigo para POS
                            : "bg-orange-50 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800" // Naranja para Consignación
                      )}>
                        <span className="text-[8px] font-black text-muted-foreground uppercase leading-none">
                          {dateObj.toLocaleString('es-AR', { month: 'short' }).toUpperCase()}
                        </span>
                        <span className={cn("text-xl font-black leading-none mt-1", 
                            isPOS ? "text-indigo-600 dark:text-indigo-400" : "text-orange-600 dark:text-orange-400"
                        )}>
                          {dateObj.getDate()}
                        </span>
                      </div>

                      {/* DETALLE PRINCIPAL */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {/* BADGE IDENTIFICADOR */}
                            <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-2 py-0.5",
                                isPOS 
                                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" 
                                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            )}>
                                {isPOS ? "VENTA POS" : "CONSIGNACIÓN"}
                            </Badge>
                            
                            {/* Estado Consignación (si aplica) */}
                            {!isPOS && op.estado === "ABIERTA" && (
                                <Badge className="text-[8px] h-4 bg-emerald-500/10 text-emerald-600 border-none px-1.5">ABIERTA</Badge>
                            )}
                        </div>

                        <span className="text-lg font-black tracking-tighter text-foreground group-hover:text-primary transition-colors uppercase block">
                          {op.referencia}
                        </span>
                        
                        <div className="flex items-center gap-4 text-muted-foreground/60">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight">
                            {isPOS ? <ReceiptText className="h-3 w-3 opacity-50" /> : <Package className="h-3 w-3 opacity-50" />}
                            <span>{op.itemsCount} Items</span>
                          </div>
                          
                          {/* Total $ solo para POS */}
                          {isPOS && op.total !== undefined && (
                             <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-indigo-600 dark:text-indigo-400">
                                <ShoppingCart className="h-3 w-3 opacity-50" />
                                <span>$ {op.total.toLocaleString("es-AR")}</span>
                             </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted group-hover:bg-primary transition-all duration-500 shadow-sm">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 bg-muted/5 rounded-[2.5rem] border-2 border-dashed border-border text-center">
                <Search className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest">Sin registros</h3>
                <p className="text-[10px] text-muted-foreground/60 uppercase mt-1">Este cliente no tiene operaciones con ese criterio.</p>
                <Button variant="link" size="sm" onClick={() => { setQ(""); setDate(undefined); }} className="mt-4 text-primary font-bold uppercase text-[10px] tracking-widest">
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </section>

        <footer className="pt-10 flex flex-col items-center gap-4 opacity-40">
          <div className="h-px w-20 bg-border" />
          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.5em] text-center">
              Expediente Digital • 2026
          </p>
        </footer>
      </div>
    </div>
  );
}