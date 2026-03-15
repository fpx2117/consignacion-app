export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/[\r\n]+/g, " ").trim();
}

export function formatDateAR(
  date?: string | Date | null,
  withTime = false,
  tz = "America/Argentina/Buenos_Aires",
): string {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: tz,
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  return withTime
    ? parsed.toLocaleString("es-AR", opts)
    : parsed.toLocaleDateString("es-AR", opts);
}

export function formatMoneyARS(amount: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  }).format(amount);
}

export function formatNumberAR(amount: number): string {
  return new Intl.NumberFormat("es-AR").format(amount);
}

export function brandInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "A";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "D";
  return `${first}${second}`.toUpperCase();
}
