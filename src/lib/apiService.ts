// src/lib/apiService.ts
import type {
  ActiveSession,
  AuditLogEntry,
  ApiResponse,
  BrandingSettings,
  Usuario,
  Cliente,
  Producto,
  Subcategoria,
  Pago,
  DashboardPeriod,
  DashboardKpis,
  DashboardConsignacionesResponse,
  DashboardTopProductos,
  DashboardTendencia,
  Configuracion,
  TiendaGlobalConfig,
  ProfileTimezone,
  SucursalResumen,
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
  Gasto,
  CategoriaGasto,
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


  PublicCatalogData,
  PublicCheckoutPayload,
  PublicCheckoutResponse,
  PublicCheckoutStatusResponse,
  PublicShippingQuote,
} from "./types";

export type ProductoWithImage = Producto & { imagenUrl?: string | null };

/* ---------- Facturas de proveedor (OCR + matching + aprendizaje) ---------- */

export type Proveedor = {
  id: number;
  nombre: string;
  cuit: string | null;
  monedaPreferida: string;
  activo: boolean;
  sucursalId: number | null;
};

export type EstadoFacturaProveedor =
  | "PENDIENTE"
  | "PROCESANDO"
  | "REQUIERE_REVISION"
  | "CONFIRMADA"
  | "CANCELADA"
  | "ERROR";

export type EstadoItemFactura =
  | "PENDIENTE"
  | "COINCIDENCIA_SEGURA"
  | "COINCIDENCIA_PROBABLE"
  | "REQUIERE_REVISION"
  | "SIN_COINCIDENCIA"
  | "PRODUCTO_CREADO"
  | "IGNORADO"
  | "CONFIRMADO"
  | "ERROR";

export type FacturaProveedorItem = {
  id: number;
  facturaId: number;
  productoId: number | null;
  producto?: { id: number; nombre: string; precioCosto: number } | null;
  textoOriginal: string;
  descripcionNormalizada: string | null;
  codigoProveedor: string | null;
  cantidad: number;
  precioUnitario: number | null;
  totalLinea: number | null;
  confianzaExtraccion: number | null;
  matchScore: number | null;
  matchMotivo: string | null;
  estado: EstadoItemFactura;
  /** Columnas detectadas sin campo estándar (lote, vencimiento, talle, color, etc.), como objeto plano. */
  atributosExtra: Record<string, string> | null;
  /** Advertencias de la validación aritmética post-extracción (ver validar-consistencia-factura.ts). */
  advertencias: string[];
  /**
   * Sugerencia de catalogo-global-api cuando no hubo match local (productoId
   * null) — solo informativa, ver openspec/changes/catalogo-global-api.
   */
  candidatoGlobalId: string | null;
  candidatoGlobalNombre: string | null;
  candidatoGlobalCodigoBarras: string | null;
  candidatoGlobalScore: number | null;
};

export type FacturaProveedor = {
  id: number;
  proveedorId: number | null;
  proveedor?: Proveedor | null;
  proveedorNombreDetectado: string | null;
  proveedorCuitDetectado: string | null;
  sucursalId: number;
  numeroFactura: string | null;
  fecha: string | null;
  moneda: string;
  totalDetectado: number | null;
  estado: EstadoFacturaProveedor;
  confianzaOcr: number | null;
  errorMensaje: string | null;
  archivoMime?: string;
  archivoEliminado?: boolean;
  createdAt?: string;
  items?: FacturaProveedorItem[];
  _count?: { items: number };
};

export type FacturaProveedorUsage = {
  used: number;
  limit: number; // -1 = ilimitado, 0 = sin acceso
  allowed: boolean;
  hasFeature: boolean;
};

export type ConfirmarItemResultado = {
  data: FacturaProveedorItem;
  variacionCosto: { variacionPct: number | null; alerta: "normal" | "advertencia" | "alerta_fuerte" | null };
  tipoCambioAplicado: number | null;
  advertenciaConversion: string | null;
};

export type ConfirmAllResultado = {
  confirmados: number;
  errores: { itemId: number; error: string }[];
};

export type UpdateFacturaProveedorInput = {
  proveedorId?: number | null;
  proveedorNombreDetectado?: string | null;
  proveedorCuitDetectado?: string | null;
  numeroFactura?: string | null;
  fecha?: string | null;
  moneda?: string;
  totalDetectado?: number | null;
};

