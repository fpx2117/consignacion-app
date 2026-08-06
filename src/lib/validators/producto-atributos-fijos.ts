// src/lib/validators/producto-atributos-fijos.ts
//
// Validación de atributosExtra contra el catálogo de atributos fijos del
// rubro activo (src/modules/invoices/config/rubro-atributos.ts).
//
// Deliberadamente separada de createProductoSchema/updateProductoSchema:
// ese schema Zod también lo usa la creación de producto desde OCR de
// facturas (create-product/route.ts), donde exigir atributos fijos
// bloquearía altas legítimas cuando la IA no detectó un campo. Esta
// validación solo se invoca explícitamente desde los endpoints de alta/
// edición MANUAL de producto (POST /api/productos, PUT /api/productos/[id]).
import {
  getAtributosFijos,
  type AtributoFijoDef,
} from "@/modules/invoices/config/rubro-atributos";

export interface AtributosFijosValidationError {
  fieldErrors: { atributosExtra: string[] };
}

function esNumeroValido(valor: string): boolean {
  return valor.trim() !== "" && Number.isFinite(Number(valor));
}

function esFechaValida(valor: string): boolean {
  return !Number.isNaN(new Date(valor).getTime());
}

function validarValorAtributo(
  def: AtributoFijoDef,
  valor: string,
): string | null {
  switch (def.tipo) {
    case "numero":
      return esNumeroValido(valor) ? null : `"${def.label}" debe ser un número`;
    case "fecha":
      return esFechaValida(valor)
        ? null
        : `"${def.label}" debe ser una fecha válida`;
    case "seleccion":
      return !def.opciones || def.opciones.includes(valor)
        ? null
        : `"${def.label}" debe ser una de: ${def.opciones.join(", ")}`;
    case "texto":
    default:
      return null;
  }
}

/**
 * Valida atributosExtra contra los atributos fijos definidos para el rubro.
 *
 * Devuelve null si no hay nada que reportar (incluye el caso de rubro sin
 * catálogo fijo definido — ver getAtributosFijos). `atributosExtra` ausente
 * o null se trata como objeto vacío: los atributos requeridos igual se
 * exigen, los opcionales simplemente no están.
 */
export function validarAtributosFijosProducto(
  atributosExtra: Record<string, string> | null | undefined,
  rubroNegocio: string | null | undefined,
): AtributosFijosValidationError | null {
  const definiciones = getAtributosFijos(rubroNegocio);
  if (definiciones.length === 0) return null;

  const valores = atributosExtra ?? {};
  const errores: string[] = [];

  for (const def of definiciones) {
    const valor = valores[def.clave];
    const presente = typeof valor === "string" && valor.trim() !== "";

    if (!presente) {
      if (def.requerido) {
        errores.push(`"${def.label}" es requerido para este rubro`);
      }
      continue;
    }

    const errorTipo = validarValorAtributo(def, valor);
    if (errorTipo) errores.push(errorTipo);
  }

  if (errores.length === 0) return null;
  return { fieldErrors: { atributosExtra: errores } };
}
