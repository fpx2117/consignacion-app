import { prisma } from "@/lib/prisma";
import { REPORT_COLORS } from "@/lib/reports/report-theme";
import type { BrandingDTO } from "@/lib/reports/types";

type BrandingRecord = {
  businessName?: string | null;
  logoData?: Buffer | Uint8Array | null;
  primaryColor?: string | null;
  footerText?: string | null;
  phone?: string | null;
  address?: string | null;
};

const DEFAULT_BRANDING: BrandingDTO = {
  businessName: "Consignación",
  logoUrl: null,
  logoBase64: null,
  primaryColor: REPORT_COLORS.brandDefault,
  footerText: null,
  phone: null,
  address: null,
};

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

/** Detecta el MIME type leyendo los magic bytes del buffer */
function detectMime(buf: Buffer): string {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "image/webp";
  return "image/png"; // fallback seguro
}

export async function getBranding(sucursalId?: number): Promise<BrandingDTO> {
  const branding = await prisma.branding.findFirst({
    where: sucursalId ? { sucursalId } : undefined,
    orderBy: { updatedAt: "desc" },
  });

  if (!branding) {
    // Si no hay branding para esa sucursal, intentamos el más reciente de cualquier sucursal
    // o simplemente retornamos el default.
    const fallback = sucursalId
      ? await prisma.branding.findFirst({ orderBy: { updatedAt: "desc" } })
      : null;

    if (!fallback) return DEFAULT_BRANDING;
    return mapToDTO(fallback);
  }

  return mapToDTO(branding);
}

function mapToDTO(branding: BrandingRecord): BrandingDTO {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  // URL HTTP — para uso en el frontend
  const logoUrl = branding.logoData
    ? `${baseUrl}/api/settings/branding/logo`
    : null;

  // Base64 inline — para Puppeteer PDF (no depende de la red)
  let logoBase64: string | null = null;
  if (branding.logoData) {
    const buf = Buffer.isBuffer(branding.logoData)
      ? branding.logoData
      : Buffer.from(branding.logoData as unknown as ArrayBuffer);
    const mime = detectMime(buf);
    logoBase64 = `data:${mime};base64,${buf.toString("base64")}`;
  }

  return {
    businessName:
      normalizeString(branding.businessName) ?? DEFAULT_BRANDING.businessName,
    logoUrl,
    logoBase64,
    primaryColor:
      normalizeString(branding.primaryColor) ?? DEFAULT_BRANDING.primaryColor,
    footerText: normalizeString(branding.footerText),
    phone: normalizeString(branding.phone),
    address: normalizeString(branding.address),
  };
}