export type UpdateFacturaProveedorItemInput = {
  textoOriginal?: string;
  codigoProveedor?: string | null;
  cantidad?: number;
  precioUnitario?: number | null;
  totalLinea?: number | null;
};

export type CreateProveedorInput = {
  nombre: string;
  cuit?: string;
  monedaPreferida?: string;
};

export type UpdateProveedorInput = {
  nombre?: string;
  cuit?: string;
  monedaPreferida?: string;
  activo?: boolean;
};

export type ListFacturasProveedorFiltros = {
  proveedorId?: number;
  estado?: EstadoFacturaProveedor;
};

export class ApiRequestError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  remainingAttempts: number | null;

  constructor(
    message: string,
    options: {
      status: number;
      retryAfterSeconds?: number | null;
      remainingAttempts?: number | null;
    },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.remainingAttempts = options.remainingAttempts ?? null;
  }
}

type ProductosPaginadosResponse = {
  data: Producto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};


/* =========================
    FETCH WRAPPER (HELPER)
 ========================= */
async function apiRequest<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const requestPath = path;

  let sucursalHeader = "";
  const method = (init?.method ?? "GET").toUpperCase();
  const isReadRequest = method === "GET";
  const isApiEndpoint = path.startsWith("/api/");
  if (typeof window !== "undefined") {
    try {
      // Lazy import para evitar errores SSR
      const { useSucursalStore } = await import("@/store/useSucursalStore");
      const sid = useSucursalStore.getState().activeSucursalId;
      const shouldAttachHeader = Number.isFinite(sid) && (sid > 0 || (sid === 0 && isApiEndpoint && isReadRequest));
      if (shouldAttachHeader) sucursalHeader = String(sid);
    } catch { /* silently ignore store errors */ }
  }

  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (sucursalHeader) {
    headers.set("x-sucursal-id", sucursalHeader);
  }

  let url = requestPath;
  if (typeof window === "undefined" && requestPath.startsWith("/")) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    url = `${baseUrl}${requestPath}`;
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: init?.cache ?? (isApiEndpoint ? ("no-store" as RequestCache) : undefined),
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

    const retryAfterSeconds = parseNumericHeader(res.headers.get("Retry-After"));
    const remainingAttempts = parseNumericHeader(
      res.headers.get("X-Auth-Remaining-Attempts") ?? res.headers.get("X-RateLimit-Remaining"),
    );

    throw new ApiRequestError(msg, {
      status: res.status,
      retryAfterSeconds,
      remainingAttempts,
    });
  }

  return (await res.json()) as ApiResponse<T>;
}

/**
 * ✅ Helper recomendado: devuelve SOLO el `data` del ApiResponse<T>
 * Esto hace que el apiService sea limpio y fácil de usar en UI.
 */
async function apiData<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<unknown>(path, init);
  // Si la respuesta tiene una propiedad 'data', la extraemos. 
  // Caso contrario, devolvemos el objeto raíz (por si es un array directo).
  if (res && typeof res === "object" && "data" in res) {
    return res.data as T;
  }
  return res as T;
}

function getObjectUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const maybeUrl = (value as { url?: unknown }).url;
  return typeof maybeUrl === "string" && maybeUrl.trim().length > 0 ? maybeUrl : null;
}

