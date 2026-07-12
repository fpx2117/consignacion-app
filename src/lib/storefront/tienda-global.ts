import { prisma } from "@/lib/prisma";

export type TiendaGlobalConfig = {
  modoUnificado: boolean;
};

export async function getTiendaGlobalConfig(): Promise<TiendaGlobalConfig> {
  const row = await prisma.tiendaGlobalConfig.findUnique({ where: { id: 1 } });
  return { modoUnificado: row?.modoUnificado ?? true };
}
