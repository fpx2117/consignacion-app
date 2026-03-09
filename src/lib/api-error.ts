import { NextResponse } from "next/server";

/**
 * Retorna una respuesta de error segura sin filtrar detalles internos.
 * Loguea el error completo en el servidor para debugging.
 *
 * @param error - El error capturado
 * @param publicMessage - Mensaje genérico seguro para el cliente
 * @param status - Código HTTP (default: 500)
 */
export function safeErrorResponse(
  error: unknown,
  publicMessage: string,
  status: number = 500
) {
  // Loguear el error completo en el servidor para debugging
  console.error(`[API Error] ${publicMessage}:`, error);

  // Retornar solo un mensaje genérico al cliente
  return NextResponse.json(
    { error: publicMessage },
    { status }
  );
}
