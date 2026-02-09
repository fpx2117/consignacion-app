// src/lib/ticket-url.ts
import { joinUrl } from "./url";

export function buildTicketPdfUrl(id: number | string, token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_API_URL || "";
  // Path interno correcto (SIN host adentro)
  const path = `/ver/ticket/${id}?token=${encodeURIComponent(token)}`;

  // Si no hay base (ej. dev raro), devolvemos relativo
  if (!base) return path;

  return joinUrl(base, path);
}
