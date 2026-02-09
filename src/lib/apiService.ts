import type {
  ApiResponse,
  Usuario,
  Cliente,
  Producto,
  Pago,
  DashboardPeriod,
  DashboardKpis,
  DashboardConsignacionesResponse,
  DashboardTopProductos,
  DashboardTendencia,
  Venta,
  Consignacion,
  LoginInput,
  CreateClienteInput,
  UpdateClienteInput,
  CreateProductoInput,
  UpdateProductoInput,
  CreateConsignacionInput,
  CreateLiquidacionInput,
  CreatePagoInput,
  EstadoCuentaResponse,
  CreateVentaDirectaInput,
  CrearPagoResponse,
  CrearLiquidacionResponse,
} from "./types";

// Importamos el tipo compartido para asegurar consistencia con el Socket
import { AppNotification } from "@/types/notification";
import { generatePdfToken } from "@/lib/crypto";

/* =========================
   Fetch wrapper (Helper)
========================= */
async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  let url = path;

  // Si estamos en el servidor (SSR) y la ruta es relativa, necesitamos la URL completa
  if (typeof window === "undefined" && path.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    url = `${baseUrl}${path}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // En Next.js App Router, 'no-store' evita que se cacheen datos que cambian rápido
    cache: init?.cache || "no-store",
  });

  if (!res.ok) {
    let msg = `Error (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error ?? j?.message ?? msg;
    } catch {}
    throw new Error(msg);
  }

  return (await res.json()) as ApiResponse<T>;
}

