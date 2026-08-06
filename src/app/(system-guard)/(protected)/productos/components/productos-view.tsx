"use client";

import * as React from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { Producto, Categoria } from "@/lib/types";
import { apiService } from "@/lib/apiService";
import { useSucursalStore } from "@/store/useSucursalStore";
import { formatMoney } from "@/lib/date-format/utils-format";
import { cn } from "@/lib/utils";
import {
  formatDateSafe,
  isExpired as dateExpired,
  isExpiringSoon,
} from "@/lib/date-format/utils-date";
import {
  getCategoryColorByKey,
  getCategoryColorByName,
} from "@/lib/category-colors";
import { calcularDescuentoEfectivo } from "@/lib/storefront/descuento-utils";

// UI Components
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Eye,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Sub-components
import { CreateProductoDialog } from "./create-producto-dialog";
import { FacturaProveedorDialog } from "./factura-proveedor-dialog";
import { EditProductoDialog } from "./edit-producto-dialog";
import { AjustarStockDialog } from "./ajustar-stock-dialog";
import { ProductosFilters } from "./productos-filters";
import { DownloadInventoryButton } from "@/components/reports/download-inventory-button";
import HistoryReportDialog from "./historial-report-dialog";
import { ProductosAgotadosSheetContent } from "./productos-agotados-sheet-content";
import { ProductosBajoStockSheetContent } from "./productos-bajo-stock-sheet-content";
import { ColumnasProductoPicker } from "./columnas-producto-picker";
import { getAtributosTipicos } from "@/modules/invoices/config/rubros";
import { getAtributosFijos } from "@/modules/invoices/config/rubro-atributos";

// --- Interfaces ---
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: "default" | "blue" | "emerald" | "orange" | "red";
  onClick?: () => void;
  clickable?: boolean;
}

type SortKey =
  | "nombre"
  | "precioVenta"
  | "stockDisponibleUnits"
  | "categoria"
  | `attr:${string}`;
type SortDirection = "asc" | "desc";
type ProductoViewItem = Producto & {
  subcategoria?: {
    nombre?: string | null;
  } | null;
};

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

// Clave sintética para "Vencimiento" en el picker de columnas — no es un
// atributo de rubro, es Producto.fechaVencimiento, pero comparte el mismo
// mecanismo de columnasAtributosProducto para que el usuario la pueda
// ocultar/mostrar igual que Marca/Sabor/Puffs.
const COLUMNA_VENCIMIENTO = "vencimiento";

