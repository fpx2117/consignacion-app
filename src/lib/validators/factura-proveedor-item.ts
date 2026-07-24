import { z } from "zod";

export const confirmarItemSchema = z.object({
  productoId: z.number().int().positive(),
});

export type ConfirmarItemInput = z.infer<typeof confirmarItemSchema>;

// Edición manual de un item antes de confirmarlo — corrige lo que la IA/OCR
// haya leído mal. Todos los campos son opcionales (PATCH parcial); si no se
// manda nada no hay error, simplemente no cambia nada.
export const updateFacturaProveedorItemSchema = z.object({
  textoOriginal: z.string().trim().min(1).max(500).optional(),
  codigoProveedor: z.string().trim().max(100).nullable().optional(),
  cantidad: z.number().int().positive().optional(),
  precioUnitario: z.number().nonnegative().nullable().optional(),
  totalLinea: z.number().nonnegative().nullable().optional(),
});

export type UpdateFacturaProveedorItemInput = z.infer<
  typeof updateFacturaProveedorItemSchema
>;

// Shape del snapshot que process/route.ts guarda en FacturaProveedorItem.valoresIaOriginal
// — mismo set de campos que este schema permite editar, derivado con .pick() para
// que no pueda divergir en silencio de lo que realmente es editable.
export const facturaItemValoresIaOriginalSchema =
  updateFacturaProveedorItemSchema.required();

export type FacturaItemValoresIaOriginal = z.infer<
  typeof facturaItemValoresIaOriginalSchema
>;
