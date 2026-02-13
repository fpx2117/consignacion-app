// lib/reports/resolver.ts

const CLIENT_ID = (process.env.CLIENT_ID || "").trim();

/**
 * Resolver genérico: intenta cargar el módulo del cliente y si falla usa base.
 * - No rompe si el override no existe.
 * - Mantiene una interfaz limpia para usar en routes.
 */
async function resolveReportModule<T>(
  baseLoader: () => Promise<T>,
  clientLoader: (clientId: string) => Promise<T>
): Promise<T> {
  if (CLIENT_ID) {
    try {
      return await clientLoader(CLIENT_ID);
    } catch {
      // fallback al base si el override no existe o no se puede cargar
    }
  }
  return await baseLoader();
}

// Tipos por módulo (tomados SIEMPRE desde base para tener contrato estable)
export type VentaReportModule = typeof import("./base/venta-report-template");
export type InventoryReportModule = typeof import("./base/inventory-report-template");
export type HistoryInventoryReportModule = typeof import("./base/history-inventory-report.template");
export type ConsignacionReportModule = typeof import("./base/consignacion-report-template");

/**
 * API pública: Reports.<tipo>() -> módulo correcto (cliente o base)
 */
export const Reports = {
  venta: () =>
    resolveReportModule<VentaReportModule>(
      () => import("./base/venta-report-template") as Promise<VentaReportModule>,
      (clientId) =>
        import(`./clients/${clientId}/venta-report-template`) as Promise<VentaReportModule>
    ),

  inventory: () =>
    resolveReportModule<InventoryReportModule>(
      () => import("./base/inventory-report-template") as Promise<InventoryReportModule>,
      (clientId) =>
        import(`./clients/${clientId}/inventory-report-template`) as Promise<InventoryReportModule>
    ),

  historyInventory: () =>
    resolveReportModule<HistoryInventoryReportModule>(
      () =>
        import("./base/history-inventory-report.template") as Promise<HistoryInventoryReportModule>,
      (clientId) =>
        import(`./clients/${clientId}/history-inventory-report-template`) as Promise<HistoryInventoryReportModule>
    ),

  consignacion: () =>
    resolveReportModule<ConsignacionReportModule>(
      () => import("./base/consignacion-report-template") as Promise<ConsignacionReportModule>,
      (clientId) =>
        import(`./clients/${clientId}/consignacion-report-template`) as Promise<ConsignacionReportModule>
    ),
} as const;
