// src/lib/types.ts

import { AppNotification } from "@/types/notification";

/* =========================
    DEFINICIONES BÁSICAS
========================= */
export type ID = number;
import type { StorefrontContent } from "@/lib/storefront-content";

export type ISODateString = string;
export type Money = number;

/**
 * SOBRE GLOBAL DE RESPUESTAS (CORREGIDO)
 * Al agregar horarioConfigurado aquí, cualquier llamada que lo devuelva
 * será reconocida automáticamente por TypeScript.
 */
export type ApiResponse<T> = {
  data: T;
  error?: string;
  message?: string;
  horarioConfigurado?: HorarioLaboralConfig | null; // ✅ Fix para el error en page.tsx
};

export type RolUsuario = "ADMIN" | "EMPLEADO";
export type TimezoneSource = "user" | "branch" | "fallback";
export type EstadoConsignacion = "ABIERTA" | "CERRADA";
export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "OTRO";
export type EstadoGasto = "PENDIENTE" | "PAGADO";
export type FrecuenciaGasto = "UNICO" | "SEMANAL" | "MENSUAL" | "ANUAL";


export type EstadoSesionCaja = "ABIERTA" | "CERRADA";
export type TipoMovimientoCaja = "INGRESO" | "EGRESO";

export enum TipoVenta {
  CASUAL = "CASUAL",
  LIQUIDACION = "LIQUIDACION",
}

export type Notification = AppNotification;

export enum TipoMovimientoStock {
  ENTRADA = "ENTRADA",
  SALIDA = "SALIDA",
  AJUSTE = "AJUSTE",
}

export enum ShareLinkType {
  TICKET = "TICKET",
  REMITO = "REMITO",
  INVENTARIO = "INVENTARIO",
  HISTORIAL_INVENTARIO = "HISTORIAL_INVENTARIO",
  REPORTE_DASHBOARD = "REPORTE_DASHBOARD",
  REPORTE_POS = "REPORTE_POS",
  REPORTE_CONSIGNACION = "REPORTE_CONSIGNACION",
  COMPROBANTE_GASTO = "COMPROBANTE_GASTO",
}

export enum MotivoMovimientoStock {
  COMPRA = "COMPRA",
  VENTA = "VENTA",
  VENCIMIENTO = "VENCIMIENTO",
  DEVOLUCION_CLIENTE = "DEVOLUCION_CLIENTE",
  DEVOLUCION_PROVEEDOR = "DEVOLUCION_PROVEEDOR",
  ROTURA = "ROTURA",
  PERDIDA = "PERDIDA",
  AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO",
  AJUSTE_POSITIVO = "AJUSTE_POSITIVO",
  AJUSTE_NEGATIVO = "AJUSTE_NEGATIVO",
  INICIAL = "INICIAL",
  CONSIGNACION = "CONSIGNACION",
}

/* =========================
    ENTIDADES (MODELS)
========================= */

export type Usuario = {
  id: ID;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  sucursalId?: ID | null;
  zonaHoraria?: string | null;
  zonaHorariaSucursal?: string | null;
  zonaHorariaResuelta?: string;
  timezoneSource?: TimezoneSource;
  sucursalesPermitidas?: SucursalPermitida[];
  createdAt: ISODateString;
  horarios?: HorarioLaboral[];
};

export type Configuracion = {
  id: ID;
  minStockGlobal: number;
  diasAnticipacionVencimiento: number;
  notificarVencimientos: boolean;
  notificarStockBajo: boolean;
  notificarVentas: boolean;
  notificarLiquidaciones?: boolean;
  notificarConsignacionesActivas?: boolean;
  diasAvisoConsignacion?: number;
  usarControlDeCaja: boolean;
  porcentajeAumentoConsignacion: number;
  porcentajeInteresTarjeta: number;
  mostrarListaPrecios: boolean;
  convertirTienda: boolean;
  separarListaPorSucursal: boolean;
  mostrarPreciosConsignacion?: boolean;
  mostrarCategoriasEnHeader?: boolean;
  tiendaLayout?: string;
  mensajeWhatsappConsignacion?: string | null;
  mensajeWhatsappVenta?: string | null;
  mostrarBuscador?: boolean;
  mpAccessTokenTienda?: string | null;
  mpPublicKeyTienda?: string | null;
  zonaHoraria?: string | null;
  timezoneMigrationDone?: boolean;
};

