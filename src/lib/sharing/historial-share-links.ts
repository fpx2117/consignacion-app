import { prisma } from "@/lib/prisma";
import {
  decryptCode,
  encryptCode,
  generateShortCode,
  hashCode,
} from "@/lib/sharing/share-links";

export const HISTORIAL_SHARE_MAX_VIEWS = 15;
export const HISTORIAL_SHARE_EXPIRY_MS = 24 * 60 * 60 * 1000;

const HISTORIAL_TARGET_FACTOR = 1_000_000;

export type HistorialPeriod = {
  anio: number;
  mes: number;
};

export type HistorialShareTarget = HistorialPeriod & {
  isLegacy: boolean;
  sucursalId: number | null;
};

export function getHistorialDefaultYear(): number {
  return new Date().getFullYear();
}

export function parseHistorialPeriod(id: string, requestUrl: string): HistorialPeriod {
  const searchParams = new URL(requestUrl).searchParams;
  const mes = Number.parseInt(id, 10);
  const anio = Number.parseInt(
    searchParams.get("anio") ?? String(getHistorialDefaultYear()),
    10
  );

  return { anio, mes };
}

export function isValidHistorialPeriod(period: HistorialPeriod): boolean {
  return (
    Number.isFinite(period.mes) &&
    period.mes >= 0 &&
    period.mes <= 11 &&
    Number.isFinite(period.anio) &&
    period.anio >= 2000 &&
    period.anio <= 2100
  );
}

export function encodeHistorialShareTarget(
  period: HistorialPeriod & { sucursalId: number }
): number {
  return period.sucursalId * HISTORIAL_TARGET_FACTOR + period.anio * 100 + period.mes;
}

export function decodeHistorialShareTarget(targetId: number): HistorialShareTarget | null {
  if (!Number.isInteger(targetId) || targetId < 0) {
    return null;
  }

  const isLegacy = targetId < HISTORIAL_TARGET_FACTOR;
  const periodTarget = isLegacy ? targetId : targetId % HISTORIAL_TARGET_FACTOR;
  const anio = Math.floor(periodTarget / 100);
  const mes = periodTarget % 100;
  const sucursalId = isLegacy ? null : Math.floor(targetId / HISTORIAL_TARGET_FACTOR);

  const decoded = { anio, mes, sucursalId, isLegacy };
  return isValidHistorialPeriod(decoded) ? decoded : null;
}

export async function getOrCreateHistorialShareUrl(input: {
  anio: number;
  mes: number;
  sucursalId: number;
}): Promise<string> {
  const targetId = encodeHistorialShareTarget(input);
  const now = new Date();

  const existing = await prisma.shareLink.findFirst({
    where: {
      type: "HISTORIAL_INVENTARIO",
      targetId,
      expiresAt: { gt: now },
      views: { lt: HISTORIAL_SHARE_MAX_VIEWS },
      maxViews: HISTORIAL_SHARE_MAX_VIEWS,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return `/x/${decryptCode(existing.codeEnc)}`;
  }

  for (let attempt = 0; attempt < HISTORIAL_SHARE_MAX_VIEWS; attempt += 1) {
    const code = generateShortCode(8);
    const codeHash = hashCode(code);

    const used = await prisma.shareLink.findUnique({ where: { codeHash } });
    if (used) {
      continue;
    }

    await prisma.shareLink.create({
      data: {
        codeHash,
        codeEnc: encryptCode(code),
        type: "HISTORIAL_INVENTARIO",
        targetId,
        expiresAt: new Date(Date.now() + HISTORIAL_SHARE_EXPIRY_MS),
        maxViews: HISTORIAL_SHARE_MAX_VIEWS,
      },
    });

    return `/x/${code}`;
  }

  throw new Error("No se pudo generar un codigo de historial unico");
}
