// src/app/api/ventas/ventas-route-deps.ts
// Puertos del adaptador HTTP de ventas. Se declaran aparte para que el handler
// legacy y el caso de uso extraído compartan exactamente las mismas
// dependencias sin importarse entre sí.

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { obtenerConfiguracionGlobal } from "@/lib/config";
import {
  evaluateStockAlert,
  processNotificationQueue,
} from "@/lib/notificaciones/stock-alerts";
import { sendNotification } from "@/lib/notificaciones/socket-trigger";
import { nowAR } from "@/lib/date-format/utils-date";
import { resolveTimezoneForAuth } from "@/lib/timezone/get-configured-tz";
import {
  buildSucursalWhere,
  isGlobalSucursalView,
} from "@/lib/security/sucursalScope";

export type VentasRouteDeps = {
  prisma: typeof prisma;
  requireAuth: typeof requireAuth;
  buildSucursalWhere: typeof buildSucursalWhere;
  isGlobalSucursalView: typeof isGlobalSucursalView;
  obtenerConfiguracionGlobal: typeof obtenerConfiguracionGlobal;
  resolveTimezoneForAuth: typeof resolveTimezoneForAuth;
  nowAR: typeof nowAR;
  evaluateStockAlert: typeof evaluateStockAlert;
  processNotificationQueue: typeof processNotificationQueue;
  sendNotification: typeof sendNotification;
};

export const defaultVentasRouteDeps: VentasRouteDeps = {
  prisma,
  requireAuth,
  buildSucursalWhere,
  isGlobalSucursalView,
  obtenerConfiguracionGlobal,
  resolveTimezoneForAuth,
  nowAR,
  evaluateStockAlert,
  processNotificationQueue,
  sendNotification,
};