export type SucursalPermitida = {
  id: ID;
  nombre: string;
  esPrincipal: boolean;
  activa: boolean;
};

export type ProfileTimezone = {
  zonaHoraria: string | null;
  zonaHorariaSucursal: string | null;
  zonaHorariaResuelta: string;
  timezoneSource: TimezoneSource;
};

export type BrandingBanner = {
  id?: ID;
  bannerData?: string | null;
  bannerMime?: string | null;
  orden?: number;
  url?: string | null;
};

export type BrandingSettings = {
  businessName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string | null;
  phone?: string | null;
  address?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  googleMapsUrl?: string | null;
  themeIdentifier?: string;
  logoData?: string | null;
  logoMime?: string | null;
  logoUrl?: string | null;
  bannerData?: string | null;
  bannerMime?: string | null;
  bannerUrl?: string | null;
  typography?: string | null;
  isBannerSlider?: boolean;
  banners?: BrandingBanner[];
  storefrontContent?: StorefrontContent | null;
};

// ============================================================
// ONLINE STORE SETTINGS — Configuración visual completa
// ============================================================

export type OnlineStoreThemeMode = "light" | "dark" | "system";
export type OnlineStoreBorderRadius = "sm" | "md" | "lg" | "xl" | "2xl";
export type OnlineStoreShadow = "none" | "soft" | "medium" | "strong";
export type OnlineStoreCardStyle = "minimal" | "elevated" | "bordered";
export type OnlineStoreButtonStyle = "rounded" | "pill" | "soft-square";
export type OnlineStoreProductLayout = "grid" | "horizontal" | "compact";
export type OnlineStoreAddButtonPosition = "floating" | "below";
export type OnlineStoreCartDisplayMode = "bottom-sheet" | "modal" | "drawer";
export type OnlineStoreDesktopLayout = "mobile-centered" | "wide-ecommerce" | "with-cart-sidebar";

export type OnlineStoreThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  whatsappColor: string;
  mode: OnlineStoreThemeMode;
  borderRadius: OnlineStoreBorderRadius;
  shadow: OnlineStoreShadow;
  cardStyle: OnlineStoreCardStyle;
  buttonStyle: OnlineStoreButtonStyle;
};

export type OnlineStoreCatalogSettings = {
  showCategories: boolean;
  showProductImages: boolean;
  showPrices: boolean;
  showStock: boolean;
  showViewAll: boolean;
  initialCategoryId?: string;
  productLayout: OnlineStoreProductLayout;
  maxProductsPerSection: number;
  addButtonPosition: OnlineStoreAddButtonPosition;
  featuredProductIds: number[];
};

export type OnlineStorePromoItem = {
  id: string;
  icon: string;
  title: string;
  description: string;
  backgroundColor?: string;
  textColor?: string;
  order?: number;
  visible?: boolean;
};

export type OnlineStorePromoSettings = {
  enabled: boolean;
  items: OnlineStorePromoItem[];
};

export type OnlineStoreCartMessageTemplate = {
  greeting: string;
  intro: string;
  subtotalLabel: string;
  totalLabel: string;
  footer?: string;
};

export type OnlineStoreCartSettings = {
  displayMode: OnlineStoreCartDisplayMode;
  showWhatsappPreview: boolean;
  whatsappButtonText: string;
  messageTemplate: OnlineStoreCartMessageTemplate;
};

export type OnlineStoreResponsiveSettings = {
  desktopLayout: OnlineStoreDesktopLayout;
};