export function ProductosView() {
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const catalogoHref = activeSucursalId
    ? `/lista?sucursalId=${activeSucursalId}`
    : "/lista";
  const [items, setItems] = React.useState<ProductoViewItem[]>([]);
  const [statsItems, setStatsItems] = React.useState<ProductoViewItem[]>([]);
  const [allCategories, setAllCategories] = React.useState<Categoria[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Estados para Filtros
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState("all");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [subCategoryFilter, setSubCategoryFilter] = React.useState("all");
  const [expiryFilter, setExpiryFilter] = React.useState("all");

  // Paginación
  const [serverPage, setServerPage] = React.useState(1);
  const [serverTotal, setServerTotal] = React.useState(0);
  const [serverTotalPages, setServerTotalPages] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "nombre",
    direction: "asc",
  });
  const [showSensitiveData, setShowSensitiveData] = React.useState(false);
  const [stockDrawer, setStockDrawer] = React.useState<"low" | "out" | null>(
    null,
  );

  // Columnas dinámicas de atributosExtra (Fase 4)
  const [columnasAtributos, setColumnasAtributos] = React.useState<string[]>(
    [],
  );
  const [sugerenciasRubro, setSugerenciasRubro] = React.useState<string[]>([]);
  const [rubroNegocio, setRubroNegocio] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiService
      .getConfiguracionGeneral()
      .then(async (config) => {
        const rubro = config?.rubroNegocio ?? null;
        setRubroNegocio(rubro);
        const hint = getAtributosTipicos(rubro);
        setSugerenciasRubro(hint ? hint.split(", ").filter(Boolean) : []);

        const columnasGuardadas = config?.columnasAtributosProducto ?? [];
        if (columnasGuardadas.length > 0) {
          setColumnasAtributos(columnasGuardadas);
          return;
        }

        // Sin columnas elegidas todavía: sembramos "vencimiento" (visible
        // por default históricamente, antes de que fuera togglable) + los
        // atributos fijos del rubro activo, si los tiene — una sola vez, no
        // pisa una elección manual porque solo corre cuando el array
        // guardado está vacío.
        const clavesFijas = getAtributosFijos(rubro).map((def) => def.clave);
        const seed = [...clavesFijas, COLUMNA_VENCIMIENTO];
        setColumnasAtributos(seed);
        try {
          await apiService.actualizarConfiguracionGeneral({
            columnasAtributosProducto: seed,
          });
        } catch {
          // No es crítico: la UI ya muestra las columnas, solo no quedó
          // persistida la preferencia hasta el próximo cambio manual.
        }
      })
      .catch(() => {
        setColumnasAtributos([]);
        setSugerenciasRubro([]);
        setRubroNegocio(null);
      });
  }, [activeSucursalId]);

  const clavesAtributosEnUso = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of statsItems) {
      if (p.atributosExtra && typeof p.atributosExtra === "object") {
        Object.keys(p.atributosExtra).forEach((k) => set.add(k));
      }
    }
    return Array.from(set);
  }, [statsItems]);

  // Las claves fijas del rubro (marca, sabor, puffs, etc.) tienen que ser
  // siempre candidatas, aunque ningún producto tenga ese dato cargado
  // todavía y aunque la clave no matchee ninguna palabra suelta del hint
  // de texto libre — si no, quedan seleccionadas por el seed automático
  // (ver Fase 4) sin ningún checkbox para poder sacarlas del picker.
  const clavesFijasDelRubro = React.useMemo(
    () => getAtributosFijos(rubroNegocio).map((def) => def.clave),
    [rubroNegocio],
  );

  // "vencimiento" no es un atributo de rubro (es Producto.fechaVencimiento,
  // un campo nativo) — se maneja aparte de columnasAtributos.map() más
  // abajo, pero comparte el mismo picker/array de columnas visibles porque
  // para el usuario es la misma decisión: "qué columna quiero ver".
  const candidatasAtributos = React.useMemo(
    () =>
      Array.from(
        new Set([
          COLUMNA_VENCIMIENTO,
          ...clavesAtributosEnUso,
          ...sugerenciasRubro,
          ...clavesFijasDelRubro,
        ]),
      ),
    [clavesAtributosEnUso, sugerenciasRubro, clavesFijasDelRubro],
  );

  // Loop genérico de columnasAtributos.map() (header/celdas) no debe
  // renderizar "vencimiento" — tiene su propia celda dedicada porque lee
  // p.fechaVencimiento, no p.atributosExtra.
  const columnasAtributosGenericos = React.useMemo(
    () => columnasAtributos.filter((c) => c !== COLUMNA_VENCIMIENTO),
    [columnasAtributos],
  );

  const labelAtributoFijo = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const def of getAtributosFijos(rubroNegocio)) {
      map.set(def.clave, def.label);
    }
    return map;
  }, [rubroNegocio]);

  // Rubros con forma marca+sabor (ej. vapes) auto-componen el nombre del
  // producto (ver producto-wizard-dialog.tsx) — mostrar ese texto de nuevo
  // en la columna "Producto" repite exactamente lo que ya dicen las
  // columnas Marca/Sabor/Puffs, así que ahí esa celda queda solo con
  // imagen y código de barras.
  const nombreEsAutoCompuesto = React.useMemo(() => {
    const defs = getAtributosFijos(rubroNegocio);
    return (
      defs.some((d) => d.clave === "marca") &&
      defs.some((d) => d.clave === "sabor")
    );
  }, [rubroNegocio]);

  const handleColumnasAtributosChange = async (nuevas: string[]) => {
    setColumnasAtributos(nuevas); // optimista
    try {
      await apiService.actualizarConfiguracionGeneral({
        columnasAtributosProducto: nuevas,
      });
    } catch {
      toast.error("No se pudo guardar la preferencia de columnas");
    }
  };

  // Debounce de búsqueda (400ms)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);

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
  }, [activeSucursalId, load, itemsPerPage]);

  // Al cambiar filtros de búsqueda/categoría (sin cambio de sucursal)
  React.useEffect(() => {
    load(1, debouncedQ, serverCategoriaId, itemsPerPage);
    setServerPage(1);
  }, [debouncedQ, serverCategoriaId, itemsPerPage, load]);

  // Wrapper sin argumentos para subcomponentes (reload de la página actual)
  const reload = React.useCallback(() => {
    load(serverPage, debouncedQ, serverCategoriaId, itemsPerPage);
  }, [load, serverPage, debouncedQ, serverCategoriaId, itemsPerPage]);

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
                        nombreEsAutoCompuesto={nombreEsAutoCompuesto}
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

