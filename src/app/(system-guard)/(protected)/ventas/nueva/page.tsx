"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, Banknote, Coins, CreditCard, Loader2, Lock, Minus, Plus, QrCode } from "lucide-react";
import { toast } from "sonner";

import { ErrorDialog } from "@/components/error-dialog";
import { ShiftEndAlert } from "@/components/shift-end-alert";
import { SuccessDialog } from "@/components/success-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiService } from "@/lib/apiService";
import type { Cliente, CreateVentaDirectaInput, DescuentoNivel, MetodoPago } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";

import { CartList } from "./components/cart-list";
import { CustomerSelector } from "./components/customer-selector";
import { DesktopSummary } from "./components/desktop-summary";
import { MobileSummaryBar } from "./components/mobile-summary-bar";
import { ProductSelector } from "./components/product-selector";
import { VentaHeader } from "./components/venta-header";
import type { CartItem, MetodoPagoOption, ProductoConStock } from "./types";
import { formatCurrency, getBestDiscount, getNextDiscount } from "./utils";

const METODOS_PAGO: MetodoPagoOption[] = [
  { value: "EFECTIVO", label: "Efe", icon: Banknote },
  { value: "TRANSFERENCIA", label: "Transf", icon: QrCode },
  { value: "TARJETA", label: "Tarj", icon: CreditCard },
  { value: "OTRO", label: "Otro", icon: Coins },
];

