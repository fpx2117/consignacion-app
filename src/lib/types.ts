// src/lib/types.ts

import { AppNotification } from "@/types/notification";

/* =========================
    DEFINICIONES BÁSICAS
========================= */
export type ID = number;
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
export type EstadoConsignacion = "ABIERTA" | "CERRADA";
export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "OTRO";

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
}

export enum MotivoMovimientoStock {
  COMPRA = "COMPRA",
  VENTA = "VENTA",
  DEVOLUCION_CLIENTE = "DEVOLUCION_CLIENTE",
  DEVOLUCION_PROVEEDOR = "DEVOLUCION_PROVEEDOR",
  ROTURA = "ROTURA",
  PERDIDA = "PERDIDA",
  AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO",
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
  usarControlDeCaja: boolean;
  porcentajeAumentoConsignacion: number;
  porcentajeInteresTarjeta: number;
  mostrarListaPrecios: boolean;
  convertirTienda: boolean;
  separarListaPorSucursal: boolean;
  mpAccessTokenTienda?: string | null;
  mpPublicKeyTienda?: string | null;
};

export type Branding = {
  id: ID;
  businessName: string;
  logoMime?: string | null;
  logoData?: any | null; // Bytes in Prisma, usually Buffer or check implementation
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
  tieneDescuento: boolean;
  descuentoCantidadMin?: number | null;
  descuentoPorcentaje?: number | null;
  categoriaId?: ID | null;
  categoria?: Categoria;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  movimientoStocks?: MovimientoStock[];
  notifications?: Notification[];
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
  sesionCajaId?: ID | null;
  cliente?: Cliente;
  detalles?: VentaDetalle[];
  liquidacionId?: ID | null;
};

export type VentaDetalle = {
  id: ID;
  ventaId: ID;
  productoId: ID;
  units: number;
  precioUnitario: Money;
  subtotal: Money;
  producto?: Producto;
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
  detalle?: ConsignacionDetalle;
};

export type Pago = {
  id: ID;
  clienteId: ID;
  fecha: ISODateString;
  monto: Money;
  metodo: MetodoPago;
  sesionCajaId?: ID | null;
  cliente?: Cliente;
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
  password: string
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
  tieneDescuento?: boolean;
  descuentoCantidadMin?: number | null;
  descuentoPorcentaje?: number | null;
};

export type UpdateProductoInput = Partial<CreateProductoInput> & {
  activo?: boolean
};

export type CreateVentaDirectaInput = {
  clienteId?: number | null;
  items: Array<{
    productoId: number;
    units: number;
    precioUnitario?: number;
  }>;
  metodoPago: MetodoPago;
};

export type CreateConsignacionInput = {
  clienteId: ID;
  porcentajeAumento: number;
  items: Array<{
    productoId: ID;
    unitsEntregadas: number;
    precioVentaHistorico?: Money;
  }>;
};

export type CreateLiquidacionInput = {
  items: Array<{
    consignacionDetalleId: ID;
    unitsVendidas?: number;
    unitsDevueltas?: number;
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
    };
    pagos: {
      cantidad: number;
      total: number;
    };
    ganancia: {
      total: number;
      porConsignacion: number;
      porVentaDirecta: number;
    };
    saldoClientesTotal: number;
    clientes: number;
  };
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

  pagosCount: number;
  pagosTotal: number;
};

export type DashboardTendencia = {
  period: Exclude<DashboardPeriod, "all">;
  from: string; // ISO
  to: string; // ISO
  series: DashboardTendenciaPoint[];
};

