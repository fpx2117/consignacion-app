import { prisma } from "@/lib/prisma";

/**
 * Obtiene la configuración global del sistema (Singleton ID: 1).
 * Si no existe, la crea con valores por defecto.
 */
export async function obtenerConfiguracionGlobal() {
  try {
    // Intentamos buscar la configuración
    const config = await prisma.configuracion.findUnique({
      where: { id: 1 },
    });

    // Si ya existe, la devolvemos
    if (config) {
      return config;
    }

    // Si es el primer arranque del sistema, creamos la default
    // Prisma rellenará el resto de campos con los @default del schema
    const nuevaConfig = await prisma.configuracion.create({
      data: {
        id: 1,
      },
    });

    return nuevaConfig;
  } catch (error) {
    console.error("⚠️ Error obteniendo configuración global:", error);

    // 🔥 SOLUCIÓN: El fallback ahora tiene la estructura completa del modelo
    return {
      id: 1,
      minStockGlobal: 5,
      diasAnticipacionVencimiento: 7,
      notificarVencimientos: true,
      notificarStockBajo: true,
      notificarVentas: true,
      usarControlDeCaja: true // <--- Aquí está el campo que faltaba
    };
  }
}