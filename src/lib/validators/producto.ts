import { z } from "zod";

export const createProductoSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  precioVenta: z.coerce.number().nonnegative("El precio no puede ser negativo"),
  precioCosto: z.coerce.number().nonnegative("El costo no puede ser negativo"),
  stockDisponibleUnits: z.coerce.number().int().nonnegative().default(0),
  // CAMBIO AQUÍ: Agregamos .nullable() para aceptar el valor null de la DB/Frontend
  packSizeUnits: z.coerce.number().int().positive().nullable().optional(),
});

export const updateProductoSchema = createProductoSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "Debe enviar al menos un campo para actualizar."
);