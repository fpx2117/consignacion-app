import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; // O tu ruta actual

interface NotificationPayload {
  // ✅ CAMBIO CLAVE: Permitimos el Enum estricto O un string cualquiera.
  // Esto hace que el tipo de Prisma ('NotificationType') sea aceptado porque es compatible con string.
  type: NOTIFICATION_TYPE | string; 
  
  title?: string;
  message: string;
  data?: any;
}

export async function sendNotification({ type, title, message, data }: NotificationPayload) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  try {
    // ... resto del código igual ...
    await fetch(`${baseUrl}/api/socket/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notification: {
          type,
          title,
          message,
          data,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Error socket dispatch:", error);
  }
}