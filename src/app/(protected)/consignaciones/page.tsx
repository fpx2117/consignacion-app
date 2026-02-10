"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Plus, Search, Package, Clock, TrendingUp, 
  ChevronRight, ChevronDown, User, 
  CheckCircle2, LayoutGrid, XCircle,
  FolderOpen // Importante para el botón de historial
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import type { Consignacion, Cliente, EstadoConsignacion } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// --- Tipos ---
type Row = Consignacion & { 
  cliente?: Cliente; 
  numeroFolio: number; 
  _count?: { detalles: number; liquidaciones: number } 
};

type ClientGroup = {
  clienteId: number;
  clienteNombre: string;
  consignaciones: Row[];
  totalAbiertas: number;
  totalItems: number;
  lastActivity: string | Date;
};

// CONFIGURACIÓN DE PAGINACIÓN DE CARPETAS
const ITEMS_PER_PAGE = 7; // Muestra 7 clientes por página

export default function ConsignacionesPage() {
  const [data, setData] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<string>("TODAS");
  
  // Estado para la paginación de carpetas
  const [currentPage, setCurrentPage] = React.useState(1);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getConsignaciones();
      setData(res.data as any);
    } catch (error) {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // --- Lógica de Agrupación ---
  const groupedData = React.useMemo(() => {
    const filtered = data.filter((c) => {
      const term = q.toLowerCase();
      const matchesSearch = 
        (c.cliente?.nombre?.toLowerCase() ?? "").includes(term) || 
        String(c.numeroFolio).includes(term); 
      
      const matchesTab = activeTab === "TODAS" || c.estado === activeTab;
      return matchesSearch && matchesTab;
    });

    const groups: Record<number, ClientGroup> = {};
    filtered.forEach(item => {
      const cId = item.clienteId;
      if (!groups[cId]) {
        groups[cId] = {
          clienteId: cId,
          clienteNombre: item.cliente?.nombre ?? "Cliente Desconocido",
          consignaciones: [],
          totalAbiertas: 0,
          totalItems: 0,
          lastActivity: item.fecha
        };
      }
      groups[cId].consignaciones.push(item);
      groups[cId].totalItems += (item._count?.detalles || 0);
      if (item.estado === "ABIERTA") groups[cId].totalAbiertas += 1;
      
      if (new Date(item.fecha) > new Date(groups[cId].lastActivity)) {
        groups[cId].lastActivity = item.fecha;
      }
    });

    return Object.values(groups).sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [data, q, activeTab]);

  // --- CÁLCULOS DE PAGINACIÓN (Solo para Carpetas) ---
  const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
  const paginatedGroups = groupedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, 
    currentPage * ITEMS_PER_PAGE
  );

  // Resetear a página 1 si cambian los filtros
  React.useEffect(() => { setCurrentPage(1); }, [q, activeTab]);

  const stats = React.useMemo(() => ({
    total: data.length,
    abiertas: data.filter(c => c.estado === "ABIERTA").length,
    items: data.reduce((acc, c) => acc + (c._count?.detalles || 0), 0)
  }), [data]);

  const eficacia = stats.total > 0 ? Math.round(((stats.total - stats.abiertas) / stats.total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-8 animate-in fade-in duration-500 min-h-screen pb-32">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Sistema de Inventario</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tight">Consignaciones</h1>
        </div>
        
        <Button asChild size="lg" className="h-12 md:h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 px-6 font-bold transition-all hover:scale-[1.02] active:scale-95 w-full md:w-auto">
          <Link href="/consignaciones/nueva" className="gap-2 text-sm md:text-base">
            <Plus className="h-5 w-5 stroke-[3px]" /> Nueva Operación
          </Link>
        </Button>
      </div>

      {/* KPI CARDS (Responsive Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <StatCard label="Activas" value={stats.abiertas} icon={Clock} color="orange" />
        <StatCard label="Items Totales" value={stats.items} icon={Package} color="blue" />
        <StatCard label="Eficacia" value={`${eficacia}%`} icon={TrendingUp} color="emerald" />
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="flex flex-col md:flex-row gap-3 items-center sticky top-2 z-30 bg-background/80 backdrop-blur-md p-2 rounded-2xl border border-border/10 shadow-sm">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente o folio..." 
            className="pl-11 h-12 bg-muted/30 border-transparent focus-visible:ring-primary rounded-xl text-base w-full transition-all"
          />
        </div>
        <Tabs defaultValue="TODAS" onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="grid grid-cols-3 h-12 bg-muted/30 rounded-xl p-1 w-full md:w-auto gap-1">
            <TabsTrigger value="TODAS" className="rounded-lg font-bold text-xs">Todas</TabsTrigger>
            <TabsTrigger value="ABIERTA" className="rounded-lg font-bold text-xs">Abiertas</TabsTrigger>
            <TabsTrigger value="CERRADA" className="rounded-lg font-bold text-xs">Cerradas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* LISTA DE CARPETAS PAGINADA */}
      <div className="bg-card/20 border border-border/20 rounded-[1.5rem] overflow-hidden shadow-2xl min-h-[300px]">
        {loading ? (
          <div className="p-6 space-y-4">
             <Skeleton className="h-20 w-full rounded-2xl" />
             <Skeleton className="h-20 w-full rounded-2xl" />
             <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : paginatedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-50">
             <XCircle className="h-16 w-16 mb-4 text-muted-foreground" />
             <p className="text-xl font-bold">No se encontraron resultados</p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
             {paginatedGroups.map((group) => (
               <ClientFolder key={group.clienteId} group={group} />
             ))}
          </div>
        )}
      </div>

      {/* CONTROLES DE PAGINACIÓN (Para las carpetas) */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-6 pt-4">
           <Button 
             variant="outline" 
             size="icon"
             onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
             disabled={currentPage === 1} 
             className="rounded-full h-12 w-12 border-border/20 bg-card hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
           >
             <ChevronRight className="h-5 w-5 rotate-180" />
           </Button>
           
           <div className="flex flex-col items-center">
             <span className="text-sm font-black text-foreground">
               Página {currentPage}
             </span>
             <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
               de {totalPages}
             </span>
           </div>

           <Button 
             variant="outline" 
             size="icon"
             onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
             disabled={currentPage === totalPages} 
             className="rounded-full h-12 w-12 border-border/20 bg-card hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
           >
             <ChevronRight className="h-5 w-5" />
           </Button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUBCOMPONENTES
// ==========================================

function StatCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: 'blue' | 'orange' | 'emerald' }) {
  const colorStyles = {
    blue: "text-blue-500",
    orange: "text-orange-500",
    emerald: "text-emerald-500",
  };
  return (
    <div className="bg-card/40 border border-border/10 rounded-2xl p-4 md:p-5 flex items-center justify-between shadow-sm">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
        <h3 className="text-2xl md:text-3xl font-black tracking-tighter">{value}</h3>
      </div>
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-background/50 border border-white/5", colorStyles[color])}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function ClientFolder({ group }: { group: ClientGroup }) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <motion.div 
      layout 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="group bg-transparent transition-colors hover:bg-white/5"
    >
      {/* HEADER DE LA CARPETA (Clickable) */}
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={cn(
          "flex items-center justify-between p-4 sm:p-5 cursor-pointer select-none transition-colors",
          isOpen ? "bg-muted/5" : ""
        )}
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className={cn(
            "h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center text-lg transition-all duration-300 border shadow-sm",
            isOpen 
              ? "bg-primary text-primary-foreground border-primary rotate-3 shadow-primary/20" 
              : "bg-muted/10 text-muted-foreground border-border/20"
          )}>
             <User className="h-6 w-6" />
          </div>

          {/* Info Cliente (Layout vertical para móvil) */}
          <div className="flex flex-col justify-center min-w-0">
            <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight leading-tight truncate pr-2">
              {group.clienteNombre}
            </h3>
            
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mt-1">
              {group.totalAbiertas > 0 ? (
                <span className="text-orange-500 whitespace-nowrap">
                  {group.totalAbiertas} Activas
                </span>
              ) : (
                <span className="text-muted-foreground/40 whitespace-nowrap">
                  Sin pendientes
                </span>
              )}
              <span className="text-border/20">•</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {group.consignaciones.length} Ops
              </span>
            </div>
          </div>
        </div>

        {/* Flecha Chevron */}
        <div className={cn(
          "h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ml-2",
          isOpen ? "bg-background shadow-md rotate-180 text-foreground" : "text-muted-foreground/30"
        )}>
          <ChevronDown className="h-5 w-5" />
        </div>
      </div>

      {/* CONTENIDO DESPLEGABLE (Sin paginación interna, con SCROLL) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: "auto", opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="bg-black/20 shadow-inner"
          >
            {/* Scroll Container: max-h-[400px] crea la ventana con scroll */}
            <div className="max-h-[400px] overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar">
              {/* Renderizamos TODOS los remitos, scroll hace el trabajo */}
              {group.consignaciones
                .sort((a,b) => b.numeroFolio - a.numeroFolio)
                .map((c, i) => (
                  <ConsignacionRowRemito key={c.id} c={c} index={i} />
                ))}

              {/* Botón Ver Historial al final de la lista */}
              <div className="pt-2 flex justify-center sticky bottom-0 z-10">
                <Button 
                  variant="outline" 
                  asChild
                  className="w-full sm:w-auto rounded-xl border-border/20 bg-background/80 backdrop-blur-sm hover:bg-background hover:border-primary/30 text-muted-foreground hover:text-foreground h-12 shadow-lg"
                >
                  <Link href={`/clientes/${group.clienteId}`} className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    <span>Ver Historial Completo</span>
                    <ChevronRight className="h-4 w-4 ml-1 opacity-50" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ConsignacionRowRemito({ c, index }: { c: Row, index: number }) {
  const isAbierta = c.estado === "ABIERTA";
  
  // Tema visual (Naranja vs Verde)
  const theme = isAbierta ? {
    border: "border-orange-500/20",
    text: "text-orange-500",
    glow: "shadow-[0_0_15px_-5px_rgba(249,115,22,0.1)]",
    badge: "bg-orange-500/10 text-orange-500"
  } : {
    border: "border-emerald-500/20",
    text: "text-emerald-500",
    glow: "shadow-[0_0_15px_-5px_rgba(16,185,129,0.1)]",
    badge: "bg-emerald-500/10 text-emerald-500"
  };

  const dateObj = new Date(c.fecha);
  const month = dateObj.toLocaleDateString('es-AR', { month: 'short' }).toUpperCase().replace('.', '');
  const day = dateObj.getDate();

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link 
        href={`/consignaciones/${c.id}`} 
        className={cn(
          "group flex items-center gap-3 sm:gap-5 p-3 sm:p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-card/40 hover:bg-card/80",
          theme.border,
          theme.glow
        )}
      >
        {/* Fecha Cuadrada (Estilo Remito) */}
        <div className={cn(
          "flex flex-col items-center justify-center h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl border bg-background/50 backdrop-blur-md transition-colors",
          theme.border,
          theme.text
        )}>
          <span className="text-[9px] sm:text-[10px] font-black tracking-widest leading-none mb-0.5 opacity-80">{month}</span>
          <span className="text-2xl sm:text-3xl font-black leading-none">{day}</span>
        </div>

        {/* Contenido Texto */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-2">
              <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-widest truncate", theme.badge)}>
                Consignación
              </span>
              {!isAbierta && (
                  <span className="hidden xs:flex text-[9px] text-emerald-500 font-bold items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Liquidado
                  </span>
              )}
          </div>

          <h4 className={cn("text-lg sm:text-2xl font-black tracking-tight truncate", isAbierta ? "text-foreground" : "text-muted-foreground/80")}>
            REMITO #{String(c.numeroFolio).padStart(4, '0')}
          </h4>

          <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
            <Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">
              {c._count?.detalles || 0} Items
            </span>
          </div>
        </div>

        {/* Flecha Acción */}
        <div className="pl-2 shrink-0">
          <ChevronRight className={cn("h-5 w-5 sm:h-6 sm:w-6 opacity-50 group-hover:opacity-100 transition-all", theme.text)} />
        </div>
      </Link>
    </motion.div>
  );
}