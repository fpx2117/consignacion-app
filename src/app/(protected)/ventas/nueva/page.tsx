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

  const handleViewTicket = async () => {
    if (!createdVentaId) return;
    try {
      const url = await apiService.getVentaPdfUrl(createdVentaId);
      window.open(url, "_blank");
    } catch (error) { toast.error("Error PDF"); }
  };

  const getSelectedClienteLabel = () => {
    if (selectedClienteId === "") return "Consumidor Final";
    const c = clientes.find(cli => cli.id === selectedClienteId);
    return c ? c.nombre : "Seleccionar...";
  };

  const isClienteRegistrado = selectedClienteId !== "";

  return (
    // CONTENEDOR PRINCIPAL: Altura Fija (h-dvh) para evitar rebotes de scroll
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      
      {/* 1. HEADER FIJO */}
      <div className="shrink-0 h-14 border-b bg-background flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="-ml-2 text-muted-foreground" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Punto de Venta
            </h1>
        </div>
        <div className="hidden md:block">
            <Badge variant="outline">{new Date().toLocaleDateString()}</Badge>
        </div>
      </div>

      {/* 2. CUERPO (Split View) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- COLUMNA IZQUIERDA (Formularios + Lista en Móvil) --- */}
        <div className="flex-1 overflow-y-auto p-4 pb-32 lg:pb-4 scroll-smooth">
          <div className="max-w-2xl mx-auto space-y-4">
            
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            {/* SELECCIÓN DE CLIENTE */}
            <Card className={cn("border shadow-sm transition-colors", isClienteRegistrado ? "border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800" : "bg-card")}>
                <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("p-2 rounded-full", isClienteRegistrado ? "bg-indigo-100 text-indigo-600" : "bg-muted text-muted-foreground")}>
                        <UserCircle2 className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente</Label>
                        <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className={cn("w-full justify-between h-11 text-sm bg-background", isClienteRegistrado && "font-bold text-indigo-700 dark:text-indigo-300 border-indigo-200")}>
                                    <span className="truncate">{getSelectedClienteLabel()}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar cliente..." />
                                    <CommandList>
                                        <CommandEmpty>No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem value="consumidor final" onSelect={() => { setSelectedClienteId(""); setOpenClienteCombobox(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", selectedClienteId === "" ? "opacity-100" : "opacity-0")} /> Consumidor Final
                                            </CommandItem>
                                        </CommandGroup>
                                        <CommandSeparator />
                                        <CommandGroup heading="Registrados">
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
                </CardContent>
            </Card>

            {/* SELECCIÓN DE PRODUCTOS */}
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Buscar Producto</Label>
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between h-12 text-lg bg-background shadow-sm" disabled={loading}>
                                    {productoId 
                                    ? <span className="font-bold truncate">{productos.find((p) => p.id === productoId)?.nombre}</span>
                                    : <span className="text-muted-foreground flex items-center gap-2"><Search className="w-4 h-4"/> Buscar...</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[90vw] md:w-[400px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Escribí nombre..." className="h-12" />
                                    <CommandList className="max-h-[300px]">
                                        <CommandEmpty className="py-4 text-center text-xs">No encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {productos.map((p) => {
                                                const stock = p.stockDisponibleUnits ?? 0;
                                                const sinStock = stock <= 0;
                                                return (
                                                    <CommandItem key={p.id} value={p.nombre} disabled={sinStock} onSelect={() => { if(!sinStock) { setProductoId(p.id); setOpenCombobox(false); }}} className={cn("flex justify-between py-3", sinStock && "opacity-50")}>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{p.nombre}</span>
                                                            <span className="text-[10px] text-muted-foreground">{sinStock ? "AGOTADO" : `Stock: ${stock}`}</span>
                                                        </div>
                                                        <Badge variant="secondary">{formatCurrency(p.precioVenta)}</Badge>
                                                    </CommandItem>
                                                )
                                            })}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex gap-3 items-end">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Cant.</Label>
                            <div className="flex items-center h-12 bg-background rounded-md border shadow-sm">
                                <Button type="button" variant="ghost" className="h-full px-3 hover:bg-muted rounded-l-md" onClick={decrementUnits} disabled={units <= 1}>
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <div className="w-12 h-full flex items-center justify-center border-x">
                                    <Input type="number" min={1} value={units} onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))} className="h-full border-0 text-center text-xl font-bold bg-transparent focus-visible:ring-0 px-0" />
                                </div>
                                <Button type="button" variant="ghost" className="h-full px-3 hover:bg-muted rounded-r-md" onClick={incrementUnits}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        <Button type="button" className="flex-1 h-12 font-bold text-lg shadow-md" onClick={addItem} disabled={!productoId}>
                            <Plus className="h-5 w-5 mr-2" /> AGREGAR
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* --- LISTA DE PRODUCTOS (VISIBLE EN MÓVIL) --- */}
            {/* Solo se muestra en pantallas pequeñas (lg:hidden) para que el usuario vea la lista debajo del form */}
            <div className="lg:hidden space-y-2 pt-2">
                <div className="flex items-center justify-between pb-2 border-b">
                    <h3 className="font-bold text-muted-foreground text-sm uppercase flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" /> Items en Ticket ({cart.length})
                    </h3>
                </div>
                {cart.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                        Aún no agregaste productos
                    </div>
                ) : (
                    <div className="space-y-2">
                         <AnimatePresence mode="popLayout" initial={false}>
                            {cart.map((item) => (
                                <motion.div 
                                    key={item.producto.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                                    className="flex items-center justify-between p-3 rounded-lg bg-card border shadow-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                            {item.quantity}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm line-clamp-1">{item.producto.nombre}</p>
                                            <p className="text-[10px] text-muted-foreground">{formatCurrency(item.producto.precioVenta)} c/u</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removeItem(item.producto.id)}>
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
        </div>

        {/* --- SIDEBAR DERECHO (VISIBLE SOLO EN DESKTOP) --- */}
        <div className="hidden lg:flex w-[400px] border-l bg-card/50 flex-col shadow-xl z-10">
            <div className="p-4 border-b bg-muted/20">
                <h2 className="font-bold flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Ticket de Venta</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                        <ShoppingCart className="h-10 w-10 mb-2 opacity-20" />
                        <p>El ticket está vacío</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.producto.id} className="flex items-center justify-between p-3 rounded-xl bg-background border shadow-sm group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                                    {item.quantity}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">{item.producto.nombre}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatCurrency(item.producto.precioVenta)} c/u</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm tabular-nums">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeItem(item.producto.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer del Sidebar Desktop */}
            <div className="p-4 bg-background border-t space-y-4">
                 <PaymentSelector metodoPago={metodoPago} setMetodoPago={setMetodoPago} />
                 <Button onClick={handleCobrar} disabled={loading || cart.length === 0} className="w-full h-14 text-xl font-bold shadow-lg">
                    {loading ? <Loader2 className="animate-spin" /> : (
                        <div className="flex justify-between w-full px-2">
                            <span>COBRAR</span>
                            <span>{formatCurrency(totalAmount)}</span>
                        </div>
                    )}
                 </Button>
            </div>
        </div>

      </div>

      {/* 3. FOOTER FIJO (SOLO MÓVIL) */}
      {/* Contiene solo los métodos de pago y el botón de cobrar, para no tapar la lista */}
      <div className="lg:hidden shrink-0 bg-background border-t p-3 pb-safe shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
          <div className="max-w-2xl mx-auto space-y-3">
             <PaymentSelector metodoPago={metodoPago} setMetodoPago={setMetodoPago} isMobile />
             
             <Button onClick={handleCobrar} disabled={loading || cart.length === 0} className="w-full h-12 text-lg font-bold shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white">
                {loading ? <Loader2 className="animate-spin" /> : (
                    <div className="flex justify-between w-full px-2 items-center">
                        <span className="flex items-center gap-2 text-sm font-medium opacity-90">
                            {cart.length} ITEMS
                        </span>
                        <span className="text-xl">COBRAR {formatCurrency(totalAmount)}</span>
                    </div>
                )}
             </Button>
          </div>
      </div>

      <SuccessDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog} onConfirm={handleReset} onCancel={handleViewTicket} title="¡Venta Exitosa!" description={<span className="text-center block">Total: <span className="text-primary font-bold">{formatCurrency(totalAmount)}</span></span>} confirmText="Nueva" cancelText="Ticket PDF" />
      <ErrorDialog open={errorDialog.open} onOpenChange={(isOpen) => setErrorDialog(prev => ({ ...prev, open: isOpen }))} title={errorDialog.title} description={errorDialog.description} />
    </div>
  );
}

// Subcomponente de Pagos para no repetir código
function PaymentSelector({ metodoPago, setMetodoPago, isMobile }: any) {
    return (
        <div className="space-y-2">
            {!isMobile && <Label className="text-[10px] font-bold uppercase text-muted-foreground">Método de Pago</Label>}
            <div className="grid grid-cols-4 gap-2">
                {METODOS_PAGO.map((m: any) => (
                    <button
                        key={m.value}
                        onClick={() => setMetodoPago(m.value)}
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg font-medium border transition-all relative overflow-hidden",
                            isMobile ? "py-1.5 text-[9px]" : "py-2 text-[10px]",
                            metodoPago === m.value 
                                ? "bg-primary border-primary text-primary-foreground shadow-md" 
                                : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                        )}
                    >
                        <m.icon className={cn("mb-1", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                        {m.label}
                    </button>
                ))}
            </div>
        </div>
    )
}