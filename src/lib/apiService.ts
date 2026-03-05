/* eslint-disable */
// @ts-nocheck
// src/lib/apiService.ts
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
  Caja,
  SesionCaja,
  AbrirCajaInput,
  CerrarCajaInput,
  CrearMovimientoCajaInput,
  Categoria,
  DescuentoNivel,
  HorarioLaboralConfig,
} from "./types";

export type ProductoWithImage = Producto & { imagenUrl?: string | null };


/* =========================
    FETCH WRAPPER (HELPER)
 ========================= */
async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  let url = path;

  // SSR: si estamos en server y la ruta es relativa, convertimos a absoluta
  if (typeof window === "undefined" && path.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    url = `${baseUrl}${path}`;
  }

  let sucursalHeader = "";
  if (typeof window !== "undefined") {
    try {
      // Lazy import para evitar errores SSR
      const { useSucursalStore } = require("@/store/useSucursalStore");
      const sid = useSucursalStore.getState().activeSucursalId;
      if (sid) sucursalHeader = String(sid);
    } catch { /* silently ignore store errors */ }
  }

  const isFormData = init?.body instanceof FormData;
  const headers: RequestInit["headers"] = {
    ...(!isFormData ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers ?? {}),
  };

  if (sucursalHeader) {
    (headers as any)["x-sucursal-id"] = sucursalHeader;
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: init?.cache || "no-store",
  });

  if (!res.ok) {
    // Si es 401/403 y NO es el endpoint de login, redirigimos al login
    if ((res.status === 401 || res.status === 403) && !url.includes("/api/auth/login")) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    let msg = `Error (${res.status})`;
    try {
      const j = await res.json();
      msg = j?.error ?? j?.message ?? msg;
    } catch { }
    throw new Error(msg);
  }

  return (await res.json()) as ApiResponse<T>;
}

/**
 * ✅ Helper recomendado: devuelve SOLO el `data` del ApiResponse<T>
 * Esto hace que el apiService sea limpio y fácil de usar en UI.
 */
async function apiData<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<any>(path, init);
  // Si la respuesta tiene una propiedad 'data', la extraemos. 
  // Caso contrario, devolvemos el objeto raíz (por si es un array directo).
  if (res && typeof res === "object" && "data" in res) {
    return res.data as T;
  }
  return res as T;
}

/* =========================
    HELPERS DE URL
 ========================= */
function getPublicBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

  let base = raw.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base;
}

function normalizeShareUrl(raw: string): string {
  const u = (raw ?? "").trim();
  if (!u) throw new Error("URL vacía");
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  return `${getPublicBaseUrl()}${path}`;
}

/* =========================
    DEFINICIÓN DE RUTAS
 ========================= */