export type OnlineStoreSettings = {
  storeName: string;
  storeLogoUrl?: string;
  storeBannerUrl?: string;
  description?: string;
  openingHours?: string;
  addressText?: string;
  theme: OnlineStoreThemeSettings;
  catalog: OnlineStoreCatalogSettings;
  promotions: OnlineStorePromoSettings;
  cart: OnlineStoreCartSettings;
  responsive: OnlineStoreResponsiveSettings;
};

export const defaultOnlineStoreSettings: OnlineStoreSettings = {
  storeName: "Mi tienda",
  storeLogoUrl: undefined,
  storeBannerUrl: undefined,
  description: "",
  openingHours: "",
  addressText: "",
  theme: {
    primaryColor: "#007AFF",
    secondaryColor: "#EAF3FF",
    backgroundColor: "#F5F6F8",
    surfaceColor: "#FFFFFF",
    textColor: "#0F172A",
    mutedTextColor: "#8A8F98",
    whatsappColor: "#25D366",
    mode: "light",
    borderRadius: "2xl",
    shadow: "soft",
    cardStyle: "minimal",
    buttonStyle: "pill",
  },
  catalog: {
    showCategories: true,
    showProductImages: true,
    showPrices: true,
    showStock: false,
    showViewAll: true,
    initialCategoryId: undefined,
    productLayout: "grid",
    maxProductsPerSection: 6,
    addButtonPosition: "floating",
    featuredProductIds: [],
  },
  promotions: {
    enabled: true,
    items: [],
  },
  cart: {
    displayMode: "bottom-sheet",
    showWhatsappPreview: true,
    whatsappButtonText: "Enviar pedido por WhatsApp",
    messageTemplate: {
      greeting: "Hola",
      intro: "Quisiera realizar el siguiente pedido:",
      subtotalLabel: "Subtotal",
      totalLabel: "Total",
      footer: "",
    },
  },
  responsive: {
    desktopLayout: "mobile-centered",
  },
};

export type AuditLogEntry = {
  id: ID;
  createdAt: ISODateString;
  action: string;
  module: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  details?: Record<string, unknown> | null;
  user?: {
    nombre: string;
    email?: string | null;
  } | null;
};

export type ActiveSession = {
  id: string;
  createdAt: ISODateString;
  lastActivity?: ISODateString | null;
  expiresAt?: ISODateString;
  isActive: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  user?: {
    nombre?: string | null;
    email?: string | null;
  } | null;
};

export type SucursalResumen = {
  id: ID;
  nombre: string;
  esPrincipal: boolean;
  activa: boolean;
};

export type Branding = {
  id: ID;
  businessName: string;
  logoMime?: string | null;
  logoData?: Buffer | string | null; // Bytes from Prisma (Buffer in Node, base64 string on client)
  primaryColor: string;
  footerText?: string | null;
  phone?: string | null;
  address?: string | null;
  updatedAt: ISODateString;
};

export type HorarioLaboral = {
  id: ID;
  usuarioId: ID;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
};

