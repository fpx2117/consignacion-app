/**
 * Server-side password strength validation.
 * Enforces minimum security requirements for user passwords.
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const MIN_LENGTH = 8;

export function validatePasswordStrength(
  password: string,
): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== "string") {
    return { valid: false, errors: ["La contraseña es requerida"] };
  }

  if (password.length < MIN_LENGTH) {
    errors.push(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("La contraseña debe contener al menos una letra mayúscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("La contraseña debe contener al menos una letra minúscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("La contraseña debe contener al menos un número");
  }

  return { valid: errors.length === 0, errors };
}
