// src/lib/money-input.ts
// Máscara de dinero estilo "caja registradora" para inputs de costo/precio:
// el usuario solo tipea dígitos y el punto decimal se inserta solo, tomando
// los últimos dos dígitos tipeados como centavos. Se re-deriva de TODO el
// texto del campo en cada cambio (no solo la tecla presionada), así que
// funciona igual de bien escribiendo hacia adelante o borrando con backspace.
// Requiere que el <Input> sea type="text" inputMode="decimal" (un
// type="number" nativo no permite este tipo de reformateo en vivo).

export function digitosAMonto(valorCrudo: string): number | null {
  const digitos = valorCrudo.replace(/\D/g, "");
  if (!digitos) return null;
  return Number(digitos) / 100;
}

export function formatearInputMonto(valor: number | null | undefined): string {
  if (valor == null) return "";
  return valor.toFixed(2);
}
