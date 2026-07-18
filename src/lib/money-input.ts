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
  // Los campos Decimal de Prisma (precioCosto/precioUnitario, etc.) serializan
  // como string sobre JSON (Decimal.prototype.toJSON hace toString()), aunque
  // los tipos de apiService.ts digan `number` — sin este Number(), un valor
  // así rompía acá con "toFixed is not a function" (ver factura-proveedor-dialog
  // -> initialValuesParaNuevoProducto, que no siempre convierte antes de pasarlo).
  return Number(valor).toFixed(2);
}
