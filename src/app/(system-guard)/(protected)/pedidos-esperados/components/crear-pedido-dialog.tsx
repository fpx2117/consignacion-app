"use client";

import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";
import { apiService } from "@/lib/apiService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  X,
  Loader2,
  Package,
  Calendar,
  ClipboardList,
  PackagePlus,
  ZoomIn,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { useTimezone } from "@/hooks/useTimezone";
import { CreateProductoDialog } from "@/app/(system-guard)/(protected)/productos/components/create-producto-dialog";
import type { ProductoCreado } from "@/app/(system-guard)/(protected)/productos/components/create-producto-dialog";

interface ProductoBasico {
  id: number;
  nombre: string;
  sku?: string | null;
  codigoBarra?: string | null;
  stockDisponibleUnits: number;
  imagenUrl?: string | null;
  categoriaId?: number | null;
  categoriaNombre?: string | null;
  subcategoriaId?: number | null;
  subcategoriaNombre?: string | null;
}

interface CategoriaBasica {
  id: number;
  nombre: string;
}

interface ItemSeleccionado {
  productoId: number;
  nombre: string;
  sku?: string | null;
  cantidadEsperada: number;
  imagenUrl?: string | null;
}

interface CrearPedidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function getTodayStr(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

// Lightbox para imagen ampliada
function ImageVisor({ src, onClose }: { src: string; onClose: () => void }) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Imagen ampliada"
        className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function CrearPedidoDialog({
  open,
  onOpenChange,
  onSuccess,
}: CrearPedidoDialogProps) {
  const { tz } = useTimezone();
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const sucursalHeaders = React.useMemo<Record<string, string>>(
    () =>
      activeSucursalId
        ? { "x-sucursal-id": String(activeSucursalId) }
        : ({} as Record<string, string>),
    [activeSucursalId],
  );

  const [productos, setProductos] = React.useState<ProductoBasico[]>([]);
  const [categorias, setCategorias] = React.useState<CategoriaBasica[]>([]);
  const [loadingProductos, setLoadingProductos] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [categoriaFiltro, setCategoriaFiltro] = React.useState<number | null>(
    null,
  );
  const [subcategoriaFiltro, setSubcategoriaFiltro] = React.useState<
    number | null
  >(null);
  const [itemsSeleccionados, setItemsSeleccionados] = React.useState<
    ItemSeleccionado[]
  >([]);
  const [fechaEsperada, setFechaEsperada] = React.useState("");
  const [observaciones, setObservaciones] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [visorImagen, setVisorImagen] = React.useState<string | null>(null);

  // Cargar productos y categorías al abrir
  React.useEffect(() => {
    if (!open) {
      setBusqueda("");
      setCategoriaFiltro(null);
      setSubcategoriaFiltro(null);
      setItemsSeleccionados([]);
      setFechaEsperada("");
      setObservaciones("");
      return;
    }

    setLoadingProductos(true);
    const url = activeSucursalId
      ? `/api/productos?sucursalId=${activeSucursalId}`
      : "/api/productos";

    Promise.all([
      fetch(url, { headers: sucursalHeaders }).then((r) => r.json()),
      apiService.getCategorias(),
    ])
      .then(([data, cats]) => {
        const raw = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setProductos(
          raw
            .filter((p: { activo?: boolean }) => p.activo !== false)
            .map(
              (p: {
                id: number;
                nombre: string;
                sku?: string | null;
                codigoBarra?: string | null;
                stockDisponibleUnits: number;
                imagenUrl?: string | null;
                categoria?: { id: number; nombre: string } | null;
                subcategoria?: { id: number; nombre: string } | null;
              }) => ({
                id: p.id,
                nombre: p.nombre,
                sku: p.sku,
                codigoBarra: p.codigoBarra,
                stockDisponibleUnits: p.stockDisponibleUnits,
                imagenUrl: p.imagenUrl,
                categoriaId: p.categoria?.id ?? null,
                categoriaNombre: p.categoria?.nombre ?? null,
                subcategoriaId: p.subcategoria?.id ?? null,
                subcategoriaNombre: p.subcategoria?.nombre ?? null,
              }),
            ),
        );
        setCategorias(
          Array.isArray(cats)
            ? cats.map((c: { id: unknown; nombre: string }) => ({
                id: Number(c.id),
                nombre: c.nombre,
              }))
            : [],
        );
      })
      .catch((err: unknown) => {
        setProductos([]);
        toast.error(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los productos",
        );
      })
      .finally(() => setLoadingProductos(false));
  }, [open, activeSucursalId, sucursalHeaders]);

  // Reset subcategoría al cambiar categoría
  React.useEffect(() => {
    setSubcategoriaFiltro(null);
  }, [categoriaFiltro]);

  // Subcategorías disponibles para la categoría seleccionada
  const subcategorias = React.useMemo(() => {
    if (!categoriaFiltro) return [];
    const map = new Map<number, string>();
    for (const p of productos) {
      if (
        p.categoriaId === categoriaFiltro &&
        p.subcategoriaId &&
        p.subcategoriaNombre
      ) {
        map.set(p.subcategoriaId, p.subcategoriaNombre);
      }
    }
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [productos, categoriaFiltro]);

  const hayFiltroActivo =
    busqueda.trim().length > 0 || categoriaFiltro !== null;

  const productosFiltrados = React.useMemo(() => {
    if (!hayFiltroActivo) return [];
    const term = busqueda.toLowerCase().trim();
    return productos.filter((p) => {
      const matchCategoria =
        categoriaFiltro === null || p.categoriaId === categoriaFiltro;
      const matchSubcategoria =
        subcategoriaFiltro === null || p.subcategoriaId === subcategoriaFiltro;
      const matchBusqueda =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.codigoBarra && p.codigoBarra.toLowerCase().includes(term));
      return matchCategoria && matchSubcategoria && matchBusqueda;
    });
  }, [
    productos,
    busqueda,
    categoriaFiltro,
    subcategoriaFiltro,
    hayFiltroActivo,
  ]);

  const yaSeleccionado = (id: number) =>
    itemsSeleccionados.some((i) => i.productoId === id);

  function agregarProducto(p: ProductoBasico) {
    if (yaSeleccionado(p.id)) return;
    setItemsSeleccionados((prev) => [
      ...prev,
      {
        productoId: p.id,
        nombre: p.nombre,
        sku: p.sku ?? p.codigoBarra,
        cantidadEsperada: 1,
        imagenUrl: p.imagenUrl,
      },
    ]);
    setBusqueda("");
  }

  function quitarProducto(productoId: number) {
    setItemsSeleccionados((prev) =>
      prev.filter((i) => i.productoId !== productoId),
    );
  }

  function setCantidad(productoId: number, cantidad: number) {
    setItemsSeleccionados((prev) =>
      prev.map((i) =>
        i.productoId === productoId
          ? { ...i, cantidadEsperada: Math.max(1, cantidad) }
          : i,
      ),
    );
  }

  function recargarProductos() {
    const url = activeSucursalId
      ? `/api/productos?sucursalId=${activeSucursalId}`
      : "/api/productos";
    fetch(url, { headers: sucursalHeaders })
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        setProductos(
          raw
            .filter((p: { activo?: boolean }) => p.activo !== false)
            .map(
              (p: {
                id: number;
                nombre: string;
                sku?: string | null;
                codigoBarra?: string | null;
                stockDisponibleUnits: number;
                imagenUrl?: string | null;
                categoria?: { id: number; nombre: string } | null;
                subcategoria?: { id: number; nombre: string } | null;
              }) => ({
                id: p.id,
                nombre: p.nombre,
                sku: p.sku,
                codigoBarra: p.codigoBarra,
                stockDisponibleUnits: p.stockDisponibleUnits,
                imagenUrl: p.imagenUrl,
                categoriaId: p.categoria?.id ?? null,
                categoriaNombre: p.categoria?.nombre ?? null,
                subcategoriaId: p.subcategoria?.id ?? null,
                subcategoriaNombre: p.subcategoria?.nombre ?? null,
              }),
            ),
        );
      })
      .catch(() => {});
  }

  function handleProductoCreado(p: ProductoCreado) {
    if (yaSeleccionado(p.id)) return;
    setItemsSeleccionados((prev) => [
      ...prev,
      {
        productoId: p.id,
        nombre: p.nombre,
        sku: p.sku ?? p.codigoBarra,
        cantidadEsperada: 1,
        imagenUrl: null,
      },
    ]);
    setBusqueda("");
    recargarProductos();
  }

  const canSubmit =
    itemsSeleccionados.length > 0 &&
    itemsSeleccionados.every((i) => i.cantidadEsperada > 0) &&
    fechaEsperada !== "" &&
    fechaEsperada >= getTodayStr(tz);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || saving) return;

    setSaving(true);
    try {
      const payload = {
        sucursalId: activeSucursalId,
        fechaEsperada: `${fechaEsperada}T23:59:59.000Z`,
        observaciones: observaciones.trim() || undefined,
        items: itemsSeleccionados.map((i) => ({
          productoId: i.productoId,
          cantidadEsperada: i.cantidadEsperada,
        })),
      };

      const res = await fetch("/api/pedidos-esperados", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sucursalHeaders },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al crear pedido");
      }

      toast.success("Pedido creado correctamente");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al crear el pedido",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {visorImagen && (
        <ImageVisor src={visorImagen} onClose={() => setVisorImagen(null)} />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[660px] p-0 overflow-hidden border-none shadow-2xl bg-background">
          {/* HEADER */}
          <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
            <div className="flex items-center gap-2.5 text-primary">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold italic tracking-tight">
                  Nuevo Pedido Esperado
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs mt-0.5">
                  Programá la llegada de productos al stock
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
          >
            {/* BUSCADOR DE PRODUCTOS */}
            <div className="space-y-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Agregar Productos
              </Label>

              {/* Filtros CATEGORÍA */}
              {categorias.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <FilterPill
                      active={categoriaFiltro === null}
                      onClick={() => setCategoriaFiltro(null)}
                    >
                      Todas
                    </FilterPill>
                    {categorias.map((cat) => (
                      <FilterPill
                        key={cat.id}
                        active={categoriaFiltro === cat.id}
                        onClick={() =>
                          setCategoriaFiltro(
                            categoriaFiltro === cat.id ? null : cat.id,
                          )
                        }
                      >
                        {cat.nombre}
                      </FilterPill>
                    ))}
                  </div>

                  {/* Filtros SUBCATEGORÍA */}
                  {categoriaFiltro !== null && subcategorias.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-2 border-l-2 border-primary/20 ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <FilterPill
                        active={subcategoriaFiltro === null}
                        onClick={() => setSubcategoriaFiltro(null)}
                        variant="sub"
                      >
                        <ChevronRight className="h-2.5 w-2.5 opacity-60" />
                        Todas
                      </FilterPill>
                      {subcategorias.map((sub) => (
                        <FilterPill
                          key={sub.id}
                          active={subcategoriaFiltro === sub.id}
                          onClick={() =>
                            setSubcategoriaFiltro(
                              subcategoriaFiltro === sub.id ? null : sub.id,
                            )
                          }
                          variant="sub"
                        >
                          <ChevronRight className="h-2.5 w-2.5 opacity-60" />
                          {sub.nombre}
                        </FilterPill>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Input búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por nombre, SKU o código..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 h-11 bg-muted/30 border-transparent focus:bg-background rounded-xl"
                  disabled={loadingProductos}
                />
                {loadingProductos ? (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  busqueda && (
                    <button
                      type="button"
                      onClick={() => setBusqueda("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>

              {/* Resultados */}
              {hayFiltroActivo && (
                <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-lg max-h-64 overflow-y-auto">
                  {productosFiltrados.length === 0 ? (
                    <div className="p-5 text-center space-y-3">
                      <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Sin resultados{busqueda ? ` para "${busqueda}"` : ""}
                      </p>
                      <CreateProductoDialog
                        onProductoCreado={handleProductoCreado}
                        trigger={
                          <button
                            type="button"
                            className="flex items-center gap-2 mx-auto text-xs font-bold text-primary hover:underline"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {busqueda
                              ? `Crear "${busqueda}" como nuevo producto`
                              : "Crear nuevo producto"}
                          </button>
                        }
                      />
                    </div>
                  ) : (
                    productosFiltrados.map((p, idx) => {
                      const selected = yaSeleccionado(p.id);
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 border-b border-border/30 last:border-0 transition-colors",
                            idx % 2 === 0 ? "bg-background" : "bg-muted/20",
                            selected ? "opacity-50" : "hover:bg-primary/5",
                          )}
                        >
                          {/* Imagen con lightbox */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (p.imagenUrl) setVisorImagen(p.imagenUrl);
                            }}
                            className={cn(
                              "h-11 w-11 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/40",
                              p.imagenUrl
                                ? "cursor-zoom-in hover:ring-2 hover:ring-primary/40 transition-all group"
                                : "cursor-default",
                            )}
                          >
                            {p.imagenUrl ? (
                              <div className="relative h-11 w-11">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.imagenUrl}
                                  alt={p.nombre}
                                  className="h-11 w-11 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                  <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>

                          {/* Nombre + categorías */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm leading-tight">
                              {p.nombre}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {p.categoriaNombre && (
                                <span className="text-[10px] font-bold text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-full border border-primary/15">
                                  {p.categoriaNombre}
                                </span>
                              )}
                              {p.subcategoriaNombre && (
                                <span className="text-[10px] text-muted-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded-full">
                                  {p.subcategoriaNombre}
                                </span>
                              )}
                              {p.sku && (
                                <span className="text-[10px] font-mono text-muted-foreground/60">
                                  {p.sku}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stock + botón */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                p.stockDisponibleUnits === 0
                                  ? "text-destructive bg-destructive/10"
                                  : "text-muted-foreground bg-muted/60",
                              )}
                            >
                              Stock {p.stockDisponibleUnits}
                            </span>
                            {selected ? (
                              <div className="h-8 w-8 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success-strong)]" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => agregarProducto(p)}
                                className="h-8 w-8 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground flex items-center justify-center transition-colors shrink-0"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* CREAR NUEVO PRODUCTO */}
            <CreateProductoDialog
              onProductoCreado={handleProductoCreado}
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors group"
                >
                  <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 group-hover:border-primary/60 flex items-center justify-center transition-colors">
                    <Plus className="h-3 w-3" />
                  </div>
                  Crear nuevo producto y agregarlo
                </button>
              }
            />

            {/* LISTA DE ITEMS SELECCIONADOS */}
            {itemsSeleccionados.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Productos seleccionados
                  </Label>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {itemsSeleccionados.length}
                  </span>
                </div>
                <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                  {itemsSeleccionados.map((item) => (
                    <div
                      key={item.productoId}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-background border border-border/30 shadow-sm hover:border-border/60 transition-colors"
                    >
                      {/* Imagen con lightbox */}
                      <button
                        type="button"
                        onClick={() => {
                          if (item.imagenUrl) setVisorImagen(item.imagenUrl);
                        }}
                        className={cn(
                          "h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden border border-border/30",
                          item.imagenUrl
                            ? "cursor-zoom-in hover:ring-2 hover:ring-primary/40 transition-all group relative"
                            : "cursor-default",
                        )}
                      >
                        {item.imagenUrl ? (
                          <div className="relative h-10 w-10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imagenUrl}
                              alt={item.nombre}
                              className="h-10 w-10 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground leading-tight">
                          {item.nombre}
                        </p>
                        {item.sku && (
                          <p className="text-[10px] font-mono text-muted-foreground/70">
                            {item.sku}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground/60 hidden sm:block">
                          Cant.
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.cantidadEsperada}
                          onChange={(e) =>
                            setCantidad(item.productoId, Number(e.target.value))
                          }
                          className="w-20 h-8 text-center font-bold rounded-lg bg-muted/30 border-transparent text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0 transition-colors"
                          onClick={() => quitarProducto(item.productoId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FECHA ESTIMADA */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Fecha estimada de llegada
              </Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="date"
                  min={getTodayStr(tz)}
                  value={fechaEsperada}
                  onChange={(e) => setFechaEsperada(e.target.value)}
                  className="pl-9 h-11 bg-muted/30 border-transparent rounded-xl"
                />
              </div>
              {fechaEsperada && fechaEsperada < getTodayStr(tz) && (
                <p className="text-xs text-destructive font-bold">
                  La fecha debe ser hoy o en el futuro
                </p>
              )}
            </div>

            {/* OBSERVACIONES */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Observaciones{" "}
                <span className="normal-case font-normal text-muted-foreground/60">
                  (opcional)
                </span>
              </Label>
              <Textarea
                placeholder="Ej: Pedido urgente, llamar al proveedor antes..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value.slice(0, 500))}
                maxLength={500}
                className="resize-none rounded-xl bg-muted/30 border-transparent min-h-[80px] text-sm focus:bg-background"
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {observaciones.length}/500
              </p>
            </div>

            <DialogFooter className="pt-2 gap-3 flex-col sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 rounded-xl"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 h-11 rounded-xl font-bold shadow-lg shadow-primary/20"
                disabled={!canSubmit || saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <PackagePlus className="h-4 w-4" />
                    Crear Pedido
                  </span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Componente pill reutilizable
function FilterPill({
  active,
  onClick,
  children,
  variant = "main",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "main" | "sub";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full font-bold transition-all",
        variant === "main"
          ? "px-3 py-1 text-[11px]"
          : "px-2.5 py-0.5 text-[10px]",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
          : variant === "main"
            ? "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
      )}
    >
      {children}
    </button>
  );
}