export const API_ROUTES = {
  AUTH: {
    SETUP: "/api/auth/setup-auth",
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
  },
  DASHBOARD: {
    KPIS: "/api/dashboard/kpi",
    CONSIGNACIONES: "/api/dashboard/consignaciones",
    TOP_PRODUCTOS: "/api/dashboard/top-productos",
    TENDENCIA: "/api/dashboard/tendencia",
    REPORTE_LINK: (period: string) => `/api/dashboard/reporte-link?period=${period}`,
  },

  CLIENTES: "/api/clientes",
  CLIENTE_ID: (id: number) => `/api/clientes/${id}`,
  ESTADO_CUENTA: (id: number) => `/api/estado-cuenta/${id}`,

  PRODUCTOS: "/api/productos",
  PRODUCTO_ID: (id: number) => `/api/productos/${id}`,
  CATEGORIAS: "/api/categorias",
  CATEGORIA_ID: (id: number) => `/api/categorias/${id}`,
  INVENTARIO_LINK: "/api/productos/inventario-link",

  CONSIGNACIONES: "/api/consignaciones",
  CONSIGNACION_ID: (id: number) => `/api/consignaciones/${id}`,
  REMITO_LINK: (id: number) => `/api/consignaciones/${id}/remito-link`,

  LIQUIDACIONES: {
    BY_ID: (id: number) => `/api/liquidaciones/${id}`,
    CREATE_FOR_CONSIGNACION: (id: number) => `/api/liquidaciones/consignacion/${id}`,
  },

  HISTORIAL: {
    YEARS: "/api/historial/anios",
    LINK: (mes: number) => `/api/historial/${mes}/historial-link`,
  },

  PAGOS: "/api/pagos",
  PAGO_CLIENTE: (clienteId: number) => `/api/pagos/${clienteId}`,

  VENTAS: "/api/ventas",
  VENTA_ID: (id: number) => `/api/ventas/${id}`,
  TICKET_LINK: (id: number) => `/api/ventas/${id}/ticket-link`,

  GASTOS: {
    LIST: "/api/gastos",
    ID: (id: number) => `/api/gastos/${id}`,
    CATEGORIAS: "/api/gastos/categorias",
  },

  NOTIFICACIONES: {
    LIST: "/api/notificaciones",
    READ_ONE: (id: number) => `/api/notificaciones/${id}/read`,
    READ_ALL: "/api/notificaciones/read-all",
    CREATE: "/api/notificaciones/create",
  },

  CAJAS: {
    LIST: "/api/settings/pos/cajas",
    SESION: "/api/settings/pos/cajas/turno",
    HISTORIAL: "/api/settings/pos/cajas/historial",
    MOVIMIENTO: "/api/settings/pos/cajas/movimiento",
  },

  SETTINGS: {
    HORARIOS: "/api/settings/pos/horarios",
    GENERAL: "/api/settings/general",
    BRANDING: "/api/settings/branding",
    SECURITY: {
      ACTIVITY: "/api/security/activity",
      SESSIONS: "/api/security/sessions",
    },
  },
  PUBLIC: {
    LISTA_PRECIOS: "/api/public/lista-precios",
    CHECKOUT: "/api/public/checkout",
  },
} as const;

/* =========================
    API SERVICE (MÉTODOS)
 ========================= */
