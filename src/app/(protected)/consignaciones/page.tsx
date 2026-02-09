"use client";

import * as React from "react";
import Link from "next/link";
import { 
  Plus, Search, Package, Clock, TrendingUp, 
  ChevronRight, ChevronDown, FolderOpen, User, 
  CheckCircle2, LayoutGrid
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
  numeroFolio: number; // Campo corregido según el nuevo schema
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

const ITEMS_PER_PAGE = 5;

export default function ConsignacionesPage() {
  const [data, setData] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<string>("TODAS");
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

  // --- Lógica de Agrupación (Carpetas por Cliente) ---
  const groupedData = React.useMemo(() => {
    const filtered = data.filter((c) => {
      const term = q.toLowerCase();
      // Búsqueda por nombre de cliente o por su número de folio relativo
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

  const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
  const paginatedGroups = groupedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  React.useEffect(() => { setCurrentPage(1); }, [q, activeTab]);

  const stats = React.useMemo(() => ({
    total: data.length,
    abiertas: data.filter(c => c.estado === "ABIERTA").length,
    items: data.reduce((acc, c) => acc + (c._count?.detalles || 0), 0)
  }), [data]);

  const eficacia = stats.total > 0 ? Math.round(((stats.total - stats.abiertas) / stats.total) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10 animate-in fade-in duration-500 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Sistema de Inventario</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">Consignaciones</h1>
          <p className="text-muted-foreground mt-1 max-w-md text-lg">Gestiona tus productos en poder de terceros.</p>
        </div>
        
        <Button asChild size="lg" className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 px-8 font-bold transition-all hover:scale-[1.02] active:scale-95">
          <Link href="/consignaciones/nueva" className="gap-3 text-base">
            <Plus className="h-5 w-5 stroke-[3px]" /> Nueva Operación
          </Link>
        </Button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard label="Total Activas" value={stats.abiertas} icon={Clock} color="blue" />
        <StatCard label="Items en Calle" value={stats.items} icon={Package} color="orange" />
        <StatCard label="Eficacia Histórica" value={`${eficacia}%`} icon={TrendingUp} color="emerald" />
      </div>

      {/* FILTERS */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-[2rem] p-3 flex flex-col md:flex-row gap-4 items-center shadow-xl shadow-foreground/5">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente o n° de folio..."
            className="pl-12 h-14 bg-muted/20 border-transparent focus-visible:ring-primary rounded-2xl text-lg"
          />
        </div>
        <Tabs defaultValue="TODAS" onValueChange={setActiveTab} className="w-full md:w-auto shrink-0">
          <TabsList className="h-14 bg-muted/30 rounded-2xl p-1.5 w-full md:w-auto border border-border/20">
            <TabsTrigger value="TODAS" className="h-11 rounded-xl px-8 data-[state=active]:shadow-lg">Todas</TabsTrigger>
            <TabsTrigger value="ABIERTA" className="h-11 rounded-xl px-8 data-[state=active]:shadow-lg">Abiertas</TabsTrigger>
            <TabsTrigger value="CERRADA" className="h-11 rounded-xl px-8 data-[state=active]:shadow-lg">Cerradas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* LISTA DE CARPETAS */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-[2rem]" />)
        ) : paginatedGroups.length === 0 ? (
          <div className="text-center py-32 rounded-[3rem] border-2 border-dashed border-border/50 bg-card/30 backdrop-blur-sm">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-xl font-bold text-muted-foreground/60 tracking-tight">No se encontraron operaciones</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {paginatedGroups.map((group) => (
              <ClientFolder key={group.clienteId} group={group} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-6 pt-6">
           <Button variant="ghost" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-full h-12 w-12 p-0 border border-border/50">
             <ChevronRight className="h-5 w-5 rotate-180" />
           </Button>
           <div className="px-6 py-2 bg-muted/50 rounded-full text-sm font-black tracking-widest text-muted-foreground uppercase">
             Página {currentPage} de {totalPages}
           </div>
           <Button variant="ghost" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-full h-12 w-12 p-0 border border-border/50">
             <ChevronRight className="h-5 w-5" />
           </Button>
        </div>
      )}
    </div>
  );
}

// --- SUBCOMPONENTES ---

function StatCard({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: 'blue' | 'orange' | 'emerald' }) {
  const colorStyles = {
    blue: "text-blue-600 bg-blue-500/10 border-blue-500/20 shadow-blue-500/5",
    orange: "text-orange-600 bg-orange-500/10 border-orange-500/20 shadow-orange-500/5",
    emerald: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5",
  };
  return (
    <div className={cn("bg-card border rounded-[2rem] p-8 relative overflow-hidden group shadow-xl transition-all hover:-translate-y-1", colorStyles[color])}>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">{label}</p>
          <h3 className="text-4xl font-black tracking-tighter text-foreground">{value}</h3>
        </div>
        <div className="h-14 w-14 rounded-2xl flex items-center justify-center bg-white/50 dark:bg-black/20 backdrop-blur-md shadow-sm border border-white/20">
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </div>
  );
}

function ClientFolder({ group }: { group: ClientGroup }) {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className={cn("rounded-[2.5rem] border bg-card/40 backdrop-blur-md transition-all overflow-hidden", isOpen ? "border-primary/40 shadow-2xl shadow-primary/5" : "border-border/50 hover:bg-card/60")}>
      <div onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between p-6 md:p-8 cursor-pointer select-none">
        <div className="flex items-center gap-6">
          <div className={cn("h-16 w-16 rounded-3xl flex items-center justify-center text-2xl font-bold transition-all duration-500 shadow-inner", isOpen ? "bg-primary text-primary-foreground rotate-12 scale-110" : "bg-muted text-muted-foreground")}>
             {isOpen ? <FolderOpen className="h-8 w-8" /> : <User className="h-8 w-8" />}
          </div>
          <div>
            <h3 className="text-2xl font-black text-foreground tracking-tight">{group.clienteNombre}</h3>
            <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground/70">
              <span className={cn("px-3 py-1 rounded-full", group.totalAbiertas > 0 ? "bg-orange-500/10 text-orange-600" : "bg-muted")}>
                {group.totalAbiertas} activas
              </span>
              <span className="h-1 w-1 rounded-full bg-border" />
              <span>{group.consignaciones.length} operaciones</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="hidden sm:flex rounded-xl h-10 px-6 font-bold bg-background/50 border-border/50">
            {group.totalItems} unidades
          </Badge>
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center border border-border/50 transition-transform duration-500", isOpen && "rotate-180 bg-primary/10 border-primary/20")}>
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="border-t border-border/20 bg-muted/10">
            <div className="p-4 space-y-2">
              {group.consignaciones
                .sort((a,b) => b.numeroFolio - a.numeroFolio)
                .map(c => <ConsignacionRow key={c.id} c={c} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ConsignacionRow({ c }: { c: Row }) {
  return (
    <Link 
      href={`/consignaciones/${c.id}`} 
      className="group flex items-center justify-between p-5 rounded-[1.5rem] bg-background/30 hover:bg-background transition-all border border-transparent hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-muted/50 border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-transparent transition-all">
          <span className="text-[10px] uppercase font-black tracking-tighter">{new Date(c.fecha).toLocaleDateString('es-AR', {month:'short'})}</span>
          <span className="text-xl font-black leading-none">{new Date(c.fecha).getDate()}</span>
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-xl font-black text-foreground tabular-nums tracking-tighter">
              #{String(c.numeroFolio).padStart(4, '0')}
            </span>
            <EstadoBadge estado={c.estado as EstadoConsignacion} />
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground/60">
             <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> {c._count?.detalles} SKU</span>
             {Number(c._count?.liquidaciones) > 0 && (
               <span className="text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                 <CheckCircle2 className="h-3.5 w-3.5" /> {c._count?.liquidaciones} Liquidado
               </span>
             )}
          </div>
        </div>
      </div>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
        <ChevronRight className="h-5 w-5" />
      </div>
    </Link>
  );
}

function EstadoBadge({ estado }: { estado: EstadoConsignacion }) {
  const isAbierta = estado === "ABIERTA";
  return (
    <div className={cn(
      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm",
      isAbierta 
        ? "bg-orange-500/10 text-orange-600 border-orange-500/20" 
        : "bg-muted text-muted-foreground border-border"
    )}>
      {isAbierta ? "● Activa" : "Cerrada"}
    </div>
  );
}