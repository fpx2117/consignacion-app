import type { DescuentoNivel } from "@/lib/types";

export function getBestDiscount(
  descuentos: DescuentoNivel[] | null | undefined,
  qty: number,
): DescuentoNivel | null {
  if (!descuentos || !Array.isArray(descuentos) || descuentos.length === 0) {
    return null;
  }

  const sorted = [...descuentos].sort((a, b) => b.cantidadMin - a.cantidadMin);
  return sorted.find((discount) => qty >= discount.cantidadMin) ?? null;
}

export function getNextDiscount(
  descuentos: DescuentoNivel[] | null | undefined,
  qty: number,
): DescuentoNivel | null {
  if (!descuentos || !Array.isArray(descuentos) || descuentos.length === 0) {
    return null;
  }

  const sorted = [...descuentos].sort((a, b) => a.cantidadMin - b.cantidadMin);
  return sorted.find((discount) => qty < discount.cantidadMin) ?? null;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}
