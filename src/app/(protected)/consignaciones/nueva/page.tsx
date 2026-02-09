"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Trash2, Loader2, User, Package, ArrowLeft, ShoppingCart,
  Search, UserPlus, Info, ChevronRight, BadgePercent, AlertTriangle 
} from "lucide-react";

import { toast } from "sonner";

import { apiService } from "@/lib/apiService";
import type { Cliente, Producto } from "@/lib/types";

// IMPORTAMOS LOS COMPONENTES DE DIÁLOGO
import { SuccessDialog } from "@/components/success-dialog";
import { ErrorDialog } from "@/components/error-dialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreateClienteDialog } from "./../../clientes/components/create-cliente-dialog";
import { 
  Command, CommandEmpty, CommandGroup, CommandInput, 
  CommandItem, CommandList 
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Extendemos el tipo Producto para asegurar que TS reconozca el stock
type ProductoConStock = Producto & { stockDisponibleUnits?: number };
type Item = { productoId: number; unitsEntregadas: number; producto?: ProductoConStock };

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
};

export default function NuevaConsignacionPage() {
  const router = useRouter();

  // --- States ---
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [productos, setProductos] = React.useState<ProductoConStock[]>([]);
  const [clienteId, setClienteId] = React.useState<number | "">("");
  const [productoId, setProductoId] = React.useState<number | "">("");
  const [units, setUnits] = React.useState<number>(1);
  const [porcentajeAumento, setPorcentajeAumento] = React.useState<number>(0);
  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // --- Dialog States ---
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [createdId, setCreatedId] = React.useState<number | null>(null);
  const [errorDialog, setErrorDialog] = React.useState({ 
    open: false, 
    title: "", 
    description: "" 
  });

  // --- Helper de Cálculo ---
  const aplicarAumento = (precio: number) => precio * (1 + porcentajeAumento / 100);

  // --- Initial Load ---
  const fetchData = React.useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        apiService.getClientes(),
        apiService.getProductos(),
      ]);
      
      // FILTRO: Excluir "Consumidor Final" (case insensitive)
      const clientesFiltrados = (c.data as any).filter((cliente: Cliente) => 
        cliente.nombre.toLowerCase() !== "consumidor final"
      );

      setClientes(clientesFiltrados);
      setProductos(p.data as any);
    } catch (err) {
      setError("Error al cargar datos iniciales.");
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // --- Logic for Selected Product ---
  const selectedProducto = productos.find((p) => p.id === productoId);
  // Validamos si el stock es 0 o menor
  const isAgotado = selectedProducto ? (selectedProducto.stockDisponibleUnits ?? 0) <= 0 : false;

  const addItem = () => {
    setError(null);
    if (!productoId || units <= 0) return;

    // Bloqueo extra por seguridad si está agotado
    if (isAgotado) {
       setErrorDialog({ open: true, title: "Stock Agotado", description: "No puedes agregar un producto sin stock." });
       return;
    }

    setItems((prev) => {
      const exists = prev.find((i) => i.productoId === productoId);
      if (exists) {
        return prev.map((i) =>
          i.productoId === productoId
            ? { ...i, unitsEntregadas: i.unitsEntregadas + units }
            : i
        );
      }
      return [...prev, { productoId: Number(productoId), unitsEntregadas: units, producto: selectedProducto }];
    });

    setProductoId("");
    setUnits(1);
  };

  const removeItem = (pid: number) => setItems((prev) => prev.filter((i) => i.productoId !== pid));

  const totalUnits = items.reduce((acc, curr) => acc + curr.unitsEntregadas, 0);
  
  // Cálculo del total visual (con el aumento aplicado)
  const totalAmount = items.reduce((acc, curr) => {
    const precioBase = curr.producto?.precioVenta || 0;
    return acc + (aplicarAumento(precioBase) * curr.unitsEntregadas);
  }, 0);

  // --- Submit Handler ---
  const submit = async () => {
    setError(null);
    
    if (!clienteId) {
       setErrorDialog({ open: true, title: "Falta Cliente", description: "Por favor selecciona un destinatario para la consignación." });
       return;
    }
    if (items.length === 0) {
       setErrorDialog({ open: true, title: "Carrito Vacío", description: "Debes agregar al menos un producto a la lista." });
       return;
    }

    setLoading(true);
    try {
      const res = await apiService.createConsignacion({
        clienteId: Number(clienteId),
        porcentajeAumento: porcentajeAumento,
        items: items.map((i) => ({ productoId: i.productoId, unitsEntregadas: i.unitsEntregadas })),
      });
      
      setCreatedId(res.data.id);
      setShowSuccessDialog(true);

    } catch (e: any) {
      let title = "Error en la operación";
      let desc = e?.message || "Ocurrió un error inesperado al procesar la solicitud.";
      
      setErrorDialog({ open: true, title, description: desc });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
  if (!createdId) return;

  try {
    const url = await apiService.getConsignacionPdfUrl(createdId);

    window.open(url, "_blank");
    router.push(`/consignaciones/${createdId}`);
  } catch (error) {
    console.error(error);
    toast.error("No se pudo generar el remito PDF");
  }
};

const handleClose = () => {
  if (createdId) router.push(`/consignaciones/${createdId}`);
};

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 lg:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
        </Button>
        <h1 className="text-4xl font-black tracking-tight text-foreground">Nueva Consignación</h1>
        <p className="text-muted-foreground">Genera una nueva entrega de mercadería a un cliente.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: INPUTS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CLIENTE CARD */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm dark:bg-zinc-900/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <User className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Cliente
                </CardTitle>
              </div>
              <CreateClienteDialog 
                onCreated={fetchData} 
                trigger={
                  <Button variant="outline" size="sm" className="gap-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-500/30 dark:text-indigo-400 dark:bg-transparent dark:hover:bg-indigo-500/10">
                    <UserPlus className="h-4 w-4" /> Crear Nuevo
                  </Button>
                } 
              />
            </CardHeader>
            <CardContent>
              <div className="relative">
                <select
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none dark:bg-black/40"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="" className="text-muted-foreground">Seleccionar destinatario...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id} className="text-foreground bg-background dark:bg-zinc-900">{c.nombre}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AJUSTE DE PRECIOS CARD (CON ATAJOS) */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm border-l-4 border-l-emerald-500 dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <BadgePercent className="h-5 w-5 text-emerald-500" /> Ajuste de Precios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-full sm:w-36 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Porcentaje</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      value={porcentajeAumento}
                      onChange={(e) => setPorcentajeAumento(Number(e.target.value))}
                      className="h-14 text-2xl font-black text-emerald-600 dark:text-emerald-400 text-center pr-8 focus-visible:ring-emerald-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-emerald-600">%</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-2">
                   <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Atajos Rápidos</Label>
                   <div className="flex flex-wrap gap-2">
                      {[5, 10, 15, 20].map((num) => (
                        <Button 
                          key={num} 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setPorcentajeAumento(num)}
                          className={`rounded-lg transition-all ${porcentajeAumento === num 
                            ? "bg-emerald-100 border-emerald-500 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" 
                            : "border-dashed hover:border-emerald-300 hover:text-emerald-600"}`}
                        >
                          +{num}%
                        </Button>
                      ))}
                      {porcentajeAumento > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setPorcentajeAumento(0)} className="text-xs text-muted-foreground underline hover:text-destructive">
                          Limpiar
                        </Button>
                      )}
                   </div>
                   <p className="text-xs text-muted-foreground pt-1 italic">
                     Se aplicará un aumento del {porcentajeAumento}% sobre el precio base.
                   </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PRODUCTO CARD */}
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm dark:bg-zinc-900/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <Package className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Agregar Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Producto</Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={`w-full justify-between h-12 border-input bg-background text-left font-normal text-foreground hover:bg-muted dark:bg-black/40 dark:hover:bg-black/60 ${isAgotado ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10" : ""}`}
                        disabled={loading}
                      >
                        {productoId 
                          ? <span className="truncate flex items-center gap-2">
                              {productos.find((p) => p.id === productoId)?.nombre}
                              {isAgotado && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">AGOTADO</Badge>}
                            </span>
                          : <span className="text-muted-foreground">Buscar producto...</span>}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] sm:w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar..." />
                        <CommandList>
                          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No encontrado.</CommandEmpty>
                          <CommandGroup>
                            {productos.map((p) => {
                               const agotado = (p.stockDisponibleUnits ?? 0) <= 0;
                               return (
                                <CommandItem
                                  key={p.id}
                                  value={p.nombre}
                                  onSelect={() => { 
                                    setProductoId(p.id); 
                                    setOpenCombobox(false); 
                                  }}
                                  disabled={false} // Permitimos seleccionarlo para mostrar el error, o podrias poner true para bloquearlo
                                  className="flex justify-between items-center py-3 cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <span className={`text-sm font-medium ${agotado ? "text-muted-foreground decoration-slate-400" : ""}`}>
                                      {p.nombre}
                                    </span>
                                    <span className={`text-[10px] ${agotado ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                                      {agotado ? "SIN STOCK" : `Stock: ${p.stockDisponibleUnits}`}
                                    </span>
                                  </div>
                                  <Badge variant={agotado ? "outline" : "secondary"} className={agotado ? "border-red-200 text-red-300" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border-none"}>
                                    {formatCurrency(p.precioVenta)}
                                  </Badge>
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="w-full sm:w-32 space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Cantidad</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      value={units}
                      onChange={(e) => setUnits(Number(e.target.value))}
                      disabled={isAgotado}
                      className="h-12 border-input bg-background text-center font-bold text-foreground focus-visible:ring-indigo-500 dark:bg-black/40 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* AVISO VISUAL DE AGOTADO */}
              {isAgotado && (
                 <div className="rounded-lg bg-red-50 border border-red-100 p-3 flex items-center gap-3 text-red-700 dark:bg-red-900/20 dark:border-red-900/50 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="text-sm font-medium">Producto agotado. No se puede agregar.</span>
                 </div>
              )}

              <Button 
                type="button" 
                className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={addItem} 
                disabled={!productoId || isAgotado}
              >
                <Plus className="h-5 w-5 mr-2" /> Agregar a la lista
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: SUMMARY */}
        <div className="lg:col-span-5">
          <div className="sticky top-6 space-y-6">
            <Card className="border-border/50 bg-card shadow-lg overflow-hidden rounded-2xl dark:bg-black/60 dark:border-white/10">
              <CardHeader className="bg-muted/30 border-b border-border/50 pb-4 dark:bg-white/5">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                    <ShoppingCart className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Resumen
                  </CardTitle>
                  <Badge variant="outline" className="border-indigo-200 text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-400">
                    {items.length} Ítems
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-4 space-y-2">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {items.length === 0 ? (
                      <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="py-12 text-center border-2 border-dashed border-border rounded-xl"
                      >
                        <ShoppingCart className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                        <p className="text-sm text-muted-foreground">Agrega productos para comenzar</p>
                      </motion.div>
                    ) : (
                      items.map((i) => {
                        const precioBase = i.producto?.precioVenta || 0;
                        const precioFinal = aplicarAumento(precioBase);

                        return (
                          <motion.div 
                            key={i.productoId}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/50 dark:bg-white/5 dark:hover:bg-white/10"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0 dark:bg-indigo-500/10 dark:text-indigo-400">
                                x{i.unitsEntregadas}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{i.producto?.nombre}</p>
                                {/* MUESTRA DE PRECIOS CON AUMENTO */}
                                <div className="flex items-center gap-2">
                                  <p className="text-[10px] text-muted-foreground line-through">
                                    {formatCurrency(precioBase)}
                                  </p>
                                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    Final: {formatCurrency(precioFinal)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 pl-2">
                              <span className="text-sm font-bold text-foreground tabular-nums">
                                {formatCurrency(precioFinal * i.unitsEntregadas)}
                              </span>
                              <button 
                                onClick={() => removeItem(i.productoId)}
                                className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

                {items.length > 0 && (
                  <div className="bg-muted/30 border-t border-border/50 p-6 space-y-6 dark:bg-white/5">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Cantidad Total</span>
                        <span className="text-foreground font-medium">{totalUnits} u.</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Valor Total</span>
                        <span className="text-3xl font-black text-foreground tracking-tight">
                          {formatCurrency(totalAmount)}
                        </span>
                      </div>
                    </div>

                    <Button 
                      onClick={submit} 
                      disabled={loading} 
                      className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 dark:shadow-indigo-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {loading ? <Loader2 className="animate-spin h-6 w-6" /> : "Confirmar Consignación"}
                    </Button>
                    
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Info className="h-3 w-3" />
                      <span>El stock se descontará del inventario general.</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* REUSABLE SUCCESS COMPONENT */}
      <SuccessDialog 
        open={showSuccessDialog} 
        onOpenChange={setShowSuccessDialog}
        onConfirm={handleDownload}
        onCancel={handleClose}
        title="¡Consignación Creada!"
        description={
          <span>
            La operación <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">#{createdId}</span> se ha registrado correctamente.<br/>
            ¿Deseas descargar el remito?
          </span>
        }
        confirmText="Descargar Remito"
        cancelText="Ver Detalle"
      />

      {/* REUSABLE ERROR COMPONENT */}
      <ErrorDialog 
        open={errorDialog.open}
        onOpenChange={(isOpen) => setErrorDialog(prev => ({ ...prev, open: isOpen }))}
        title={errorDialog.title}
        description={errorDialog.description}
      />

    </div>
  );
}