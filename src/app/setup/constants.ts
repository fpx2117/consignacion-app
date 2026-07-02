import type { SetupStep, SetupFormData } from "./types";

// ─── Step Definitions ────────────────────────────────────────────────────────

export interface StepConfig {
  id: SetupStep;
  label: string;
  required: boolean;
  showProgress: boolean;
  showNavigation: boolean;
}

export const STEPS: StepConfig[] = [
  { id: "welcome",       label: "Bienvenida",      required: true,  showProgress: false, showNavigation: false },
  { id: "business",      label: "Tu Negocio",       required: true,  showProgress: true,  showNavigation: true },
  { id: "admin",         label: "Administrador",    required: true,  showProgress: true,  showNavigation: true },
  { id: "branch",        label: "Sucursal",         required: true,  showProgress: true,  showNavigation: true },
  { id: "pos",           label: "Punto de Venta",   required: true,  showProgress: true,  showNavigation: true },
  { id: "catalog",       label: "Catálogo",         required: false, showProgress: true,  showNavigation: true },
  { id: "notifications", label: "Notificaciones",   required: false, showProgress: true,  showNavigation: true },
  { id: "team",          label: "Equipo",           required: false, showProgress: true,  showNavigation: true },
  { id: "subscription",  label: "Plan",             required: true,  showProgress: true,  showNavigation: true },
  { id: "payment",       label: "Pago",             required: true,  showProgress: true,  showNavigation: true },
  { id: "loading",       label: "Procesando",       required: true,  showProgress: false, showNavigation: false },
  { id: "success",       label: "Listo",            required: true,  showProgress: false, showNavigation: false },
];

export const NAVIGABLE_STEPS = STEPS.filter(s => s.showProgress);
export const TOTAL_NAVIGABLE = NAVIGABLE_STEPS.length;

// ─── Default Form Data ──────────────────────────────────────────────────────

export const DEFAULT_FORM_DATA: SetupFormData = {
  businessName: "",
  rubroNegocio: null,
  branding: {
    phone: "",
    address: "",
    primaryColor: "var(--swatch-11)",
    logoFile: null,
    logoPreview: null,
  },
  adminData: {
    nombre: "",
    email: "",
    password: "",
    confirmPassword: "",
  },
  branch: {
    nombre: "Sucursal Principal",
    terminalNombre: "Caja Principal",
  },
  posConfig: {
    usarControlDeCaja: true,
    porcentajeAumentoConsignacion: 0,
    porcentajeInteresTarjeta: 0,
  },
  catalog: {
    mostrarListaPrecios: false,
    whatsappNumber: "",
  },
  notifications: {
    minStockGlobal: 5,
    diasAnticipacionVencimiento: 7,
    notificarStockBajo: true,
    notificarVencimientos: true,
    notificarVentas: true,
    notificarLiquidaciones: true,
    notificarConsignacionesActivas: true,
    diasAvisoConsignacion: 15,
  },
  staff: [],
  selectedPlanId: null,
};
