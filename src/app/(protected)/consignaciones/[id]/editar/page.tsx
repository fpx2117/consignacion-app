//src/app/(protected)/consignaciones/[id]/editar/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  Package,
  Search,
  Loader2,
  Info,
  User,
  TrendingUp,
  Undo2,
  Archive,
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import type { Consignacion, Producto } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { SuccessDialog } from "@/components/success-dialog";
import { ErrorDialog } from "@/components/error-dialog";
import { HelpDialog } from "@/components/help-dialog";

type EditableItem = {
  productoId: number;
  nombre: string;
  precioVenta: number;
  unitsEntregadas: number;
  unitsVendidas: number;
  unitsDevueltas: number;
  originalEntregadas: number;
  originalVendidas: number;
  originalDevueltas: number;
  stockDisponible: number;
  isNew?: boolean;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function EditarConsignacionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<EditableItem[]>([]);
  const [allProducts, setAllProducts] = React.useState<Producto[]>([]);
  const [clienteNombre, setClienteNombre] = React.useState("");
  const [hasLiquidaciones, setHasLiquidaciones] = React.useState(false);

  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [selectedProdId, setSelectedProdId] = React.useState<number | "">("");
  const [addQty, setAddQty] = React.useState(1); // lo mantenés aunque ahora no lo uses

  const [showSuccess, setShowSuccess] = React.useState(false);
  const [showHelp, setShowHelp] = React.useState(false);
  const [errorDialog, setErrorDialog] = React.useState({
    open: false,
    title: "",
    description: "",
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      // ✅ AHORA devuelven data plano (sin .data)
      const [consignacion, productos] = await Promise.all([
        apiService.getConsignacion(id),
        apiService.getProductos(),
      ]);

      setClienteNombre(consignacion.cliente?.nombre || "Cliente");
      setAllProducts(productos);

      const _hasLiquidaciones = (consignacion.liquidaciones?.length ?? 0) > 0;
      setHasLiquidaciones(_hasLiquidaciones);

      const mappedItems: EditableItem[] = (consignacion.detalles || []).map((d: any) => {
        const realProd = productos.find((p) => p.id === d.productoId);

        return {
          productoId: d.productoId,
          nombre: d.producto?.nombre || realProd?.nombre || "Producto",
          precioVenta: Number(d.producto?.precioVenta ?? realProd?.precioVenta ?? 0),

          unitsEntregadas: Number(d.unitsEntregadas ?? 0),
          unitsVendidas: Number(d.unitsVendidasAcum ?? 0),
          unitsDevueltas: Number(d.unitsDevueltasAcum ?? 0),

          originalEntregadas: Number(d.unitsEntregadas ?? 0),
          originalVendidas: Number(d.unitsVendidasAcum ?? 0),
          originalDevueltas: Number(d.unitsDevueltasAcum ?? 0),

          stockDisponible: Number(realProd?.stockDisponibleUnits ?? 0),
        };
      });

      setItems(mappedItems);
    } catch (e: any) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: e?.message ?? "No se pudo cargar la consignación.",
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (id) loadData();
  }, [id, loadData]);

  const handleUpdateItem = (prodId: number, field: keyof EditableItem, val: number) => {
    if (val < 0) return;
    setItems((prev) =>
      prev.map((item) => (item.productoId === prodId ? { ...item, [field]: val } : item))
    );
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;

    for (const item of items) {
      const diff = item.unitsEntregadas - item.originalEntregadas;

      // Si aumentás entregadas, verificamos stock disponible del depósito
      if (diff > 0 && diff > item.stockDisponible) {
        setErrorDialog({
          open: true,
          title: "Stock Insuficiente",
          description: `En "${item.nombre}" faltan ${diff - item.stockDisponible} unidades en depósito.`,
        });
        return;
      }

      // Validación de consistencia
      if (item.unitsVendidas + item.unitsDevueltas > item.unitsEntregadas) {
        setErrorDialog({
          open: true,
          title: "Inconsistencia",
          description: `En "${item.nombre}", las unidades liquidadas exceden lo entregado.`,
        });
        return;
      }
    }

    setSaving(true);
    try {
      await apiService.updateConsignacion(id, {
        items: items.map((i) => ({
          productoId: i.productoId,
          unitsEntregadas: i.unitsEntregadas,

          // Si hay liquidaciones: no tocamos acumulados desde esta pantalla
          unitsVendidasAcum: hasLiquidaciones ? i.originalVendidas : i.unitsVendidas,
          unitsDevueltasAcum: hasLiquidaciones ? i.originalDevueltas : i.unitsDevueltas,
        })),
      });

      setShowSuccess(true);
    } catch (e: any) {
      setErrorDialog({
        open: true,
        title: "Error",
        description: e?.message ?? "No se pudieron guardar los cambios.",
      });
    } finally {
      setSaving(false);
    }
  };

  const totalEntregadas = items.reduce((a, b) => a + (Number(b.unitsEntregadas) || 0), 0);
  const totalValor = items.reduce((a, b) => a + (Number(b.unitsEntregadas) || 0) * (Number(b.precioVenta) || 0), 0);

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground italic">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4">
      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>

          <h1 className="text-3xl font-black">Corregir Operación Pendiente</h1>

          <div className="flex gap-2">
            <Badge variant="secondary">
              <User className="h-3 w-3 mr-1" /> {clienteNombre}
            </Badge>
            <Badge variant="outline" className="font-mono">
              #{id}
            </Badge>
          </div>
        </div>
      </div>

      {hasLiquidaciones && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 flex gap-4 items-start">
            <Info className="text-blue-600 h-5 w-5 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-blue-800">Detección de Movimientos</p>
              <p className="text-muted-foreground">
                Esta consignación ya tiene liquidaciones. Solo puedes editar las{" "}
                <strong>unidades entregadas</strong> (estructura). Las ventas se corrigen en la liquidación.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <CardHeader className="px-0 pt-0 pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Package className="h-5 w-5 text-indigo-500" /> Detalle de Mercadería
            </CardTitle>
          </CardHeader>

          {items.map((item) => (
            <Card key={item.productoId} className="overflow-hidden transition-all hover:border-primary/30">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{item.nombre}</h3>
                    <p className="text-xs text-muted-foreground">
                      Stock actual en depósito: {item.stockDisponible}
                    </p>
                  </div>

                  {!hasLiquidaciones && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setItems((prev) => prev.filter((i) => i.productoId !== item.productoId))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
                      <Archive className="h-3 w-3" /> Entregadas
                    </Label>
                    <Input
                      type="number"
                      value={item.unitsEntregadas}
                      onChange={(e) => handleUpdateItem(item.productoId, "unitsEntregadas", Number(e.target.value))}
                      className="h-11 font-bold bg-blue-500/5 border-blue-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-emerald-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Vendidas (Acum)
                    </Label>
                    <Input
                      type="number"
                      disabled={hasLiquidaciones}
                      value={item.unitsVendidas}
                      onChange={(e) => handleUpdateItem(item.productoId, "unitsVendidas", Number(e.target.value))}
                      className={cn("h-11 font-bold", hasLiquidaciones ? "bg-muted" : "bg-emerald-500/5 border-emerald-100")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1">
                      <Undo2 className="h-3 w-3" /> Devueltas (Acum)
                    </Label>
                    <Input
                      type="number"
                      disabled={hasLiquidaciones}
                      value={item.unitsDevueltas}
                      onChange={(e) => handleUpdateItem(item.productoId, "unitsDevueltas", Number(e.target.value))}
                      className={cn("h-11 font-bold", hasLiquidaciones ? "bg-muted" : "bg-amber-500/5 border-amber-100")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {!hasLiquidaciones && (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="p-6 flex flex-col sm:flex-row items-end gap-4">
                <div className="flex-1 space-y-2 w-full">
                  <Label className="text-xs font-bold uppercase">Añadir más productos</Label>

                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between h-10">
                        {selectedProdId
                          ? allProducts.find((p) => p.id === selectedProdId)?.nombre
                          : "Buscar..."}
                        <Search className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[300px] p-0">
                      <Command>
                        <CommandInput placeholder="Nombre..." />
                        <CommandList>
                          <CommandEmpty>No hay resultados.</CommandEmpty>
                          <CommandGroup>
                            {allProducts.map((p) => (
                              <CommandItem
                                key={p.id}
                                onSelect={() => {
                                  setSelectedProdId(p.id);
                                  setOpenCombobox(false);
                                }}
                              >
                                {p.nombre}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Button
                  onClick={() => {
                    const p = allProducts.find((x) => x.id === selectedProdId);
                    if (!p) return;

                    // ✅ evita duplicados
                    const exists = items.some((i) => i.productoId === p.id);
                    if (exists) {
                      setErrorDialog({
                        open: true,
                        title: "Producto ya agregado",
                        description: `"${p.nombre}" ya está en la consignación.`,
                      });
                      setSelectedProdId("");
                      return;
                    }

                    setItems((prev) => [
                      ...prev,
                      {
                        productoId: p.id,
                        nombre: p.nombre,
                        precioVenta: Number(p.precioVenta),
                        unitsEntregadas: 1,
                        unitsVendidas: 0,
                        unitsDevueltas: 0,
                        originalEntregadas: 0,
                        originalVendidas: 0,
                        originalDevueltas: 0,
                        stockDisponible: p.stockDisponibleUnits,
                        isNew: true,
                      },
                    ]);

                    setSelectedProdId("");
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Agregar
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-4">
          <Card className="sticky top-6 shadow-xl border-primary/20 bg-card">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <Info className="h-4 w-4" /> Resumen
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Entregado</span>
                  <span className="font-bold">{totalEntregadas} u.</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Estimado</span>
                  <span className="font-bold text-primary">{formatCurrency(totalValor)}</span>
                </div>
              </div>

              <Separator />

              <Button className="w-full h-12 font-bold" onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" /> Guardar Corrección
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SuccessDialog
        open={showSuccess}
        onOpenChange={setShowSuccess}
        title="Operación Corregida"
        description="Los cambios han sido aplicados. Si aumentaste las entregas, se descontaron del stock disponible."
        onConfirm={() => router.push(`/consignaciones/${id}`)}
        onCancel={() => router.push("/consignaciones")}
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(o) => setErrorDialog((p) => ({ ...p, open: o }))}
        title={errorDialog.title}
        description={errorDialog.description}
      />

      <HelpDialog open={showHelp} onOpenChange={setShowHelp} title="Guía de Edición" />
    </div>
  );
}