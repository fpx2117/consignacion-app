import { validatePasswordStrength } from "@/lib/validators/password";

export function validatePrimaryColor(value: unknown): string | null {
  if (value === undefined) return null;
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? null
    : "Color inválido";
}

export function validateSetupStaff(staff: unknown): string | null {
  if (staff === undefined) return null;
  if (!Array.isArray(staff) || staff.length > 100)
    return "Lista de empleados inválida";
  for (const member of staff) {
    if (!member || typeof member !== "object" || Array.isArray(member))
      return "Lista de empleados inválida";
    const { nombre, email, password } = member as Record<string, unknown>;
    if (
      typeof nombre !== "string" ||
      !nombre.trim() ||
      nombre.length > 120 ||
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (password !== undefined && typeof password !== "string")
    )
      return "Empleado inválido";
    if (password?.trim() && !validatePasswordStrength(password).valid)
      return `Contraseña inválida para ${email}`;
  }
  return null;
}