// Interfaz para la configuración que viene del backend en el login/verificación
export interface HorarioLaboralConfig {
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export type Caja = {
  id: ID;
  nombre: string;
  activa: boolean;
};

export type MovimientoCaja = {
  id: ID;
  sesionCajaId: ID;
  tipo: TipoMovimientoCaja;
  monto: Money;
  motivo: string;
  fecha: ISODateString;
};

export type SesionCaja = {
  id: ID;
  cajaId: ID;
  usuarioId: ID;
  estado: EstadoSesionCaja;
  fechaApertura: ISODateString;
  fechaCierre?: ISODateString | null;

  montoInicial: Money;
  montoFinalEsperado?: Money | null;
  montoFinalReal?: Money | null;
  diferencia?: Money | null;
  observaciones?: string | null;

  caja?: Caja;
  usuario?: Usuario;
  movimientos?: MovimientoCaja[];
  ventas?: Venta[];
  pagos?: Pago[];
};

export type Cliente = {
  id: ID;
  nombre: string;
  sucursalId?: ID;
  sucursal?: { id: ID; nombre: string };
  telefono?: string | null;
  direccion?: string | null;
  activo: boolean;
  saldoCuenta: Money;
  createdAt: ISODateString;
};

export type Categoria = {
  id: ID;
  nombre: string;
  color?: string;
  subcategorias?: Subcategoria[];
};

export type Subcategoria = {
  id: ID;
  nombre: string;
  categoriaId: ID;
  descuentos?: DescuentoNivel[] | null;
};

export type DescuentoNivel = {
  cantidadMin: number;
  porcentaje: number;
};

export type DescuentoEfectivo = {
  tipo: "porcentaje" | "monto";
  porcentaje: number;
  precioOriginal: number;
  precioFinal: number;
  montoDescuento: number;
};

export type Producto = {
  id: ID;
  nombre: string;
  descripcion?: string | null;
  codigoBarra?: string | null;
  sku?: string | null;
  activo: boolean;
  precioVenta: Money;
  precioCosto: Money;
  iva: number;
  stockDisponibleUnits: number;
  stockConsignadoUnits: number;
  stockMinUnits: number;
  packSizeUnits?: number | null;
  fechaVencimiento?: ISODateString | null;
  imagenUrl?: string | null;
  categoriaId?: ID | null;
  categoria?: Categoria;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  movimientoStocks?: MovimientoStock[];
  notifications?: Notification[];
  // Descuento directo sobre el producto
  tipoDescuento?: "porcentaje" | "monto";
  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  descuentoActivo?: boolean;
  descuentoDesde?: ISODateString | null;
  descuentoHasta?: ISODateString | null;
  // Campo calculado por el backend — el frontend no evalúa vigencia
  descuentoEfectivo?: DescuentoEfectivo | null;
};

export type PublicCatalogSubcategory = {
  id: ID;
  nombre: string;
};

export type PublicCatalogCategory = {
  id: ID;
  nombre: string;
  subcategorias: PublicCatalogSubcategory[];
};

export type PublicCatalogProduct = Pick<
  Producto,
  "id" | "nombre" | "imagenUrl" | "stockDisponibleUnits"
> & {
  precioVenta: number | string | { toString(): string };
  categoriaId: ID | null;
  subcategoriaId: ID | null;
  categoria?: Pick<Categoria, "id" | "nombre"> | null;
  subcategoria?: PublicCatalogSubcategory | null;
  descuentoEfectivo?: DescuentoEfectivo | null;
};

export type PublicCatalogBanner = {
  id?: ID;
  bannerData?: string | null;
  bannerMime?: string | null;
  orden?: number;
  url?: string | null;
};

export type PublicCatalogConfig = {
  sucursalId: ID;
  businessName?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoMime?: string | null;
  logoData?: string | null;
  logoUrl?: string | null;
  bannerMime?: string | null;
  bannerData?: string | null;
  bannerUrl?: string | null;
  isBannerSlider?: boolean;
  banners?: PublicCatalogBanner[];
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  whatsappNumber?: string | null;
  whatsappMessage?: string | null;
  phone?: string | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  footerText?: string | null;
  typography?: string | null;
  themeIdentifier?: string | null;
  tiendaLayout?: string | null;
  mostrarCategoriasEnHeader?: boolean;
  convertirTienda?: boolean;
  mostrarPreciosConsignacion?: boolean;
  porcentajeAumentoConsignacion?: number;
  porcentajeInteresTarjeta?: number;
  mpPublicKeyTienda?: string | null;
  storefrontContent?: StorefrontContent | null;
  onlineStoreConfig?: OnlineStoreSettings | null;
};

export type PublicCatalogData = {
  productos: PublicCatalogProduct[];
  categorias: PublicCatalogCategory[];
  config: PublicCatalogConfig;
};

export type CatalogCartItem = PublicCatalogProduct & {
  quantity: number;
  pricingMode?: "default" | "consigne";
};

export type PublicCatalogSortBy =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc";

export type PublicCheckoutCustomerData = {
  nombre: string;
  email: string;
  documento?: string | null;
  telefono?: string | null;
  provincia?: string | null;
  localidad?: string | null;
  codigoPostal?: string | null;
  direccion?: string | null;
  altura?: string | null;
};

export type PublicCheckoutShippingMethod = "RETIRO_LOCAL" | "UBER_FLASH" | "ENCOMIENDA";

export type PublicCheckoutShippingData = {
  metodoEnvio: PublicCheckoutShippingMethod | null;
  costo: number;
};

export type PublicCheckoutPayload = {
  items: CatalogCartItem[];
  sucursalId: ID;
  clienteData: PublicCheckoutCustomerData;
  envioData: PublicCheckoutShippingData;
};

export type PublicCheckoutResponse = {
  init_point?: string | null;
  preference_id?: string | null;
  checkout_token?: string | null;
};

export type PublicCheckoutStatusResponse = {
  status: "PENDING" | "PAID" | "FAILED";
  ventaId?: ID;
  reason?: string;
};

export type PublicShippingQuote = {
  domicilio: number;
  sucursal: number;
};

export type MovimientoStock = {
  id: ID;
  productoId: ID;
  tipo: TipoMovimientoStock;
  motivo: MotivoMovimientoStock;
  cantidad: number;
  stockPrevio: number;
  stockPosterior: number;
  observaciones?: string | null;
  createdAt: ISODateString;
  producto?: Producto;
};

export type MovimientoConProducto = MovimientoStock & {
  producto: Producto;
};

export type ShareLink = {
  id: ID;
  codeHash: string;
  codeEnc: string;
  type: ShareLinkType;
  targetId: ID;
  expiresAt: ISODateString;
  maxViews: number;
  views: number;
  createdAt: ISODateString;
  lastViewedAt?: ISODateString | null;
};

export type Venta = {
  id: ID;
  tipo: TipoVenta;
  clienteId: ID | null;
  fecha: ISODateString;
  metodoPago: MetodoPago;
  total: Money;
  descuentoGlobal?: Money;
  numeroVenta?: number | null;
  sesionCajaId?: ID | null;
  sucursalId?: ID;
  cliente?: Cliente;
  detalles?: VentaDetalle[];
  liquidacionId?: ID | null;
  // Anulación
  anulada?: boolean;
  motivoAnulacion?: string | null;
  fechaAnulacion?: ISODateString | null;
};

export type VentaDetalle = {
  id: ID;
  ventaId: ID;
  productoId: ID;
  units: number;
  precioUnitario: Money;
  descuento: Money;
  subtotal: Money;
  producto?: Producto;
  esRotura?: boolean;
};

export type Consignacion = {
  id: ID;
  numeroFolio: number;
  clienteId: ID;
  fecha: ISODateString;
  estado: EstadoConsignacion;
  porcentajeAumento: number;
  cliente?: Cliente;
  detalles?: ConsignacionDetalle[];
  liquidaciones?: Liquidacion[];
};

export type ConsignacionDetalle = {
  id: ID;
  consignacionId?: ID;
  productoId: ID;
  unitsEntregadas: number;
  unitsVendidasAcum: number;
  unitsDevueltasAcum: number;
  precioUnitario: Money;
  descuento: Money;
  producto?: Producto;

  // ✅ agregar esto
  precioVentaAplicado?: number | string | null;
};

export type Liquidacion = {
  id: ID;
  consignacionId: ID;
  fecha: ISODateString;
  items?: LiquidacionItem[];
  venta?: Venta | null;
  consignacion?: Consignacion;
};

export type LiquidacionItem = {
  id: ID;
  liquidacionId: ID;
  consignacionDetalleId: ID;
  unitsVendidas: number;
  unitsDevueltas: number;
  precioUnitario: Money;
  descuento: Money;
  detalle?: ConsignacionDetalle;
};

export type Pago = {
  id: ID;
  clienteId: ID;
  sucursalId?: ID;
  tipo?: string;
  fecha: ISODateString;
  monto: Money;
  metodo: MetodoPago;
  sesionCajaId?: ID | null;
  cliente?: Cliente;
};

export type CategoriaGasto = {
  id: ID;
  nombre: string;
  sucursalId: ID;
};

export type Gasto = {
  id: ID;
  monto: Money;
  fecha: ISODateString;
  fechaVencimiento?: ISODateString | null;
  motivo: string;
  estado: EstadoGasto;
  esRecurrente: boolean;
  frecuencia: FrecuenciaGasto;
  categoriaGastoId: ID;
  sucursalId: ID;
  userId?: ID | null;
  comprobanteUrl?: string | null;
  cuotaActual?: number | null;
  cuotaTotal?: number | null;
  recurrenciaId?: string | null;
  esCompartido?: boolean;
  esVistaCompartida?: boolean;
  sucursalesCompartidas?: { sucursalId: ID; montoProporcional: Money }[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  categoria?: CategoriaGasto;
  user?: { id: ID; nombre: string };
};


/* =========================
    INPUTS (API PAYLOADS)
========================= */

export type AbrirCajaInput = {
  cajaId: number;
  montoInicial: number;
};

export type CerrarCajaInput = {
  sesionId: number;
  montoReal: number;
  observaciones?: string;
};

export type CrearMovimientoCajaInput = {
  tipo: TipoMovimientoCaja;
  monto: number;
  motivo: string;
};

export type LoginInput = {
  email: string;
  password: string;
  remember?: boolean;
};

export type CreateClienteInput = {
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
};

export type UpdateClienteInput = Partial<CreateClienteInput> & {
  activo?: boolean
};

export type CreateProductoInput = {
  nombre: string;
  descripcion?: string;
  codigoBarra?: string;
  sku?: string;
  precioVenta: Money;
  precioCosto: Money;
  iva?: number;
  stockDisponibleUnits?: number;
  stockMinUnits?: number;
  packSizeUnits?: number | null;
  fechaVencimiento?: ISODateString | null;
  categoriaId?: ID | null;
  imagenUrl?: string | null;
  // Descuento en catálogo
  tipoDescuento?: "porcentaje" | "monto";
  descuentoPorcentaje?: number | null;
  descuentoMonto?: number | null;
  descuentoActivo?: boolean;
  descuentoDesde?: ISODateString | null;
  descuentoHasta?: ISODateString | null;
};

export type UpdateProductoInput = Partial<CreateProductoInput> & {
  activo?: boolean;
  movimientoInfo?: {
    tipo: TipoMovimientoStock;
    motivo: MotivoMovimientoStock;
    observaciones?: string;
  };
};

export type CreateVentaDirectaInput = {
  clienteId?: number | null;
  items: Array<{
    productoId: number;
    units: number;
    precioUnitario?: number;
    descuento?: number;
  }>;
  metodoPago: MetodoPago;
  descuentoGlobal?: number;
};

export type CreateConsignacionInput = {
  clienteId: ID;
  porcentajeAumento: number;
  items: Array<{
    productoId: ID;
    unitsEntregadas: number;
    precioVentaHistorico?: Money;
    descuento?: number;
  }>;
};

export type CreateLiquidacionInput = {
  items: Array<{
    consignacionDetalleId: ID;
    unitsVendidas?: number;
    unitsDevueltas?: number;
    descuento?: number;
  }>;
};

export type CreatePagoInput = {
  monto: Money;
  metodo: MetodoPago
};

/* =========================
    RESPUESTAS ESPECIALES
========================= */

export type EstadoCuentaResponse = {
  id: ID;
  nombre: string;
  saldoCuenta: Money;
  ventas: Venta[];
  pagos: Pago[];
};

export type CrearPagoResponse = {
  pago: Pago;
  saldo: Money;
};

export type CrearLiquidacionResponse = {
  liquidacion: Liquidacion;
  venta: Venta | null;
  totalVenta: Money;
  consignacionCerrada: boolean;
};




/* =========================
   DASHBOARD
========================= */

export type DashboardPeriod = "today" | "week" | "month" | "all";
export type DashboardFilter = "all" | "consignacion" | "pos";

/** /api/dashboard/kpis */
export type DashboardKpis = {
  period: DashboardPeriod;
  usarControlDeCaja: boolean;

  consignaciones: {
    total: number;
    abiertas: number;
    cerradas: number;
    creadasEnPeriodo: number;
  };

  consignacionUnits: {
    entregadas: number;
    vendidas: number;
    devueltas: number;
    pendientes: number;
  };

  stock: {
    disponibleUnits: number;
    consignadoUnits: number;
    totalUnits: number;
  };

  finanzas: {
    ventas: {
      cantidad: number;
      total: number;
      soloVenta?: number;   // Ventas directas POS (tipo CASUAL)
      soloConsig?: number;  // Liquidaciones de consignación (tipo LIQUIDACION)
      unitsVendidas?: { total: number; soloPos: number; soloConsig: number };
    };
    pagos: {
      cantidad: number;
      total: number;
      soloVenta?: number;  // Pagos de ventas directas (tipo VENTA)
      soloDeuda?: number;  // Cobros de deudas de consignación (tipo DEUDA)
    };
    ganancia: {
      total: number;
      bruta: number;
      neta: number;
      netaSinGastos: number;
      gastos: number;
      porConsignacion: number;
      porVentaDirecta: number;
    };
    saldoClientesTotal: number;
    clientes: number;
  };

  gastos: {
    cantidad: number;
    total: number;
  };

  catalogo: {
    visitas: number;
    visitantesUnicos: number;
    productosVisibles: number;
  };

  proximosVencimientos: Gasto[];
};


/** /api/dashboard/consignaciones */

export type DashboardConsignacionDetalle = ConsignacionDetalle & {
  producto?: Producto;
};

export type DashboardConsignacion = Consignacion & {
  cliente?: Cliente;
  detalles?: DashboardConsignacionDetalle[];
  unitsPendientes: number; // calculado en endpoint
};

export type DashboardLiquidacionItem = LiquidacionItem & {
  detalle?: ConsignacionDetalle & { producto?: Producto };
};

export type DashboardLiquidacion = Liquidacion & {
  consignacion?: Consignacion & { cliente?: Cliente };
  items?: DashboardLiquidacionItem[];
  venta?: Venta | null;
};

export type DashboardConsignacionesResponse = {
  pendientesPrioridad: DashboardConsignacion[];
  ultimasConsignaciones: (Consignacion & {
    cliente?: Cliente;
    detalles?: (ConsignacionDetalle & { producto?: Producto })[];
  })[];
  ultimasLiquidaciones: DashboardLiquidacion[];
};

/** /api/dashboard/top-productos */
export type DashboardTopVendidos = {
  productoId: number;
  nombre: string;
  units: number;
  total: number;
};

export type DashboardTopConsignados = {
  productoId: number;
  nombre: string;
  unitsEntregadas: number;
};

export type DashboardTopProductos = {
  period: DashboardPeriod;
  topVendidos: DashboardTopVendidos[];
  topConsignados: DashboardTopConsignados[];
};

/** /api/dashboard/tendencia */
export type DashboardTendenciaPoint = {
  date: string; // YYYY-MM-DD
  consignaciones: number;
  liquidaciones: number;

  ventasCount: number;
  ventasTotal: number;
  ventasPosTotal: number;    // Solo ventas directas POS
  ventasConsigTotal: number; // Solo liquidaciones consignación

  pagosCount: number;
  pagosTotal: number;
};

export type DashboardTendencia = {
  period: Exclude<DashboardPeriod, "all">;
  from: string; // ISO
  to: string; // ISO
  series: DashboardTendenciaPoint[];
};