function parseNumericHeader(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
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
  PRODUCTO_BARCODE: (code: string) => `/api/productos/barcode/${encodeURIComponent(code)}`,

  PROVEEDORES: "/api/proveedores",
  PROVEEDOR_ID: (id: number) => `/api/proveedores/${id}`,

  FACTURAS_PROVEEDOR: {
    LIST: "/api/facturas-proveedor",
    UPLOAD: "/api/facturas-proveedor/upload",
    USAGE: "/api/facturas-proveedor/usage",
    BY_ID: (id: number) => `/api/facturas-proveedor/${id}`,
    PROCESS: (id: number) => `/api/facturas-proveedor/${id}/process`,
    CANCEL: (id: number) => `/api/facturas-proveedor/${id}/cancel`,
    ARCHIVO: (id: number) => `/api/facturas-proveedor/${id}/archivo`,
    CONFIRM_ALL: (id: number) => `/api/facturas-proveedor/${id}/confirm-all`,
    ITEM_UPDATE: (itemId: number) => `/api/facturas-proveedor/items/${itemId}`,
    ITEM_CONFIRM: (itemId: number) => `/api/facturas-proveedor/items/${itemId}/confirm`,
    ITEM_CREATE_PRODUCT: (itemId: number) => `/api/facturas-proveedor/items/${itemId}/create-product`,
    ITEM_IGNORE: (itemId: number) => `/api/facturas-proveedor/items/${itemId}/ignore`,
  },

  CATEGORIAS: "/api/categorias",
  CATEGORIA_ID: (id: number) => `/api/categorias/${id}`,
  INVENTARIO_LINK: (id?: string | number) => `/api/productos/inventario-link${id ? `?sucursalId=${id}` : ""}`,

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
    TIENDA_GLOBAL: "/api/settings/tienda-global",
    PROFILE_TIMEZONE: "/api/settings/profile/timezone",
    BRANDING: "/api/settings/branding",
    SECURITY: {
      ACTIVITY: "/api/security/activity",
      SESSIONS: "/api/security/sessions",
    },
  },
  PUBLIC: {
    LISTA_PRECIOS: "/api/public/lista-precios",
    CHECKOUT: "/api/public/checkout",
    CHECKOUT_STATUS: "/api/public/checkout/status",
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
    return apiData<{ ok?: boolean; message?: string }>(API_ROUTES.CAJAS.MOVIMIENTO, {
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
    return apiData<Configuracion | null>(API_ROUTES.SETTINGS.GENERAL);
  },

   actualizarConfiguracionGeneral(data: Partial<Configuracion> & Record<string, unknown>) {
    return apiRequest<{ message: string; data: Configuracion }>(API_ROUTES.SETTINGS.GENERAL, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getTiendaGlobalConfig() {
    return apiData<TiendaGlobalConfig>(API_ROUTES.SETTINGS.TIENDA_GLOBAL);
  },

  actualizarTiendaGlobalConfig(data: TiendaGlobalConfig) {
    return apiRequest<{ message: string; data: TiendaGlobalConfig }>(API_ROUTES.SETTINGS.TIENDA_GLOBAL, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getProfileTimezone() {
    return apiData<ProfileTimezone>(API_ROUTES.SETTINGS.PROFILE_TIMEZONE);
  },

  updateProfileTimezone(zonaHoraria: string | null) {
    return apiData<ProfileTimezone>(API_ROUTES.SETTINGS.PROFILE_TIMEZONE, {
      method: "PUT",
      body: JSON.stringify({ zonaHoraria }),
    });
  },

  /* ---------- BRANDING ---------- */
  getBranding() {
    return apiData<BrandingSettings | null>(API_ROUTES.SETTINGS.BRANDING);
  },

  actualizarBranding(data: BrandingSettings) {
    return apiRequest<{ message: string; data: BrandingSettings | null }>(API_ROUTES.SETTINGS.BRANDING, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /* ---------- STAFF & SETTINGS ---------- */
  getUsuariosConHorarios() {
    return apiData<Usuario[]>(API_ROUTES.SETTINGS.HORARIOS);
  },

  guardarHorariosStaff(usuarioId: number, horarios: Array<{ id?: number; usuarioId?: number; diaSemana: number; horaInicio: string; horaFin: string; activo: boolean }>) {
    return apiRequest<{ message: string }>(API_ROUTES.SETTINGS.HORARIOS, {
      method: "POST",
      body: JSON.stringify({ usuarioId, horarios }),
    });
  },

  /* ---------- PUBLIC ---------- */
  getPublicListaPrecios(sucursalId?: number) {
    const qs = sucursalId ? `?sucursalId=${sucursalId}` : "";
    return apiData<PublicCatalogData>(`${API_ROUTES.PUBLIC.LISTA_PRECIOS}${qs}`);
  },

  createPublicCheckout(payload: PublicCheckoutPayload) {
    return apiData<PublicCheckoutResponse>(API_ROUTES.PUBLIC.CHECKOUT, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getPublicCheckoutStatus(token: string) {
    const qs = new URLSearchParams({ token });
    return apiData<PublicCheckoutStatusResponse>(
      `${API_ROUTES.PUBLIC.CHECKOUT_STATUS}?${qs.toString()}`,
    );
  },

  cotizarEnvioPublico(payload: { sucursalId: number, codigoPostal: string, subtotal: number, pesoKg?: number }) {
    return apiData<PublicShippingQuote>("/api/public/envios/cotizar", {
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

  async getProductosPaginados(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoriaId?: number | null;
    scope?: "default" | "branch-stock";
  }) {
    const sp = new URLSearchParams();
    if (params.page !== undefined) sp.set("page", String(params.page));
    if (params.limit !== undefined) sp.set("limit", String(params.limit));
    if (params.search) sp.set("search", params.search);
    if (params.categoriaId) sp.set("categoriaId", String(params.categoriaId));
    if (params.scope && params.scope !== "default") sp.set("scope", params.scope);
    const qs = sp.toString();
    const response = await apiRequest<Producto[]>(`${API_ROUTES.PRODUCTOS}${qs ? `?${qs}` : ""}`);
    const metadata = response as ApiResponse<Producto[]> & Partial<Omit<ProductosPaginadosResponse, "data">>;

    return {
      data: Array.isArray(response.data) ? response.data : [],
      total: metadata.total ?? 0,
      page: metadata.page ?? params.page ?? 1,
      limit: metadata.limit ?? params.limit ?? 50,
      totalPages: metadata.totalPages ?? 1,
    } satisfies ProductosPaginadosResponse;
  },

  getProducto(id: number) {
    return apiData<Producto>(API_ROUTES.PRODUCTO_ID(id));
  },

  getProductoPorBarcode(code: string) {
    return apiData<Producto>(API_ROUTES.PRODUCTO_BARCODE(code));
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

  /* ---------- Facturas de proveedor (pipeline OCR + matching) ---------- */

  getProveedores() {
    return apiData<Proveedor[]>(API_ROUTES.PROVEEDORES);
  },

  createProveedor(payload: CreateProveedorInput) {
    return apiData<Proveedor>(API_ROUTES.PROVEEDORES, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateProveedor(id: number, payload: UpdateProveedorInput) {
    return apiData<Proveedor>(API_ROUTES.PROVEEDOR_ID(id), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteProveedor(id: number) {
    return apiData<{ success: boolean }>(API_ROUTES.PROVEEDOR_ID(id), {
      method: "DELETE",
    });
  },

  uploadFacturaProveedor(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiData<FacturaProveedor>(API_ROUTES.FACTURAS_PROVEEDOR.UPLOAD, {
      method: "POST",
      body: formData,
      headers: {},
    });
  },

  getFacturaProveedorUsage() {
    return apiData<FacturaProveedorUsage>(API_ROUTES.FACTURAS_PROVEEDOR.USAGE);
  },

  processFacturaProveedor(facturaId: number) {
    return apiData<FacturaProveedor>(API_ROUTES.FACTURAS_PROVEEDOR.PROCESS(facturaId), {
      method: "POST",
    });
  },

  getFacturaProveedor(facturaId: number) {
    return apiData<FacturaProveedor>(API_ROUTES.FACTURAS_PROVEEDOR.BY_ID(facturaId));
  },

  listFacturasProveedor(filtros?: ListFacturasProveedorFiltros) {
    const params = new URLSearchParams();
    if (filtros?.proveedorId != null) params.set("proveedorId", String(filtros.proveedorId));
    if (filtros?.estado) params.set("estado", filtros.estado);
    const qs = params.toString();
    const url = qs ? `${API_ROUTES.FACTURAS_PROVEEDOR.LIST}?${qs}` : API_ROUTES.FACTURAS_PROVEEDOR.LIST;
    return apiData<FacturaProveedor[]>(url);
  },

  cancelFacturaProveedor(facturaId: number) {
    return apiData<FacturaProveedor>(API_ROUTES.FACTURAS_PROVEEDOR.CANCEL(facturaId), {
      method: "POST",
    });
  },

  updateFacturaProveedor(facturaId: number, payload: UpdateFacturaProveedorInput) {
    return apiData<FacturaProveedor>(API_ROUTES.FACTURAS_PROVEEDOR.BY_ID(facturaId), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  updateFacturaProveedorItem(itemId: number, payload: UpdateFacturaProveedorItemInput) {
    return apiData<FacturaProveedorItem>(API_ROUTES.FACTURAS_PROVEEDOR.ITEM_UPDATE(itemId), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async confirmFacturaProveedorItem(itemId: number, productoId: number): Promise<ConfirmarItemResultado> {
    const res = await apiRequest<FacturaProveedorItem>(API_ROUTES.FACTURAS_PROVEEDOR.ITEM_CONFIRM(itemId), {
      method: "POST",
      body: JSON.stringify({ productoId }),
    });
    const extra = res as unknown as {
      variacionCosto?: ConfirmarItemResultado["variacionCosto"];
      tipoCambioAplicado?: number | null;
      advertenciaConversion?: string | null;
    };
    return {
      data: res.data,
      variacionCosto: extra.variacionCosto ?? { variacionPct: null, alerta: null },
      tipoCambioAplicado: extra.tipoCambioAplicado ?? null,
      advertenciaConversion: extra.advertenciaConversion ?? null,
    };
  },

  ignoreFacturaProveedorItem(itemId: number) {
    return apiData<FacturaProveedorItem>(API_ROUTES.FACTURAS_PROVEEDOR.ITEM_IGNORE(itemId), {
      method: "POST",
    });
  },

  async createProductoDesdeFacturaItem(itemId: number, payload: CreateProductoInput) {
    const res = await apiRequest<{ producto: ProductoWithImage; item: FacturaProveedorItem }>(
      API_ROUTES.FACTURAS_PROVEEDOR.ITEM_CREATE_PRODUCT(itemId),
      { method: "POST", body: JSON.stringify(payload) },
    );
    const extra = res as unknown as { tipoCambioAplicado?: number | null; advertenciaConversion?: string | null };
    return {
      ...res.data,
      tipoCambioAplicado: extra.tipoCambioAplicado ?? null,
      advertenciaConversion: extra.advertenciaConversion ?? null,
    };
  },

  confirmAllFacturaProveedor(facturaId: number) {
    return apiData<ConfirmAllResultado>(API_ROUTES.FACTURAS_PROVEEDOR.CONFIRM_ALL(facturaId), {
      method: "POST",
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

  createCategoria(data: { nombre: string; color?: string }) {
    return apiData<Categoria>(API_ROUTES.CATEGORIAS, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteCategoria(id: number) {
    return apiData<{ ok: true }>(API_ROUTES.CATEGORIA_ID(id), { method: "DELETE" });
  },

  updateCategoria(id: number, data: { nombre?: string; color?: string }) {
    return apiData<Categoria>(API_ROUTES.CATEGORIA_ID(id), {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /* ---------- SUBCATEGORÍAS ---------- */
  getSubcategorias(categoriaId: number) {
    return apiData<Subcategoria[]>(`/api/subcategorias?categoriaId=${categoriaId}`);
  },

  createSubcategoria(data: { nombre: string; categoriaId: number; descuentos?: DescuentoNivel[] | null }) {
    return apiData<Subcategoria>("/api/subcategorias", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateSubcategoria(id: number, data: { nombre?: string; descuentos?: DescuentoNivel[] | null }) {
    return apiData<Subcategoria>(`/api/subcategorias/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteSubcategoria(id: number) {
    return apiData<{ ok: true }>(`/api/subcategorias/${id}`, {
      method: "DELETE",
    });
  },

  /* ---------- CONSIGNACIONES ---------- */
  getConsignaciones() {
    return apiData<Consignacion[]>(API_ROUTES.CONSIGNACIONES);
  },

  getConsignacionesPaginadas(params: {
    page?: number;
    limit?: number;
    search?: string;
    estado?: string;
  }) {
    const sp = new URLSearchParams();
    if (params.page !== undefined) sp.set("page", String(params.page));
    if (params.limit !== undefined) sp.set("limit", String(params.limit));
    if (params.search) sp.set("search", params.search);
    if (params.estado && params.estado !== "TODAS") sp.set("estado", params.estado);
    const qs = sp.toString();
    return apiRequest<{ data: Consignacion[]; total: number; page: number; totalPages: number }>(
      `${API_ROUTES.CONSIGNACIONES}${qs ? `?${qs}` : ""}`
    );
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

  updateConsignacion<TPayload extends Record<string, unknown>>(id: number, payload: TPayload) {
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

  getLiquidacion<TResponse = unknown>(id: number) {
    return apiData<TResponse>(API_ROUTES.LIQUIDACIONES.BY_ID(id));
  },

  updateLiquidacion<TPayload extends Record<string, unknown>, TResponse = unknown>(liquidacionId: number, payload: TPayload) {
    return apiData<TResponse>(API_ROUTES.LIQUIDACIONES.BY_ID(liquidacionId), {
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

  anularVenta(id: number, payload: { motivo: string; brokenItems?: number[] }) {
    return apiData<{ success: true }>(API_ROUTES.VENTA_ID(id), {
      method: "DELETE",
      body: JSON.stringify(payload),
    });
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
    const data = await apiRequest<{ url?: string }>(`${API_ROUTES.DASHBOARD.REPORTE_LINK(period)}&type=${type}`);
    const url = getObjectUrl(data) ?? getObjectUrl(data.data);
    if (!url) {
      throw new Error("No se pudo obtener la URL del reporte.");
    }
    return normalizeShareUrl(url);
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
    return apiData<Array<Record<string, unknown>>>(`${API_ROUTES.NOTIFICACIONES.LIST}?${qs.toString()}`);
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
  async getSharePdfUrl(path: string): Promise<string> {
    const response = await apiRequest<{ url?: string }>(path);
    const rawUrl = (response as { url?: string })?.url;
    if (!rawUrl) {
      throw new Error("No se pudo obtener la URL del PDF.");
    }
    return normalizeShareUrl(rawUrl);
  },

  async getConsignacionPdfUrl(id: number): Promise<string> {
    return this.getSharePdfUrl(API_ROUTES.REMITO_LINK(id));
  },

  async getVentaPdfUrl(id: number): Promise<string> {
    return this.getSharePdfUrl(API_ROUTES.TICKET_LINK(id));
  },

  async getInventarioPdfUrl(sucursalId?: string | number): Promise<string> {
    return this.getSharePdfUrl(API_ROUTES.INVENTARIO_LINK(sucursalId));
  },

  /* ---------- SEGURIDAD ---------- */
  getAuditLogs(params?: { module?: string; userId?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.module) qs.append("module", params.module);
    if (params?.userId) qs.append("userId", String(params.userId));
    if (params?.limit) qs.append("limit", String(params.limit));
    return apiData<AuditLogEntry[]>(`${API_ROUTES.SETTINGS.SECURITY.ACTIVITY}?${qs.toString()}`);
  },

  getActiveSessions() {
    return apiData<ActiveSession[]>(API_ROUTES.SETTINGS.SECURITY.SESSIONS);
  },

  revokeSession(sessionId: string) {
    return apiData<{ ok: boolean }>(`${API_ROUTES.SETTINGS.SECURITY.SESSIONS}?id=${sessionId}`, {
      method: "DELETE",
    });
  },

  /* ---------- SUCURSALES ---------- */
  getSucursales() {
    return apiData<SucursalResumen[]>("/api/settings/sucursales");
  },
  createSucursal(payload: { nombre: string; activa?: boolean }) {
    return apiData<SucursalResumen>("/api/settings/sucursales", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateSucursal(id: number, payload: { nombre?: string; activa?: boolean }) {
    return apiData<SucursalResumen>(`/api/settings/sucursales/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  deleteSucursal(id: number) {
    return apiData<{ ok?: boolean; success?: boolean }>(`/api/settings/sucursales/${id}`, {
      method: "DELETE",
    });
  },

  /* ---------- GASTOS ---------- */
  getGastos(params?: { estado?: string; categoriaId?: number }) {
    const qs = new URLSearchParams();
    if (params?.estado) qs.append("estado", params.estado);
    if (params?.categoriaId) qs.append("categoriaId", String(params.categoriaId));
    return apiData<Gasto[]>(`${API_ROUTES.GASTOS.LIST}?${qs.toString()}`);
  },

  createGasto<TPayload extends Record<string, unknown>>(payload: TPayload) {
    return apiData<Gasto>(API_ROUTES.GASTOS.LIST, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateGasto<TPayload extends Record<string, unknown>>(id: number, payload: TPayload) {
    return apiData<Gasto>(API_ROUTES.GASTOS.ID(id), {
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
    return apiData<CategoriaGasto[]>(API_ROUTES.GASTOS.CATEGORIAS);
  },

  createGastoCategoria(nombre: string) {
    return apiData<CategoriaGasto>(API_ROUTES.GASTOS.CATEGORIAS, {
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