function PaginationControls({
  itemsPerPage,
  setItemsPerPage,
  totalItems,
  currentItems,
  isMobile = false,
  serverPage,
  serverTotalPages,
  onServerPrev,
  onServerNext,
}: {
  itemsPerPage: number;
  setItemsPerPage: (v: number) => void;
  totalItems: number;
  currentItems: number;
  isMobile?: boolean;
  serverPage?: number;
  serverTotalPages?: number;
  onServerPrev?: () => void;
  onServerNext?: () => void;
}) {
  const page = serverPage ?? 1;
  const totalPages = serverTotalPages ?? 1;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/20",
        isMobile && "flex-col border rounded-xl bg-card",
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          Mostrando {currentItems} de{" "}
          <span className="font-bold text-foreground">{totalItems}</span>
        </span>
      </div>

      <div
        className={cn(
          "flex items-center gap-4",
          isMobile && "w-full justify-between",
        )}
      >
        {!isMobile && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filas:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(v) => setItemsPerPage(Number(v))}
            >
              <SelectTrigger className="h-8 w-[80px] text-xs font-bold">
                <SelectValue placeholder="10" />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="9999">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onServerPrev}
            disabled={!onServerPrev || page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm font-bold">{page}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={onServerNext}
            disabled={!onServerNext || page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortConfig;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSort.key === sortKey;
  return (
    <TableHead
      className={cn(
        "py-4 transition-colors cursor-pointer select-none hover:bg-muted/50 hover:text-foreground",
        className,
      )}
      onClick={() => onSort(sortKey)}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          className?.includes("text-right") && "justify-end",
          className?.includes("text-center") && "justify-center",
        )}
      >
        <span
          className={cn(
            "font-bold text-xs uppercase tracking-wider",
            isActive ? "text-primary" : "text-muted-foreground/70",
          )}
        >
          {label}
        </span>
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition-opacity",
            isActive ? "text-primary opacity-100" : "opacity-0",
          )}
        />
      </div>
    </TableHead>
  );
}

