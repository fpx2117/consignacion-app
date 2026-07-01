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

export type UpdateFacturaProveedorInput = z.infer<typeof updateFacturaProveedorSchema>;
