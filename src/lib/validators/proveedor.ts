import { z } from "zod";

export const createProveedorSchema = z.object({
  nombre: z.string().min(2, "El nombre es requerido"),
  cuit: z.string().min(1).optional(),
  monedaPreferida: z.string().min(1).default("ARS"),
});

export const updateProveedorSchema = createProveedorSchema
  .partial()
  .extend({ activo: z.boolean().optional() })
  .refine((d) => Object.keys(d).length > 0, "Debe enviar al menos un campo.");

export type CreateProveedorInput = z.infer<typeof createProveedorSchema>;
export type UpdateProveedorInput = z.infer<typeof updateProveedorSchema>;
