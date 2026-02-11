"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Plus, Minus, Trash2, Loader2, ArrowLeft, ShoppingCart,
  Search, Banknote, CreditCard, QrCode, Coins, Check, ChevronsUpDown,
  UserCircle2, Barcode
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import type { Producto, Cliente, CreateVentaDirectaInput, MetodoPago } from "@/lib/types";
import { SuccessDialog } from "@/components/success-dialog";
import { ErrorDialog } from "@/components/error-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  Command, CommandEmpty, CommandGroup, CommandInput, 
  CommandItem, CommandList 
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator"; // Importante para el ticket

// --- TIPOS ---
type ProductoConStock = Producto & { stockDisponibleUnits?: number };
type CartItem = { producto: ProductoConStock; quantity: number; };

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
};

const METODOS_PAGO: { value: MetodoPago; label: string; icon: any }[] = [
  { value: "EFECTIVO", label: "Efe", icon: Banknote },
  { value: "TRANSFERENCIA", label: "Transf", icon: QrCode },
  { value: "TARJETA", label: "Tarj", icon: CreditCard },
  { value: "OTRO", label: "Otro", icon: Coins },
];

export default function NuevaVentaPage() {
  const router = useRouter();

  // --- States ---
  const [productos, setProductos] = React.useState<ProductoConStock[]>([]);
  const [clientes, setClientes] = React.useState<Cliente[]>([]); 
  
  // Form States
  const [productoId, setProductoId] = React.useState<number | "">("");
  const [selectedClienteId, setSelectedClienteId] = React.useState<number | "">(""); 
  const [units, setUnits] = React.useState<number>(1);
  const [metodoPago, setMetodoPago] = React.useState<MetodoPago>("EFECTIVO");
  
  // UI States
  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [openClienteCombobox, setOpenClienteCombobox] = React.useState(false); 
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Dialog States
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [createdVentaId, setCreatedVentaId] = React.useState<number | null>(null);
  const [errorDialog, setErrorDialog] = React.useState({ open: false, title: "", description: "" });

  // Scanner Buffer
  const barcodeBuffer = React.useRef<string>("");
  const lastKeyTime = React.useRef<number>(0);
  
  // --- Initial Load ---
  const fetchData = React.useCallback(async () => {
    try {
      const [prodRes, cliRes] = await Promise.all([
        apiService.getProductos(),
        apiService.getClientes()
      ]);
      const activos = (prodRes.data as any[]).filter(p => p.activo !== false);
      setProductos(activos);
      setClientes(cliRes.data);
    } catch (err) { setError("Error cargando datos."); }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // --- LÓGICA DE SCANNER ---
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 50) {
        barcodeBuffer.current = "";
      }
      lastKeyTime.current = currentTime;

      if (e.key === "Enter") {
        if (barcodeBuffer.current.length > 0) {
          processBarcode(barcodeBuffer.current);
          barcodeBuffer.current = "";
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [productos, cart]); 

  const processBarcode = (code: string) => {
    const prod = productos.find(p => p.codigoBarra === code);
    if (prod) {
      addToCart(prod, 1);
      toast.success(`Escaneado: ${prod.nombre}`);
    } else {
      toast.error(`Producto no encontrado: ${code}`);
    }
  };

  // --- LÓGICA CARRITO ---
  const addToCart = (prod: ProductoConStock, quantityToAdd: number) => {
    setError(null);
    const stockDisponible = prod.stockDisponibleUnits ?? 9999;
    const currentInCart = cart.find(item => item.producto.id === prod.id)?.quantity || 0;

    if (stockDisponible <= 0) {
       setErrorDialog({ open: true, title: "Sin Stock", description: "Este producto está agotado." });
       return;
    }

    if ((currentInCart + quantityToAdd) > stockDisponible) {
       setErrorDialog({
         open: true,
         title: "Stock Insuficiente",
         description: `Solo quedan ${stockDisponible} unidades disponibles.`
       });
       return;
    }

    setCart((prev) => {
      const exists = prev.find((item) => item.producto.id === prod.id);
      if (exists) {
        return prev.map((item) => item.producto.id === prod.id ? { ...item, quantity: item.quantity + quantityToAdd } : item);
      }
      return [...prev, { producto: prod, quantity: quantityToAdd }];
    });
  };

  const addItemManual = () => {
    if (!productoId || units <= 0) return;
    const prod = productos.find(p => p.id === productoId);
    if (prod) {
      addToCart(prod, units);
      setProductoId("");
      setUnits(1);
      setOpenCombobox(false);
    }
  };

  const removeItem = (pid: number) => setCart((prev) => prev.filter((item) => item.producto.id !== pid));
  const incrementUnits = () => setUnits(prev => prev + 1);
  const decrementUnits = () => setUnits(prev => (prev > 1 ? prev - 1 : 1));

  const totalAmount = cart.reduce((acc, curr) => acc + (Number(curr.producto.precioVenta) * curr.quantity), 0);

  // --- COBRAR ---
  const handleCobrar = async () => {
    setError(null);
    if (cart.length === 0) return;
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
      setErrorDialog({ open: true, title: "Error al procesar", description: e.message || "Intenta nuevamente." });
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

  const handleViewTicket = () => {
    if (!createdVentaId) return;
    window.open(`/ticket-loading/${createdVentaId}`, '_blank');
  };

  // --- HELPERS UI ---
  const clientesFiltrados = React.useMemo(() => {
    return clientes.filter(c => !c.nombre.toLowerCase().includes("consumidor final"));
  }, [clientes]);

  const getSelectedClienteLabel = () => {
    if (selectedClienteId === "") return "Consumidor Final";
    const c = clientes.find(cli => cli.id === selectedClienteId);
    return c ? c.nombre : "Seleccionar...";
  };

  const isClienteRegistrado = selectedClienteId !== "";

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      
      {/* 1. HEADER */}
      <div className="shrink-0 h-14 border-b bg-background flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="-ml-2 text-muted-foreground" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Punto de Venta
            </h1>
        </div>
      </div>

      {/* 2. CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* === COLUMNA IZQUIERDA === */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          
          {/* A. ZONA DE FORMULARIO */}
          <div className="shrink-0 p-3 space-y-3 bg-card/30 border-b z-10 shadow-sm">
             {error && <Alert variant="destructive" className="py-2"><AlertDescription>{error}</AlertDescription></Alert>}

             <div className="flex gap-2">
  {/* SELECTOR CLIENTE: Ancho fijo en móvil, adaptable en desktop */}
  <div className="w-[110px] sm:w-1/3 min-w-[110px]">
    <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn("w-full justify-between h-10 text-xs px-2 truncate", isClienteRegistrado && "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600")}>
           {/* En móvil truncamos el nombre si es muy largo */}
           <span className="truncate">{selectedClienteId === "" ? "Cons. Final" : getSelectedClienteLabel()}</span>
           <UserCircle2 className="ml-1 h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      {/* ... (El PopoverContent del cliente queda igual) ... */}
    </Popover>
  </div>

  {/* SELECTOR PRODUCTO MEJORADO */}
  <div className="flex-1 min-w-0"> {/* min-w-0 es CLAVE para que el flex no se desborde */}
    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          role="combobox" 
          className={cn(
            "w-full h-10 text-sm shadow-sm relative text-left transition-colors",
            // Padding izquierdo grande para el icono
            "pl-9 sm:pl-10", 
            !productoId && "text-muted-foreground border-dashed hover:border-primary/50"
          )} 
          disabled={loading}
        >
          {/* ICONO ANIMADO - Posicionado Absolutamente */}
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
             <Barcode className="h-4 w-4 text-primary animate-pulse" />
          </div>

          {/* CONTENIDO DEL TEXTO */}
          <div className="flex items-center justify-between w-full overflow-hidden">
            {productoId ? (
               <span className="font-bold truncate text-foreground text-xs sm:text-sm">
                 {productos.find((p) => p.id === productoId)?.nombre}
               </span>
            ) : (
               // TRUCO VISUAL: Texto corto en móvil ("Buscar..."), largo en PC
               <span className="truncate text-xs sm:text-sm">
                 <span className="sm:hidden">Escanear...</span>
                 <span className="hidden sm:inline">Escanear o buscar producto...</span>
               </span>
            )}
            
            {/* Ocultamos las flechas en móvil para ahorrar espacio */}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50 hidden sm:block" />
          </div>
        </Button>
      </PopoverTrigger>
                        <PopoverContent className="w-[85vw] md:w-[400px] p-0" align="start">
                            <Command filter={(value, search) => {
                                const p = productos.find(item => item.nombre === value);
                                if (!p) return 0;
                                const matchName = p.nombre.toLowerCase().includes(search.toLowerCase());
                                const matchCode = p.codigoBarra?.toLowerCase().includes(search.toLowerCase());
                                return (matchName || matchCode) ? 1 : 0;
                            }}>
                                <CommandInput placeholder="Nombre o código..." className="h-12" />
                                <CommandList className="max-h-[250px]">
                                    <CommandEmpty>No encontrado.</CommandEmpty>
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
                                                  className={cn("flex justify-between py-2 cursor-pointer", sinStock && "opacity-50")}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{p.nombre}</span>
                                                        <div className="flex gap-2 text-[10px] text-muted-foreground">
                                                           {p.codigoBarra && <span className="font-mono bg-muted px-1 rounded flex items-center gap-1"><Barcode className="h-3 w-3"/> {p.codigoBarra}</span>}
                                                           <span>{sinStock ? "AGOTADO" : `Stock: ${stock}`}</span>
                                                        </div>
                                                    </div>
                                                    <Badge variant={sinStock ? "destructive" : "secondary"} className="text-xs">{formatCurrency(p.precioVenta)}</Badge>
                                                </CommandItem>
                                            )
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
             </div>

             {/* FILA DE CANTIDAD Y AGREGAR */}
             <div className="flex gap-2">
                 <div className="flex items-center h-10 bg-background rounded-md border shadow-sm shrink-0">
                    <Button type="button" variant="ghost" className="h-full px-2 hover:bg-muted rounded-l-md" onClick={decrementUnits} disabled={units <= 1}>
                        <Minus className="h-3 w-3" />
                    </Button>
                    <div className="w-10 h-full flex items-center justify-center border-x">
                        <Input type="number" min={1} value={units} onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))} className="h-full border-0 text-center text-lg font-bold bg-transparent focus-visible:ring-0 px-0" />
                    </div>
                    <Button type="button" variant="ghost" className="h-full px-2 hover:bg-muted rounded-r-md" onClick={incrementUnits}>
                        <Plus className="h-3 w-3" />
                    </Button>
                 </div>
                 <Button type="button" className="flex-1 h-10 font-bold text-sm shadow-sm" onClick={addItemManual} disabled={!productoId}>
                    <Plus className="h-4 w-4 mr-1" /> AGREGAR
                 </Button>
             </div>
          </div>

          {/* B. ZONA DE LISTA CENTRAL (Log de operaciones) */}
          <div className="flex-1 overflow-y-auto p-3 bg-muted/10">
              {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                      <ShoppingCart className="h-12 w-12 opacity-20" />
                      <p className="text-sm font-medium">Ticket vacío</p>
                      <p className="text-xs text-muted-foreground opacity-60">Escanea un producto o búscalo manualmente</p>
                  </div>
              ) : (
                  <div className="space-y-2 pb-4">
                      <div className="flex justify-between items-center pb-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Items agregados ({cart.length})</span>
                      </div>
                      
                      <AnimatePresence mode="popLayout" initial={false}>
                        {cart.map((item) => (
                            <motion.div 
                                key={item.producto.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -20 }}
                                className="flex items-center justify-between p-3 rounded-xl bg-card border shadow-sm"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-sm shrink-0">
                                        {item.quantity}x
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm truncate pr-2">{item.producto.nombre}</p>
                                        <p className="text-[11px] text-muted-foreground font-medium">{formatCurrency(item.producto.precioVenta)} / unidad</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-black text-base">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors" onClick={() => removeItem(item.producto.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                      </AnimatePresence>
                  </div>
              )}
          </div>
        </div>

        {/* --- CORRECCIÓN 2: SIDEBAR DERECHO (RESUMEN TICKET) --- */}
        {/* Restaurado el diseño tipo "Papel de Ticket" que suele gustar más */}
        <div className="hidden lg:flex w-[380px] bg-background border-l flex-col shadow-xl z-20">
            <div className="p-6 border-b bg-muted/30">
                <h2 className="font-bold text-lg flex items-center gap-2 text-foreground">
                   <ShoppingCart className="h-5 w-5" /> Resumen de Compra
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Detalle de items actuales</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
                {cart.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-40 gap-3">
                      <div className="p-4 rounded-full bg-muted">
                        <Barcode className="h-8 w-8" />
                      </div>
                      <p className="text-sm font-medium">Esperando items...</p>
                   </div>
                ) : (
                   <div className="space-y-4">
                      {cart.map((item) => (
                         <div key={item.producto.id + 'sidebar'} className="flex justify-between items-baseline text-sm group">
                            <div className="flex gap-3">
                               <span className="font-bold w-6 text-right tabular-nums text-muted-foreground">{item.quantity}</span>
                               <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{item.producto.nombre}</span>
                                  <span className="text-[10px] text-muted-foreground">{formatCurrency(item.producto.precioVenta)} c/u</span>
                               </div>
                            </div>
                            <span className="font-mono font-bold">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                         </div>
                      ))}
                      <Separator className="my-4" />
                   </div>
                )}
            </div>

            <div className="p-6 bg-muted/20 border-t space-y-4">
                 <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                       <span>Subtotal</span>
                       <span>{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                       <span>Descuentos</span>
                       <span>-</span>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-border/50">
                       <span className="text-lg font-bold">Total a Pagar</span>
                       <span className="text-3xl font-black text-primary tabular-nums">{formatCurrency(totalAmount)}</span>
                    </div>
                 </div>
                 
                 {/* El botón de cobrar ya está abajo, aquí solo mostramos info */}
            </div>
        </div>

      </div>

      {/* ESPACIADOR */}
      <div className="h-64 md:h-48 w-full shrink-0" />

      {/* 3. FOOTER FLOTANTE */}
{/* bottom-[80px]: En móvil lo subimos unos 80px para que no tape tu barra de navegación inferior.
    md:bottom-6: En PC (donde no hay barra inferior) lo bajamos para que se vea estético.
*/}
<div className="fixed bottom-[90px] md:bottom-6 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
  <div className="w-full max-w-2xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-2xl rounded-[2rem] p-3 md:p-4 pointer-events-auto transition-all duration-300">
    <div className="space-y-3">
       
       {/* Selector de Pago */}
       <PaymentSelector metodoPago={metodoPago} setMetodoPago={setMetodoPago} isMobile />
       
       {/* Botón Cobrar */}
       <Button 
         onClick={handleCobrar} 
         disabled={loading || cart.length === 0} 
         className="w-full h-12 md:h-14 text-base md:text-lg font-bold shadow-lg shadow-indigo-500/20 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl md:rounded-2xl active:scale-[0.98] transition-all"
       >
          {loading ? <Loader2 className="animate-spin" /> : (
              <div className="flex justify-between w-full px-2 md:px-4 items-center">
                  <span className="text-[10px] md:text-xs font-bold tracking-widest opacity-80 uppercase">{cart.length} ITEMS</span>
                  <span className="text-lg md:text-xl font-black tracking-tight">COBRAR {formatCurrency(totalAmount)}</span>
              </div>
          )}
       </Button>
    </div>
  </div>
</div>
      
      <SuccessDialog 
        open={showSuccessDialog} 
        onOpenChange={setShowSuccessDialog} 
        onConfirm={handleReset} 
        onCancel={handleViewTicket} 
        title="¡Venta Exitosa!" 
        description={<span className="text-center block">Total: <span className="text-primary font-bold">{formatCurrency(totalAmount)}</span></span>} 
        confirmText="Nueva Venta" 
        cancelText="Ver Ticket" 
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

// Subcomponente de Pagos
function PaymentSelector({ metodoPago, setMetodoPago, isMobile }: any) {
    return (
        <div className="grid grid-cols-4 gap-2">
            {METODOS_PAGO.map((m: any) => (
                <button
                    key={m.value}
                    onClick={() => setMetodoPago(m.value)}
                    className={cn(
                        "flex flex-col items-center justify-center rounded-lg font-medium border transition-all relative overflow-hidden",
                        isMobile ? "py-2 text-[10px]" : "py-2 text-[10px]",
                        metodoPago === m.value 
                            ? "bg-primary border-primary text-primary-foreground shadow-md" 
                            : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                    )}
                >
                    <m.icon className={cn("mb-1", isMobile ? "h-4 w-4" : "h-4 w-4")} />
                    {m.label}
                </button>
            ))}
        </div>
    )
}