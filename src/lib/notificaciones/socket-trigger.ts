import { NOTIFICATION_TYPE } from "@/lib/notificaciones/types";

interface NotificationPayload {
  id?: number;
  type: NOTIFICATION_TYPE | string;
  title?: string;
  message: string;
  branch?: string;
  /** Sucursal dueña del aviso: el servidor emite sólo a esa sala. */
  sucursalId?: number | null;
  /** Usuario destinatario, para avisos personales. */
  userId?: number | null;
  data?: Record<string, unknown>;
}

export async function sendNotification({
  id,
  type,
  title,
  message,
  branch,
  sucursalId,
  userId,
  data,
}: NotificationPayload) {
  const baseUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const dispatchSecret =
    process.env.SOCKET_DISPATCH_SECRET || process.env.CRON_SECRET;

  try {
    console.log(
      `📡 [sendNotification] Despachando a ${baseUrl}/api/socket/dispatch`,
      { type, title },
    );
    const response = await fetch(`${baseUrl}/api/socket/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(dispatchSecret && { Authorization: `Bearer ${dispatchSecret}` }),
      },
      body: JSON.stringify({
        notification: {
          id,
          type,
          title,
          message,
          branch,
          sucursalId: sucursalId ?? null,
          userId: userId ?? null,
          data,
          timestamp: new Date().toISOString(),
        },
      }),
    });
    console.log(
      `✅ [sendNotification] Respuesta del dispatch: ${response.status}`,
    );
  } catch (error) {
    console.error("Error socket dispatch:", error);
  }
}
