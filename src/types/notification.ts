/* =========================================================
   NOTIFICATIONS TYPES (DB + SOCKET + UI)
   ========================================================= */

/* ---------- Tipos DB (Prisma Enum) ---------- */
/**
 * Estos son los valores reales guardados en PostgreSQL
 * según el enum NotificationType en Prisma.
 */
export type DbNotificationType =
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "SYSTEM";

/* ---------- Tipos UI (Frontend / Socket) ---------- */
/**
 * Estos son los valores que usa tu frontend visualmente
 * y los que llegan por Socket.IO.
 */
export type AppNotificationType =
  | "low_stock"
  | "out_of_stock"
  | "system";

/* =========================================================
   MODELO COMPLETO DESDE DB (Prisma)
   ========================================================= */
export interface DbNotification {
  id: number;

  type: DbNotificationType;

  title: string;
  description: string;

  productoId?: number | null;

  read: boolean;

  fingerprint: string;

  createdAt: string; // ISO Date string
  readAt?: string | null;
}

/* =========================================================
   MODELO USADO EN UI + SOCKET
   ========================================================= */
export interface AppNotification {
  id: string; // UI siempre lo maneja como string

  title: string;
  description: string;

  type: AppNotificationType;

  time: string; // "Ahora", "10:45", etc.

  productoId?: number;
}

/* =========================================================
   MAPPERS (DB <-> UI)
   ========================================================= */

/**
 * Convierte una notificación guardada en DB
 * a formato frontend/socket.
 */
export function mapDbNotificationToApp(
  n: DbNotification
): AppNotification {
  const typeMap: Record<DbNotificationType, AppNotificationType> = {
    LOW_STOCK: "low_stock",
    OUT_OF_STOCK: "out_of_stock",
    SYSTEM: "system",
  };

  return {
    id: String(n.id),
    title: n.title,
    description: n.description,
    type: typeMap[n.type] ?? "system",
    time: new Date(n.createdAt).toLocaleTimeString(),
    productoId: n.productoId ?? undefined,
  };
}

/**
 * Convierte una notificación frontend/socket
 * en formato DB para guardarla.
 */
export function mapAppNotificationToDb(
  n: AppNotification
): Partial<DbNotification> {
  const typeMap: Record<AppNotificationType, DbNotificationType> = {
    low_stock: "LOW_STOCK",
    out_of_stock: "OUT_OF_STOCK",
    system: "SYSTEM",
  };

  return {
    type: typeMap[n.type],
    title: n.title,
    description: n.description,
    productoId: n.productoId ?? null,
    fingerprint: `${typeMap[n.type]}:${n.productoId ?? "system"}`,
  };
}
