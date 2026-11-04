// src/lib/security/audit-events.ts
//
// Constructores puros de eventos de auditoría.
//
// Existen por dos razones:
//   1. El payload de `AuditLog` se arma en un solo lugar, así los handlers no
//      inventan formas distintas para el mismo tipo de acción.
//   2. Se pueden testear sin base de datos ni request, porque son funciones
//      puras que reciben datos y devuelven el objeto de auditoría.
//
// Regla dura: nunca se incluyen contraseñas, hashes, tokens ni credenciales.
// `recordAuditLog` ya limpia `token`/`hash`/`password` de primer nivel, pero acá
// además se aplica una lista blanca a la configuración, cuyos secretos tienen
// otros nombres (`mpAccessTokenTienda`, `andreaniPassword`, ...).

import type { AuditAction, AuditModule } from "./audit";

export type AuditEvent = {
  userId?: number;
  action: AuditAction;
  module: AuditModule;
  details?: Record<string, unknown>;
};

function event(
  actorId: number,
  action: AuditAction,
  module: AuditModule,
  details: Record<string, unknown>,
): AuditEvent {
  return { userId: actorId, action, module, details };
}

/* ============================
   Usuarios
   ============================ */

export function userCreated(input: {
  actorId: number;
  userId: number;
  email: string;
  rol: string;
  sucursalId: number | null;
}): AuditEvent {
  return event(input.actorId, "CREATE", "USERS", {
    targetUserId: input.userId,
    email: input.email,
    rol: input.rol,
    sucursalId: input.sucursalId,
  });
}

export function userUpdated(input: {
  actorId: number;
  userId: number;
  email: string;
  rol: string;
  sucursalId: number | null;
  passwordChanged: boolean;
}): AuditEvent {
  return event(input.actorId, "UPDATE", "USERS", {
    targetUserId: input.userId,
    email: input.email,
    rol: input.rol,
    sucursalId: input.sucursalId,
    // Se registra QUE se cambió la contraseña, nunca su valor ni su hash.
    passwordChanged: input.passwordChanged,
  });
}

export function userDeleted(input: {
  actorId: number;
  userId: number;
}): AuditEvent {
  return event(input.actorId, "DELETE", "USERS", {
    targetUserId: input.userId,
  });
}

/* ============================
   Inventario
   ============================ */

export function productCreated(input: {
  actorId: number;
  productoId: number;
  nombre: string;
  sucursalId: number;
  stockInicial: number;
}): AuditEvent {
  return event(input.actorId, "CREATE", "INVENTORY", {
    productoId: input.productoId,
    nombre: input.nombre,
    sucursalId: input.sucursalId,
    stockInicial: input.stockInicial,
  });
}

export function productUpdated(input: {
  actorId: number;
  productoId: number;
  nombre: string;
  sucursalId: number | null;
}): AuditEvent {
  return event(input.actorId, "UPDATE", "INVENTORY", {
    productoId: input.productoId,
    nombre: input.nombre,
    sucursalId: input.sucursalId,
  });
}

export function productDeactivated(input: {
  actorId: number;
  productoId: number;
  sucursalId: number;
}): AuditEvent {
  return event(input.actorId, "DELETE", "INVENTORY", {
    productoId: input.productoId,
    sucursalId: input.sucursalId,
    softDelete: true,
  });
}

/* ============================
   Ventas
   ============================ */

export function saleCancelled(input: {
  actorId: number;
  ventaId: number;
  sucursalId: number;
  motivo: string;
  roturaCount: number;
}): AuditEvent {
  return event(input.actorId, "DELETE", "SALES", {
    ventaId: input.ventaId,
    sucursalId: input.sucursalId,
    motivo: input.motivo,
    roturaCount: input.roturaCount,
    anulada: true,
  });
}

/* ============================
   Consignaciones
   ============================ */

export function consignmentCreated(input: {
  actorId: number;
  consignacionId: number;
  clienteId: number;
  sucursalId: number;
  itemsCount: number;
}): AuditEvent {
  return event(input.actorId, "CREATE", "CONSIGNMENTS", {
    consignacionId: input.consignacionId,
    clienteId: input.clienteId,
    sucursalId: input.sucursalId,
    itemsCount: input.itemsCount,
  });
}

/* ============================
   Configuración
   ============================ */

/**
 * Campos de `Configuracion` que sí pueden quedar registrados.
 *
 * Todo lo que no esté acá se descarta. En particular quedan afuera
 * `mpAccessTokenTienda`, `mpPublicKeyTienda` y las credenciales de Andreani.
 */
const AUDITABLE_SETTINGS_FIELDS = new Set([
  "minStockGlobal",
  "diasAnticipacionVencimiento",
  "notificarVencimientos",
  "notificarStockBajo",
  "notificarVentas",
  "notificarLiquidaciones",
  "notificarConsignacionesActivas",
  "diasAvisoConsignacion",
  "usarControlDeCaja",
  "porcentajeAumentoConsignacion",
  "mostrarPreciosConsignacion",
  "porcentajeInteresTarjeta",
  "mostrarListaPrecios",
  "convertirTienda",
  "tiendaMetodoPago",
  "separarListaPorSucursal",
  "mostrarEnTiendaOnline",
  "tiendaSlug",
  "tiendaLayout",
  "mostrarCategoriasEnHeader",
  "zonaHoraria",
  "rubroNegocio",
  "columnasAtributosProducto",
]);

export function settingsUpdated(input: {
  actorId: number;
  sucursalId: number;
  fields: string[];
}): AuditEvent {
  const safeFields = [...new Set(input.fields)]
    .filter((field) => AUDITABLE_SETTINGS_FIELDS.has(field))
    .sort();

  return event(input.actorId, "SETTINGS_CHANGE", "SETTINGS", {
    sucursalId: input.sucursalId,
    fields: safeFields,
  });
}

export { AUDITABLE_SETTINGS_FIELDS };
