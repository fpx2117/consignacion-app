import { validatePasswordStrength } from "@/lib/validators/password";

const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

type Input = {
  admin?: { nombre?: unknown; email?: unknown; password?: unknown };
  staff?: Array<{ email?: string; password?: string }>;
  branding?: { logoData?: unknown; logoMime?: unknown };
};

function base64Size(value: string): number | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0)
    return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function hasExpectedSignature(data: string, mime: string): boolean {
  const bytes = Buffer.from(data, "base64");
  if (mime === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png")
    return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  return (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function validateSetupSecurity(input: Input): string | null {
  const { admin, staff, branding } = input;
  if (
    typeof admin?.nombre !== "string" ||
    !admin.nombre.trim() ||
    admin.nombre.length > 120 ||
    typeof admin.email !== "string" ||
    admin.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email) ||
    typeof admin.password !== "string"
  )
    return "Faltan datos del administrador";
  const adminPassword = validatePasswordStrength(admin.password);
  if (!adminPassword.valid) return adminPassword.errors.join(". ");
  if (staff !== undefined && (!Array.isArray(staff) || staff.length > 100))
    return "Lista de empleados inválida";
  if (branding?.logoData) {
    if (typeof branding.logoData !== "string") return "Logo inválido";
    const size = base64Size(branding.logoData);
    if (
      typeof branding.logoMime !== "string" ||
      !ALLOWED_LOGO_TYPES.has(branding.logoMime) ||
      size === null ||
      size > MAX_LOGO_BYTES ||
      !hasExpectedSignature(branding.logoData, branding.logoMime)
    )
      return "Logo inválido o mayor a 5 MB";
  }
  for (const member of staff ?? []) {
    if (
      member.password?.trim() &&
      !validatePasswordStrength(member.password).valid
    )
      return `Contraseña inválida para ${member.email || "un empleado"}`;
  }
  return null;
}