/* =========================
   Definición de Rutas
========================= */
export const API_ROUTES = {
  AUTH: {
    SETUP: "/api/auth/setup-auth",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  DASHBOARD: {
    KPIS: "/api/dashboard/kpi",
    CONSIGNACIONES: "/api/dashboard/consignaciones",
    TOP_PRODUCTOS: "/api/dashboard/top-productos",
    TENDENCIA: "/api/dashboard/tendencia",
  },
  CLIENTES: "/api/clientes",
  CLIENTE_ID: (id: number) => `/api/clientes/${id}`,
  ESTADO_CUENTA: (id: number) => `/api/estado-cuenta/${id}`,

  PRODUCTOS: "/api/productos",
  PRODUCTO_ID: (id: number) => `/api/productos/${id}`,

  CONSIGNACIONES: "/api/consignaciones",
  CONSIGNACION_ID: (id: number) => `/api/consignaciones/${id}`,

 LIQUIDACIONES: {
  BY_ID: (liquidacionId: number) => `/api/liquidaciones/${liquidacionId}`, // GET/PUT
  CREATE_FOR_CONSIGNACION: (consignacionId: number) => `/api/consignaciones/${consignacionId}`, // POST (tu route actual)
  // si luego lo cambiás a /api/consignaciones/:id/liquidaciones, lo actualizamos acá
},

  PAGOS: "/api/pagos",
  PAGO_CLIENTE: (clienteId: number) => `/api/pagos/${clienteId}`,

  VENTAS: "/api/ventas",
  VENTA_ID: (id: number) => `/api/ventas/${id}`,

  // Ruta para historial de notificaciones (Opcional por ahora)
 NOTIFICACIONES: {
    LIST: "/api/notificaciones",
    READ_ONE: (id: number) => `/api/notificaciones/${id}/read`,
    READ_ALL: "/api/notificaciones/read-all",
    CREATE: "/api/notificaciones/create",
  },
} as const;

/* =========================
   API SERVICE
========================= */
export const apiService = {
  routes: API_ROUTES,

  /* ---------- NOTIFICACIONES ---------- */

  // Listar notificaciones (por defecto trae las últimas 50)
  getNotificaciones(params?: { onlyUnread?: boolean; limit?: number }) {
    const onlyUnread = params?.onlyUnread ?? false;
    const limit = params?.limit ?? 50;

    const qs = new URLSearchParams();
    qs.set("onlyUnread", String(onlyUnread));
    qs.set("limit", String(limit));

    return apiRequest<any[]>(
      `${API_ROUTES.NOTIFICACIONES.LIST}?${qs.toString()}`,
      { method: "GET" }
    );
  },

  // Marcar una como leída (id DB: number)
  marcarNotificacionLeida(id: number) {
    return apiRequest<{ success: boolean }>(API_ROUTES.NOTIFICACIONES.READ_ONE(id), {
      method: "PATCH",
    });
  },

  // Marcar todas como leídas
  marcarTodasNotificacionesLeidas() {
    return apiRequest<{ success: boolean }>(API_ROUTES.NOTIFICACIONES.READ_ALL, {
      method: "PATCH",
    });
  },

  // Crear manual (opcional: para testing / admin)
  crearNotificacion(payload: {
    type: "LOW_STOCK" | "OUT_OF_STOCK" | "SYSTEM";
    title: string;
    description: string;
    productoId?: number | null;
    fingerprint: string;
  }) {
    return apiRequest<any>(API_ROUTES.NOTIFICACIONES.CREATE, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ---------- AUTH ---------- */
  setupAdmin() {
    return apiRequest<Usuario>(API_ROUTES.AUTH.SETUP, { method: "POST" });
  },

  login(payload: LoginInput) {
    return apiRequest<void>(API_ROUTES.AUTH.LOGIN, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  logout() {
    return apiRequest<void>(API_ROUTES.AUTH.LOGOUT, { method: "POST" });
  },

  me() {
    return apiRequest<Usuario>(API_ROUTES.AUTH.ME, { method: "GET" });
  },

  /* ---------- DASHBOARD ---------- */
  getDashboardKpis(period: DashboardPeriod = "month") {
    return apiRequest<DashboardKpis>(
      `${API_ROUTES.DASHBOARD.KPIS}?period=${period}`,
      { method: "GET" }
    );
  },

  getConsignacionPdfUrl(id: number): string {
  let token = "";
  try { token = generatePdfToken(id); } catch {}

  // ✅ Siempre origen real en cliente
  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "");
  const base = origin.replace(/\/+$/, "");

  return `${base}/ver/remito/${id}?token=${encodeURIComponent(token)}`;
},


 getVentaPdfUrl(id: number): string {
  let token = "";
  try { token = generatePdfToken(id); } catch {}

  // ✅ Siempre origen real en cliente
  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "");
  const base = origin.replace(/\/+$/, "");

  return `${base}/ver/ticket/${id}?token=${encodeURIComponent(token)}`;
},

  getDashboardConsignaciones(limit = 10) {
    return apiRequest<DashboardConsignacionesResponse>(
      `${API_ROUTES.DASHBOARD.CONSIGNACIONES}?limit=${limit}`,
      { method: "GET" }
    );
  },

  getDashboardTopProductos(period: DashboardPeriod = "month", limit = 10) {
    return apiRequest<DashboardTopProductos>(
      `${API_ROUTES.DASHBOARD.TOP_PRODUCTOS}?period=${period}&limit=${limit}`,
      { method: "GET" }
    );
  },

  getDashboardTendencia(period: Exclude<DashboardPeriod, "all"> = "month") {
    return apiRequest<DashboardTendencia>(
      `${API_ROUTES.DASHBOARD.TENDENCIA}?period=${period}`,
      { method: "GET" }
    );
  },

  /* ---------- CLIENTES ---------- */
  getClientes() {
    return apiRequest<Cliente[]>(API_ROUTES.CLIENTES);
  },

  getCliente(id: number) {
    return apiRequest<Cliente>(API_ROUTES.CLIENTE_ID(id));
  },

  createCliente(payload: CreateClienteInput) {
    return apiRequest<Cliente>(API_ROUTES.CLIENTES, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCliente(id: number, payload: UpdateClienteInput) {
    return apiRequest<Cliente>(API_ROUTES.CLIENTE_ID(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteCliente(id: number) {
    return apiRequest<{ success: boolean }>(API_ROUTES.CLIENTE_ID(id), {
      method: "DELETE",
    });
  },

  getEstadoCuenta(clienteId: number) {
    return apiRequest<EstadoCuentaResponse>(API_ROUTES.ESTADO_CUENTA(clienteId));
  },

  /* ---------- PRODUCTOS ---------- */
  getProductos() {
    return apiRequest<Producto[]>(API_ROUTES.PRODUCTOS);
  },

  getProducto(id: number) {
    return apiRequest<Producto>(API_ROUTES.PRODUCTO_ID(id));
  },

  createProducto(payload: CreateProductoInput) {
    return apiRequest<Producto>(API_ROUTES.PRODUCTOS, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateProducto(id: number, payload: UpdateProductoInput) {
    return apiRequest<Producto>(API_ROUTES.PRODUCTO_ID(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteProducto(id: number) {
    return apiRequest<{ ok: true }>(API_ROUTES.PRODUCTO_ID(id), {
      method: "DELETE",
    });
  },

  /* ---------- CONSIGNACIONES ---------- */
  getConsignaciones() {
    return apiRequest<Consignacion[]>(API_ROUTES.CONSIGNACIONES);
  },

  getConsignacion(id: number) {
    return apiRequest<Consignacion>(API_ROUTES.CONSIGNACION_ID(id));
  },

 updateConsignacion(
  id: number,
  payload: { 
    items: { productoId: number; unitsEntregadas: number }[];
    porcentajeAumento?: number; // 👈 Agregamos esto para permitir ediciones
  }
) {
  return apiRequest<Consignacion>(API_ROUTES.CONSIGNACION_ID(id), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
},

  createConsignacion(payload: CreateConsignacionInput) {
    return apiRequest<Consignacion>(API_ROUTES.CONSIGNACIONES, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

 /* ---------- LIQUIDACIONES ---------- */

// Crear (por consignación)
createLiquidacion(consignacionId: number, payload: CreateLiquidacionInput) {
  return apiRequest<CrearLiquidacionResponse>(
    API_ROUTES.LIQUIDACIONES.CREATE_FOR_CONSIGNACION(consignacionId),
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
},

// Obtener (por liquidacionId)
getLiquidacion(liquidacionId: number) {
  return apiRequest<any>(
    API_ROUTES.LIQUIDACIONES.BY_ID(liquidacionId),
    { method: "GET" }
  );
},

// Corregir (por liquidacionId)
updateLiquidacion(liquidacionId: number, payload: CreateLiquidacionInput) {
  return apiRequest<any>(
    API_ROUTES.LIQUIDACIONES.BY_ID(liquidacionId),
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
},

  /* ---------- PAGOS ---------- */
  getPagos() {
    return apiRequest<Pago[]>(API_ROUTES.PAGOS);
  },

  createPago(clienteId: number, payload: CreatePagoInput) {
    return apiRequest<CrearPagoResponse>(API_ROUTES.PAGO_CLIENTE(clienteId), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ---------- VENTAS ---------- */
  getVentas() {
    return apiRequest<Venta[]>(API_ROUTES.VENTAS);
  },

  getVenta(id: number) {
    return apiRequest<Venta>(API_ROUTES.VENTA_ID(id));
  },

// En apiService.ts -> ventas
  deleteVenta(id: number) {
   return apiRequest<{ success: true }>(API_ROUTES.VENTA_ID(id), {
    method: "DELETE",
  });
},
  
  // NUEVO METODO
  createVentaDirecta(payload: CreateVentaDirectaInput) {
    return apiRequest<Venta>(API_ROUTES.VENTAS, { // Asumiendo que POST /api/ventas crea la venta
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};