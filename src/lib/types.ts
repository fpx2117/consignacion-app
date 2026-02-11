// src/lib/types.ts

// 1. Importamos el tipo compartido de notificaciones
import { AppNotification } from "@/types/notification";

// 2. Definiciones básicas
export type ID = number;
export type ISODateString = string;
export type Money = number;

export type ApiResponse<T> = { data: T };

export type RolUsuario = "ADMIN" | "EMPLEADO";
export type EstadoConsignacion = "ABIERTA" | "CERRADA";
export type MetodoPago = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "OTRO";

// --- NOTIFICACIONES ---
// Re-exportamos el tipo con el nombre 'Notification' para mantener compatibilidad
// con el resto de tu código que espera este nombre.
export type Notification = AppNotification;

export enum TipoMovimientoStock {
  ENTRADA = "ENTRADA",
  SALIDA = "SALIDA",
  AJUSTE = "AJUSTE",
}

// --- ENTIDADES ---

export type Usuario = {
  id: ID;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  createdAt: ISODateString;
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
};

export type Producto = {
  id: ID;
  nombre: string;
  descripcion?: string | null; // Agregado
  codigoBarra?: string | null; // 👈 Agregado para el scanner
  sku?: string | null;         // 👈 Agregado para control interno
  activo: boolean;             // 👈 Agregado para borrado lógico
  
  precioVenta: Money;
  precioCosto: Money;
  iva: number;                 // Agregado

  stockDisponibleUnits: number;
  stockConsignadoUnits: number;
  stockMinUnits: number;       // 👈 Agregado para alertas de stock bajo
  
  packSizeUnits?: number | null;
  fechaVencimiento?: ISODateString | null;

  categoriaId?: ID | null;
  categoria?: Categoria;       // Relación opcional

  createdAt: ISODateString;
  updatedAt: ISODateString;
  
  movimientos?: MovimientoStock[];
};

export interface MovimientoStock {
  id: number;
  productoId: number;
  tipo: TipoMovimientoStock;
  motivo: MotivoMovimientoStock;
  cantidad: number;
  stockPrevio: number;
  stockPosterior: number;
  observaciones?: string | null;
  createdAt: Date;
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
}

export type ConsignacionDetalle = {
  id: ID;
  consignacionId?: ID;
  productoId: ID;
  numeroFolio: number;
  unitsEntregadas: number;
  unitsVendidasAcum: number;
  unitsDevueltasAcum: number;
  precioVentaAplicado: Money; // 👈 Sugerido: Precio original + aumento en ese momento
  producto?: Producto;
};

export type CreateVentaDirectaInput = {
  // Opcional: si tu backend lo permite, enviamos null o un ID de "Consumidor Final"
  clienteId?: number | null; 
  items: Array<{
    productoId: number;
    units: number;
    precioUnitario?: number; // Opcional si el backend usa el precio actual
  }>;
  metodoPago: MetodoPago;
};

export type Consignacion = {
  id: ID;
  clienteId: ID;
  fecha: ISODateString;
  estado: EstadoConsignacion;
  porcentajeAumento: number; // 👈 Agregado: para persistir el valor aplicado
  cliente?: Cliente;
  detalles?: ConsignacionDetalle[];
  liquidaciones?: Liquidacion[];
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

export type VentaDetalle = {
  id: ID;
  ventaId: ID;
  productoId: ID;
  units: number;
  precioUnitario: Money;
  subtotal: Money;
  producto?: Producto;
};

export type Venta = {
  id: ID;
  clienteId: ID;
  fecha: ISODateString;
  total: Money;
  cliente?: Cliente;
  detalles?: VentaDetalle[];
  liquidacionId?: ID | null;
};

export type Liquidacion = {
  id: ID;
  consignacionId: ID;
  fecha: ISODateString;
  items?: LiquidacionItem[];
  venta?: Venta | null;
  consignacion?: Consignacion;
};

export type Pago = {
  id: ID;
  clienteId: ID;
  fecha: ISODateString;
  monto: Money;
  metodo: MetodoPago;
  cliente?: Cliente;
};

// --- RESPUESTAS ESPECIALES API ---

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


/* =========================
   INPUTS (Formularios)
========================= */

export type LoginInput = { email: string; password: string };

export type CreateClienteInput = {
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
};

export type UpdateClienteInput = Partial<CreateClienteInput> & { activo?: boolean };

export type CreateProductoInput = {
  nombre: string;
  descripcion?: string;
  codigoBarra?: string;
  sku?: string;
  precioVenta: Money;
  precioCosto: Money;
  iva?: number;
  stockDisponibleUnits?: number;
  stockMinUnits?: number;      // 👈 Para definir el umbral desde el alta
  packSizeUnits?: number | null;
  fechaVencimiento?: ISODateString | null;
  categoriaId?: ID | null;
};

export type UpdateProductoInput = {
  nombre?: string;
  codigoBarra?: string | null;
  precioVenta?: number;
  categoriaId?: number | null; 
  precioCosto?: number;
  stockDisponibleUnits?: number; 
  stockMinUnits?: number;
  fechaVencimiento?: string | null;
  activo?: boolean;
};

export type ScanProductoResponse = {
  producto: Producto;
  encontrado: boolean;
};

export type CreateConsignacionInput = {
  clienteId: ID;
  porcentajeAumento: number; // 👈 Agregado: el usuario lo enviará desde el form
  items: Array<{ 
    productoId: ID; 
    unitsEntregadas: number;
    // Opcional: si tu backend prefiere recibir el precio ya calculado
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

export interface MovimientoReporte extends MovimientoStock {
  nombreProducto: string; // Para no tener que buscar en el objeto producto
}

export interface MovimientoConProducto extends MovimientoStock {
  producto: Pick<Producto, "nombre" | "codigoBarra">;
}

// Interfaz para el resumen estadístico del reporte de movimientos
export interface ResumenMovimientos {
  totalEntradas: number;
  totalSalidas: number;
  ajustesPositivos: number;
  ajustesNegativos: number;
  periodo: string;
}

export type CreatePagoInput = { monto: Money; metodo: MetodoPago };