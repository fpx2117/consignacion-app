/**
 * get-configured-tz.ts — Helper server-side para leer la zona horaria configurada.
 *
 * Lee Configuracion.zonaHoraria de la DB por sucursalId.
 * Cachea el resultado 60s con tag "config" para no golpear la DB en cada request.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const TZ_AR_DEFAULT = "America/Argentina/Buenos_Aires";

export const getConfiguredTz = unstable_cache(
  async (sucursalId: number): Promise<string> => {
    try {
      const config = await prisma.configuracion.findUnique({
        where: { sucursalId },
        select: { zonaHoraria: true },
      });
      const tz = config?.zonaHoraria ?? TZ_AR_DEFAULT;
      // Validar que el string IANA sea válido antes de retornarlo
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return tz;
      } catch {
        console.error(`[getConfiguredTz] Timezone inválida en config sucursal ${sucursalId}: "${tz}". Usando fallback.`);
        return TZ_AR_DEFAULT;
      }
    } catch (error) {
      console.error(`[getConfiguredTz] Error leyendo config de sucursal ${sucursalId}:`, error);
      return TZ_AR_DEFAULT;
    }
  },
  ["configured-tz"],
  { revalidate: 60, tags: ["config"] },
);