export const apiService = {
  routes: API_ROUTES,

  /* ---------- CAJA ---------- */
  getCajasDisponibles() {
    return apiData<Caja[]>(API_ROUTES.CAJAS.LIST);
  },

  verificarCajaAbierta() {
    return apiRequest<SesionCaja | null>(API_ROUTES.CAJAS.SESION);
  },

  extenderTurno(minutos: number) {
    return apiData<SesionCaja>(API_ROUTES.CAJAS.SESION, {
      method: "PATCH",
      body: JSON.stringify({ minutos }),
    });
  },

  abrirCaja(payload: AbrirCajaInput) {
    return apiData<SesionCaja>(API_ROUTES.CAJAS.SESION, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  registrarMovimientoCaja(payload: CrearMovimientoCajaInput) {
    return apiData<any>(API_ROUTES.CAJAS.MOVIMIENTO, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cerrarCaja(payload: CerrarCajaInput) {
    // Si tu backend devuelve { message, data }, acá usamos apiRequest y devolvemos el objeto completo:
    return apiRequest<{ message: string; data: SesionCaja }>(API_ROUTES.CAJAS.SESION, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  getHistorialCajas() {
    return apiData<SesionCaja[]>(API_ROUTES.CAJAS.HISTORIAL);
  },

  crearCajaFisica(nombre: string) {
    return apiData<Caja>(API_ROUTES.CAJAS.LIST, {
      method: "POST",
      body: JSON.stringify({ nombre }),
    });
  },

  /* ---------- CONFIGURACIÓN GENERAL ---------- */
  getConfiguracionGeneral() {
    return apiData<any>(API_ROUTES.SETTINGS.GENERAL);
  },

  actualizarConfiguracionGeneral(data: any) {
    return apiRequest<{ message: string; data: any }>(API_ROUTES.SETTINGS.GENERAL, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /* ---------- BRANDING ---------- */
  getBranding() {
    return apiData<any>(API_ROUTES.SETTINGS.BRANDING);
  },

  actualizarBranding(data: any) {
    return apiRequest<{ message: string; data: any }>(API_ROUTES.SETTINGS.BRANDING, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /* ---------- STAFF & SETTINGS ---------- */
  getUsuariosConHorarios() {
    return apiData<Usuario[]>(API_ROUTES.SETTINGS.HORARIOS);
  },

  guardarHorariosStaff(usuarioId: number, horarios: any[]) {
    return apiRequest<{ message: string }>(API_ROUTES.SETTINGS.HORARIOS, {
      method: "POST",
      body: JSON.stringify({ usuarioId, horarios }),
    });
  },

  /* ---------- PUBLIC ---------- */
  getPublicListaPrecios(sucursalId?: number) {
    const qs = sucursalId ? `?sucursalId=${sucursalId}` : "";
    return apiData<any>(`${API_ROUTES.PUBLIC.LISTA_PRECIOS}${qs}`);
  },

  createPublicCheckout(payload: any) {
    return apiData<any>(API_ROUTES.PUBLIC.CHECKOUT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  cotizarEnvioPublico(payload: { sucursalId: number, codigoPostal: string, subtotal: number, pesoKg?: number }) {
    return apiData<any>("/api/public/envios/cotizar", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  /* ---------- CLIENTES ---------- */
  getClientes() {
    return apiData<Cliente[]>(API_ROUTES.CLIENTES);
  },

  getCliente(id: number) {
    return apiData<Cliente>(API_ROUTES.CLIENTE_ID(id));
  },

  createCliente(payload: CreateClienteInput) {
    return apiData<Cliente>(API_ROUTES.CLIENTES, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCliente(id: number, payload: UpdateClienteInput) {
    return apiData<Cliente>(API_ROUTES.CLIENTE_ID(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteCliente(id: number) {
    return apiData<{ success: boolean }>(API_ROUTES.CLIENTE_ID(id), { method: "DELETE" });
  },

  getEstadoCuenta(clienteId: number) {
    return apiData<EstadoCuentaResponse>(API_ROUTES.ESTADO_CUENTA(clienteId));
  },

  /* ---------- PRODUCTOS & CATEGORÍAS ---------- */
  getProductos() {
    return apiData<Producto[]>(API_ROUTES.PRODUCTOS);
  },

  getProducto(id: number) {
    return apiData<Producto>(API_ROUTES.PRODUCTO_ID(id));
  },

  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiData<{ url: string }>("/api/upload", {
      method: "POST",
      body: formData,
      // No seteamos Content-Type para que el browser ponga el boundary
      headers: {},
    });
  },

  createProducto(payload: CreateProductoInput) {
    return apiData<Producto>(API_ROUTES.PRODUCTOS, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateProducto(id: number, payload: UpdateProductoInput) {
    return apiData<Producto>(API_ROUTES.PRODUCTO_ID(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteProducto(id: number) {
    return apiData<{ ok: true }>(API_ROUTES.PRODUCTO_ID(id), { method: "DELETE" });
  },

  getCategorias() {
    return apiData<Categoria[]>(API_ROUTES.CATEGORIAS);
  },

  createCategoria(data: { nombre: string; color?: string; descuentos?: DescuentoNivel[] | null }) {
    return apiData<Categoria>(API_ROUTES.CATEGORIAS, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteCategoria(id: number) {
    return apiData<{ ok: true }>(API_ROUTES.CATEGORIA_ID(id), { method: "DELETE" });
  },

  updateCategoria(id: number, data: { nombre?: string; color?: string; descuentos?: DescuentoNivel[] | null }) {
    return apiData<Categoria>(API_ROUTES.CATEGORIA_ID(id), {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /* ---------- CONSIGNACIONES ---------- */
  getConsignaciones() {
    return apiData<Consignacion[]>(API_ROUTES.CONSIGNACIONES);
  },

  getConsignacion(id: number) {
    return apiData<Consignacion>(API_ROUTES.CONSIGNACION_ID(id));
  },

  createConsignacion(payload: CreateConsignacionInput) {
    return apiData<Consignacion>(API_ROUTES.CONSIGNACIONES, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateConsignacion(id: number, payload: any) {
    return apiData<Consignacion>(API_ROUTES.CONSIGNACION_ID(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  /* ---------- LIQUIDACIONES ---------- */
  createLiquidacion(consignacionId: number, payload: CreateLiquidacionInput) {
    return apiData<CrearLiquidacionResponse>(API_ROUTES.LIQUIDACIONES.CREATE_FOR_CONSIGNACION(consignacionId), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getLiquidacion(id: number) {
    return apiData<any>(API_ROUTES.LIQUIDACIONES.BY_ID(id));
  },

  updateLiquidacion(liquidacionId: number, payload: any) {
    return apiData<any>(API_ROUTES.LIQUIDACIONES.BY_ID(liquidacionId), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  /* ---------- HISTORIAL ---------- */
  async getAvailableYears() {
    const years = await apiData<number[]>(API_ROUTES.HISTORIAL.YEARS);
    return years?.length ? years : [new Date().getFullYear()];
  },

  async getHistorialPdfUrl(mes: number, anio: number): Promise<string> {
    const res = await fetch(`${API_ROUTES.HISTORIAL.LINK(mes)}?anio=${anio}`);
    const data = await res.json();
    return normalizeShareUrl(data.url);
  },

  /* ---------- VENTAS ---------- */
  getVentas() {
    return apiData<Venta[]>(API_ROUTES.VENTAS);
  },

  getVenta(id: number) {
    return apiData<Venta>(API_ROUTES.VENTA_ID(id));
  },

  createVentaDirecta(payload: CreateVentaDirectaInput) {
    return apiData<Venta>(API_ROUTES.VENTAS, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteVenta(id: number) {
    return apiData<{ success: true }>(API_ROUTES.VENTA_ID(id), { method: "DELETE" });
  },

  /* ---------- PAGOS ---------- */
  getPagos() {
    return apiData<Pago[]>(API_ROUTES.PAGOS);
  },

  createPago(clienteId: number, payload: CreatePagoInput) {
    return apiData<CrearPagoResponse>(API_ROUTES.PAGO_CLIENTE(clienteId), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ---------- DASHBOARD ---------- */
  getDashboardKpis(period: DashboardPeriod = "month") {
    return apiData<DashboardKpis>(`${API_ROUTES.DASHBOARD.KPIS}?period=${period}`);
  },

  getDashboardConsignaciones(limit = 10) {
    return apiData<DashboardConsignacionesResponse>(`${API_ROUTES.DASHBOARD.CONSIGNACIONES}?limit=${limit}`);
  },

  getDashboardTopProductos(period: DashboardPeriod = "month", limit = 10) {
    return apiData<DashboardTopProductos>(`${API_ROUTES.DASHBOARD.TOP_PRODUCTOS}?period=${period}&limit=${limit}`);
  },

  getDashboardTendencia(period: Exclude<DashboardPeriod, "all"> = "month") {
    return apiData<DashboardTendencia>(`${API_ROUTES.DASHBOARD.TENDENCIA}?period=${period}`);
  },

  async getDashboardReporteUrl(period: DashboardPeriod = "month", type: "general" | "pos" | "consignacion" = "general"): Promise<string> {
    const res = await fetch(`${API_ROUTES.DASHBOARD.REPORTE_LINK(period)}&type=${type}`);
    const data = await res.json();
    return normalizeShareUrl(data.url);
  },

  getPosReporteUrl(period: DashboardPeriod = "month"): Promise<string> {
    return apiService.getDashboardReporteUrl(period, "pos");
  },

  getConsigReporteUrl(period: DashboardPeriod = "month"): Promise<string> {
    return apiService.getDashboardReporteUrl(period, "consignacion");
  },

  /* ---------- NOTIFICACIONES ---------- */
  getNotificaciones(params?: { onlyUnread?: boolean; limit?: number }) {
    const qs = new URLSearchParams({
      onlyUnread: String(params?.onlyUnread ?? false),
      limit: String(params?.limit ?? 50),
    });
    return apiData<any[]>(`${API_ROUTES.NOTIFICACIONES.LIST}?${qs.toString()}`);
  },

  marcarNotificacionLeida(id: number) {
    return apiData<{ success: boolean }>(API_ROUTES.NOTIFICACIONES.READ_ONE(id), { method: "PATCH" });
  },

  marcarTodasNotificacionesLeidas() {
    return apiData<{ success: boolean }>(API_ROUTES.NOTIFICACIONES.READ_ALL, { method: "PATCH" });
  },

  /* ---------- AUTH ---------- */
  login(payload: LoginInput) {
    // si backend devuelve {data: null} esto funciona igual
    return apiData<void>(API_ROUTES.AUTH.LOGIN, { method: "POST", body: JSON.stringify(payload) });
  },

  me() {
    return apiData<Usuario>(API_ROUTES.AUTH.ME);
  },

  logout() {
    return apiData<void>(API_ROUTES.AUTH.LOGOUT, { method: "POST" });
  },

  requestPasswordReset(email: string) {
    return apiData<{ message: string }>(API_ROUTES.AUTH.FORGOT_PASSWORD, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(payload: { token: string; password: string }) {
    return apiData<{ message: string }>(API_ROUTES.AUTH.RESET_PASSWORD, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /* ---------- LINKS PDF (CLIENT-SIDE) ---------- */
  async getConsignacionPdfUrl(id: number): Promise<string> {
    const res = await fetch(API_ROUTES.REMITO_LINK(id));
    const data = await res.json();
    return normalizeShareUrl(data.url);
  },

  async getVentaPdfUrl(id: number): Promise<string> {
    const res = await fetch(API_ROUTES.TICKET_LINK(id));
    const data = await res.json();
    return normalizeShareUrl(data.url);
  },

  async getInventarioPdfUrl(): Promise<string> {
    const res = await fetch(API_ROUTES.INVENTARIO_LINK);
    const data = await res.json();
    return normalizeShareUrl(data.url);
  },

  /* ---------- SEGURIDAD ---------- */
  getAuditLogs(params?: { module?: string; userId?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.module) qs.append("module", params.module);
    if (params?.userId) qs.append("userId", String(params.userId));
    if (params?.limit) qs.append("limit", String(params.limit));
    return apiData<any[]>(`${API_ROUTES.SETTINGS.SECURITY.ACTIVITY}?${qs.toString()}`);
  },

  getActiveSessions() {
    return apiData<any[]>(API_ROUTES.SETTINGS.SECURITY.SESSIONS);
  },

  revokeSession(sessionId: string) {
    return apiData<{ ok: boolean }>(`${API_ROUTES.SETTINGS.SECURITY.SESSIONS}?id=${sessionId}`, {
      method: "DELETE",
    });
  },

  /* ---------- SUCURSALES ---------- */
  getSucursales() {
    return apiData<any[]>("/api/settings/sucursales");
  },
  createSucursal(payload: { nombre: string; activa?: boolean }) {
    return apiData<any>("/api/settings/sucursales", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateSucursal(id: number, payload: { nombre?: string; activa?: boolean }) {
    return apiData<any>(`/api/settings/sucursales/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteSucursal(id: number) {
    return apiData<any>(`/api/settings/sucursales/${id}`, {
      method: "DELETE",
    });
  },

  /* ---------- GASTOS ---------- */
  getGastos(params?: { estado?: string; categoriaId?: number }) {
    const qs = new URLSearchParams();
    if (params?.estado) qs.append("estado", params.estado);
    if (params?.categoriaId) qs.append("categoriaId", String(params.categoriaId));
    return apiData<any[]>(`${API_ROUTES.GASTOS.LIST}?${qs.toString()}`);
  },

  createGasto(payload: any) {
    return apiData<any>(API_ROUTES.GASTOS.LIST, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateGasto(id: number, payload: any) {
    return apiData<any>(API_ROUTES.GASTOS.ID(id), {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  deleteGasto(id: number) {
    return apiData<{ success: boolean }>(API_ROUTES.GASTOS.ID(id), {
      method: "DELETE",
    });
  },

  getGastosCategorias() {
    return apiData<any[]>(API_ROUTES.GASTOS.CATEGORIAS);
  },

  createGastoCategoria(nombre: string) {
    return apiData<any>(API_ROUTES.GASTOS.CATEGORIAS, {
      method: "POST",
      body: JSON.stringify({ nombre }),
    });
  },

  deleteGastoCategoria(id: number) {
    return apiData<{ success: boolean }>(`${API_ROUTES.GASTOS.CATEGORIAS}/${id}`, {
      method: "DELETE",
    });
  },

  getGastoComprobanteLink(id: number) {
    return apiData<{ url: string }>(`${API_ROUTES.GASTOS.ID(id)}/comprobante-link`);
  },
};
