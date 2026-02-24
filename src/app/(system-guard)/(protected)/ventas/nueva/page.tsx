// src/app/(protected)/ventas/nueva/page.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus, Minus, Trash2, Loader2, ArrowLeft, ShoppingCart,
  Search, Banknote, CreditCard, QrCode, Coins, Check, ChevronsUpDown,
  UserCircle2, Barcode, Lock, Store
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
import { Separator } from "@/components/ui/separator";
import { ShiftEndAlert } from "@/components/shift-end-alert";
import { useSucursalStore } from "@/store/useSucursalStore";

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
  const { activeSucursalId } = useSucursalStore();

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

  // --- ESTADOS DE CAJA Y HORARIO ---
  const [usaCajaEstricta, setUsaCajaEstricta] = React.useState<boolean>(true);
  const [cajaAbierta, setCajaAbierta] = React.useState<boolean | null>(null);
  const [verificandoCaja, setVerificandoCaja] = React.useState(true);
  const [horarioFin, setHorarioFin] = React.useState<string | undefined>(undefined);

  // Scanner Buffer
  const barcodeBuffer = React.useRef<string>("");
  const lastKeyTime = React.useRef<number>(0);

  // --- Initial Load ---
  const fetchData = React.useCallback(async () => {
    setVerificandoCaja(true);
    try {
      // 1. Obtener la configuración general primero
      const configRes = await apiService.getConfiguracionGeneral();
      const requiereCaja = configRes?.usarControlDeCaja ?? true;
      setUsaCajaEstricta(requiereCaja);

      // 2. Verificar estado de caja y traer horario configurado
      const cajaRes = await apiService.verificarCajaAbierta();

      // Guardamos el horario de fin para el monitor
      setHorarioFin(cajaRes.horarioConfigurado?.horaFin);

      if (requiereCaja) {
        if (!cajaRes.data) {
          setCajaAbierta(false);
          setVerificandoCaja(false);
          return;
        }
        setCajaAbierta(true);
      } else {
        // Modo Venta Rápida: ignoramos el bloqueo de apertura
        setCajaAbierta(true);
      }

      // 3. Cargar productos y clientes
      const [prodRes, cliRes] = await Promise.all([
        apiService.getProductos(),
        apiService.getClientes()
      ]);
      const activos = (prodRes as any[]).filter(p => p.activo !== false);
      setProductos(activos);
      setClientes(cliRes);
    } catch (err) {
      setError("Error cargando datos del sistema.");
    } finally {
      setVerificandoCaja(false);
    }
  }, [activeSucursalId]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // Clean cart when sucursal changes
  React.useEffect(() => {
    setCart([]);
    setProductoId("");
  }, [activeSucursalId]);

  // --- LÓGICA DE SCANNER ---
  React.useEffect(() => {
    if (usaCajaEstricta && !cajaAbierta) return;

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
  }, [productos, cart, cajaAbierta, usaCajaEstricta]);

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
      setCreatedVentaId(res.id);
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

  // ========================================================
  // RENDERIZADOS CONDICIONALES
  // ========================================================

  if (verificandoCaja) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Sincronizando sesión...</p>
      </div>
    );
  }

  if (usaCajaEstricta && cajaAbierta === false) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background px-4 text-center">
        <div className="h-24 w-24 bg-muted/50 rounded-full flex items-center justify-center mb-6 border shadow-sm">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">Caja Cerrada</h1>
        <p className="text-muted-foreground max-w-sm mb-8 text-sm leading-relaxed">
          Para comenzar a vender, primero debes abrir tu turno de caja y declarar el fondo inicial.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => router.back()}>
            Volver
          </Button>
          <Button className="flex-1 h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => router.push('/caja/abrir')}>
            Abrir Caja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden selection:bg-primary/20">

      {/* 1. HEADER */}
      <div className="shrink-0 h-14 border-b bg-background flex items-center justify-between px-4 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="-ml-2 text-muted-foreground" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Punto de Venta
            </h1>
            {!usaCajaEstricta && (
              <Badge variant="outline" className="text-[9px] bg-muted/30 text-muted-foreground hidden sm:flex items-center gap-1 border-border/50">
                <Store className="h-3 w-3" /> Venta Rápida
              </Badge>
            )}
          </div>
        </div>

        {usaCajaEstricta && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-semibold text-xs h-8 rounded-lg"
            onClick={() => router.push('/caja/cerrar')}
          >
            <Lock className="h-3 w-3 mr-1.5" />
            Cerrar Turno
          </Button>
        )}
      </div>

      {/* 2. CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 relative bg-background">

          {/* A. FORMULARIO */}
          <div className="shrink-0 p-3 space-y-3 bg-card/30 border-b z-10 shadow-sm">
            {error && <Alert variant="destructive" className="py-2 rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>}

            <div className="flex gap-2">
              <div className="w-[115px] sm:w-1/3 min-w-[115px]">
                <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between h-10 text-[11px] sm:text-xs px-2 truncate rounded-xl transition-all",
                        isClienteRegistrado && "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 font-bold"
                      )}
                    >
                      <span className="truncate">{selectedClienteId === "" ? "Cons. Final" : getSelectedClienteLabel()}</span>
                      <UserCircle2 className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[85vw] sm:w-[320px] p-0 rounded-xl" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." className="h-10" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>No se encontró el cliente.</CommandEmpty>
                        <CommandGroup heading="Opciones">
                          <CommandItem
                            value="consumidor final"
                            onSelect={() => {
                              setSelectedClienteId("");
                              setOpenClienteCombobox(false);
                            }}
                            className="cursor-pointer"
                          >
                            <UserCircle2 className="mr-2 h-4 w-4 opacity-70" />
                            <span className="font-medium">Consumidor Final</span>
                            {selectedClienteId === "" && <Check className="ml-auto h-4 w-4 text-primary" />}
                          </CommandItem>
                        </CommandGroup>
                        <Separator />
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
                              <div className="flex flex-col overflow-hidden">
                                <span className={cn("text-sm truncate", selectedClienteId === cliente.id && "font-bold text-primary")}>
                                  {cliente.nombre}
                                </span>
                              </div>
                              {selectedClienteId === cliente.id && <Check className="ml-auto h-4 w-4 text-primary shrink-0" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 min-w-0">
                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full h-10 text-sm shadow-sm relative text-left pl-9 sm:pl-10 rounded-xl transition-all",
                        !productoId && "text-muted-foreground border-dashed border-border/60"
                      )}
                      disabled={loading}
                    >
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                        <Barcode className="h-4 w-4 text-primary animate-pulse" />
                      </div>
                      <div className="flex items-center justify-between w-full overflow-hidden">
                        <span className="truncate text-xs sm:text-sm">
                          {productoId
                            ? productos.find((p) => p.id === productoId)?.nombre
                            : "Escanear o buscar producto..."}
                        </span>
                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50 hidden sm:block" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[85vw] md:w-[400px] p-0 rounded-xl" align="start">
                    <Command filter={(value, search) => {
                      const p = productos.find(item => item.nombre === value);
                      if (!p) return 0;
                      const matchName = p.nombre.toLowerCase().includes(search.toLowerCase());
                      const matchCode = p.codigoBarra?.toLowerCase().includes(search.toLowerCase());
                      return (matchName || matchCode) ? 1 : 0;
                    }}>
                      <CommandInput placeholder="Nombre o código..." className="h-12" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>No se encontró el producto.</CommandEmpty>
                        <CommandGroup>
                          {productos.map((p) => {
                            const stock = p.stockDisponibleUnits ?? 0;
                            const sinStock = stock <= 0;
                            return (
                              <CommandItem
                                key={p.id}
                                value={p.nombre}
                                disabled={sinStock}
                                onSelect={() => {
                                  setProductoId(p.id);
                                  setOpenCombobox(false);
                                }}
                                className={cn("flex justify-between py-3 cursor-pointer", sinStock && "opacity-50")}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm leading-none">{p.nombre}</span>
                                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground font-bold">
                                    {p.codigoBarra && (
                                      <span className="font-mono bg-muted px-1 rounded flex items-center gap-1 border border-border/40">
                                        <Barcode className="h-3 w-3" /> {p.codigoBarra}
                                      </span>
                                    )}
                                    <span>{sinStock ? "AGOTADO" : `Disp: ${stock}`}</span>
                                  </div>
                                </div>
                                <Badge variant={sinStock ? "destructive" : "secondary"}>
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
            </div>

            <div className="flex gap-2">
              <div className="flex items-center h-10 bg-background rounded-xl border border-border/50 shadow-sm shrink-0">
                <Button type="button" variant="ghost" className="h-full px-2" onClick={decrementUnits} disabled={units <= 1}>
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="w-10 h-full flex items-center justify-center border-x border-border/50 bg-muted/5">
                  <Input type="number" min={1} value={units} onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))} className="h-full border-0 text-center text-lg font-bold bg-transparent focus-visible:ring-0 px-0" />
                </div>
                <Button type="button" variant="ghost" className="h-full px-2" onClick={incrementUnits}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button type="button" className="flex-1 h-10 font-bold rounded-xl active:scale-[0.98] transition-all shadow-sm" onClick={addItemManual} disabled={!productoId}>
                <Plus className="h-4 w-4 mr-1" /> AGREGAR AL TICKET
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 bg-muted/5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-3">
                <div className="p-5 rounded-full bg-muted/50 border border-border/40">
                  <ShoppingCart className="h-10 w-10 opacity-30" />
                </div>
                <p className="text-sm font-black tracking-widest uppercase">Ticket vacío</p>
              </div>
            ) : (
              <div className="space-y-2.5 pb-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {cart.map((item) => (
                    <motion.div
                      key={item.producto.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, x: -20 }}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/40 shadow-sm group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs shrink-0">
                          {item.quantity}x
                        </div>
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-sm truncate text-foreground">{item.producto.nombre}</p>
                          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{formatCurrency(item.producto.precioVenta)} / unidad</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-black text-base">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/30 hover:text-red-500 rounded-lg transition-colors" onClick={() => removeItem(item.producto.id)}>
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

        <div className="hidden lg:flex w-[380px] bg-background border-l border-border/40 flex-col shadow-xl z-20">
          <div className="p-6 border-b bg-muted/10">
            <h2 className="font-black text-lg flex items-center gap-2 text-foreground tracking-tight">
              <ShoppingCart className="h-5 w-5 text-primary" /> Resumen de Compra
            </h2>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-1 opacity-60">Detalle de items facturados</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-background/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3">
                <div className="p-4 rounded-full border-2 border-dashed border-muted-foreground/50">
                  <Barcode className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-black tracking-widest uppercase">Esperando items...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.producto.id + 'sidebar'} className="flex justify-between items-start text-sm group">
                    <div className="flex gap-3 min-w-0 pr-4">
                      <span className="font-bold w-6 text-right tabular-nums text-muted-foreground shrink-0">{item.quantity}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground leading-tight">{item.producto.nombre}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(item.producto.precioVenta)} c/u</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold tracking-tight shrink-0">{formatCurrency(item.producto.precioVenta * item.quantity)}</span>
                  </div>
                ))}
                <Separator className="my-4 border-dashed" />
              </div>
            )}
          </div>

          <div className="p-6 bg-muted/10 border-t border-border/40 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground font-medium">
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground font-medium">
                <span>Descuentos</span>
                <span>$ 0</span>
              </div>
              <div className="flex justify-between items-end pt-2 border-t border-border/50">
                <span className="text-sm font-black uppercase text-muted-foreground tracking-widest">Total</span>
                <span className="text-3xl font-black text-primary tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-64 md:h-48 w-full shrink-0 lg:hidden" />

      <div className="fixed bottom-[90px] md:bottom-6 left-0 right-0 z-40 px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-2xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-2xl rounded-[2rem] p-3 md:p-4 pointer-events-auto transition-all duration-300">
          <div className="space-y-4">
            <PaymentSelector metodoPago={metodoPago} setMetodoPago={setMetodoPago} />
            <Button
              onClick={handleCobrar}
              disabled={loading || cart.length === 0}
              className="w-full h-12 md:h-14 text-base md:text-lg font-black shadow-lg shadow-indigo-500/20 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl md:rounded-2xl active:scale-[0.98] transition-all"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                <div className="flex justify-between w-full px-2 md:px-4 items-center">
                  <span className="text-[10px] md:text-xs font-bold tracking-widest opacity-80 uppercase bg-black/10 px-2 py-1 rounded-md">{cart.length} ITEMS</span>
                  <span className="text-lg md:text-xl tracking-tight">COBRAR {formatCurrency(totalAmount)}</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ✅ Cambiamos 'horaFinOriginal' por 'horaFin' para que coincida con el componente */}
      {usaCajaEstricta && cajaAbierta && (
        <ShiftEndAlert
          horaFin={horarioFin}
          onExtender={(nuevaHora) => setHorarioFin(nuevaHora)}
        />
      )}

      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        onConfirm={handleReset}
        onCancel={handleViewTicket}
        title="¡Venta Exitosa!"
        description={<span className="text-center block text-muted-foreground mt-2 font-medium">Total: <span className="text-primary font-black text-xl ml-1">{formatCurrency(totalAmount)}</span></span>}
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

function PaymentSelector({ metodoPago, setMetodoPago }: any) {
  return (
    <div className="grid grid-cols-4 gap-2 md:gap-3">
      {METODOS_PAGO.map((m: any) => (
        <button
          key={m.value}
          onClick={() => setMetodoPago(m.value)}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl font-bold border transition-all h-[52px] md:h-[64px]",
            metodoPago === m.value
              ? "bg-primary border-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
              : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          <m.icon className={cn("mb-1 transition-transform", metodoPago === m.value ? "h-4 w-4 md:h-5 md:w-5 scale-110" : "h-4 w-4 opacity-60")} />
          <span className="text-[9px] md:text-[10px] uppercase tracking-wider">{m.label}</span>
        </button>
      ))}
    </div>
  )
}