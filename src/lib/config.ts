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
    const nuevaConfig = await prisma.configuracion.create({
      data: {
        id: 1,
        minStockGlobal: 5, // Valor por defecto inicial
      },
    });

    return nuevaConfig;
  } catch (error) {
    console.error("⚠️ Error obteniendo configuración global:", error);
    // Fallback de seguridad por si falla la DB (evita que la app crashee)
    return { id: 1, minStockGlobal: 5 };
  }
}