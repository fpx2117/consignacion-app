"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Plus, Minus, Trash2, Loader2, ArrowLeft, ShoppingCart,
  Search, Banknote, CreditCard, QrCode, Coins, Check, ChevronsUpDown,
  UserCircle2
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import type { Producto, Cliente, CreateVentaDirectaInput, MetodoPago } from "@/lib/types";
import { SuccessDialog } from "@/components/success-dialog";
import { ErrorDialog } from "@/components/error-dialog";
import { Card, CardContent } from "@/components/ui/card";
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
  const [productoId, setProductoId] = React.useState<number | "">("");
  const [selectedClienteId, setSelectedClienteId] = React.useState<number | "">(""); 
  const [units, setUnits] = React.useState<number>(1);
  const [openCombobox, setOpenCombobox] = React.useState(false);
  const [openClienteCombobox, setOpenClienteCombobox] = React.useState(false); 
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [metodoPago, setMetodoPago] = React.useState<MetodoPago>("EFECTIVO");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [createdVentaId, setCreatedVentaId] = React.useState<number | null>(null);
  const [errorDialog, setErrorDialog] = React.useState({ open: false, title: "", description: "" });
  
  // --- Initial Load ---
  const fetchData = React.useCallback(async () => {
    try {
      const [prodRes, cliRes] = await Promise.all([
        apiService.getProductos(),
        apiService.getClientes()
      ]);
      setProductos(prodRes.data as any);
      setClientes(cliRes.data);
    } catch (err) { setError("Error datos."); }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const clientesFiltrados = React.useMemo(() => {
    return clientes.filter(c => !c.nombre.toLowerCase().includes("consumidor final"));
  }, [clientes]);

  // --- Logic Helpers ---
  const incrementUnits = () => setUnits(prev => prev + 1);
  const decrementUnits = () => setUnits(prev => (prev > 1 ? prev - 1 : 1));

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
         title: "Stock Limitado",
         description: `Solo quedan ${stockDisponible} unidades.`
       });
       return;
    }

    setCart((prev) => {
      const exists = prev.find((item) => item.producto.id === Number(productoId));
      if (exists) {
        return prev.map((item) => item.producto.id === Number(productoId) ? { ...item, quantity: item.quantity + units } : item);
      }
      return [...prev, { producto: prod, quantity: units }];
    });
    setProductoId("");
    setUnits(1);
    setOpenCombobox(false);
    toast.success("Agregado al ticket");
  };

  const removeItem = (pid: number) => setCart((prev) => prev.filter((item) => item.producto.id !== pid));
  const totalAmount = cart.reduce((acc, curr) => acc + (curr.producto.precioVenta * curr.quantity), 0);

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
      let title = "Error";
      let desc = e?.message || "Error inesperado.";
      if (desc.includes("Stock")) title = "Stock Insuficiente";
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

 const handleViewTicket = () => {
    if (!createdVentaId) return;

    // Abrimos directamente tu nueva página de carga en una pestaña nueva.
    // Al ser una navegación directa sin 'await' previo, el navegador NO la bloquea.
    const url = `/ticket-loading/${createdVentaId}`;
    window.open(url, '_blank');
  };

  const getSelectedClienteLabel = () => {
    if (selectedClienteId === "") return "Consumidor Final";
    const c = clientes.find(cli => cli.id === selectedClienteId);
    return c ? c.nombre : "Seleccionar...";
  };

  const isClienteRegistrado = selectedClienteId !== "";

  return (
    // ESTRUCTURA PRINCIPAL: h-[100dvh] previene el scroll del body
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      
      {/* 1. HEADER (Fijo) */}
      <div className="shrink-0 h-14 border-b bg-background flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="-ml-2 text-muted-foreground" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Punto de Venta
            </h1>
        </div>
      </div>

      {/* 2. CONTENIDO PRINCIPAL (Flexbox Split) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* === COLUMNA IZQUIERDA (Móvil: Todo el contenido / PC: Formularios) === */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          
          {/* A. ZONA DE FORMULARIO (FIJA EN MÓVIL) - shrink-0 evita que colapse */}
          <div className="shrink-0 p-3 space-y-3 bg-card/30 border-b z-10 shadow-sm">
             
             {error && <Alert variant="destructive" className="py-2"><AlertDescription>{error}</AlertDescription></Alert>}

             <div className="flex gap-2">
                {/* SELECTOR CLIENTE (Más compacto) */}
                <div className="w-1/3 min-w-[120px]">
                    <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between h-10 text-xs px-2", isClienteRegistrado && "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600")}>
                                <span className="truncate">{selectedClienteId === "" ? "Cons. Final" : getSelectedClienteLabel()}</span>
                                <UserCircle2 className="ml-1 h-3 w-3 opacity-50 shrink-0" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Buscar..." />
                                <CommandList>
                                    <CommandEmpty>No hay.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem value="consumidor final" onSelect={() => { setSelectedClienteId(""); setOpenClienteCombobox(false); }}>
                                            <Check className={cn("mr-2 h-4 w-4", selectedClienteId === "" ? "opacity-100" : "opacity-0")} /> Consumidor Final
                                        </CommandItem>
                                        {clientesFiltrados.map((c) => (
                                            <CommandItem key={c.id} value={c.nombre} onSelect={() => { setSelectedClienteId(c.id); setOpenClienteCombobox(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", selectedClienteId === c.id ? "opacity-100" : "opacity-0")} /> {c.nombre}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* SELECTOR PRODUCTO (Más visible) */}
                <div className="flex-1">
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between h-10 text-sm bg-background shadow-sm" disabled={loading}>
                                {productoId 
                                ? <span className="font-bold truncate text-primary">{productos.find((p) => p.id === productoId)?.nombre}</span>
                                : <span className="text-muted-foreground flex items-center gap-2"><Search className="w-3 h-3"/> Buscar producto...</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[85vw] md:w-[400px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Nombre del producto..." className="h-12" />
                                <CommandList className="max-h-[250px]">
                                    <CommandEmpty>No encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {productos.map((p) => {
                                            const stock = p.stockDisponibleUnits ?? 0;
                                            const sinStock = stock <= 0;
                                            return (
                                                <CommandItem key={p.id} value={p.nombre} disabled={sinStock} onSelect={() => { if(!sinStock) { setProductoId(p.id); setOpenCombobox(false); }}} className={cn("flex justify-between py-2", sinStock && "opacity-50")}>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{p.nombre}</span>
                                                        <span className="text-[10px] text-muted-foreground">{sinStock ? "AGOTADO" : `Stock: ${stock}`}</span>
                                                    </div>
                                                    <Badge variant="secondary" className="text-xs">{formatCurrency(p.precioVenta)}</Badge>
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
                 <Button type="button" className="flex-1 h-10 font-bold text-sm shadow-sm" onClick={addItem} disabled={!productoId}>
                    <Plus className="h-4 w-4 mr-1" /> AGREGAR
                 </Button>
             </div>
          </div>

          {/* B. ZONA DE LISTA (SCROLLABLE) - flex-1 overflow-y-auto */}
          {/* Esta es la clave: La lista ocupa TODO el espacio restante y scrollea independientemente de los inputs */}
          <div className="flex-1 overflow-y-auto p-3 bg-muted/10">
              {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-2">
                      <ShoppingCart className="h-12 w-12 opacity-20" />
                      <p className="text-sm font-medium">Ticket vacío</p>
                  </div>
              ) : (
                  <div className="space-y-2 pb-4">
                      {/* Cabecera de lista visible solo si hay items */}
                      <div className="flex justify-between items-center pb-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">Items en Ticket ({cart.length})</span>
                      </div>
                      
                      <AnimatePresence mode="popLayout" initial={false}>
                        {cart.map((item) => (
                            <motion.div 
                                key={item.producto.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: -20 }}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-card border shadow-sm"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                        {item.quantity}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-sm truncate pr-2">{item.producto.nombre}</p>
                                        <p className="text-[10px] text-muted-foreground">{formatCurrency(item.producto.precioVenta)} u.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-bold text-sm">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => removeItem(item.producto.id)}>
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

        {/* --- SIDEBAR DERECHO (Solo Desktop) --- */}
        {/* En desktop, mostramos una vista espejo del ticket para aprovechar el espacio */}
        <div className="hidden lg:flex w-[400px] border-l bg-card/50 flex-col shadow-xl z-10">
            <div className="p-4 border-b bg-muted/20">
                <h2 className="font-bold flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Resumen Ticket</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.map((item) => (
                     <div key={item.producto.id + 'd'} className="flex justify-between text-sm">
                        <span>{item.quantity} x {item.producto.nombre}</span>
                        <span className="font-mono">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                     </div>
                ))}
            </div>
            {/* Footer Sidebar Desktop */}
            <div className="p-4 border-t bg-background">
                 <div className="flex justify-between text-xl font-bold mb-4">
                    <span>Total</span>
                    <span>{formatCurrency(totalAmount)}</span>
                 </div>
            </div>
        </div>

      </div>

      {/* 3. FOOTER FIJO (Pago y Botón) */}
      <div className="shrink-0 bg-background border-t p-3 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-2xl mx-auto space-y-3">
             <PaymentSelector metodoPago={metodoPago} setMetodoPago={setMetodoPago} isMobile />
             
             <Button onClick={handleCobrar} disabled={loading || cart.length === 0} className="w-full h-12 text-lg font-bold shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white">
                {loading ? <Loader2 className="animate-spin" /> : (
                    <div className="flex justify-between w-full px-2 items-center">
                        <span className="text-sm font-medium opacity-90">{cart.length} ITEMS</span>
                        <span className="text-xl">COBRAR {formatCurrency(totalAmount)}</span>
                    </div>
                )}
             </Button>
          </div>
      </div>

      <SuccessDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog} onConfirm={handleReset} onCancel={handleViewTicket} title="¡Venta Exitosa!" description={<span className="text-center block">Total: <span className="text-primary font-bold">{formatCurrency(totalAmount)}</span></span>} confirmText="Nueva" cancelText="Descargar Ticket" />
      <ErrorDialog open={errorDialog.open} onOpenChange={(isOpen) => setErrorDialog(prev => ({ ...prev, open: isOpen }))} title={errorDialog.title} description={errorDialog.description} />
    </div>
  );
}

// Subcomponente de Pagos (Igual que antes, pero asegurando el tamaño en móvil)
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