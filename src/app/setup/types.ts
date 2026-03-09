// ─── Setup Wizard Types ─────────────────────────────────────────────────────
// Tipos centralizados para todo el flujo de setup

export interface AdminData {
  nombre: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface StaffMember {
  nombre: string;
  email: string;
  rol: string;
  password?: string;
}

export interface BrandingData {
  phone: string;
  address: string;
  primaryColor: string;
  logoFile: File | null;
  logoPreview: string | null;
}

export interface BranchData {
  nombre: string;
  terminalNombre: string;
}

export interface PosConfigData {
  usarControlDeCaja: boolean;
  porcentajeAumentoConsignacion: number;
  porcentajeInteresTarjeta: number;
}

export interface CatalogData {
  mostrarListaPrecios: boolean;
  whatsappNumber: string;
}

export interface NotificationsData {
  minStockGlobal: number;
  diasAnticipacionVencimiento: number;
  notificarStockBajo: boolean;
  notificarVencimientos: boolean;
  notificarVentas: boolean;
  notificarLiquidaciones: boolean;
  notificarConsignacionesActivas: boolean;
  diasAvisoConsignacion: number;
}

export interface SetupFormData {
  businessName: string;
  branding: BrandingData;
  adminData: AdminData;
  branch: BranchData;
  posConfig: PosConfigData;
  catalog: CatalogData;
  notifications: NotificationsData;
  staff: StaffMember[];
  selectedPlanId: number | null;
}

// Payload que se envía al API /api/setup/initialize
export interface InitializePayload {
  admin: { nombre: string; email: string; password: string };
  planId: number;
  businessName: string;
  staff: Array<{ nombre: string; email: string; password?: string }>;
  promoCode?: string;
  paymentId?: string;
  branding: {
    phone?: string;
    address?: string;
    primaryColor: string;
    logoData?: string;
    logoMime?: string;
  };
  branch: {
    nombre: string;
    terminalNombre: string;
  };
  posConfig: {
    usarControlDeCaja: boolean;
    porcentajeAumentoConsignacion: number;
    porcentajeInteresTarjeta: number;
  };
  catalog?: {
    mostrarListaPrecios: boolean;
    whatsappNumber?: string;
  };
  notifications?: {
    minStockGlobal: number;
    diasAnticipacionVencimiento: number;
    notificarStockBajo: boolean;
    notificarVencimientos: boolean;
    notificarVentas: boolean;
    notificarLiquidaciones: boolean;
    notificarConsignacionesActivas: boolean;
    diasAvisoConsignacion: number;
  };
}

export type SetupStep =
  | "welcome"
  | "business"
  | "admin"
  | "branch"
  | "pos"
  | "catalog"
  | "notifications"
  | "team"
  | "subscription"
  | "payment"
  | "loading"
  | "success";
