import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; // O tu ruta actual

interface NotificationPayload {
  id?: number; // ✅ Opcional: Para vincular con la DB en el cliente
  type: NOTIFICATION_TYPE | string;
  title?: string;
  message: string;
  branch?: string; // ✅ Opcional: Para mostrar la sucursal en el toast
  data?: any;
}

export async function sendNotification({ id, type, title, message, branch, data }: NotificationPayload) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    console.log(`📡 [sendNotification] Despachando a ${baseUrl}/api/socket/dispatch`, { type, title });
    const response = await fetch(`${baseUrl}/api/socket/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notification: {
          id,
          type,
          title,
          message,
          branch,
          data,
          timestamp: new Date().toISOString(),
        },
      }),
    });
    console.log(`✅ [sendNotification] Respuesta del dispatch: ${response.status}`);

  } catch (error) {
    console.error("Error socket dispatch:", error);
  }
}