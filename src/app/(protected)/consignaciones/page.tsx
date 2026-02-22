"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Package,
  Clock,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  LayoutGrid,
  XCircle,
  FolderOpen,
  Folder,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import type { Consignacion, Cliente } from "@/lib/types";

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
  _count?: { detalles: number; liquidaciones: number };
};

type ClientGroup = {
  clienteId: number;
  clienteNombre: string;
  consignaciones: Row[];
  totalAbiertas: number;
  totalItems: number;
  lastActivity: string | Date;
};

const ITEMS_PER_PAGE = 7;

// --- Utilidades de color para avatares ---
const AVATAR_PALETTES = [
  { bg: "bg-blue-500/15 dark:bg-blue-500/20", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/20" },
  { bg: "bg-emerald-500/15 dark:bg-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/20" },
  { bg: "bg-amber-500/15 dark:bg-amber-500/20", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/20" },
  { bg: "bg-rose-500/15 dark:bg-rose-500/20", text: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/20" },
  { bg: "bg-cyan-500/15 dark:bg-cyan-500/20", text: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/20" },
  { bg: "bg-indigo-500/15 dark:bg-indigo-500/20", text: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-500/20" },
  { bg: "bg-pink-500/15 dark:bg-pink-500/20", text: "text-pink-600 dark:text-pink-400", ring: "ring-pink-500/20" },
  { bg: "bg-teal-500/15 dark:bg-teal-500/20", text: "text-teal-600 dark:text-teal-400", ring: "ring-teal-500/20" },
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
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
      setData(res as any);
    } catch {
      toast.error("Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

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
    filtered.forEach((item) => {
      const cId = item.clienteId;
      if (!groups[cId]) {
        groups[cId] = {
          clienteId: cId,
          clienteNombre: item.cliente?.nombre ?? "Cliente Desconocido",
          consignaciones: [],
          totalAbiertas: 0,
          totalItems: 0,
          lastActivity: item.fecha,
        };
      }
      groups[cId].consignaciones.push(item);
      groups[cId].totalItems += item._count?.detalles || 0;
      if (item.estado === "ABIERTA") groups[cId].totalAbiertas += 1;

      if (new Date(item.fecha) > new Date(groups[cId].lastActivity)) {
        groups[cId].lastActivity = item.fecha;
      }
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }, [data, q, activeTab]);

  const totalPages = Math.ceil(groupedData.length / ITEMS_PER_PAGE);
  const paginatedGroups = groupedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  React.useEffect(() => { setCurrentPage(1); }, [q, activeTab]);

  const stats = React.useMemo(
    () => ({
      total: data.length,
      abiertas: data.filter((c) => c.estado === "ABIERTA").length,
      items: data.reduce((acc, c) => acc + (c._count?.detalles || 0), 0),
    }),
    [data]
  );

  const eficacia = stats.total > 0 ? Math.round(((stats.total - stats.abiertas) / stats.total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 p-3 sm:p-4 md:p-8 animate-in fade-in duration-500 min-h-screen pb-32">
      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <span className="text-[10px] sm:text-xs font-bold text-primary uppercase tracking-widest">
              Sistema de Inventario
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-foreground tracking-tight">
            Consignaciones
          </h1>
        </div>

        <Button
          asChild
          size="lg"
          className="h-11 sm:h-12 md:h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 px-5 sm:px-6 font-bold transition-all hover:scale-[1.02] active:scale-95 w-full sm:w-auto"
        >
          <Link href="/consignaciones/nueva" className="gap-2 text-sm md:text-base">
            <Plus className="h-5 w-5 stroke-[3px]" /> Nueva Operación
          </Link>
        </Button>
      </div>

      {/* ── KPI CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <StatCard label="Activas" value={stats.abiertas} icon={Clock} color="orange" />
        <StatCard label="Items" value={stats.items} icon={Package} color="blue" />
        <StatCard label="Eficacia" value={`${eficacia}%`} icon={TrendingUp} color="emerald" />
      </div>

      {/* ── FILTROS Y BUSCADOR ─────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center sticky top-2 z-30 bg-background/80 backdrop-blur-xl p-2 rounded-2xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente o folio..."
            className="pl-10 h-10 sm:h-11 bg-muted/40 border-transparent focus-visible:border-primary/30 focus-visible:ring-primary/20 rounded-xl text-sm sm:text-base w-full transition-all"
          />
        </div>
        <Tabs defaultValue="TODAS" onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-3 h-10 sm:h-11 bg-muted/40 rounded-xl p-1 w-full sm:w-auto gap-0.5">
            <TabsTrigger value="TODAS" className="rounded-lg font-bold text-[11px] sm:text-xs data-[state=active]:shadow-sm">
              Todas
            </TabsTrigger>
            <TabsTrigger value="ABIERTA" className="rounded-lg font-bold text-[11px] sm:text-xs data-[state=active]:shadow-sm">
              Abiertas
            </TabsTrigger>
            <TabsTrigger value="CERRADA" className="rounded-lg font-bold text-[11px] sm:text-xs data-[state=active]:shadow-sm">
              Cerradas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── LISTA DE CARPETAS ──────────────────────────── */}
      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />
            ))}
          </div>
        ) : paginatedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <XCircle className="h-10 w-10" />
            </div>
            <p className="text-lg font-bold">No se encontraron resultados</p>
            <p className="text-sm mt-1 text-muted-foreground/60">Intenta con otra búsqueda o filtro</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {paginatedGroups.map((group, index) => (
              <motion.div
                key={group.clienteId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <ClientFolder group={group} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* ── PAGINACIÓN ─────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 sm:gap-6 pt-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-full h-10 w-10 sm:h-12 sm:w-12 border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 rotate-180" />
          </Button>

          <div className="flex flex-col items-center select-none">
            <span className="text-sm font-black text-foreground">Página {currentPage}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              de {totalPages}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-full h-10 w-10 sm:h-12 sm:w-12 border-border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUBCOMPONENTES
// ==========================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: any;
  color: "blue" | "orange" | "emerald";
}) {
  const styles = {
    blue: {
      icon: "text-blue-500",
      iconBg: "bg-blue-500/10 dark:bg-blue-500/15",
      glow: "group-hover:shadow-blue-500/5",
    },
    orange: {
      icon: "text-orange-500",
      iconBg: "bg-orange-500/10 dark:bg-orange-500/15",
      glow: "group-hover:shadow-orange-500/5",
    },
    emerald: {
      icon: "text-emerald-500",
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
      glow: "group-hover:shadow-emerald-500/5",
    },
  };

  const s = styles[color];

  return (
    <div
      className={cn(
        "group bg-card border border-border rounded-2xl p-3 sm:p-4 md:p-5 flex items-center justify-between",
        "shadow-sm hover:shadow-md transition-all duration-300",
        s.glow
      )}
    >
      <div className="min-w-0">
        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5 sm:mb-1 truncate">
          {label}
        </p>
        <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter text-foreground">
          {value}
        </h3>
      </div>
      <div
        className={cn(
          "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 ml-2 transition-transform group-hover:scale-110",
          s.iconBg
        )}
      >
        <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.icon)} />
      </div>
    </div>
  );
}

// ==========================================
// CARPETA DE CLIENTE (Folder Dossier)
// ==========================================
function ClientFolder({ group }: { group: ClientGroup }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const palette = getAvatarPalette(group.clienteNombre);
  const initials = getInitials(group.clienteNombre);

  const lastDate = new Date(group.lastActivity);
  const timeAgo = getRelativeTime(lastDate);

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all duration-300",
        isOpen
          ? "bg-card border-primary/30 shadow-lg shadow-primary/5 ring-1 ring-primary/10"
          : "bg-card border-border hover:border-border/80 shadow-sm hover:shadow-md"
      )}
    >
      {/* ── FOLDER HEADER ──────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between p-3 sm:p-4 cursor-pointer select-none transition-colors text-left",
          isOpen ? "bg-primary/[0.03] dark:bg-primary/[0.06]" : "hover:bg-muted/30"
        )}
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Avatar con iniciales */}
          <div
            className={cn(
              "h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-xl flex items-center justify-center font-black text-sm sm:text-base ring-1 transition-all duration-300",
              palette.bg,
              palette.text,
              palette.ring,
              isOpen && "scale-105 ring-2"
            )}
          >
            {initials}
          </div>

          {/* Info del cliente */}
          <div className="flex flex-col justify-center min-w-0 gap-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <Folder className={cn(
                "h-3.5 w-3.5 shrink-0 transition-colors",
                isOpen ? "text-primary" : "text-muted-foreground/40"
              )} />
              <h3 className="text-sm sm:text-base font-black text-foreground tracking-tight leading-tight truncate">
                {group.clienteNombre}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {group.totalAbiertas > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-500/15 px-1.5 py-0.5 rounded-md">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {group.totalAbiertas} {group.totalAbiertas === 1 ? "activa" : "activas"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded-md">
                  <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  Al día
                </span>
              )}
              <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                {group.consignaciones.length} ops · {timeAgo}
              </span>
            </div>
          </div>
        </div>

        {/* Chevron */}
        <div
          className={cn(
            "h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ml-2",
            isOpen
              ? "bg-primary/10 text-primary rotate-180"
              : "text-muted-foreground/30 group-hover:text-muted-foreground"
          )}
        >
          <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </button>

      {/* ── EXPANDED CONTENT ───────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50">
              <div className="max-h-[420px] overflow-y-auto p-2.5 sm:p-4 space-y-2 sm:space-y-2.5 custom-scrollbar bg-muted/20 dark:bg-muted/10">
                {group.consignaciones
                  .sort((a, b) => b.numeroFolio - a.numeroFolio)
                  .map((c, i) => (
                    <ConsignacionRowRemito key={c.id} c={c} index={i} />
                  ))}

                {/* Ver historial completo */}
                <div className="pt-1 sm:pt-2 flex justify-center sticky bottom-0 z-10">
                  <Button
                    variant="outline"
                    asChild
                    className="w-full sm:w-auto rounded-xl border-border bg-card hover:bg-card hover:border-primary/30 text-muted-foreground hover:text-foreground h-10 sm:h-11 shadow-sm transition-all"
                  >
                    <Link href={`/clientes/${group.clienteId}`} className="flex items-center gap-2 text-sm">
                      <FolderOpen className="h-4 w-4" />
                      <span>Ver Historial Completo</span>
                      <ChevronRight className="h-4 w-4 ml-1 opacity-50" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// FILA DE REMITO (Consignación individual)
// ==========================================
function ConsignacionRowRemito({ c, index }: { c: Row; index: number }) {
  const isAbierta = c.estado === "ABIERTA";

  const theme = isAbierta
    ? {
      accent: "border-l-orange-500",
      badge: "bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400",
      dateText: "text-orange-600 dark:text-orange-400",
      dateBg: "bg-orange-500/8 dark:bg-orange-500/10 border-orange-500/15",
    }
    : {
      accent: "border-l-emerald-500",
      badge: "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      dateText: "text-emerald-600 dark:text-emerald-400",
      dateBg: "bg-emerald-500/8 dark:bg-emerald-500/10 border-emerald-500/15",
    };

  const dateObj = new Date(c.fecha);
  const month = dateObj.toLocaleDateString("es-AR", { month: "short" }).toUpperCase().replace(".", "");
  const day = dateObj.getDate();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link
        href={`/consignaciones/${c.id}`}
        className={cn(
          "group flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3.5 rounded-xl border border-border transition-all duration-200",
          "bg-card hover:bg-card/90 dark:hover:bg-card/90",
          "hover:shadow-md hover:border-border/80",
          "border-l-[3px]",
          theme.accent
        )}
      >
        {/* Date block */}
        <div
          className={cn(
            "flex flex-col items-center justify-center h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-lg border transition-colors",
            theme.dateBg,
            theme.dateText
          )}
        >
          <span className="text-[8px] sm:text-[9px] font-black tracking-widest leading-none mb-0.5 opacity-80">
            {month}
          </span>
          <span className="text-lg sm:text-2xl font-black leading-none">{day}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className={cn("px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase tracking-wider", theme.badge)}>
              {isAbierta ? "Abierta" : "Cerrada"}
            </span>
            {!isAbierta && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="h-3 w-3" /> Liquidado
              </span>
            )}
          </div>

          <h4
            className={cn(
              "text-base sm:text-lg font-black tracking-tight truncate",
              isAbierta ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Hash className="inline h-3 w-3 sm:h-3.5 sm:w-3.5 mr-0.5 opacity-40" />
            REMITO {String(c.numeroFolio).padStart(4, "0")}
          </h4>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="h-3 w-3" />
            <span className="text-[10px] sm:text-xs font-semibold">{c._count?.detalles || 0} items</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="pl-1 sm:pl-2 shrink-0">
          <ChevronRight
            className={cn(
              "h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 transition-all"
            )}
          />
        </div>
      </Link>
    </motion.div>
  );
}

// ==========================================
// UTILIDADES
// ==========================================
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays}d`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)}sem`;
  return `hace ${Math.floor(diffDays / 30)}m`;
}