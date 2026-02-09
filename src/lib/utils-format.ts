export function formatNumber(n: number) {
  return new Intl.NumberFormat("es-AR").format(n);
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}