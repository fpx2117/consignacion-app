// src/lib/notificaciones/socket-rooms.ts
// Salas de Socket.IO y destino mínimo de cada evento.
//
// ADR 005: el servidor valida la sesión y une cada socket sólo a salas
// autorizadas de instalación, sucursal y usuario. El filtrado en el cliente no
// es un límite de seguridad.

export const SOCKET_ROOMS = {
  install: "install",
  branch: (sucursalId: number) => `branch:${sucursalId}`,
  user: (userId: number) => `user:${userId}`,
} as const;

export type SocketIdentity = {
  userId: number;
  /** `null` para vista global (sólo lectura): no se une a una sucursal puntual. */
  activeSucursalId: number | null;
  /**
   * Sucursales que el usuario puede ver cuando está en vista global. Sólo se
   * usan en ese modo: en una sucursal activa, el socket escucha únicamente esa.
   */
  visibleSucursalIds?: number[];
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Salas a las que se une un socket ya autenticado y autorizado. */
export function resolveSocketRooms(identity: SocketIdentity): string[] {
  const rooms: string[] = [
    SOCKET_ROOMS.install,
    SOCKET_ROOMS.user(identity.userId),
  ];

  const branches = isPositiveInteger(identity.activeSucursalId)
    ? [identity.activeSucursalId]
    : (identity.visibleSucursalIds ?? []);

  for (const sucursalId of new Set(branches)) {
    if (isPositiveInteger(sucursalId)) {
      rooms.push(SOCKET_ROOMS.branch(sucursalId));
    }
  }

  return rooms;
}

export type NotificationTarget = {
  sucursalId?: number | null;
  userId?: number | null;
};

/**
 * Destino mínimo del evento: la sucursal si el aviso es de sucursal, el usuario
 * si es personal, y la instalación sólo para avisos del programa (suscripción).
 */
export function resolveNotificationRoom(target: NotificationTarget): string {
  if (isPositiveInteger(target.sucursalId)) {
    return SOCKET_ROOMS.branch(target.sucursalId);
  }
  if (isPositiveInteger(target.userId)) {
    return SOCKET_ROOMS.user(target.userId);
  }
  return SOCKET_ROOMS.install;
}
