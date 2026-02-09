"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Trash2, Loader2, Package, ArrowLeft, ShoppingCart,
  Search, Info, Banknote, CreditCard, QrCode, Coins, User, Check, ChevronsUpDown
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import type { Producto, Cliente, CreateVentaDirectaInput, MetodoPago } from "@/lib/types";

// IMPORTAMOS LOS COMPONENTES DE DIÁLOGO
import { SuccessDialog } from "@/components/success-dialog";
import { ErrorDialog } from "@/components/error-dialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Command, CommandEmpty, CommandGroup, CommandInput, 
  CommandItem, CommandList, CommandSeparator 
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --- TIPOS ---
type ProductoConStock = Producto & { stockDisponibleUnits?: number };
type CartItem = { 
  producto: ProductoConStock; 
  quantity: number; 
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
};

const METODOS_PAGO: { value: MetodoPago; label: string; icon: any }[] = [
  { value: "EFECTIVO", label: "Efectivo", icon: Banknote },
  { value: "TRANSFERENCIA", label: "Transferencia", icon: QrCode },
  { value: "TARJETA", label: "Tarjeta", icon: CreditCard },
  { value: "OTRO", label: "Otro", icon: Coins },
];

export default function NuevaVentaPage() {
  const router = useRouter();

  // --- States ---
  const [productos, setProductos] = React.useState<ProductoConStock[]>([]);
  const [clientes, setClientes] = React.useState<Cliente[]>([]); 
  
  const [productoId, setProductoId] = React.useState<number | "">("");
  const [selectedClienteId, setSelectedClienteId] = React.useState<number | "">(""); // "" = Consumidor Final
  
  const [units, setUnits] = React.useState<number>(1);
  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [openClienteCombobox, setOpenClienteCombobox] = React.useState(false); 
  
  // Estado del Carrito y Pago
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [metodoPago, setMetodoPago] = React.useState<MetodoPago>("EFECTIVO");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // --- Dialog States ---
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [createdVentaId, setCreatedVentaId] = React.useState<number | null>(null);
  const [errorDialog, setErrorDialog] = React.useState({ 
    open: false, 
    title: "", 
    description: "" 
  });

  // --- Initial Load ---
  const fetchData = React.useCallback(async () => {
    try {
      const [prodRes, cliRes] = await Promise.all([
        apiService.getProductos(),
        apiService.getClientes()
      ]);
      setProductos(prodRes.data as any);
      setClientes(cliRes.data);
    } catch (err) {
      setError("Error al cargar datos iniciales.");
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // --- LÓGICA DE FILTRADO DE CLIENTES ---
  const clientesFiltrados = React.useMemo(() => {
    return clientes.filter(c => !c.nombre.toLowerCase().includes("consumidor final"));
  }, [clientes]);

  // --- Cart Logic ---
  const addItem = () => {
    setError(null);
    if (!productoId || units <= 0) return;

    const prod = productos.find(p => p.id === productoId);
    if (!prod) return;

    const currentInCart = cart.find(item => item.producto.id === productoId)?.quantity || 0;
    const stockDisponible = prod.stockDisponibleUnits ?? 9999; 
    
    if ((currentInCart + units) > stockDisponible) {
       setErrorDialog({
         open: true,
         title: "Stock Insuficiente",
         description: `Solo quedan ${stockDisponible} unidades disponibles de "${prod.nombre}".`
       });
       return;
    }

    setCart((prev) => {
      const exists = prev.find((item) => item.producto.id === Number(productoId));
      if (exists) {
        return prev.map((item) =>
          item.producto.id === Number(productoId)
            ? { ...item, quantity: item.quantity + units }
            : item
        );
      }
      return [...prev, { producto: prod, quantity: units }];
    });

    setProductoId("");
    setUnits(1);
    setOpenCombobox(false);
  };

  const removeItem = (pid: number) => setCart((prev) => prev.filter((item) => item.producto.id !== pid));

  const totalAmount = cart.reduce((acc, curr) => acc + (curr.producto.precioVenta * curr.quantity), 0);

  // --- Submit Handler ---
  const handleCobrar = async () => {
    setError(null);
    if (cart.length === 0) {
       setErrorDialog({ open: true, title: "Carrito Vacío", description: "Agrega productos antes de cobrar." });
       return;
    }

    setLoading(true);
    try {
      const finalClienteId = selectedClienteId === "" ? null : Number(selectedClienteId);

      const payload: CreateVentaDirectaInput = {
        clienteId: finalClienteId, 
        items: cart.map((item) => ({
          productoId: item.producto.id,
          units: item.quantity,
          precioUnitario: item.producto.precioVenta
        })),
        metodoPago: metodoPago
      };

      const res = await apiService.createVentaDirecta(payload);
      setCreatedVentaId(res.data.id);
      setShowSuccessDialog(true);
    } catch (e: any) {
      let title = "Error al procesar venta";
      let desc = e?.message || "Ocurrió un error inesperado.";
      if (desc.includes("Stock insuficiente")) title = "Stock Insuficiente";
      setErrorDialog({ open: true, title, description: desc });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCart([]);
    setMetodoPago("EFECTIVO");
    setSelectedClienteId("");
    setCreatedVentaId(null);
    setShowSuccessDialog(false);
    fetchData(); 
  };

  const handleViewTicket = async () => {
  if (!createdVentaId) return;

  try {
    const url = await apiService.getVentaPdfUrl(createdVentaId);
    window.open(url, "_blank");
  } catch (e) {
    console.error(e);
    toast.error("No se pudo generar el ticket PDF");
  }
};

  // Helper para mostrar nombre del cliente seleccionado
  const getSelectedClienteLabel = () => {
    if (selectedClienteId === "") return "👤 Consumidor Final (Venta Casual)";
    const c = clientes.find(cli => cli.id === selectedClienteId);
    return c ? c.nombre : "Seleccionar cliente...";
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 lg:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-4xl font-black tracking-tight text-foreground">Punto de Venta</h1>
                <p className="text-muted-foreground">Venta directa a consumidor final o clientes registrados.</p>
            </div>
            <div className="hidden md:block">
                <Badge variant="outline" className="text-lg px-4 py-1 border-indigo-200 text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-400">
                    {new Date().toLocaleDateString()}
                </Badge>
            </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: SELECCIÓN DE PRODUCTOS */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-sm dark:bg-zinc-900/50 h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                <Package className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Selección de Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Buscar Producto</Label>
                  <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-14 text-lg border-input bg-background text-left font-normal text-foreground hover:bg-muted dark:bg-black/40 dark:hover:bg-black/60"
                        disabled={loading}
                      >
                        {productoId 
                          ? <span className="truncate font-semibold">{productos.find((p) => p.id === productoId)?.nombre}</span>
                          : <span className="text-muted-foreground">Escanear o buscar...</span>}
                        <Search className="ml-2 h-5 w-5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] sm:w-[500px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Nombre del producto..." className="h-12 text-base" />
                        <CommandList>
                          <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No encontrado.</CommandEmpty>
                          <CommandGroup>
                            {productos.map((p) => {
                                const stock = p.stockDisponibleUnits ?? 0;
                                const sinStock = stock <= 0;
                                return (
                                    <CommandItem
                                        key={p.id}
                                        value={p.nombre}
                                        disabled={sinStock}
                                        onSelect={() => { if(!sinStock) { setProductoId(p.id); setOpenCombobox(false); }}}
                                        className={cn("flex justify-between items-center py-3 cursor-pointer", sinStock && "opacity-50")}
                                    >
                                        <div className="flex flex-col">
                                        <span className="text-base font-medium">{p.nombre}</span>
                                        <span className={cn("text-xs", sinStock ? "text-red-500 font-bold" : "text-muted-foreground")}>
                                            {sinStock ? "AGOTADO" : `Stock: ${stock}`}
                                        </span>
                                        </div>
                                        <Badge variant="secondary" className="text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 border-none">
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
                  <Input
                      type="number"
                      min={1}
                      value={units}
                      onChange={(e) => setUnits(Number(e.target.value))}
                      onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
                      className="h-14 text-xl border-input bg-background text-center font-bold text-foreground focus-visible:ring-indigo-500 dark:bg-black/40"
                    />
                </div>
              </div>

              <Button 
                type="button" 
                className="w-full h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-[0.98]" 
                onClick={addItem} 
                disabled={!productoId}
              >
                <Plus className="h-5 w-5 mr-2" /> Agregar Item
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: RESUMEN Y PAGO */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* --- SELECTOR DE CLIENTE MEJORADO (COMBOBOX) --- */}
          <Card className="border-border/50 bg-card shadow-sm dark:bg-black/60 dark:border-white/10">
            <CardHeader className="py-4 border-b border-border/50">
                <CardTitle className="text-sm flex items-center justify-between text-muted-foreground uppercase tracking-wider font-bold">
                   <span className="flex items-center gap-2"><User className="h-4 w-4" /> Cliente Asignado</span>
                   {selectedClienteId !== "" ? (
                       <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-none">Registrado</Badge>
                   ) : (
                       <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200 border-none">Anónimo</Badge>
                   )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openClienteCombobox}
                      className="w-full justify-between h-12 text-base font-normal px-3 border-input bg-background hover:bg-accent hover:text-accent-foreground dark:bg-white/5"
                    >
                      <span className="truncate">{getSelectedClienteLabel()}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>No encontrado.</CommandEmpty>
                        
                        <CommandGroup>
                           <CommandItem
                             value="consumidor final venta casual"
                             onSelect={() => {
                               setSelectedClienteId("");
                               setOpenClienteCombobox(false);
                             }}
                             className="cursor-pointer"
                           >
                             <Check
                               className={cn(
                                 "mr-2 h-4 w-4",
                                 selectedClienteId === "" ? "opacity-100" : "opacity-0"
                               )}
                             />
                             👤 Consumidor Final (Venta Casual)
                           </CommandItem>
                        </CommandGroup>

                        <CommandSeparator />
                        
                        <CommandGroup heading="Clientes Registrados">
                          {clientesFiltrados.map((cliente) => (
                            <CommandItem
                              key={cliente.id}
                              value={cliente.nombre}
                              onSelect={() => {
                                setSelectedClienteId(cliente.id);
                                setOpenClienteCombobox(false);
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClienteId === cliente.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {cliente.nombre}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
            </CardContent>
          </Card>
          
          {/* TICKET DE VENTA */}
          <Card className="flex-1 border-border/50 bg-card shadow-lg overflow-hidden rounded-2xl dark:bg-black/60 dark:border-white/10 flex flex-col">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4 dark:bg-white/5">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                  <ShoppingCart className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Ticket de Venta
                </CardTitle>
                <Badge variant="outline" className="border-indigo-200 text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-400">
                  {cart.length} Ítems
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 flex flex-col">
              <div className="flex-1 max-h-[400px] overflow-y-auto custom-scrollbar p-4 space-y-2 min-h-[200px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  {cart.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center py-12 border-2 border-dashed border-border rounded-xl"
                    >
                      <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
                      <p className="text-muted-foreground font-medium">Ticket vacío</p>
                      <p className="text-xs text-muted-foreground/70">Escanea productos para empezar</p>
                    </motion.div>
                  ) : (
                    cart.map((item) => (
                      <motion.div 
                        key={item.producto.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="group flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-transparent hover:border-border/50 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0 dark:bg-indigo-500/10 dark:text-indigo-400">
                            {item.quantity}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{item.producto.nombre}</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.producto.precioVenta)} c/u</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3 pl-2">
                          <span className="text-sm font-bold text-foreground tabular-nums">
                            {formatCurrency(item.producto.precioVenta * item.quantity)}
                          </span>
                          <button 
                            onClick={() => removeItem(item.producto.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              <div className="bg-muted/30 border-t border-border/50 p-6 space-y-6 dark:bg-white/5">
                
                {/* Selector de Método de Pago */}
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Método de Pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {METODOS_PAGO.map((m) => {
                            const Icon = m.icon;
                            const isSelected = metodoPago === m.value;
                            return (
                                <button
                                    key={m.value}
                                    onClick={() => setMetodoPago(m.value)}
                                    className={cn(
                                        "flex items-center justify-center gap-2 p-2 rounded-lg text-sm font-medium border transition-all",
                                        isSelected 
                                            ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" 
                                            : "bg-background border-input text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {m.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="space-y-1 pt-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total a Cobrar</span>
                    <span className="text-4xl font-black text-foreground tracking-tight">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>

                <Button 
                  onClick={handleCobrar} 
                  disabled={loading || cart.length === 0} 
                  className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xl shadow-lg shadow-indigo-500/20 dark:shadow-indigo-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="animate-spin h-6 w-6" /> : "COBRAR"}
                </Button>
                
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  <span>Se descontará del stock inmediatamente.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SuccessDialog 
        open={showSuccessDialog} 
        onOpenChange={setShowSuccessDialog}
        onConfirm={handleReset}
        onCancel={handleViewTicket} // ✅ Conectado a la función de imprimir
        title="¡Venta Exitosa!"
        description={
          <span>
            La venta se ha registrado correctamente.<br/>
            Total cobrado: <span className="text-indigo-600 font-bold text-lg">{formatCurrency(totalAmount)}</span>
          </span>
        }
        confirmText="Nueva Venta"
        cancelText="Imprimir Ticket" // ✅ Texto actualizado
      />

      <ErrorDialog 
        open={errorDialog.open}
        onOpenChange={(isOpen) => setErrorDialog(prev => ({ ...prev, open: isOpen }))}
        title={errorDialog.title}
        description={errorDialog.description}
      />

    </div>
  );
}