export default function NuevaVentaPage() {
  const router = useRouter();
  const { activeSucursalId } = useSucursalStore();

  const [productos, setProductos] = React.useState<ProductoConStock[]>([]);
  const [clientes, setClientes] = React.useState<Cliente[]>([]);
  const [porcentajeInteresTarjeta, setPorcentajeInteresTarjeta] = React.useState(0);

  const [productoId, setProductoId] = React.useState<number | "">("");
  const [selectedClienteId, setSelectedClienteId] = React.useState<number | "">("");
  const [units, setUnits] = React.useState<number>(1);
  const [metodoPago, setMetodoPago] = React.useState<MetodoPago>("EFECTIVO");

  const [openProductoCombobox, setOpenProductoCombobox] = React.useState(false);
  const [openClienteCombobox, setOpenClienteCombobox] = React.useState(false);
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [createdVentaId, setCreatedVentaId] = React.useState<number | null>(null);
  const [errorDialog, setErrorDialog] = React.useState({ open: false, title: "", description: "" });

  const [openDescuento, setOpenDescuento] = React.useState(false);
  const [descuentoTipo, setDescuentoTipo] = React.useState<"MONTO" | "PORCENTAJE">("MONTO");
  const [descuentoValor, setDescuentoValor] = React.useState<string>("");
  const [descuentoAplicado, setDescuentoAplicado] = React.useState<{
    tipo: "MONTO" | "PORCENTAJE";
    valor: number;
  } | null>(null);

  const [usaCajaEstricta, setUsaCajaEstricta] = React.useState(true);
  const [cajaAbierta, setCajaAbierta] = React.useState<boolean | null>(null);
  const [verificandoCaja, setVerificandoCaja] = React.useState(true);
  const [horarioFin, setHorarioFin] = React.useState<string | undefined>(undefined);

  const barcodeBuffer = React.useRef("");
  const lastKeyTime = React.useRef(0);

  const fetchData = React.useCallback(async () => {
    setVerificandoCaja(true);

    try {
      const configRes = await apiService.getConfiguracionGeneral();
      const requiereCaja = configRes?.usarControlDeCaja ?? true;
      setUsaCajaEstricta(requiereCaja);
      setPorcentajeInteresTarjeta(configRes?.porcentajeInteresTarjeta ?? configRes?.data?.porcentajeInteresTarjeta ?? 0);

      const cajaRes = await apiService.verificarCajaAbierta();
      setHorarioFin(cajaRes.horarioConfigurado?.horaFin);

      if (requiereCaja) {
        if (!cajaRes.data) {
          setCajaAbierta(false);
          setVerificandoCaja(false);
          return;
        }
        setCajaAbierta(true);
      } else {
        setCajaAbierta(true);
      }

      const [productosResponse, clientesResponse] = await Promise.all([
        apiService.getProductos(),
        apiService.getClientes(),
      ]);

      const productosActivos = (productosResponse as ProductoConStock[]).filter((producto) => producto.activo !== false);
      setProductos(productosActivos);
      setClientes(clientesResponse);
    } catch {
      setError("Error cargando datos del sistema.");
    } finally {
      setVerificandoCaja(false);
    }
  }, []);

  const addToCart = React.useCallback(
    (product: ProductoConStock, quantityToAdd: number) => {
      setError(null);

      const stockDisponible = product.stockDisponibleUnits ?? 9999;
      const currentInCart = cart.find((item) => item.producto.id === product.id)?.quantity ?? 0;

      if (stockDisponible <= 0) {
        setErrorDialog({
          open: true,
          title: "Sin Stock",
          description: "Este producto esta agotado.",
        });
        return;
      }

      if (currentInCart + quantityToAdd > stockDisponible) {
        setErrorDialog({
          open: true,
          title: "Stock Insuficiente",
          description: `Solo quedan ${stockDisponible} unidades disponibles.`,
        });
        return;
      }

      setCart((previous) => {
        const exists = previous.find((item) => item.producto.id === product.id);
        if (exists) {
          return previous.map((item) =>
            item.producto.id === product.id ? { ...item, quantity: item.quantity + quantityToAdd } : item,
          );
        }
        return [...previous, { producto: product, quantity: quantityToAdd }];
      });
    },
    [cart],
  );

  const processBarcode = React.useCallback(
    (code: string) => {
      const product = productos.find((producto) => producto.codigoBarra === code);
      if (product) {
        addToCart(product, 1);
        toast.success(`Escaneado: ${product.nombre}`);
        return;
      }
      toast.error(`Producto no encontrado: ${code}`);
    },
    [addToCart, productos],
  );

  React.useEffect(() => {
    fetchData();
  }, [activeSucursalId, fetchData]);

  React.useEffect(() => {
    setCart([]);
    setProductoId("");
  }, [activeSucursalId]);

  React.useEffect(() => {
    if (usaCajaEstricta && !cajaAbierta) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 50) {
        barcodeBuffer.current = "";
      }
      lastKeyTime.current = currentTime;

      if (event.key === "Enter") {
        if (barcodeBuffer.current.length > 0) {
          processBarcode(barcodeBuffer.current);
          barcodeBuffer.current = "";
        }
        return;
      }

      if (event.key.length === 1) {
        barcodeBuffer.current += event.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cajaAbierta, processBarcode, usaCajaEstricta]);

  const addItemManual = () => {
    if (!productoId || units <= 0) {
      return;
    }

    const product = productos.find((item) => item.id === productoId);
    if (!product) {
      return;
    }

    addToCart(product, units);
    setProductoId("");
    setUnits(1);
    setOpenProductoCombobox(false);
  };

  const removeItem = (productId: number) => {
    setCart((previous) => previous.filter((item) => item.producto.id !== productId));
  };

  const totalSinInteres = React.useMemo(
    () => cart.reduce((accumulator, current) => accumulator + Number(current.producto.precioVenta) * current.quantity, 0),
    [cart],
  );

  const subcategoryQtyMap = React.useMemo(() => {
    const map = new Map<number, number>();
    cart.forEach((item) => {
      const subcategoryId = item.producto.subcategoriaId;
      if (subcategoryId) {
        map.set(subcategoryId, (map.get(subcategoryId) ?? 0) + item.quantity);
      }
    });
    return map;
  }, [cart]);

  const getDiscountMeta = React.useCallback(
    (item: CartItem) => {
      const subcategoryId = item.producto.subcategoriaId;
      const totalSubQty = subcategoryId ? (subcategoryQtyMap.get(subcategoryId) ?? 0) : 0;
      const descuentos = item.producto.subcategoria?.descuentos as DescuentoNivel[] | null | undefined;
      const best = getBestDiscount(descuentos, totalSubQty);
      const next = getNextDiscount(descuentos, totalSubQty);

      return {
        totalSubQty,
        bestDiscountPct: best?.porcentaje ?? null,
        nextDiscountPct: next?.porcentaje ?? null,
        nextDiscountQty: next?.cantidadMin ?? null,
        subcategoriaNombre: item.producto.subcategoria?.nombre ?? "marca",
      };
    },
    [subcategoryQtyMap],
  );

  const totalDescuento = React.useMemo(
    () =>
      cart.reduce((accumulator, item) => {
        const subcategoryId = item.producto.subcategoriaId;
        if (!subcategoryId) {
          return accumulator;
        }

        const totalSubQty = subcategoryQtyMap.get(subcategoryId) ?? 0;
        const subDescuentos = item.producto.subcategoria?.descuentos as DescuentoNivel[] | null | undefined;
        const best = getBestDiscount(subDescuentos, totalSubQty);

        if (!best) {
          return accumulator;
        }

        const descuentoItem = Number(item.producto.precioVenta) * item.quantity * (best.porcentaje / 100);
        return accumulator + descuentoItem;
      }, 0),
    [cart, subcategoryQtyMap],
  );

  const subtotalNetoItems = totalSinInteres - totalDescuento;

  const montoDescuentoGlobal = React.useMemo(() => {
    if (!descuentoAplicado) {
      return 0;
    }

    if (descuentoAplicado.tipo === "MONTO") {
      return descuentoAplicado.valor;
    }

    return subtotalNetoItems * (descuentoAplicado.valor / 100);
  }, [descuentoAplicado, subtotalNetoItems]);

  const montoInteres =
    metodoPago === "TARJETA" ? (subtotalNetoItems - montoDescuentoGlobal) * (porcentajeInteresTarjeta / 100) : 0;

  const totalAmount = subtotalNetoItems - montoDescuentoGlobal + montoInteres;

  const formatMontoInput = React.useCallback((value: string) => {
    const cleaned = value.replace(/[^\d,]/g, "");
    if (!cleaned) {
      return "";
    }

    const hasComma = cleaned.includes(",");
    const [integerRaw, decimalRaw = ""] = cleaned.split(",");
    const integerNormalized = integerRaw.replace(/^0+(?=\d)/, "") || "0";
    const integerFormatted = integerNormalized.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const decimalLimited = decimalRaw.replace(/,/g, "").slice(0, 2);

    if (hasComma) {
      return decimalLimited.length > 0 ? `${integerFormatted},${decimalLimited}` : `${integerFormatted},`;
    }

    return integerFormatted;
  }, []);

  const sanitizePorcentajeInput = React.useCallback((value: string) => {
    const cleaned = value.replace(/[^\d,]/g, "");
    const firstComma = cleaned.indexOf(",");
    if (firstComma === -1) {
      return cleaned;
    }
    return cleaned.slice(0, firstComma + 1) + cleaned.slice(firstComma + 1).replace(/,/g, "");
  }, []);

  const parseMontoArs = React.useCallback((value: string) => {
    const cleaned = value.trim().replace(/\$/g, "").replace(/\s+/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, []);

  const parsePorcentaje = React.useCallback((value: string) => {
    const cleaned = value.trim().replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, []);

  const descuentoPreview = React.useMemo(() => {
    if (!descuentoValor) {
      return 0;
    }

    if (descuentoTipo === "MONTO") {
      const parsed = parseMontoArs(descuentoValor);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }

    const parsed = parsePorcentaje(descuentoValor);
    return Number.isFinite(parsed) && parsed > 0 ? subtotalNetoItems * (parsed / 100) : 0;
  }, [descuentoTipo, descuentoValor, parseMontoArs, parsePorcentaje, subtotalNetoItems]);

  const handleCobrar = async () => {
    setError(null);
    if (cart.length === 0) {
      return;
    }

    setLoading(true);
    try {
      const finalClienteId = selectedClienteId === "" ? null : Number(selectedClienteId);
      const payload: CreateVentaDirectaInput = {
        clienteId: finalClienteId,
        items: cart.map((item) => {
          const subcategoryId = item.producto.subcategoriaId;
          let discountForItem = 0;

          if (subcategoryId) {
            const totalSubQty = subcategoryQtyMap.get(subcategoryId) ?? 0;
            const subDescuentos = item.producto.subcategoria?.descuentos as DescuentoNivel[] | null | undefined;
            const best = getBestDiscount(subDescuentos, totalSubQty);

            if (best) {
              discountForItem = Number(item.producto.precioVenta) * item.quantity * (best.porcentaje / 100);
            }
          }

          return {
            productoId: item.producto.id,
            units: item.quantity,
            precioUnitario: item.producto.precioVenta,
            descuento: discountForItem,
          };
        }),
        metodoPago,
        descuentoGlobal: montoDescuentoGlobal,
      };

      const response = await apiService.createVentaDirecta(payload);
      setCreatedVentaId(response.id);
      setShowSuccessDialog(true);
    } catch (caughtError: unknown) {
      const message =
        typeof caughtError === "object" &&
        caughtError !== null &&
        "message" in caughtError &&
        typeof (caughtError as { message?: string }).message === "string"
          ? (caughtError as { message: string }).message
          : "Intenta nuevamente.";

      setErrorDialog({
        open: true,
        title: "Error al procesar",
        description: message,
      });
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
    setDescuentoAplicado(null);
    setDescuentoValor("");
    fetchData();
  };

  const handleViewTicket = () => {
    if (!createdVentaId) {
      return;
    }
    window.open(`/ticket-loading/${createdVentaId}`, "_blank");
  };

  const handleWhatsApp = () => {
    if (!createdVentaId) {
      return;
    }

    const cliente = clientes.find((item) => item.id === Number(selectedClienteId));
    const phone = cliente?.telefono ?? "";
    const name = cliente?.nombre ?? "Cliente";

    const url = `/ticket-loading/${createdVentaId}?mode=whatsapp&phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`;
    window.open(url, "_blank");
  };

  const clientesFiltrados = React.useMemo(
    () => clientes.filter((cliente) => !cliente.nombre.toLowerCase().includes("consumidor final")),
    [clientes],
  );

  const selectedClienteLabel = React.useMemo(() => {
    if (selectedClienteId === "") {
      return "Consumidor Final";
    }
    const cliente = clientes.find((item) => item.id === selectedClienteId);
    return cliente ? cliente.nombre : "Seleccionar...";
  }, [clientes, selectedClienteId]);

  const isClienteRegistrado = selectedClienteId !== "";

  if (verificandoCaja) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-background" role="status" aria-live="polite">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" aria-hidden="true" />
        <p className="text-muted-foreground font-medium">Sincronizando sesion...</p>
      </div>
    );
  }

  if (usaCajaEstricta && cajaAbierta === false) {
    return (
      <main className="h-[100dvh] flex flex-col items-center justify-center bg-background px-4 text-center">
        <div className="h-24 w-24 bg-muted/50 rounded-full flex items-center justify-center mb-6 border shadow-sm">
          <Lock className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">Caja Cerrada</h1>
        <p className="text-muted-foreground max-w-sm mb-8 text-sm leading-relaxed">
          Para comenzar a vender, primero debes abrir tu turno de caja y declarar el fondo inicial.
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <Button type="button" variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => router.back()}>
            Volver
          </Button>
          <Button
            type="button"
            className="flex-1 h-12 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => router.push("/caja/abrir")}
          >
            Abrir Caja
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden selection:bg-primary/20">
      <VentaHeader
        onBack={() => router.back()}
        onCloseShift={() => router.push("/caja/cerrar")}
        showQuickSaleTag={!usaCajaEstricta}
        showCloseShift={usaCajaEstricta}
      />

      {activeSucursalId === 0 && (
        <Alert variant="destructive" className="mx-4 mt-2 rounded-xl border-dashed bg-[color:var(--status-danger)]/10 text-[color:var(--status-danger)]">
          <AlertDescription className="flex items-center gap-2 font-bold text-center justify-center">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Ventas deshabilitadas en &quot;Vista General&quot;. Selecciona una sucursal especifica arriba.
          </AlertDescription>
        </Alert>
      )}

      <main className="flex-1 flex overflow-hidden" aria-label="Flujo de venta">
        <section className="flex-1 flex flex-col min-h-0 relative bg-background" aria-label="Carga de ticket">
          <section className="shrink-0 p-3 space-y-3 bg-card/30 border-b z-10 shadow-sm" aria-label="Controles de venta">
            {error && (
              <Alert variant="destructive" className="py-2 rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <CustomerSelector
                open={openClienteCombobox}
                onOpenChange={setOpenClienteCombobox}
                selectedClienteId={selectedClienteId}
                clientesFiltrados={clientesFiltrados}
                isClienteRegistrado={isClienteRegistrado}
                selectedLabel={selectedClienteLabel}
                onSelectConsumidorFinal={() => {
                  setSelectedClienteId("");
                  setOpenClienteCombobox(false);
                }}
                onSelectCliente={(clienteId) => {
                  setSelectedClienteId(clienteId);
                  setOpenClienteCombobox(false);
                }}
              />

              <ProductSelector
                open={openProductoCombobox}
                onOpenChange={setOpenProductoCombobox}
                productoId={productoId}
                productos={productos}
                loading={loading}
                onSelectProduct={(productId) => {
                  setProductoId(productId);
                  setOpenProductoCombobox(false);
                }}
              />
            </div>

            <div className="flex gap-2 w-full">
              <div className="flex items-center h-10 bg-background rounded-xl border border-border/50 shadow-sm w-[132px] shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full px-2 focus-visible:ring-2"
                  onClick={() => setUnits((previous) => (previous > 1 ? previous - 1 : 1))}
                  disabled={units <= 1}
                  aria-label="Disminuir cantidad"
                >
                  <Minus className="h-3 w-3" aria-hidden="true" />
                </Button>
                <div className="flex-1 h-full flex items-center justify-center border-x border-border/50 bg-muted/5">
                  <Input
                    type="number"
                    min={1}
                    value={units}
                    onChange={(event) => setUnits(Math.max(1, Number(event.target.value)))}
                    className="h-full border-0 text-center text-lg font-bold bg-transparent focus-visible:ring-0 px-0"
                    aria-label="Cantidad de unidades"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full px-2 focus-visible:ring-2"
                  onClick={() => setUnits((previous) => previous + 1)}
                  aria-label="Aumentar cantidad"
                >
                  <Plus className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>

              <Button
                type="button"
                className="flex-1 h-10 min-w-0 font-bold rounded-xl active:scale-[0.98] transition-all shadow-sm focus-visible:ring-2 text-sm"
                onClick={addItemManual}
                disabled={!productoId}
                aria-label="Agregar producto al ticket"
              >
                <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Agregar
              </Button>
            </div>
          </section>

          <section className="flex-1 overflow-y-auto p-3 bg-muted/5" aria-label="Listado de carrito">
            <CartList cart={cart} getDiscountInfo={getDiscountMeta} onRemoveItem={removeItem} />
          </section>
        </section>

        <DesktopSummary
          cart={cart}
          totalSinInteres={totalSinInteres}
          totalDescuento={totalDescuento}
          montoDescuentoGlobal={montoDescuentoGlobal}
          montoInteres={montoInteres}
          porcentajeInteresTarjeta={porcentajeInteresTarjeta}
          totalAmount={totalAmount}
          isTarjeta={metodoPago === "TARJETA"}
          descuentoTipo={descuentoAplicado?.tipo}
          descuentoValor={descuentoAplicado?.valor}
        />
      </main>

      <div className="h-64 md:h-48 w-full shrink-0 lg:hidden" />

      <MobileSummaryBar
        metodoPago={metodoPago}
        opcionesPago={METODOS_PAGO}
        loading={loading}
        cartLength={cart.length}
        totalAmount={totalAmount}
        disabled={loading || cart.length === 0 || activeSucursalId === 0}
        onMetodoPagoChange={setMetodoPago}
        onOpenDescuento={() => setOpenDescuento(true)}
        onCobrar={handleCobrar}
      />

      {usaCajaEstricta && cajaAbierta && (
        <ShiftEndAlert horaFin={horarioFin} onExtender={(nuevaHora) => setHorarioFin(nuevaHora)} />
      )}

      <SuccessDialog
        open={showSuccessDialog}
        onOpenChange={setShowSuccessDialog}
        onConfirm={handleReset}
        onCancel={handleViewTicket}
        onWhatsApp={handleWhatsApp}
        title="Venta Exitosa"
        description={
          <span className="text-center block text-muted-foreground mt-2 font-medium">
            Total: <span className="text-primary font-black text-xl ml-1">{formatCurrency(totalAmount)}</span>
          </span>
        }
        confirmText="Nueva Venta"
        cancelText="Ver Ticket"
      />

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(isOpen) => setErrorDialog((previous) => ({ ...previous, open: isOpen }))}
        title={errorDialog.title}
        description={errorDialog.description}
      />

      <Dialog open={openDescuento} onOpenChange={setOpenDescuento}>
        <DialogContent className="sm:max-w-xs md:max-w-sm rounded-2xl border-border/60 bg-background">
          <DialogHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
              <BadgePercent className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Promocion</span>
            </div>
            <DialogTitle className="text-xl font-black tracking-tight">Descuento General</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/50 border border-border/60">
              <Button
                type="button"
                variant={descuentoTipo === "MONTO" ? "default" : "outline"}
                className={cn(
                  "h-10 rounded-lg",
                  descuentoTipo === "MONTO" && "bg-primary hover:bg-primary/90 text-primary-foreground border-primary",
                )}
                onClick={() => {
                  setDescuentoTipo("MONTO");
                  setDescuentoValor((previous) => formatMontoInput(previous));
                }}
              >
                Monto Fijo ($)
              </Button>
              <Button
                type="button"
                variant={descuentoTipo === "PORCENTAJE" ? "default" : "outline"}
                className={cn(
                  "h-10 rounded-lg",
                  descuentoTipo === "PORCENTAJE" && "bg-primary hover:bg-primary/90 text-primary-foreground",
                )}
                onClick={() => {
                  setDescuentoTipo("PORCENTAJE");
                  setDescuentoValor((previous) => sanitizePorcentajeInput(previous));
                }}
              >
                Porcentaje (%)
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                type="text"
                inputMode={descuentoTipo === "MONTO" ? "decimal" : "numeric"}
                placeholder={descuentoTipo === "MONTO" ? "$ 1.500,50" : "10,5"}
                value={descuentoValor}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDescuentoValor(
                    descuentoTipo === "MONTO" ? formatMontoInput(nextValue) : sanitizePorcentajeInput(nextValue),
                  );
                }}
                className="text-lg font-bold text-center h-12 border-border/70 bg-background/80 focus-visible:ring-primary"
                aria-label="Valor del descuento"
              />
              {descuentoTipo === "PORCENTAJE" && (
                <p className="text-xs text-muted-foreground text-center">Usa coma para decimales: ej. 10,5</p>
              )}
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm flex items-center justify-between">
              <span className="font-semibold text-primary">Descuento estimado</span>
              <span className="font-black text-primary">- {formatCurrency(descuentoPreview)}</span>
            </div>

            {descuentoAplicado && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[color:var(--status-danger)] hover:text-[color:var(--status-danger)] hover:bg-[color:var(--status-danger)]/10"
                onClick={() => {
                  setDescuentoAplicado(null);
                  setDescuentoValor("");
                  setOpenDescuento(false);
                }}
              >
                Quitar Descuento Actual
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 rounded-xl"
              onClick={() => {
                const value = descuentoTipo === "MONTO" ? parseMontoArs(descuentoValor) : parsePorcentaje(descuentoValor);
                if (!Number.isNaN(value) && value > 0) {
                  setDescuentoAplicado({ tipo: descuentoTipo, valor: value });
                } else {
                  setDescuentoAplicado(null);
                }
                setOpenDescuento(false);
              }}
            >
              Aplicar Descuento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
