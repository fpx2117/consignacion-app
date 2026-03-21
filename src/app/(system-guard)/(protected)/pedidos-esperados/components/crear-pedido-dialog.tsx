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

// Fecha mínima: hoy en el timezone configurado
function getTodayStr(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export function CrearPedidoDialog({ open, onOpenChange, onSuccess }: CrearPedidoDialogProps) {
  const { tz } = useTimezone();
  const activeSucursalId = useSucursalStore((s) => s.activeSucursalId);
  const sucursalHeaders = React.useMemo<Record<string, string>>(
    () => activeSucursalId ? { "x-sucursal-id": String(activeSucursalId) } : {} as Record<string, string>,
    [activeSucursalId]
  );

  const [productos, setProductos] = React.useState<ProductoBasico[]>([]);
  const [categorias, setCategorias] = React.useState<CategoriaBasica[]>([]);
  const [loadingProductos, setLoadingProductos] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [categoriaFiltro, setCategoriaFiltro] = React.useState<number | null>(null);
  const [itemsSeleccionados, setItemsSeleccionados] = React.useState<ItemSeleccionado[]>([]);
  const [fechaEsperada, setFechaEsperada] = React.useState("");
  const [observaciones, setObservaciones] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Cargar productos y categorías al abrir
  React.useEffect(() => {
    if (!open) {
      setBusqueda("");
      setCategoriaFiltro(null);
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
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setProductos(arr.filter((p: { activo?: boolean }) => p.activo !== false));
        setCategorias(Array.isArray(cats) ? cats.map((c: { id: unknown; nombre: string }) => ({ id: Number(c.id), nombre: c.nombre })) : []);
      })
      .catch((err: unknown) => {
        setProductos([]);
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los productos");
      })
      .finally(() => setLoadingProductos(false));
  }, [open, activeSucursalId, sucursalHeaders]);

  // Filtrado: muestra resultados si hay búsqueda o categoría seleccionada
  const hayFiltroActivo = busqueda.trim().length > 0 || categoriaFiltro !== null;

  const productosFiltrados = React.useMemo(() => {
    if (!hayFiltroActivo) return [];
    const term = busqueda.toLowerCase().trim();
    return productos.filter((p) => {
      const matchCategoria = categoriaFiltro === null || p.categoriaId === categoriaFiltro;
      const matchBusqueda =
        !term ||
        p.nombre.toLowerCase().includes(term) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.codigoBarra && p.codigoBarra.toLowerCase().includes(term));
      return matchCategoria && matchBusqueda;
    });
  }, [productos, busqueda, categoriaFiltro, hayFiltroActivo]);

  const yaSeleccionado = (id: number) => itemsSeleccionados.some((i) => i.productoId === id);

  function agregarProducto(p: ProductoBasico) {
    if (yaSeleccionado(p.id)) return;
    setItemsSeleccionados((prev) => [
      ...prev,
      { productoId: p.id, nombre: p.nombre, sku: p.sku ?? p.codigoBarra, cantidadEsperada: 1, imagenUrl: p.imagenUrl },
    ]);
    setBusqueda("");
  }

  function quitarProducto(productoId: number) {
    setItemsSeleccionados((prev) => prev.filter((i) => i.productoId !== productoId));
  }

  function setCantidad(productoId: number, cantidad: number) {
    setItemsSeleccionados((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, cantidadEsperada: Math.max(1, cantidad) } : i))
    );
  }

  function recargarProductos() {
    const url = activeSucursalId ? `/api/productos?sucursalId=${activeSucursalId}` : "/api/productos";
    fetch(url, { headers: sucursalHeaders })
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setProductos(arr.filter((p: { activo?: boolean }) => p.activo !== false));
      })
      .catch(() => {});
  }

  function handleProductoCreado(p: ProductoCreado) {
    if (yaSeleccionado(p.id)) return;
    setItemsSeleccionados((prev) => [
      ...prev,
      { productoId: p.id, nombre: p.nombre, sku: p.sku ?? p.codigoBarra, cantidadEsperada: 1, imagenUrl: null },
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
        headers: {
          "Content-Type": "application/json",
          ...sucursalHeaders,
        },
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
      toast.error(err instanceof Error ? err.message : "Error al crear el pedido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] p-0 overflow-hidden border-none shadow-2xl bg-background">
        <DialogHeader className="p-6 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary">
            <ClipboardList className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold italic tracking-tight">Nuevo Pedido Esperado</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            Programá la llegada de productos al stock
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* BUSCADOR DE PRODUCTOS */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Agregar Productos</Label>

            {/* Filtros por categoría */}
            {categorias.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategoriaFiltro(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors",
                    categoriaFiltro === null
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  )}
                >
                  Todas
                </button>
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoriaFiltro(categoriaFiltro === cat.id ? null : cat.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors",
                      categoriaFiltro === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cat.nombre}
                  </button>
                ))}
              </div>
            )}

            {/* Input búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar por nombre, SKU o código..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-11 bg-muted/30 border-transparent focus:bg-background"
                disabled={loadingProductos}
              />
              {loadingProductos && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Resultados */}
            {hayFiltroActivo && (
              <div className="border border-border/60 rounded-xl overflow-hidden bg-background shadow-md max-h-64 overflow-y-auto">
                {productosFiltrados.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center space-y-2">
                    <p>Sin resultados{busqueda ? ` para "${busqueda}"` : ""}</p>
                    <CreateProductoDialog
                      onProductoCreado={handleProductoCreado}
                      trigger={
                        <button type="button" className="flex items-center gap-2 mx-auto text-xs font-bold text-primary hover:underline">
                          <Plus className="h-3.5 w-3.5" />
                          {busqueda ? `Crear "${busqueda}" como nuevo producto` : "Crear nuevo producto"}
                        </button>
                      }
                    />
                  </div>
                ) : (
                  productosFiltrados.map((p) => {
                    const selected = yaSeleccionado(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => agregarProducto(p)}
                        disabled={selected}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-sm text-left border-b border-border/40 last:border-0 transition-colors",
                          selected
                            ? "opacity-40 cursor-not-allowed bg-muted/30"
                            : "hover:bg-muted/50 cursor-pointer"
                        )}
                      >
                        {/* Imagen o ícono */}
                        <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
                          {p.imagenUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imagenUrl} alt={p.nombre} className="h-10 w-10 object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        {/* Nombre completo + SKU */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm leading-tight">{p.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.categoriaNombre && (
                              <span className="text-[10px] font-bold text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded-full">
                                {p.categoriaNombre}
                              </span>
                            )}
                            {p.sku && (
                              <span className="text-[10px] font-mono text-muted-foreground">{p.sku}</span>
                            )}
                          </div>
                        </div>

                        {/* Stock + acción */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Stock: {p.stockDisponibleUnits}
                          </span>
                          {selected ? (
                            <span className="text-[10px] font-bold text-[color:var(--status-success-strong)] bg-[color:var(--status-success-strong)]/10 px-1.5 py-0.5 rounded-md">Agregado</span>
                          ) : (
                            <Plus className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
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
              <button type="button" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                <Plus className="h-3.5 w-3.5" />
                Crear nuevo producto y agregarlo
              </button>
            }
          />

          {/* LISTA DE ITEMS SELECCIONADOS */}
          {itemsSeleccionados.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Productos seleccionados ({itemsSeleccionados.length})
              </Label>
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
                {itemsSeleccionados.map((item) => (
                  <div
                    key={item.productoId}
                    className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border/40"
                  >
                    {/* Imagen miniatura */}
                    <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.imagenUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imagenUrl} alt={item.nombre} className="h-9 w-9 object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground leading-tight">{item.nombre}</p>
                      {item.sku && (
                        <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground/70 hidden sm:block">
                        Cant.
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.cantidadEsperada}
                        onChange={(e) => setCantidad(item.productoId, Number(e.target.value))}
                        className="w-20 h-8 text-center font-bold rounded-lg bg-muted/30 border-transparent text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10 rounded-lg shrink-0"
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
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Fecha estimada de llegada
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="date"
                min={getTodayStr(tz)}
                value={fechaEsperada}
                onChange={(e) => setFechaEsperada(e.target.value)}
                className="pl-9 h-11 bg-muted/30 border-transparent"
              />
            </div>
            {fechaEsperada && fechaEsperada < getTodayStr(tz) && (
              <p className="text-xs text-[color:var(--status-danger)] font-bold">La fecha debe ser hoy o en el futuro</p>
            )}
          </div>

          {/* OBSERVACIONES */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Observaciones <span className="normal-case font-normal text-muted-foreground/60">(opcional)</span>
            </Label>
            <Textarea
              placeholder="Ej: Pedido urgente, llamar al proveedor antes..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value.slice(0, 500))}
              maxLength={500}
              className="resize-none rounded-xl bg-muted/30 border-transparent min-h-[80px] text-sm focus:bg-background"
            />
            <p className="text-[10px] text-muted-foreground text-right">{observaciones.length}/500</p>
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
  );
}
