// src/lib/ocr/parse-factura.ts
// Heurística de parseo de texto OCR de una factura: separa líneas de producto
// (nombre + cantidad + precio) del resto del contenido (encabezados, totales, etc).

export type FacturaLineaDetectada = {
  textoOriginal: string;
  nombreDetectado: string;
  cantidadDetectada: number | null;
  precioDetectado: number | null;
};

const PALABRAS_EXCLUIDAS = [
  "cuit",
  "fecha",
  "total",
  "subtotal",
  "iva",
  "factura",
  "remito",
  "razon social",
  "razón social",
  "domicilio",
  "condicion de venta",
  "condición de venta",
  "cae",
  "vencimiento",
  "cliente",
  "proveedor",
  "página",
  "pagina",
  "codigo",
  "código",
  "descripcion",
  "descripción",
  "cantidad",
  "precio",
  "importe",
];

// Número con separador de miles (.) y/o decimales (,) al estilo AR, o formato simple con punto decimal.
// El grupo de miles requiere al menos una repetición (`+`) para no comerse de a 3 dígitos
// los números planos sin separador (ej. "1200,00"), que deben caer en la segunda alternativa.
const NUMERO_REGEX = /(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;

function esLineaExcluida(lineaLower: string): boolean {
  return PALABRAS_EXCLUIDAS.some((palabra) => lineaLower.includes(palabra));
}

function normalizarNumero(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;

  // Si tiene coma y punto, asumimos formato AR: punto = miles, coma = decimal.
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    // Solo coma: coma decimal.
    s = s.replace(",", ".");
  }
  // Solo punto: puede ser miles o decimal, se deja tal cual (Number lo interpreta como decimal).

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseFacturaTexto(texto: string): FacturaLineaDetectada[] {
  if (!texto || !texto.trim()) return [];

  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const resultado: FacturaLineaDetectada[] = [];

  for (const linea of lineas) {
    const lower = linea.toLowerCase();

    if (esLineaExcluida(lower)) continue;

    const numeros = linea.match(NUMERO_REGEX);
    // Sin al menos un número, no hay forma de inferir cantidad o precio: se descarta.
    if (!numeros || numeros.length === 0) continue;

    // El nombre es el texto previo a la primera coincidencia numérica.
    const primerNumeroIdx = linea.search(NUMERO_REGEX);
    const nombreDetectado = linea.slice(0, primerNumeroIdx).replace(/[-–—:.]+$/, "").trim();

    if (nombreDetectado.length < 2) continue;

    // Heurística: último número = precio, penúltimo (si existe y es entero chico) = cantidad.
    const valores = numeros.map(normalizarNumero).filter((n): n is number => n !== null);
    if (valores.length === 0) continue;

    const precioDetectado = valores.length > 0 ? valores[valores.length - 1] : null;
    const posibleCantidad = valores.length > 1 ? valores[0] : null;
    const cantidadDetectada =
      posibleCantidad !== null && Number.isInteger(posibleCantidad) && posibleCantidad > 0 && posibleCantidad < 10000
        ? posibleCantidad
        : null;

    resultado.push({
      textoOriginal: linea,
      nombreDetectado,
      cantidadDetectada: cantidadDetectada ?? 1,
      precioDetectado,
    });
  }

  return resultado;
}