function ProductoRow({
  p,
  idx,
  load,
  isLow,
  isOut,
  columnasAtributos,
  nombreEsAutoCompuesto,
}: {
  p: ProductoViewItem;
  idx: number;
  load: () => void;
  isLow: boolean;
  isOut: boolean;
  columnasAtributos: string[];
  nombreEsAutoCompuesto: boolean;
}) {
  const desc = React.useMemo(
    () =>
      calcularDescuentoEfectivo({
        descuentoActivo: p.descuentoActivo ?? false,
        tipoDescuento: p.tipoDescuento,
        descuentoPorcentaje: p.descuentoPorcentaje ?? 0,
        descuentoMonto: p.descuentoMonto ?? 0,
        descuentoDesde: p.descuentoDesde ?? null,
        descuentoHasta: p.descuentoHasta ?? null,
        precioVenta: Number(p.precioVenta),
      }),
    [
      p.descuentoActivo,
      p.tipoDescuento,
      p.descuentoPorcentaje,
      p.descuentoMonto,
      p.descuentoDesde,
      p.descuentoHasta,
      p.precioVenta,
    ],
  );

  const precioEfectivo = desc?.precioFinal ?? Number(p.precioVenta);
  const tieneDescuento = desc !== null;
  const margenEfectivo = precioEfectivo - Number(p.precioCosto);
  return (
    <motion.tr
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
      className="group border-b border-border/40 hover:bg-muted/30 transition-colors"
    >
      <TableCell
        className={cn(
          "pl-6 py-4 max-w-0",
          nombreEsAutoCompuesto ? "w-16" : "w-[30%]",
        )}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-12 w-12 rounded-lg bg-muted/50 border border-border/60 overflow-hidden flex items-center justify-center shrink-0 relative">
            {p.imagenUrl ? (
              <Image
                src={p.imagenUrl}
                alt={p.nombre}
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>
          {/* Si el nombre se auto-compone desde Marca+Sabor+Puffs, mostrarlo
              acá de nuevo repite exactamente esas columnas — la celda queda
              solo con la imagen. El código de barras, cuando existe, sigue
              siendo buscable desde el buscador de arriba. */}
          {!nombreEsAutoCompuesto && (
            <div className="flex flex-col gap-1 min-w-0">
              <span
                className="font-bold text-foreground text-sm leading-none group-hover:text-primary transition-colors truncate"
                title={p.nombre}
              >
                {p.nombre}
              </span>
              <div className="flex items-center gap-2 pt-1">
                {p.codigoBarra ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 font-mono text-muted-foreground border-border/60 bg-background/50 gap-1 rounded-md"
                  >
                    <Barcode className="h-3 w-3 opacity-50" /> {p.codigoBarra}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40 italic">
                    Sin código
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </TableCell>

      {columnasAtributos
        .filter((clave) => clave !== COLUMNA_VENCIMIENTO)
        .map((clave) => (
          <TableCell
            key={clave}
            className="text-center text-sm text-muted-foreground"
          >
            {(p.atributosExtra as Record<string, string> | null | undefined)?.[
              clave
            ] ?? "—"}
          </TableCell>
        ))}

      <TableCell className="text-left">
        <div className="flex flex-col gap-1">
          {(() => {
            const catName = p.categoria?.nombre || "General";
            const color = p.categoria?.color
              ? getCategoryColorByKey(p.categoria.color)
              : getCategoryColorByName(catName);
            return (
              <Badge
                variant="secondary"
                className={cn(
                  "px-2.5 py-0.5 rounded-lg font-bold text-[10px] border uppercase tracking-tight gap-1.5 w-fit",
                  color.bg,
                  color.text,
                  color.border,
                )}
              >
                <div className={cn("h-1.5 w-1.5 rounded-full", color.dot)} />
                {catName}
              </Badge>
            );
          })()}
          {/* Si ya se muestra la columna "marca", la subcategoría suele
              repetir la misma info (ver openspec/columnas-fijas-por-rubro) */}
          {p.subcategoria && !columnasAtributos.includes("marca") && (
            <span className="text-[10px] text-muted-foreground font-medium ml-1">
              {p.subcategoria.nombre}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="text-center">
        {isOut ? (
          <Badge
            variant="destructive"
            className="rounded-full px-2 py-0 text-[10px] font-black uppercase"
          >
            Agotado
          </Badge>
        ) : isLow ? (
          <Badge className="bg-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] rounded-full px-2 py-0 text-[10px] font-black uppercase">
            Bajo Stock
          </Badge>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-[color:var(--status-success-strong)] dark:text-[color:var(--status-success-strong)]">
            <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--status-success-strong)] animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-tight">
              Disponible
            </span>
          </div>
        )}
      </TableCell>

      <TableCell className="text-center">
        <span
          className={cn(
            "text-sm font-bold tabular-nums",
            isOut
              ? "text-destructive"
              : isLow
                ? "text-[color:var(--status-warning)]"
                : "text-foreground",
          )}
        >
          {p.stockDisponibleUnits}
        </span>
      </TableCell>

      {columnasAtributos.includes(COLUMNA_VENCIMIENTO) && (
        <TableCell className="text-center">
          {(() => {
            if (!p.fechaVencimiento)
              return (
                <span className="text-[10px] text-muted-foreground/40 italic">
                  Sin venc.
                </span>
              );
            const expired = dateExpired(p.fechaVencimiento);
            const soon = isExpiringSoon(p.fechaVencimiento);
            return (
              <div className="flex flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums flex items-center gap-1",
                    expired
                      ? "text-[color:var(--status-danger)]"
                      : soon
                        ? "text-[color:var(--status-warning)]"
                        : "text-muted-foreground",
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {formatDateSafe(p.fechaVencimiento)}
                </span>
                {expired && (
                  <span className="text-[9px] font-black text-[color:var(--status-danger)] uppercase">
                    Vencido
                  </span>
                )}
                {soon && (
                  <span className="text-[9px] font-black text-[color:var(--status-warning)] uppercase">
                    Pronto
                  </span>
                )}
              </div>
            );
          })()}
        </TableCell>
      )}

      <TableCell className="text-right pr-6">
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {tieneDescuento && (
              <span className="text-[9px] font-black text-destructive bg-destructive/10 px-1 py-0.5 rounded-full leading-none">
                -{desc.porcentaje}%
              </span>
            )}
            <span
              className={cn(
                "font-black text-foreground text-sm tabular-nums",
                tieneDescuento && "line-through text-muted-foreground/60",
              )}
            >
              {formatMoney(p.precioVenta)}
            </span>
            {tieneDescuento && (
              <span className="font-black text-destructive text-sm tabular-nums">
                {formatMoney(precioEfectivo)}
              </span>
            )}
          </div>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 rounded-md tabular-nums",
              margenEfectivo < 0
                ? "text-destructive bg-destructive/10"
                : tieneDescuento
                  ? "text-[color:var(--status-warning)] bg-[color:var(--status-warning)]/10"
                  : "text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10",
            )}
          >
            Margen: {formatMoney(margenEfectivo)}
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[color:var(--status-warning)] hover:bg-[color:var(--status-warning)] dark:hover:bg-[color:var(--status-warning)]/30 rounded-lg"
                title="Ajustar Stock"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            }
          />
          <EditProductoDialog
            producto={p}
            onUpdated={load}
            onCategoriasChanged={load}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[color:var(--theme-ocean-primary)] hover:bg-[color:var(--theme-ocean-primary)] dark:hover:bg-[color:var(--theme-ocean-primary)]/30 rounded-lg"
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteButton
            id={p.id}
            nombre={p.nombre}
            onDeleted={load}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] dark:hover:bg-[color:var(--status-danger)]/30 rounded-lg"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </TableCell>
    </motion.tr>
  );
}

function MobileProductCard({
  p,
  idx,
  load,
  isLow,
  isOut,
  columnasAtributos,
  labelAtributoFijo,
}: {
  p: ProductoViewItem;
  idx: number;
  load: () => void;
  isLow: boolean;
  isOut: boolean;
  columnasAtributos: string[];
  labelAtributoFijo: Map<string, string>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
    >
      <Card className="p-4 bg-card border-border/50 shadow-sm rounded-2xl relative overflow-hidden space-y-3">
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1.5",
            isOut
              ? "bg-[color:var(--status-danger)]"
              : isLow
                ? "bg-[color:var(--status-warning)]"
                : "bg-[color:var(--status-success-strong)]",
          )}
        />

        <div className="flex justify-between items-start pl-3 gap-3">
          <div className="h-14 w-14 rounded-xl bg-muted/50 border border-border/60 overflow-hidden flex items-center justify-center shrink-0 relative">
            {p.imagenUrl ? (
              <Image
                src={p.imagenUrl}
                alt={p.nombre}
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-foreground text-sm leading-tight">
              {p.nombre}
            </h3>
            <div className="flex items-center gap-2">
              {(() => {
                const catName = p.categoria?.nombre || "General";
                const color = p.categoria?.color
                  ? getCategoryColorByKey(p.categoria.color)
                  : getCategoryColorByName(catName);
                return (
                  <div className="flex flex-col gap-0.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] h-5 px-1.5 font-bold border rounded-md gap-1 w-fit",
                        color.bg,
                        color.text,
                        color.border,
                      )}
                    >
                      <div
                        className={cn("h-1.5 w-1.5 rounded-full", color.dot)}
                      />
                      {catName}
                    </Badge>
                    {p.subcategoria && !columnasAtributos.includes("marca") && (
                      <span className="text-[10px] text-muted-foreground font-medium ml-1">
                        {p.subcategoria.nombre}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div className="text-right">
            <span className="block font-black text-lg text-primary tabular-nums">
              {formatMoney(p.precioVenta)}
            </span>
            {p.codigoBarra && (
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {p.codigoBarra}
              </span>
            )}
          </div>
        </div>

        {p.fechaVencimiento &&
          (() => {
            const expired = dateExpired(p.fechaVencimiento);
            const soon = isExpiringSoon(p.fechaVencimiento);
            return (
              <div
                className={cn(
                  "flex items-center gap-1.5 pl-3 text-[11px] font-bold",
                  expired
                    ? "text-[color:var(--status-danger)]"
                    : soon
                      ? "text-[color:var(--status-warning)]"
                      : "text-muted-foreground",
                )}
              >
                <Calendar className="h-3 w-3" />
                Vence: {formatDateSafe(p.fechaVencimiento)}
                {expired && (
                  <Badge
                    variant="destructive"
                    className="text-[9px] h-4 px-1 rounded-md ml-1"
                  >
                    Vencido
                  </Badge>
                )}
                {soon && (
                  <Badge className="bg-[color:var(--status-warning)] text-[9px] h-4 px-1 rounded-md ml-1">
                    Pronto
                  </Badge>
                )}
              </div>
            );
          })()}

        {columnasAtributos.length > 0 &&
          (() => {
            const atributos =
              (p.atributosExtra as Record<string, string> | null | undefined) ??
              {};
            const chips = columnasAtributos.filter((clave) => atributos[clave]);
            if (chips.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1 pl-3">
                {chips.map((clave) => (
                  <Badge
                    key={clave}
                    variant="outline"
                    className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground border-border/60 bg-background/50 rounded-md capitalize"
                  >
                    {labelAtributoFijo.get(clave) ?? clave}: {atributos[clave]}
                  </Badge>
                ))}
              </div>
            );
          })()}

        <div className="flex items-center justify-between pl-3 pr-1 pt-2 border-t border-dashed border-border/50 mt-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1",
                isOut
                  ? "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]"
                  : isLow
                    ? "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]"
                    : "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
              )}
            >
              <Package className="h-3.5 w-3.5" />
              {p.stockDisponibleUnits} uds.
            </span>
          </div>

          {/* â”€â”€ DROPDOWN DE ACCIONES (Mobile) â”€â”€ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl border-border/60"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-xl border-border/60 shadow-xl"
            >
              {/* Ajustar Stock */}
              <AjustarStockDialog
                producto={p}
                onUpdated={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-[color:var(--status-warning)] dark:text-[color:var(--status-warning)] cursor-pointer rounded-lg focus:text-[color:var(--status-warning)] focus:bg-[color:var(--status-warning)] dark:focus:bg-[color:var(--status-warning)]/40"
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
                onCategoriasChanged={load}
                trigger={
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 font-semibold text-[color:var(--theme-ocean-primary)] dark:text-[color:var(--theme-ocean-primary)] cursor-pointer rounded-lg focus:text-[color:var(--theme-ocean-primary)] focus:bg-[color:var(--theme-ocean-primary)] dark:focus:bg-[color:var(--theme-ocean-primary)]/40"
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
                    className="flex items-center gap-2.5 font-semibold text-[color:var(--status-danger)] dark:text-[color:var(--status-danger)] cursor-pointer rounded-lg focus:text-[color:var(--status-danger)] focus:bg-[color:var(--status-danger)] dark:focus:bg-[color:var(--status-danger)]/40"
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

function StatCard({
  label,
  value,
  icon: Icon,
  color = "default",
  trend,
  trendUp,
  onClick,
  clickable,
}: StatCardProps) {
  const colors = {
    default: "bg-primary/5 text-primary",
    blue: "bg-[color:var(--theme-ocean-primary)]/10 text-[color:var(--theme-ocean-primary)]",
    emerald:
      "bg-[color:var(--status-success-strong)]/10 text-[color:var(--status-success-strong)]",
    orange:
      "bg-[color:var(--status-warning)]/10 text-[color:var(--status-warning)]",
    red: "bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]",
  };

  return (
    <Card
      className={cn(
        "p-5 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm relative overflow-hidden group hover:bg-card/80 transition-all",
        clickable && "cursor-pointer hover:shadow-md hover:border-primary/40",
      )}
      onClick={clickable ? onClick : undefined}
    >
      {clickable && (
        <div className="absolute top-3 right-3 z-20">
          <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}
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
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {label}
          </p>
          <div className="flex items-end gap-2">
            <h3 className="text-2xl font-black tracking-tight text-foreground">
              {value}
            </h3>
          </div>
          {trend && (
            <p
              className={cn(
                "text-[10px] font-bold flex items-center gap-1",
                trendUp
                  ? "text-[color:var(--status-success-strong)]"
                  : "text-[color:var(--status-danger)]",
              )}
            >
              {trendUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
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

function DeleteButton({
  id,
  nombre,
  onDeleted,
  trigger,
}: {
  id: number;
  nombre: string;
  onDeleted: () => void;
  trigger: React.ReactNode;
}) {
  const [deleting, setDeleting] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiService.deleteProducto(id);
      toast.success("Eliminado correctamente");
      onDeleted();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
      setOpen(false);
    }
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {trigger}
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-[color:var(--status-danger)] dark:bg-[color:var(--status-danger)]/30 p-3 rounded-full w-fit mb-2">
              <AlertCircle className="h-8 w-8 text-[color:var(--status-danger)]" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-center">
              Â¿Eliminar producto?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-muted-foreground">
              Estás a punto de eliminar{" "}
              <span className="font-bold text-foreground">
                &quot;{nombre}&quot;
              </span>
              . Esta acción es irreversible y afectará los reportes de
              inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-3 sm:flex-row sm:justify-center pt-2">
            <AlertDialogCancel
              className="h-11 rounded-xl mt-0"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-xl bg-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)] text-[color:var(--ui-fx-white)] font-bold"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sí, eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
