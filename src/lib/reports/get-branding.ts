import { prisma } from "@/lib/prisma";

export type BrandingDTO = {
  businessName: string;
  logoUrl: string | null; // ✅ URL interna al logo
  primaryColor: string;
  footerText: string | null;
  phone: string | null;
  address: string | null;
};

const DEFAULT_BRANDING: BrandingDTO = {
  businessName: "Consignación",
  logoUrl: null,
  primaryColor: "#294c98",
  footerText: null,
  phone: null,
  address: null,
};

function normalizeString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

export async function getBranding(): Promise<BrandingDTO> {
  // ✅ Traemos el branding más reciente
  const branding = await prisma.branding.findFirst({
    orderBy: { updatedAt: "desc" },
  });

  if (!branding) return DEFAULT_BRANDING;

  // ✅ Base URL absoluta (para Puppeteer PDF)
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000";

  // ✅ Si hay logo guardado en DB → usamos endpoint interno
  const logoUrl = branding.logoData
    ? `${baseUrl}/api/settings/branding/logo`
    : null;

  return {
    businessName:
      normalizeString(branding.businessName) ??
      DEFAULT_BRANDING.businessName,

    // ✅ Ya no usamos branding.logoUrl de DB
    logoUrl,

    primaryColor:
      normalizeString(branding.primaryColor) ??
      DEFAULT_BRANDING.primaryColor,

    footerText: normalizeString(branding.footerText),
    phone: normalizeString(branding.phone),
    address: normalizeString(branding.address),
  };
}
