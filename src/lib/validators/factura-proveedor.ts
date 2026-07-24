import { z } from "zod";

// Edición manual de la cabecera de una factura de proveedor antes de
// confirmarla — corrige lo que la IA/OCR haya leído mal (proveedor, número,
// fecha, moneda, total). Todos los campos son opcionales (PATCH parcial).
export const updateFacturaProveedorSchema = z.object({
  proveedorId: z.number().int().positive().nullable().optional(),
  proveedorNombreDetectado: z.string().trim().max(200).nullable().optional(),
  proveedorCuitDetectado: z.string().trim().max(50).nullable().optional(),
  numeroFactura: z.string().trim().max(100).nullable().optional(),
  fecha: z.string().trim().min(1).nullable().optional(),
  moneda: z.string().trim().min(1).max(10).optional(),
  totalDetectado: z.number().nonnegative().nullable().optional(),
});

export type UpdateFacturaProveedorInput = z.infer<
  typeof updateFacturaProveedorSchema
>;

// Shape del snapshot que process/route.ts guarda en FacturaProveedor.valoresIaOriginal
// — mismo subconjunto de campos que este schema permite editar (menos proveedorId,
// que es un FK interno y no un dato leído del comprobante), derivado con .pick()
// para que no pueda divergir en silencio de lo que realmente es editable.
export const facturaValoresIaOriginalSchema = updateFacturaProveedorSchema
  .pick({
    proveedorNombreDetectado: true,
    proveedorCuitDetectado: true,
    numeroFactura: true,
    fecha: true,
    moneda: true,
    totalDetectado: true,
  })
  .required();

export type FacturaValoresIaOriginal = z.infer<
  typeof facturaValoresIaOriginalSchema
>;
